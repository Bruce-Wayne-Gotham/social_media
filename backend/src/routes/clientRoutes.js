const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const clientController = require("../controllers/clientController");
const socialProfileController = require("../controllers/socialProfileController");
const approvalMagicLinkController = require("../controllers/approvalMagicLinkController");
const mediaAssetController = require("../controllers/mediaAssetController");
const trackedLinkController = require("../controllers/trackedLinkController");
const postService = require("../services/postService");
const { createPostSchema } = require("../validators/postValidators");

const router = express.Router();

router.use(requireAuth);

router.get("/:clientId", clientController.getClient);
router.patch("/:clientId", clientController.updateClient);
router.delete("/:clientId", clientController.deleteClient);

router.post("/:clientId/approval-links", approvalMagicLinkController.create);
router.get("/:clientId/media-assets", mediaAssetController.listForClient);
router.post("/:clientId/media-assets/upload-url", mediaAssetController.createUploadUrl);
router.get("/:clientId/tracked-links", trackedLinkController.list);
router.get("/:clientId/tracked-links/report", trackedLinkController.report);
router.post("/:clientId/tracked-links", trackedLinkController.create);

router.get("/:clientId/social-profiles", socialProfileController.listProfiles);
router.get("/:clientId/social-profiles/oauth/:platform/start", socialProfileController.startOAuth);

router.get("/:clientId/posts", async (req, res, next) => {
  try {
    const posts = await postService.getPostsByClient(req.user.sub, req.params.clientId);
    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

router.post("/:clientId/posts", async (req, res, next) => {
  try {
    const payload = createPostSchema.parse(req.body);
    const post = await postService.createPostForClient(req.user.sub, req.params.clientId, payload);
    res.status(201).json({ post });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
