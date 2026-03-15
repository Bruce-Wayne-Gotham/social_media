const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const controller = require("../controllers/oauthConnectSessionController");

const router = express.Router();

router.use(requireAuth);
router.get("/:sessionId", controller.getSession);
router.post("/:sessionId/consume", controller.consume);

module.exports = router;

