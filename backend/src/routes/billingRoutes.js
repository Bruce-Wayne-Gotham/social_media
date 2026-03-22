const express = require("express");

const { requireAuth } = require("../middleware/authMiddleware");
const controller = require("../controllers/billingController");

const router = express.Router();

router.use(requireAuth);
router.get("/workspaces/:workspaceId", controller.getWorkspaceBilling);
router.post("/workspaces/:workspaceId/checkout", controller.createCheckoutSession);

module.exports = router;
