const { pool, query } = require("../config/db");
const { postQueue } = require("../config/queue");
const { normalizePlatform } = require("../utils/platforms");
const { httpError } = require("../utils/httpError");

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

async function assertClientAccess(userId, clientId) {
  const result = await query(
    `SELECT 1
     FROM clients c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE c.id = $1 AND wm.user_id = $2`,
    [clientId, userId]
  );

  if (result.rowCount === 0) {
    throw httpError("Client not found", 404);
  }
}

async function insertApprovalEvent(client, { postId, actorUserId, action, fromStatus, toStatus, note }) {
  await client.query(
    `INSERT INTO post_approval_events (post_id, actor_user_id, action, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [postId, actorUserId, action, fromStatus || null, toStatus || null, note || null]
  );
}

async function createPostForClient(userId, clientId, payload) {
  await assertClientAccess(userId, clientId);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const postResult = await client.query(
      `INSERT INTO posts (user_id, client_id, content, media_url, hashtags, scheduled_time, approval_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        clientId,
        payload.content,
        payload.mediaUrl || null,
        payload.hashtags || [],
        payload.scheduledTime || null,
        "draft",
        "draft"
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
      toStatus: "draft",
      note: null
    });

    await client.query("COMMIT");
    return getPostByIdForUser(userId, post.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getPostsByClient(userId, clientId) {
  await assertClientAccess(userId, clientId);
  const result = await query(
    `SELECT
       p.id,
       p.client_id,
       p.content,
       p.media_url,
       p.hashtags,
       p.scheduled_time,
       p.approval_status,
       p.approval_requested_at,
       p.approved_at,
       p.approved_by,
       p.status,
       p.created_at,
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
     ORDER BY p.created_at DESC`,
    [clientId]
  );

  return result.rows;
}

async function getPostByIdForUser(userId, postId) {
  const result = await query(
    `SELECT
       p.id,
       p.client_id,
       p.content,
       p.media_url,
       p.hashtags,
       p.scheduled_time,
       p.approval_status,
       p.approval_requested_at,
       p.approved_at,
       p.approved_by,
       p.status,
       p.created_at,
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
     JOIN clients c ON c.id = p.client_id
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE wm.user_id = $1 AND p.id = $2
     GROUP BY p.id`,
    [userId, postId]
  );

  return result.rows[0] || null;
}

async function getPostsByUser(userId) {
  const clientId = await getDefaultClientIdForUser(userId);
  return getPostsByClient(userId, clientId);
}

async function updatePost(userId, postId, patch) {
  const existing = await getPostByIdForUser(userId, postId);
  if (!existing) {
    throw httpError("Post not found", 404);
  }

  if (existing.status === "publishing" || existing.status === "published") {
    throw httpError("Cannot edit a post that is publishing or published", 409);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const nextContent = patch.content ?? existing.content;
    const nextMediaUrl = patch.mediaUrl === "" ? null : (patch.mediaUrl ?? existing.media_url);
    const nextHashtags = patch.hashtags ?? existing.hashtags;
    const nextScheduledTime = patch.scheduledTime ?? existing.scheduled_time;

    // Editing an approved post invalidates approval and returns it to needs_approval.
    let nextApprovalStatus = existing.approval_status;
    let nextPublishStatus = existing.status;
    if (existing.approval_status === "approved") {
      nextApprovalStatus = "needs_approval";
      nextPublishStatus = "draft";
    }

    const updated = await client.query(
      `UPDATE posts
       SET content = $2,
           media_url = $3,
           hashtags = $4,
           scheduled_time = $5,
           approval_status = $6,
           approved_at = CASE WHEN $6 = 'approved' THEN approved_at ELSE NULL END,
           approved_by = CASE WHEN $6 = 'approved' THEN approved_by ELSE NULL END,
           status = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [postId, nextContent, nextMediaUrl, nextHashtags, nextScheduledTime, nextApprovalStatus, nextPublishStatus]
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
      note: null
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

async function approvePost(userId, postId, note) {
  const existing = await getPostByIdForUser(userId, postId);
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
      [postId, userId, nextStatus]
    );

    await client.query(
      `UPDATE post_targets
       SET publish_status = 'queued', updated_at = NOW()
       WHERE post_id = $1`,
      [postId]
    );

    await insertApprovalEvent(client, {
      postId,
      actorUserId: userId,
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

    return getPostByIdForUser(userId, postId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rejectPost(userId, postId, note) {
  const existing = await getPostByIdForUser(userId, postId);
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
      actorUserId: userId,
      action: "rejected",
      fromStatus: existing.approval_status,
      toStatus: "rejected",
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

module.exports = {
  approvePost,
  createPost: async (userId, payload) => {
    const clientId = await getDefaultClientIdForUser(userId);
    return createPostForClient(userId, clientId, payload);
  },
  createPostForClient,
  getPostsByUser,
  getPostsByClient,
  getPostById: getPostByIdForUser,
  getPostByIdForUser,
  rejectPost,
  requestApproval,
  updatePost
};
