"use strict";

// Business logic for the Posts domain (B2).
// Every public function returns contract-shaped objects (camelCase).
// Access checks are done here — controllers pass req.user.sub and trust the result.

const { pool, query: pgQuery } = require("../config/db");
const { assertClientAccess }   = require("./accessService");
const { transition }           = require("./post-state-machine.service");

const postsQ       = require("../db/queries/posts.queries");
const targetsQ     = require("../db/queries/post-targets.queries");
const approvalLogsQ = require("../db/queries/approval-logs.queries");
const { Errors }   = require("../utils/ApiError");

// ─── response formatters ─────────────────────────────────────────────────────

function fmtLog(row) {
  return {
    id:        row.id,
    postId:    row.post_id,
    action:    row.action,
    actorId:   row.actor_id,
    actorName: row.actor_name,
    comment:   row.comment,
    createdAt: row.created_at,
  };
}

function fmtPost(row, approvalLog = null) {
  const base = {
    id:                 row.id,
    clientId:           row.client_id,
    workspaceId:        row.workspace_id,
    status:             row.status,
    originalContent:    row.original_content,
    scheduledAt:        row.scheduled_at,
    publishImmediately: row.publish_immediately,
    createdBy: {
      id:        row.created_by_id   ?? null,
      // users table has no name column — email is used as the display name.
      name:      row.created_by_email ?? null,
      avatarUrl: null,
    },
    // targets come back from JSON_AGG already in camelCase (see posts.queries.js)
    targets:    row.targets ?? [],
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };

  if (approvalLog !== null) {
    base.approvalLog = approvalLog.map(fmtLog);
  }

  return base;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// Verify profileIds all belong to clientId. Returns the matching rows.
async function resolveProfiles(db, clientId, profileIds) {
  const found = await targetsQ.findProfilesByIds(db, clientId, profileIds);
  if (found.length !== profileIds.length) {
    throw Errors.socialProfileNotFound();
  }
  return found; // [{ id, platform }]
}

// Fetch a full post or throw 404.
async function fetchFullPost(postId) {
  const row = await postsQ.findPostById(pgQuery, postId);
  if (!row) throw Errors.postNotFound();
  const logs = await approvalLogsQ.findLogsByPost(pgQuery, postId);
  return fmtPost(row, logs);
}

// ─── listPosts ───────────────────────────────────────────────────────────────

async function listPosts(userId, clientId, queryParams) {
  const access = await assertClientAccess(userId, clientId);
  void access; // side-effect: throws CLIENT_NOT_FOUND if no access

  // Contract uses `page` as the cursor param name; query fn uses `cursor` internally.
  const { items, total, nextCursor } = await postsQ.findPostsByClient(
    pgQuery, clientId, { ...queryParams, cursor: queryParams.page }
  );

  return {
    data: items.map(row => fmtPost(row)), // no approvalLog in list
    meta: { total, nextCursor: nextCursor ?? null },
  };
}

// ─── createPost ──────────────────────────────────────────────────────────────

async function createPost(userId, clientId, body) {
  const access = await assertClientAccess(userId, clientId);

  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    // Validate that all targetProfileIds belong to this client.
    const profiles = await resolveProfiles(db, clientId, body.targetProfileIds);

    const postRow = await postsQ.insertPost(db, {
      clientId,
      workspaceId:       access.workspace_id,
      originalContent:   body.originalContent,
      scheduledAt:       body.scheduledAt ?? null,
      publishImmediately: body.publishImmediately ?? false,
      createdById:       userId,
    });

    await targetsQ.insertTargets(db, postRow.id, profiles);

    await db.query("COMMIT");

    // Fetch the full post (with targets joined) to build the response.
    return fetchFullPost(postRow.id);
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  } finally {
    db.release();
  }
}

// ─── getPost ─────────────────────────────────────────────────────────────────

