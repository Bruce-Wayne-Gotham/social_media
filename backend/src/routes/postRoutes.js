const express = require("express");
const controller = require("../controllers/postController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", controller.listPosts);
router.post("/", controller.createPost);
router.get("/:id", controller.getPost);

module.exports = router;
