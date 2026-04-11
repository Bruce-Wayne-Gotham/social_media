"use strict";

const postsService       = require("../services/posts.service");
const adaptationService  = require("../services/adaptation.service");
const {
  createPostSchema,
  updatePostSchema,
  approvalActionSchema,
  listPostsQuerySchema,
  saveAdaptationSchema,
} = require("../validators/posts.validator");
const { ApiError } = require("../utils/ApiError");

// ─── helpers ─────────────────────────────────────────────────────────────────

// Propagates ApiError directly and wraps everything else as a 500.
function handleError(err, next) {
  if (err instanceof ApiError || err.isApiError) return next(err);
  // Zod validation errors surfaced from service layer (shouldn't happen, but safe):
  if (err.name === "ZodError") return next(err);
  next(err);
}

// ─── GET /api/clients/:clientId/posts ────────────────────────────────────────

async function listPosts(req, res, next) {
  try {
    const query  = listPostsQuerySchema.parse(req.query);
    const result = await postsService.listPosts(
      req.user.sub, req.params.clientId, query
    );
    res.json(result);
  } catch (err) {
    handleError(err, next);
  }
}

// ─── POST /api/clients/:clientId/posts ───────────────────────────────────────

async function createPost(req, res, next) {
  try {
    const body = createPostSchema.parse(req.body);
    const post = await postsService.createPost(req.user.sub, req.params.clientId, body);
    res.status(201).json({ data: post });
  } catch (err) {
    handleError(err, next);
  }
}

// ─── GET /api/posts/:postId ───────────────────────────────────────────────────

async function getPost(req, res, next) {
  try {
    const post = await postsService.getPost(req.user.sub, req.params.postId);
    res.json({ data: post });
  } catch (err) {
    handleError(err, next);
  }
}

// ─── PATCH /api/posts/:postId ─────────────────────────────────────────────────

async function updatePost(req, res, next) {
  try {
    const body = updatePostSchema.parse(req.body);
    const post = await postsService.updatePost(req.user.sub, req.params.postId, body);
    res.json({ data: post });
  } catch (err) {
    handleError(err, next);
  }
}

// ─── DELETE /api/posts/:postId ────────────────────────────────────────────────

async function deletePost(req, res, next) {
  try {
    await postsService.deletePost(req.user.sub, req.params.postId);
    res.status(204).end();
  } catch (err) {
    handleError(err, next);
  }
}

// ─── POST /api/posts/:postId/submit ──────────────────────────────────────────

async function submitPost(req, res, next) {
  try {
    const { comment } = approvalActionSchema.parse(req.body);
    const post = await postsService.submitPost(req.user.sub, req.user.email, req.params.postId, comment);
    res.json({ data: post });
  } catch (err) {
    handleError(err, next);
  }
}

// ─── POST /api/posts/:postId/approve ─────────────────────────────────────────

async function approvePost(req, res, next) {
  try {
    const { comment } = approvalActionSchema.parse(req.body);
    const post = await postsService.approvePost(req.user.sub, req.user.email, req.params.postId, comment);
    res.json({ data: post });
  } catch (err) {
    handleError(err, next);
  }
}

// ─── POST /api/posts/:postId/reject ──────────────────────────────────────────

async function rejectPost(req, res, next) {
  try {
    const { comment } = approvalActionSchema.parse(req.body);
    const post = await postsService.rejectPost(req.user.sub, req.user.email, req.params.postId, comment);
    res.json({ data: post });
  } catch (err) {
    handleError(err, next);
  }
}

// ─── POST /api/posts/:postId/recall ──────────────────────────────────────────

async function recallPost(req, res, next) {
  try {
    const { comment } = approvalActionSchema.parse(req.body);
    const post = await postsService.recallPost(req.user.sub, req.user.email, req.params.postId, comment);
    res.json({ data: post });
  } catch (err) {
    handleError(err, next);
  }
}

// ─── POST /api/posts/:postId/adapt ───────────────────────────────────────────

async function adaptPost(req, res, next) {
  try {
    const result = await adaptationService.adaptPost(req.user.sub, req.params.postId);
    res.json({ data: result });
  } catch (err) {
    handleError(err, next);
  }
}

// ─── PATCH /api/posts/:postId/targets/:targetId ───────────────────────────────

async function saveAdaptation(req, res, next) {
  try {
    const body   = saveAdaptationSchema.parse(req.body);
    const target = await adaptationService.saveAdaptation(
      req.user.sub,
      req.params.postId,
      req.params.targetId,
      body
    );
    res.json({ data: target });
  } catch (err) {
    handleError(err, next);
  }
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
  adaptPost,
  saveAdaptation,
};
