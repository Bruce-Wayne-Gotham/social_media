"use strict";

const { z } = require("zod");

const isoDatetime = z.string().datetime({ offset: true });

// ─── POST /api/clients/:clientId/posts ───────────────────────────────────────

const createPostSchema = z.object({
  originalContent:    z.string().min(1).max(40000),
  scheduledAt:        isoDatetime.optional().nullable(),
  publishImmediately: z.boolean().default(false),
  targetProfileIds:   z.array(z.string().uuid()).min(1, "At least one target profile is required"),
});

// ─── PATCH /api/posts/:postId ─────────────────────────────────────────────────

const updatePostSchema = z.object({
  originalContent:    z.string().min(1).max(40000).optional(),
  scheduledAt:        isoDatetime.optional().nullable(),
  publishImmediately: z.boolean().optional(),
  targetProfileIds:   z.array(z.string().uuid()).min(1).optional(),
});

// ─── Approval action body (submit / approve / reject / recall) ────────────────

const approvalActionSchema = z.object({
  comment: z.string().max(2000).optional().nullable(),
});

// ─── GET list query params ────────────────────────────────────────────────────

const listPostsQuerySchema = z.object({
  status: z.enum([
    "draft", "needs_approval", "approved", "scheduled",
    "publishing", "published", "failed",
  ]).optional(),
  from:  isoDatetime.optional(),
  to:    isoDatetime.optional(),
  // page is a base64 cursor string (cursor-based pagination per contract).
  page:  z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── PATCH /api/posts/:postId/targets/:targetId ───────────────────────────────

const saveAdaptationSchema = z.object({
  adaptedContent: z.string().min(1).max(40000),
  adaptedTitle:   z.string().max(300).optional().nullable(),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
  approvalActionSchema,
  listPostsQuerySchema,
  saveAdaptationSchema,
};
