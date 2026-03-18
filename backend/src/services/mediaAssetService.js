const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { query } = require("../config/db");
const { API_ORIGIN, MAX_MEDIA_UPLOAD_BYTES, UPLOAD_ROOT, UPLOAD_TOKEN_TTL_MS } = require("../config/media");
const { httpError } = require("../utils/httpError");
const { assertClientAccess } = require("./accessService");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sanitizeFilename(value) {
  return (value || "upload")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
}

async function listMediaAssets(userId, clientId) {
  await assertClientAccess(userId, clientId);

  const result = await query(
    `SELECT id, workspace_id, client_id, original_filename, content_type, file_size_bytes, public_url, status, created_at, updated_at
     FROM media_assets
     WHERE client_id = $1
     ORDER BY created_at DESC`,
    [clientId]
  );

  return result.rows;
}

async function createUploadUrl(userId, clientId, { fileName, contentType, fileSizeBytes }) {
  const access = await assertClientAccess(userId, clientId);

  if (fileSizeBytes > MAX_MEDIA_UPLOAD_BYTES) {
    throw httpError(`File exceeds upload limit of ${MAX_MEDIA_UPLOAD_BYTES} bytes`, 400);
  }

  const extension = path.extname(fileName || "") || "";
  const storageKey = `${clientId}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  const rawToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + UPLOAD_TOKEN_TTL_MS).toISOString();
  const originalFilename = sanitizeFilename(fileName);

  const result = await query(
    `INSERT INTO media_assets (
       workspace_id,
       client_id,
       uploaded_by,
       original_filename,
       content_type,
       file_size_bytes,
       storage_key,
       upload_token_hash,
       upload_expires_at,
       status,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
     RETURNING id, original_filename, content_type, file_size_bytes, storage_key, upload_expires_at`,
    [
      access.workspace_id,
      clientId,
      userId,
      originalFilename,
      contentType,
      fileSizeBytes,
      storageKey,
      hashToken(rawToken),
      expiresAt
    ]
  );

  const asset = result.rows[0];
  return {
    assetId: asset.id,
    uploadUrl: `${API_ORIGIN}/api/media-assets/${asset.id}/upload?token=${rawToken}`,
    expiresAt: asset.upload_expires_at,
    maxBytes: MAX_MEDIA_UPLOAD_BYTES
  };
}

async function completeUpload(assetId, token, body, contentType) {
  const result = await query(
    `SELECT id, storage_key, upload_token_hash, upload_expires_at, original_filename
     FROM media_assets
     WHERE id = $1`,
    [assetId]
  );
  const asset = result.rows[0];

  if (!asset || !asset.upload_token_hash) {
    throw httpError("Upload is invalid or already used", 404);
  }

  if (asset.upload_token_hash !== hashToken(token)) {
    throw httpError("Upload token is invalid", 401);
  }

  if (!asset.upload_expires_at || new Date(asset.upload_expires_at).getTime() < Date.now()) {
    throw httpError("Upload token expired", 410);
  }

  if (!body || !Buffer.isBuffer(body) || body.length === 0) {
    throw httpError("Upload body is required", 400);
  }

  if (body.length > MAX_MEDIA_UPLOAD_BYTES) {
    throw httpError(`File exceeds upload limit of ${MAX_MEDIA_UPLOAD_BYTES} bytes`, 400);
  }

  const filePath = path.join(UPLOAD_ROOT, asset.storage_key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);

  const publicUrl = `${API_ORIGIN}/media/${asset.storage_key}`;
  const update = await query(
    `UPDATE media_assets
     SET public_url = $2,
         content_type = COALESCE($3, content_type),
         file_size_bytes = $4,
         upload_token_hash = NULL,
         upload_expires_at = NULL,
         status = 'ready',
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, workspace_id, client_id, original_filename, content_type, file_size_bytes, public_url, status, created_at, updated_at`,
    [assetId, publicUrl, contentType || null, body.length]
  );

  return update.rows[0];
}

async function resolveMediaForPost(userId, clientId, mediaAssetId, mediaUrl) {
  if (mediaAssetId) {
    await assertClientAccess(userId, clientId);
    const result = await query(
      `SELECT id, public_url
       FROM media_assets
       WHERE id = $1 AND client_id = $2 AND status = 'ready'`,
      [mediaAssetId, clientId]
    );
    const asset = result.rows[0];
    if (!asset) {
      throw httpError("Media asset not found", 404);
    }

    return {
      mediaAssetId: asset.id,
      mediaUrl: asset.public_url
    };
  }

  return {
    mediaAssetId: null,
    mediaUrl: mediaUrl || null
  };
}

module.exports = {
  completeUpload,
  createUploadUrl,
  listMediaAssets,
  resolveMediaForPost
};
