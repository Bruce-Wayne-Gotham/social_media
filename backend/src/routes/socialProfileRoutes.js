const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const controller = require("../controllers/socialProfileController");

const router = express.Router();

router.use(requireAuth);
router.delete("/:socialProfileId", controller.disconnect);

module.exports = router;

