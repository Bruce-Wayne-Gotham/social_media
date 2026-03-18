const path = require("path");

const UPLOAD_ROOT = process.env.MEDIA_UPLOAD_DIR || path.join(process.cwd(), "uploads");
const API_ORIGIN = process.env.APP_BASE_URL || "http://localhost:4000";
const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_MEDIA_UPLOAD_BYTES = Number(process.env.MAX_MEDIA_UPLOAD_BYTES || 50 * 1024 * 1024);

module.exports = {
  API_ORIGIN,
  MAX_MEDIA_UPLOAD_BYTES,
  UPLOAD_ROOT,
  UPLOAD_TOKEN_TTL_MS
};
