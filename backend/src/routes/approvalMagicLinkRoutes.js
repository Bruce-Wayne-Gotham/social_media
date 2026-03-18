const express = require("express");
const controller = require("../controllers/approvalMagicLinkController");

const router = express.Router();

router.get("/:token", controller.getOverview);
router.get("/:token/posts/:postId", controller.getPost);
router.post("/:token/posts/:postId/comments", controller.comment);
router.post("/:token/posts/:postId/approve", controller.approve);
router.post("/:token/posts/:postId/reject", controller.reject);

module.exports = router;
