const express = require("express");
const controller = require("../controllers/socialAccountController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/oauth/:platform/callback", controller.completeOAuth);

router.use(requireAuth);
router.get("/", controller.listAccounts);
router.post("/connect", controller.connectAccount);
router.get("/oauth/:platform/start", controller.startOAuth);

module.exports = router;
