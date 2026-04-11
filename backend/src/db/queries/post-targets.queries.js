"use strict";

// ─── insertTargets ────────────────────────────────────────────────────────────
// Bulk-inserts one post_target row per profileId in a single query.

async function insertTargets(db, postId, profileRows) {
  // profileRows: [{ id, platform }]
  if (profileRows.length === 0) return;

  const values = profileRows.map((_, i) => {
    const base = i * 3;
    return `($${base + 1}, $${base + 2}, $${base + 3}, 'pending')`;
  });

  const params = profileRows.flatMap(r => [postId, r.id, r.platform]);

  await db.query(
    `INSERT INTO post_targets (post_id, social_profile_id, platform, status)
     VALUES ${values.join(", ")}`,
    params
  );
}

// ─── deleteTargetsByPost ──────────────────────────────────────────────────────

async function deleteTargetsByPost(db, postId) {
  await db.query(`DELETE FROM post_targets WHERE post_id = $1`, [postId]);
}

// ─── findProfilesByIds ────────────────────────────────────────────────────────
// Returns the social_profiles rows for the given IDs that actually belong to
// clientId.  Used to validate targetProfileIds on create/update.

async function findProfilesByIds(db, clientId, profileIds) {
  if (profileIds.length === 0) return [];
  const { rows } = await db.query(
    `SELECT id, platform
     FROM social_profiles
     WHERE id = ANY($1::uuid[]) AND client_id = $2`,
    [profileIds, clientId]
  );
  return rows;
}

// ─── checkTargetsHaveAdaptedContent ──────────────────────────────────────────
// Returns true if every target for postId has a non-null adapted_content.
// Used by the submit pre-check.

async function checkTargetsHaveAdaptedContent(db, postId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(adapted_content)::int AS adapted
     FROM post_targets
     WHERE post_id = $1`,
    [postId]
  );
  const { total, adapted } = rows[0];
  // A post with zero targets cannot be submitted either.
  return total > 0 && total === adapted;
}

// ─── findTargetById ───────────────────────────────────────────────────────────
// Returns a single target row joined with its social_profile, or null.

async function findTargetById(db, postId, targetId) {
  const { rows } = await db.query(
    `SELECT
       pt.id,
       pt.post_id,
       pt.social_profile_id,
       pt.platform,
       pt.adapted_content,
       pt.adapted_title,
       pt.status,
       pt.external_post_id,
       pt.failure_reason,
       pt.approved_at,
       pt.published_at,
       sp.id              AS sp_id,
       sp.display_name    AS sp_display_name,
       sp.profile_image_url AS sp_profile_image_url,
       sp.platform        AS sp_platform,
       sp.provider_meta   AS sp_provider_meta
     FROM post_targets pt
     LEFT JOIN social_profiles sp ON sp.id = pt.social_profile_id
     WHERE pt.id = $1 AND pt.post_id = $2`,
    [targetId, postId]
  );
  return rows[0] || null;
}

// ─── updateTargetAdaptation ───────────────────────────────────────────────────
// Saves adapted_content and adapted_title onto a post_target row.

async function updateTargetAdaptation(db, targetId, { adaptedContent, adaptedTitle }) {
  const { rows } = await db.query(
    `UPDATE post_targets
     SET adapted_content = $2,
         adapted_title   = $3
     WHERE id = $1
     RETURNING id`,
    [targetId, adaptedContent, adaptedTitle ?? null]
  );
  return rows[0] || null;
}

module.exports = {
  insertTargets,
  deleteTargetsByPost,
  findProfilesByIds,
  checkTargetsHaveAdaptedContent,
  findTargetById,
  updateTargetAdaptation,
};
