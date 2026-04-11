"use strict";

const express    = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const ctrl       = require("../controllers/posts.controller");

const router = express.Router();

router.use(requireAuth);

// Individual post operations (all operate on /api/posts/:postId)
router.get   ("/:postId",         ctrl.getPost);
router.patch ("/:postId",         ctrl.updatePost);
router.delete("/:postId",         ctrl.deletePost);

// Adaptation
router.post  ("/:postId/adapt",                     ctrl.adaptPost);
router.patch ("/:postId/targets/:targetId",          ctrl.saveAdaptation);

// State machine transitions
router.post  ("/:postId/submit",  ctrl.submitPost);
router.post  ("/:postId/approve", ctrl.approvePost);
router.post  ("/:postId/reject",  ctrl.rejectPost);
router.post  ("/:postId/recall",  ctrl.recallPost);

module.exports = router;
