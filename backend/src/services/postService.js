const { pool, query } = require("../config/db");
const { postQueue } = require("../config/queue");
const { normalizePlatform } = require("../utils/platforms");
const { httpError } = require("../utils/httpError");
const { assertClientAccess } = require("./accessService");
const { generateDrafts: generateAutopilotDrafts } = require("./autopilotService");
const { resolveMediaForPost } = require("./mediaAssetService");

function normalizeTextList(values) {
  return (values || []).map((value) => `${value}`.trim()).filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildGenerationAuditNote(generationSource, phase) {
  if (generationSource === "autopilot_stub") {
    return phase === "requested"
      ? "Autopilot routed this draft to the approvals queue in Safe Mode"
      : "Created by Autopilot v1 stub generator";
  }

  if (generationSource === "autopilot_ai") {
    return phase === "requested"
      ? "Autopilot routed this AI-generated draft to the approvals queue in Safe Mode"
      : "Created by the configured Autopilot provider";
  }

  return null;
}

async function getDefaultClientIdForUser(userId) {
  const result = await query("SELECT default_client_id FROM users WHERE id = $1", [userId]);
  const clientId = result.rows[0]?.default_client_id;
  if (!clientId) {
    throw httpError("Default client is not configured for this user", 500);
  }
  return clientId;
}

async function resolveDefaultSocialAccountId(client, clientId, platform) {
  const result = await client.query(
    `SELECT id
     FROM social_accounts
     WHERE client_id = $1 AND platform = $2
     ORDER BY updated_at DESC
     LIMIT 1`,
    [clientId, platform]
  );

  return result.rows[0]?.id || null;
}

async function insertApprovalEvent(client, { postId, actorUserId, actorLabel, action, fromStatus, toStatus, note }) {
  await client.query(
    `INSERT INTO post_approval_events (post_id, actor_user_id, actor_label, action, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [postId, actorUserId || null, actorLabel || null, action, fromStatus || null, toStatus || null, note || null]
  );
}

async function getApprovalEvents(postId) {
  const result = await query(
    `SELECT
       e.id,
       e.action,
       e.from_status,
       e.to_status,
       e.note,
       e.created_at,
       e.actor_user_id,
       COALESCE(u.email, e.actor_label, 'System') AS actor
     FROM post_approval_events e
     LEFT JOIN users u ON u.id = e.actor_user_id
     WHERE e.post_id = $1
     ORDER BY e.created_at ASC`,
    [postId]
  );

  return result.rows;
}

async function getClientStrategy(clientId) {
  const result = await query(
    `SELECT
       id,
       workspace_id,
       name,
       brand_voice_notes,
       content_do,
       content_dont,
       content_pillars,
       cta_style,
       default_hashtags,
       banned_terms,
       required_disclaimer
     FROM clients
     WHERE id = $1`,
    [clientId]
  );

  const row = result.rows[0];
  if (!row) {
    throw httpError("Client not found", 404);
  }

  return {
    ...row,
    brand_voice_notes: row.brand_voice_notes || "",
    content_do: normalizeTextList(row.content_do),
    content_dont: normalizeTextList(row.content_dont),
    content_pillars: normalizeTextList(row.content_pillars),
    cta_style: row.cta_style || "",
    default_hashtags: normalizeTextList(row.default_hashtags),
    banned_terms: normalizeTextList(row.banned_terms),
    required_disclaimer: row.required_disclaimer || ""
  };
}

function evaluateRiskChecks(content, strategy) {
  const flags = [];
  const normalizedContent = `${content || ""}`.toLowerCase();

  const matchedTerms = normalizeTextList(strategy.banned_terms).filter((term) => {
    const escaped = escapeRegExp(term.toLowerCase());
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(normalizedContent);
  });

  if (matchedTerms.length) {
    flags.push(`Contains banned terms: ${matchedTerms.join(", ")}`);
  }

  const requiredDisclaimer = `${strategy.required_disclaimer || ""}`.trim();
  if (requiredDisclaimer && !normalizedContent.includes(requiredDisclaimer.toLowerCase())) {
    flags.push("Missing required disclaimer");
  }

  return flags;
}

async function getPostSummaryById(postId) {
  const result = await query(
    `SELECT
       p.id,
       p.client_id,
       p.media_asset_id,
       p.content,
       p.media_url,
       p.hashtags,
       p.risk_flags,
       p.generation_source,
       p.scheduled_time,
       p.approval_status,
       p.approval_requested_at,
       p.approved_at,
       p.approved_by,
       p.status,
       p.created_at,
       p.updated_at,
       c.name AS client_name,
       c.workspace_id,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'platform', pt.platform,
             'socialAccountId', pt.social_account_id,
             'publishStatus', pt.publish_status,
             'externalPostId', pt.external_post_id,
             'errorMessage', pt.error_message
           )
         ) FILTER (WHERE pt.id IS NOT NULL),
         '[]'
       ) AS targets
     FROM posts p
     JOIN clients c ON c.id = p.client_id
     LEFT JOIN post_targets pt ON pt.post_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, c.name, c.workspace_id`,
    [postId]
  );

  return result.rows[0] || null;
}

async function getPostDetailById(postId) {
  const post = await getPostSummaryById(postId);
  if (!post) {
    return null;
  }

  return {
    ...post,
    events: await getApprovalEvents(postId)
  };
}

async function getPostByIdForUser(userId, postId) {
  const summary = await getPostSummaryById(postId);
  if (!summary) {
    return null;
  }

  await assertClientAccess(userId, summary.client_id);
  return {
    ...summary,
    events: await getApprovalEvents(postId)
  };
}

async function getPostByIdForClient(clientId, postId) {
  const summary = await getPostSummaryById(postId);
  if (!summary || summary.client_id !== clientId) {
    return null;
  }

  return {
    ...summary,
    events: await getApprovalEvents(postId)
  };
}

async function getPostsByClient(userId, clientId) {
  await assertClientAccess(userId, clientId);
  const result = await query(
    `SELECT
       p.id,
       p.client_id,
       p.media_asset_id,
       p.content,
       p.media_url,
       p.hashtags,
       p.risk_flags,
       p.generation_source,
       p.scheduled_time,
       p.approval_status,
       p.approval_requested_at,
       p.approved_at,
       p.approved_by,
       p.status,
       p.created_at,
       p.updated_at,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'platform', pt.platform,
             'socialAccountId', pt.social_account_id,
             'publishStatus', pt.publish_status,
             'externalPostId', pt.external_post_id,
             'errorMessage', pt.error_message
           )
         ) FILTER (WHERE pt.id IS NOT NULL),
         '[]'
       ) AS targets
     FROM posts p
     LEFT JOIN post_targets pt ON pt.post_id = p.id
     WHERE p.client_id = $1
     GROUP BY p.id
     ORDER BY COALESCE(p.approval_requested_at, p.created_at) DESC, p.created_at DESC`,
    [clientId]
  );

  return result.rows;
}

async function getPendingApprovalPostsByClient(clientId) {
  const result = await query(
    `SELECT
       p.id,
       p.client_id,
       p.media_asset_id,
       p.content,
       p.media_url,
       p.hashtags,
       p.risk_flags,
       p.generation_source,
       p.scheduled_time,
       p.approval_status,
       p.approval_requested_at,
       p.approved_at,
       p.approved_by,
       p.status,
       p.created_at,
       p.updated_at,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'platform', pt.platform,
             'socialAccountId', pt.social_account_id,
             'publishStatus', pt.publish_status,
             'externalPostId', pt.external_post_id,
             'errorMessage', pt.error_message
           )
         ) FILTER (WHERE pt.id IS NOT NULL),
         '[]'
       ) AS targets
     FROM posts p
     LEFT JOIN post_targets pt ON pt.post_id = p.id
     WHERE p.client_id = $1 AND p.approval_status = 'needs_approval'
     GROUP BY p.id
     ORDER BY p.approval_requested_at DESC NULLS LAST, p.created_at DESC`,
    [clientId]
  );

  return result.rows;
}

async function getPostsByUser(userId) {
  const clientId = await getDefaultClientIdForUser(userId);
  return getPostsByClient(userId, clientId);
}

async function createPostForClient(userId, clientId, payload) {
  await assertClientAccess(userId, clientId);
  const strategy = await getClientStrategy(clientId);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const media = await resolveMediaForPost(userId, clientId, payload.mediaAssetId || null, payload.mediaUrl || null);
    const approvalStatus = payload.approvalStatus || "draft";
    const publishStatus = payload.status || "draft";
    const riskFlags = Array.isArray(payload.riskFlags)
      ? payload.riskFlags
      : evaluateRiskChecks(payload.content, strategy);
    const generationSource = payload.generationSource || "manual";
    const hashtags = normalizeTextList(payload.hashtags);

    const postResult = await client.query(
      `INSERT INTO posts (user_id, client_id, media_asset_id, content, media_url, hashtags, risk_flags, generation_source, scheduled_time, approval_status, approval_requested_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $10 = 'needs_approval' THEN NOW() ELSE NULL END, $11)
       RETURNING *`,
      [
        userId,
        clientId,
        media.mediaAssetId,
        payload.content,
        media.mediaUrl,
        hashtags,
        riskFlags,
        generationSource,
        payload.scheduledTime || null,
        approvalStatus,
        publishStatus
      ]
    );

    const post = postResult.rows[0];

    for (const rawPlatform of payload.platforms) {
      const platform = normalizePlatform(rawPlatform);
      const socialAccountId = await resolveDefaultSocialAccountId(client, clientId, platform);
      await client.query(
        `INSERT INTO post_targets (post_id, platform, social_account_id, publish_status)
         VALUES ($1, $2, $3, $4)`,
        [post.id, platform, socialAccountId, "pending"]
      );
    }

    await insertApprovalEvent(client, {
      postId: post.id,
      actorUserId: userId,
      action: "created",
      fromStatus: null,
      toStatus: approvalStatus,
      note: buildGenerationAuditNote(generationSource, "created")
    });

    if (approvalStatus === "needs_approval") {
      await insertApprovalEvent(client, {
        postId: post.id,
        actorUserId: userId,
        action: "requested",
        fromStatus: "draft",
        toStatus: "needs_approval",
        note: buildGenerationAuditNote(generationSource, "requested")
      });
    }

    await client.query("COMMIT");
    return getPostByIdForUser(userId, post.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function generateDraftsForClient(userId, clientId, payload) {
  const access = await assertClientAccess(userId, clientId);
  const strategy = await getClientStrategy(clientId);

  const generation = await generateAutopilotDrafts({
    workspaceId: access.workspace_id,
    clientId,
    userId,
    clientName: strategy.name,
    strategy,
    count: payload.count,
    platforms: payload.platforms
  });

  const posts = [];
  for (const draft of generation.drafts) {
    const post = await createPostForClient(userId, clientId, {
      content: draft.content,
      mediaAssetId: null,
      mediaUrl: "",
      hashtags: draft.hashtags?.length ? draft.hashtags : strategy.default_hashtags,
      scheduledTime: null,
      platforms: payload.platforms,
      approvalStatus: "needs_approval",
      status: "draft",
      generationSource: "autopilot_ai"
    });

    posts.push(post);
  }

  return posts;
}


async function updatePost(userId, postId, patch) {
  const existing = await getPostByIdForUser(userId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  if (existing.status === "publishing" || existing.status === "published") {
    throw httpError("Cannot edit a post that is publishing or published", 409);
  }

  const strategy = await getClientStrategy(existing.client_id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const nextContent = patch.content ?? existing.content;
    const nextHashtags = normalizeTextList(patch.hashtags ?? existing.hashtags);
    const nextScheduledTime = patch.scheduledTime ?? existing.scheduled_time;

    const nextMediaAssetId = Object.prototype.hasOwnProperty.call(patch, "mediaAssetId")
      ? patch.mediaAssetId
      : existing.media_asset_id;
    const nextRawMediaUrl = Object.prototype.hasOwnProperty.call(patch, "mediaUrl")
      ? (patch.mediaUrl === "" ? null : patch.mediaUrl)
      : existing.media_url;
    const media = await resolveMediaForPost(userId, existing.client_id, nextMediaAssetId, nextRawMediaUrl);

    let nextApprovalStatus = existing.approval_status;
    let nextPublishStatus = existing.status;
    if (existing.approval_status === "approved") {
      nextApprovalStatus = "needs_approval";
      nextPublishStatus = "draft";
    }

    const nextRiskFlags = evaluateRiskChecks(nextContent, strategy);

    await client.query(
      `UPDATE posts
       SET media_asset_id = $2,
           content = $3,
           media_url = $4,
           hashtags = $5,
           risk_flags = $6,
           scheduled_time = $7,
           approval_status = $8,
           approved_at = CASE WHEN $8 = 'approved' THEN approved_at ELSE NULL END,
           approved_by = CASE WHEN $8 = 'approved' THEN approved_by ELSE NULL END,
           status = $9,
           updated_at = NOW()
       WHERE id = $1`,
      [postId, media.mediaAssetId, nextContent, media.mediaUrl, nextHashtags, nextRiskFlags, nextScheduledTime, nextApprovalStatus, nextPublishStatus]
    );

    if (existing.approval_status === "approved" && nextApprovalStatus !== "approved") {
      await client.query(
        `UPDATE post_targets
         SET publish_status = 'pending', updated_at = NOW()
         WHERE post_id = $1`,
        [postId]
      );
    }

    if (patch.platforms) {
      await client.query("DELETE FROM post_targets WHERE post_id = $1", [postId]);
      for (const rawPlatform of patch.platforms) {
        const platform = normalizePlatform(rawPlatform);
        const socialAccountId = await resolveDefaultSocialAccountId(client, existing.client_id, platform);
        await client.query(
          `INSERT INTO post_targets (post_id, platform, social_account_id, publish_status)
           VALUES ($1, $2, $3, 'pending')`,
          [postId, platform, socialAccountId]
        );
      }
    }

    await insertApprovalEvent(client, {
      postId,
      actorUserId: userId,
      action: "updated",
      fromStatus: existing.approval_status,
      toStatus: nextApprovalStatus,
      note: nextRiskFlags.length ? `Risk checks: ${nextRiskFlags.join("; ")}` : null
    });

    if (existing.approval_status === "approved" && nextApprovalStatus !== "approved") {
      await insertApprovalEvent(client, {
        postId,
        actorUserId: userId,
        action: "unapproved",
        fromStatus: "approved",
        toStatus: nextApprovalStatus,
        note: "Post changed after approval"
      });
    }

    await client.query("COMMIT");
    return getPostByIdForUser(userId, postId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function requestApproval(userId, postId, note) {
  const existing = await getPostByIdForUser(userId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  if (existing.status !== "draft") {
    throw httpError("Only draft posts can be submitted for approval", 409);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE posts
       SET approval_status = 'needs_approval',
           approval_requested_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [postId]
    );

    await insertApprovalEvent(client, {
      postId,
      actorUserId: userId,
      action: "requested",
      fromStatus: existing.approval_status,
      toStatus: "needs_approval",
      note
    });

    await client.query("COMMIT");
    return getPostByIdForUser(userId, postId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function performApprove({ postId, actorUserId, actorLabel, note, resultLoader }) {
  const existing = await getPostDetailById(postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  if (existing.approval_status !== "needs_approval") {
    throw httpError("Post is not awaiting approval", 409);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const delay = existing.scheduled_time
      ? Math.max(new Date(existing.scheduled_time).getTime() - Date.now(), 0)
      : 0;
    const nextStatus = existing.scheduled_time ? "queued" : "publishing";

    await client.query(
      `UPDATE posts
       SET approval_status = 'approved',
           approved_at = NOW(),
           approved_by = $2,
           status = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [postId, actorUserId || null, nextStatus]
    );

    await client.query(
      `UPDATE post_targets
       SET publish_status = 'queued', updated_at = NOW()
       WHERE post_id = $1`,
      [postId]
    );

    await insertApprovalEvent(client, {
      postId,
      actorUserId,
      actorLabel,
      action: "approved",
      fromStatus: existing.approval_status,
      toStatus: "approved",
      note
    });

    await client.query("COMMIT");

    await postQueue.add(
      "publish-post",
      { postId },
      {
        delay,
        removeOnComplete: 50,
        removeOnFail: 100
      }
    );

    return resultLoader();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function performReject({ postId, actorUserId, actorLabel, note, resultLoader }) {
  const existing = await getPostDetailById(postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  if (existing.approval_status !== "needs_approval") {
    throw httpError("Post is not awaiting approval", 409);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE posts
       SET approval_status = 'rejected',
           status = 'draft',
           updated_at = NOW()
       WHERE id = $1`,
      [postId]
    );

    await insertApprovalEvent(client, {
      postId,
      actorUserId,
      actorLabel,
      action: "rejected",
      fromStatus: existing.approval_status,
      toStatus: "rejected",
      note
    });

    await client.query("COMMIT");
    return resultLoader();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addApprovalCommentToPost({ postId, actorUserId, actorLabel, note, resultLoader }) {
  const existing = await getPostDetailById(postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertApprovalEvent(client, {
      postId,
      actorUserId,
      actorLabel,
      action: "commented",
      fromStatus: existing.approval_status,
      toStatus: existing.approval_status,
      note
    });
    await client.query("COMMIT");
    return resultLoader();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function approvePost(userId, postId, note) {
  const existing = await getPostByIdForUser(userId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  return performApprove({
    postId,
    actorUserId: userId,
    note,
    resultLoader: () => getPostByIdForUser(userId, postId)
  });
}

async function rejectPost(userId, postId, note) {
  const existing = await getPostByIdForUser(userId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  return performReject({
    postId,
    actorUserId: userId,
    note,
    resultLoader: () => getPostByIdForUser(userId, postId)
  });
}

async function addApprovalComment(userId, postId, note) {
  const existing = await getPostByIdForUser(userId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  return addApprovalCommentToPost({
    postId,
    actorUserId: userId,
    note,
    resultLoader: () => getPostByIdForUser(userId, postId)
  });
}

async function approvePostForClient(clientId, postId, note, actorLabel) {
  const existing = await getPostByIdForClient(clientId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  return performApprove({
    postId,
    actorLabel,
    note,
    resultLoader: () => getPostByIdForClient(clientId, postId)
  });
}

async function rejectPostForClient(clientId, postId, note, actorLabel) {
  const existing = await getPostByIdForClient(clientId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  return performReject({
    postId,
    actorLabel,
    note,
    resultLoader: () => getPostByIdForClient(clientId, postId)
  });
}

async function addApprovalCommentForClient(clientId, postId, note, actorLabel) {
  const existing = await getPostByIdForClient(clientId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  return addApprovalCommentToPost({
    postId,
    actorLabel,
    note,
    resultLoader: () => getPostByIdForClient(clientId, postId)
  });
}

module.exports = {
  addApprovalComment,
  addApprovalCommentForClient,
  approvePost,
  approvePostForClient,
  createPost: async (userId, payload) => {
    const clientId = await getDefaultClientIdForUser(userId);
    return createPostForClient(userId, clientId, payload);
  },
  createPostForClient,
  generateDraftsForClient,
  getPendingApprovalPostsByClient,
  getPostById: getPostByIdForUser,
  getPostByIdForClient,
  getPostByIdForUser,
  getPostsByClient,
  getPostsByUser,
  rejectPost,
  rejectPostForClient,
  requestApproval,
  updatePost
};
