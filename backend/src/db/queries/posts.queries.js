"use strict";

// All post-level SELECT / INSERT / UPDATE / DELETE.
// Every function accepts a `db` parameter — either a pool.connect() client
// (for use inside a caller-managed transaction) or the pool-level `query`
// helper from config/db.js.  Callers decide the tx boundary.

// ─── helpers ────────────────────────────────────────────────────────────────

function encodeCursor({ createdAt, id }) {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString("base64");
}

function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// The JSON_BUILD_OBJECT for a single target row (used in both list + full queries).
// Returns camelCase keys so the service layer can attach them directly.
const TARGET_JSON = `
  JSON_BUILD_OBJECT(
    'id',              pt.id,
    'postId',          pt.post_id,
    'socialProfileId', pt.social_profile_id,
    'platform',        pt.platform,
    'adaptedContent',  pt.adapted_content,
    'adaptedTitle',    pt.adapted_title,
    'status',          pt.status,
    'externalPostId',  pt.external_post_id,
    'failureReason',   pt.failure_reason,
    'approvedAt',      pt.approved_at,
    'publishedAt',     pt.published_at,
    'socialProfile',   CASE WHEN sp.id IS NOT NULL THEN
      JSON_BUILD_OBJECT(
        'id',              sp.id,
        'displayName',     sp.display_name,
        'profileImageUrl', sp.profile_image_url,
        'platform',        sp.platform,
        'providerMeta',    sp.provider_meta
      )
    ELSE NULL END
  )
`;

const POST_COLS = `
  p.id,
  p.client_id,
  p.workspace_id,
  p.status,
  p.original_content,
  p.scheduled_at,
  p.publish_immediately,
  p.created_at,
  p.updated_at,
  p.created_by         AS created_by_id,
  u.email              AS created_by_email
`;

const POST_JOINS = `
  LEFT JOIN users u          ON u.id = p.created_by
  LEFT JOIN post_targets  pt ON pt.post_id = p.id
  LEFT JOIN social_profiles sp ON sp.id = pt.social_profile_id
`;

// ─── findPostById ────────────────────────────────────────────────────────────
// Returns one post with aggregated targets.  approvalLog is fetched separately.

async function findPostById(db, postId) {
  const { rows } = await db.query(
    `SELECT
       ${POST_COLS},
       COALESCE(
         JSON_AGG(${TARGET_JSON} ORDER BY pt.created_at ASC)
         FILTER (WHERE pt.id IS NOT NULL),
         '[]'::json
       ) AS targets
     FROM posts p
     ${POST_JOINS}
     WHERE p.id = $1
     GROUP BY p.id, u.email`,
    [postId]
  );
  return rows[0] || null;
}

// ─── findPostsByClient ────────────────────────────────────────────────────────
// Returns { items, total, nextCursor } for the list endpoint.
// Filters: status, from (scheduled_at >=), to (scheduled_at <=).
// Pagination: keyset on (created_at DESC, id DESC).

async function findPostsByClient(db, clientId, { status, from, to, cursor, limit = 20 }) {
  const limitNum = Math.min(Number(limit) || 20, 100);

  const where  = ["p.client_id = $1"];
  const params = [clientId];
  let   p      = 2; // next param index

  if (status) { where.push(`p.status = $${p++}`);         params.push(status); }
  if (from)   { where.push(`p.scheduled_at >= $${p++}`);  params.push(from); }
  if (to)     { where.push(`p.scheduled_at <= $${p++}`);  params.push(to); }

  // COUNT uses the same filters but no cursor so the total is stable.
  const countResult = await db.query(
    `SELECT COUNT(DISTINCT p.id)::int AS total
     FROM posts p
     WHERE ${where.join(" AND ")}`,
    params.slice() // copy before we push cursor params
  );
  const total = countResult.rows[0].total;

  // Keyset cursor appended after the stable filters.
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      where.push(`(p.created_at, p.id) < ($${p++}::timestamptz, $${p++}::uuid)`);
      params.push(decoded.createdAt, decoded.id);
    }
  }

  params.push(limitNum + 1); // fetch one extra to detect next page
  const dataIdx = p++;

  const { rows } = await db.query(
    `SELECT
       ${POST_COLS},
       COALESCE(
         JSON_AGG(${TARGET_JSON} ORDER BY pt.created_at ASC)
         FILTER (WHERE pt.id IS NOT NULL),
         '[]'::json
       ) AS targets
     FROM posts p
     ${POST_JOINS}
     WHERE ${where.join(" AND ")}
     GROUP BY p.id, u.email
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $${dataIdx}`,
    params
  );

  const hasNext = rows.length > limitNum;
  const items   = hasNext ? rows.slice(0, limitNum) : rows;
  const last    = items[items.length - 1];
  const nextCursor = hasNext
    ? encodeCursor({ createdAt: last.created_at, id: last.id })
    : null;

  return { items, total, nextCursor };
}

// ─── insertPost ──────────────────────────────────────────────────────────────

async function insertPost(db, { clientId, workspaceId, originalContent, scheduledAt, publishImmediately, createdById }) {
  const { rows } = await db.query(
    `INSERT INTO posts
       (client_id, workspace_id, original_content, scheduled_at, publish_immediately, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft')
     RETURNING id, client_id, workspace_id, status, original_content,
               scheduled_at, publish_immediately, created_by, created_at, updated_at`,
    [clientId, workspaceId, originalContent, scheduledAt || null, publishImmediately ?? false, createdById]
  );
  return rows[0];
}

// ─── updatePost ──────────────────────────────────────────────────────────────
// Only called when status='draft' — controller enforces that.

async function updatePost(db, postId, { originalContent, scheduledAt, publishImmediately }) {
  const sets    = [];
  const params  = [postId];
  let   p       = 2;

  if (originalContent   !== undefined) { sets.push(`original_content    = $${p++}`); params.push(originalContent); }
  if (scheduledAt       !== undefined) { sets.push(`scheduled_at        = $${p++}`); params.push(scheduledAt ?? null); }
  if (publishImmediately !== undefined) { sets.push(`publish_immediately = $${p++}`); params.push(publishImmediately); }

  if (sets.length === 0) return null; // nothing to update

  sets.push("updated_at = NOW()");

  const { rows } = await db.query(
    `UPDATE posts SET ${sets.join(", ")} WHERE id = $1 RETURNING id`,
    params
  );
  return rows[0] || null;
}

// ─── deletePost ──────────────────────────────────────────────────────────────

async function deletePost(db, postId) {
  const { rowCount } = await db.query(
    `DELETE FROM posts WHERE id = $1`,
    [postId]
  );
  return rowCount > 0;
}

// ─── updatePostStatus ─────────────────────────────────────────────────────────
// Used ONLY by the state machine — no other caller may update status directly.

async function updatePostStatus(db, postId, newStatus) {
  const { rows } = await db.query(
    `UPDATE posts
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, status`,
    [postId, newStatus]
  );
  return rows[0] || null;
}

module.exports = {
  findPostById,
  findPostsByClient,
  insertPost,
  updatePost,
  deletePost,
  updatePostStatus,
};
