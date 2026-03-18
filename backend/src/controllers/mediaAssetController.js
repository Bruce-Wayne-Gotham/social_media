const { createUploadUrlSchema } = require("../validators/mediaAssetValidators");
const mediaAssetService = require("../services/mediaAssetService");

async function listForClient(req, res, next) {
  try {
    const assets = await mediaAssetService.listMediaAssets(req.user.sub, req.params.clientId);
    res.json({ assets });
  } catch (error) {
    next(error);
  }
}

async function createUploadUrl(req, res, next) {
  try {
    const payload = createUploadUrlSchema.parse(req.body || {});
    const upload = await mediaAssetService.createUploadUrl(req.user.sub, req.params.clientId, payload);
    res.status(201).json(upload);
  } catch (error) {
    next(error);
  }
}

async function upload(req, res, next) {
  try {
    const asset = await mediaAssetService.completeUpload(
      req.params.assetId,
      req.query.token,
      req.body,
      req.headers["content-type"]
    );
    res.json({ asset });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createUploadUrl,
  listForClient,
  upload
};