async function getPost(userId, postId) {
  const row = await postsQ.findPostById(pgQuery, postId);
  if (!row) throw Errors.postNotFound();

  // Workspace ownership check — throws CLIENT_NOT_FOUND if user has no access.
  await assertClientAccess(userId, row.client_id);

  const logs = await approvalLogsQ.findLogsByPost(pgQuery, postId);
  return fmtPost(row, logs);
}

// ─── updatePost ──────────────────────────────────────────────────────────────

async function updatePost(userId, postId, body) {
  // Verify access and that the post is in draft.
  const row = await postsQ.findPostById(pgQuery, postId);
  if (!row) throw Errors.postNotFound();
  await assertClientAccess(userId, row.client_id);

  if (row.status !== "draft") throw Errors.postNotEditable();

  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    await postsQ.updatePost(db, postId, {
      originalContent:    body.originalContent,
      scheduledAt:        body.scheduledAt,
      publishImmediately: body.publishImmediately,
    });

    if (body.targetProfileIds !== undefined) {
      const profiles = await resolveProfiles(db, row.client_id, body.targetProfileIds);
      await targetsQ.deleteTargetsByPost(db, postId);
      await targetsQ.insertTargets(db, postId, profiles);
    }

    await db.query("COMMIT");
    return fetchFullPost(postId);
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  } finally {
    db.release();
  }
}

// ─── deletePost ──────────────────────────────────────────────────────────────

async function deletePost(userId, postId) {
  const row = await postsQ.findPostById(pgQuery, postId);
  if (!row) throw Errors.postNotFound();
  await assertClientAccess(userId, row.client_id);

  if (!["draft", "failed"].includes(row.status)) {
    throw Errors.postNotDeletable();
  }

  await postsQ.deletePost(pgQuery, postId);
}

// ─── submitPost ──────────────────────────────────────────────────────────────

async function submitPost(userId, actorName, postId, comment) {
  const row = await postsQ.findPostById(pgQuery, postId);
  if (!row) throw Errors.postNotFound();
  await assertClientAccess(userId, row.client_id);

  // Pre-check: all targets must have adapted_content.
  const allAdapted = await targetsQ.checkTargetsHaveAdaptedContent(pgQuery, postId);
  if (!allAdapted) throw Errors.postNotSubmittable();

  // State machine enforces draft → needs_approval.
  await transition(postId, "submit", userId, actorName, comment);

  return fetchFullPost(postId);
}

// ─── approvePost ─────────────────────────────────────────────────────────────

async function approvePost(userId, actorName, postId, comment) {
  const row = await postsQ.findPostById(pgQuery, postId);
  if (!row) throw Errors.postNotFound();

  const access = await assertClientAccess(userId, row.client_id);

  // Role check: only owner / admin / client_approver may approve.
  if (!["owner", "admin", "client_approver"].includes(access.role)) {
    throw Errors.forbidden();
  }

  await transition(postId, "approve", userId, actorName, comment);

  // TODO: Enqueue publish job when worker is implemented (B5).
  // await publishQueue.add("publish-post", { postId }, { delay: scheduledDelay });

  return fetchFullPost(postId);
}

// ─── rejectPost ──────────────────────────────────────────────────────────────

async function rejectPost(userId, actorName, postId, comment) {
  const row = await postsQ.findPostById(pgQuery, postId);
  if (!row) throw Errors.postNotFound();
  await assertClientAccess(userId, row.client_id);

  await transition(postId, "reject", userId, actorName, comment);
  return fetchFullPost(postId);
}

// ─── recallPost ──────────────────────────────────────────────────────────────

async function recallPost(userId, actorName, postId, comment) {
  const row = await postsQ.findPostById(pgQuery, postId);
  if (!row) throw Errors.postNotFound();
  await assertClientAccess(userId, row.client_id);

  await transition(postId, "recall", userId, actorName, comment);
  return fetchFullPost(postId);
}

module.exports = {
  listPosts,
  createPost,
  getPost,
  updatePost,
  deletePost,
  submitPost,
  approvePost,
  rejectPost,
  recallPost,
};
