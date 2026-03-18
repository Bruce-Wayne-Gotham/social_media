const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const controller = require("../controllers/workspaceController");

const router = express.Router();

router.use(requireAuth);

router.get("/", controller.listWorkspaces);
router.post("/", controller.createWorkspace);
router.get("/current", controller.getCurrentWorkspace);
router.patch("/current", controller.switchCurrentWorkspace);

router.get("/:workspaceId/clients", controller.listClients);
router.post("/:workspaceId/clients", controller.createClient);

module.exports = router;
