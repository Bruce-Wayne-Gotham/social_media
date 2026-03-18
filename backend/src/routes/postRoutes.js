const express = require("express");
const controller = require("../controllers/postController");
const approvalController = require("../controllers/approvalController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", controller.listPosts);
router.post("/", controller.createPost);
router.get("/:id", controller.getPost);
router.patch("/:id", controller.updatePost);

router.post("/:id/request-approval", approvalController.requestApproval);
router.post("/:id/comments", approvalController.comment);
router.post("/:id/approve", approvalController.approve);
router.post("/:id/reject", approvalController.reject);

module.exports = router;
