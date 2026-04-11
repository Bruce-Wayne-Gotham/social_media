const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const clientController = require("../controllers/clientController");
const socialProfileController = require("../controllers/socialProfileController");
const approvalMagicLinkController = require("../controllers/approvalMagicLinkController");
const mediaAssetController = require("../controllers/mediaAssetController");
const trackedLinkController = require("../controllers/trackedLinkController");
const postsController = require("../controllers/posts.controller");

const router = express.Router();

router.use(requireAuth);

// Contract paths: GET /api/clients and POST /api/clients (workspace from JWT).
// These must be registered BEFORE the /:clientId param routes.
router.get("/",  clientController.listClientsForCurrentWorkspace);
router.post("/", clientController.createClientForCurrentWorkspace);

router.get("/:clientId", clientController.getClient);
router.patch("/:clientId", clientController.updateClient);
router.delete("/:clientId", clientController.deleteClient);
router.post("/:clientId/generate-drafts", clientController.generateDrafts);

router.post("/:clientId/approval-links", approvalMagicLinkController.create);
router.get("/:clientId/media-assets", mediaAssetController.listForClient);
router.post("/:clientId/media-assets/upload-url", mediaAssetController.createUploadUrl);
router.get("/:clientId/tracked-links", trackedLinkController.list);
router.get("/:clientId/tracked-links/report", trackedLinkController.report);
router.post("/:clientId/tracked-links", trackedLinkController.create);

router.get("/:clientId/social-profiles", socialProfileController.listProfiles);
router.get("/:clientId/social-profiles/oauth/:platform/start", socialProfileController.startOAuth);

router.get ("/:clientId/posts", postsController.listPosts);
router.post("/:clientId/posts", postsController.createPost);

module.exports = router;
