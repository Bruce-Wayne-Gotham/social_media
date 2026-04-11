"use strict";

// ─── insertApprovalLog ────────────────────────────────────────────────────────

async function insertApprovalLog(db, { postId, action, actorId, actorName, comment }) {
  const { rows } = await db.query(
    `INSERT INTO approval_logs (post_id, action, actor_id, actor_name, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, post_id, action, actor_id, actor_name, comment, created_at`,
    [postId, action, actorId || null, actorName, comment || null]
  );
  return rows[0];
}

// ─── findLogsByPost ───────────────────────────────────────────────────────────

async function findLogsByPost(db, postId) {
  const { rows } = await db.query(
    `SELECT id, post_id, action, actor_id, actor_name, comment, created_at
     FROM approval_logs
     WHERE post_id = $1
     ORDER BY created_at ASC`,
    [postId]
  );
  return rows;
}

module.exports = {
  insertApprovalLog,
  findLogsByPost,
};
