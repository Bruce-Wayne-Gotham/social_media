const express = require("express");
const controller = require("../controllers/trackedLinkController");

const router = express.Router();

router.get("/:code/resolve", controller.resolve);

module.exports = router;
