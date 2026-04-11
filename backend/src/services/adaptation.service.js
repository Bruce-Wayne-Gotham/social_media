"use strict";

// Adaptation endpoints (B3).
// ENDPOINT 1 — adaptPost: calls AI for each target, returns suggestions without DB writes.
// ENDPOINT 2 — saveAdaptation: writes adapted content to one post_target row.

const { query: pgQuery }   = require("../config/db");
const { assertClientAccess } = require("./accessService");
const { adaptContent }     = require("./ai.service");
const postsQ               = require("../db/queries/posts.queries");
const targetsQ             = require("../db/queries/post-targets.queries");
const { Errors }           = require("../utils/ApiError");

// Platforms that require adaptedTitle.
const TITLE_REQUIRED = new Set(["reddit", "youtube", "pinterest"]);

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtTarget(row) {
  return {
    id:              row.id,
    postId:          row.post_id,
    socialProfileId: row.social_profile_id,
    platform:        row.platform,
    adaptedContent:  row.adapted_content,
    adaptedTitle:    row.adapted_title,
    status:          row.status,
    externalPostId:  row.external_post_id,
    failureReason:   row.failure_reason,
    approvedAt:      row.approved_at,
    publishedAt:     row.published_at,
    socialProfile:   row.sp_id ? {
      id:              row.sp_id,
      displayName:     row.sp_display_name,
      profileImageUrl: row.sp_profile_image_url,
      platform:        row.sp_platform,
      providerMeta:    row.sp_provider_meta,
    } : null,
  };
}

// ─── adaptPost ───────────────────────────────────────────────────────────────
// POST /api/posts/:postId/adapt
// Does NOT write to DB. Returns AdaptResult shape.

async function adaptPost(userId, postId) {
  const postRow = await postsQ.findPostById(pgQuery, postId);
  if (!postRow) throw Errors.postNotFound();

  await assertClientAccess(userId, postRow.client_id);

  const targets = postRow.targets ?? [];

  const adaptations = await Promise.all(
    targets.map(async (target) => {
      const providerMeta = target.socialProfile?.providerMeta ?? {};
      const { content, title, notes } = await adaptContent(
        target.platform,
        postRow.original_content,
        providerMeta
      );

      const charCount    = content.length;
      const hashtagCount = (content.match(/#\w+/g) || []).length;

      return {
        targetId:        target.id,
        socialProfileId: target.socialProfileId,
        platform:        target.platform,
        content,
        title,
        charCount,
        hashtagCount,
        notes,
      };
    })
  );

  return { postId, adaptations };
}

// ─── saveAdaptation ──────────────────────────────────────────────────────────
// PATCH /api/posts/:postId/targets/:targetId
// Saves adapted content onto the post_target row. Only allowed in draft.

async function saveAdaptation(userId, postId, targetId, body) {
  const postRow = await postsQ.findPostById(pgQuery, postId);
  if (!postRow) throw Errors.postNotFound();

  await assertClientAccess(userId, postRow.client_id);

  if (postRow.status !== "draft") throw Errors.postNotEditable();

  const targetRow = await targetsQ.findTargetById(pgQuery, postId, targetId);
  if (!targetRow) {
    throw Errors.validationError({ targetId: "Target not found for this post" });
  }

  // adaptedTitle is required for reddit, youtube, pinterest.
  if (TITLE_REQUIRED.has(targetRow.platform) && !body.adaptedTitle) {
    throw Errors.adaptedTitleRequired();
  }

  await targetsQ.updateTargetAdaptation(pgQuery, targetId, {
    adaptedContent: body.adaptedContent,
    adaptedTitle:   body.adaptedTitle ?? null,
  });

  const updated = await targetsQ.findTargetById(pgQuery, postId, targetId);
  return fmtTarget(updated);
}

module.exports = { adaptPost, saveAdaptation };
