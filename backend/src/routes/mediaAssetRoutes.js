const express = require("express");
const mediaAssetController = require("../controllers/mediaAssetController");
const { MAX_MEDIA_UPLOAD_BYTES } = require("../config/media");

const router = express.Router();

router.put(
  "/:assetId/upload",
  express.raw({ type: "*/*", limit: MAX_MEDIA_UPLOAD_BYTES }),
  mediaAssetController.upload
);

module.exports = router;
