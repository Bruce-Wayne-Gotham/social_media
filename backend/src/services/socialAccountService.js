const { query } = require("../config/db");
const { encrypt } = require("../utils/crypto");
const { normalizePlatform } = require("../utils/platforms");
const { httpError } = require("../utils/httpError");
const { Errors } = require("../utils/ApiError");
const { assertClientAccess } = require("./accessService");
const { assertWithinWorkspacePlanLimit, countAdditionalProfilesForClient } = require("./billingService");

// Contract-shaped SocialProfile formatter.
function fmtProfile(row) {
  return {
    id:              row.id,
    clientId:        row.client_id,
    platform:        row.platform,
    displayName:     row.display_name,
    profileImageUrl: row.profile_image_url ?? null,
    providerId:      row.provider_id,
    providerType:    row.provider_type,
    providerMeta:    row.provider_meta,
    isConnected:     row.is_connected,
    connectedAt:     row.connected_at  ?? null,
    lastSyncedAt:    row.last_synced_at ?? null,
    createdAt:       row.created_at,
  };
}

async function getDefaultClientIdForUser(userId) {
  const result = await query("SELECT default_client_id FROM users WHERE id = $1", [userId]);
  const clientId = result.rows[0]?.default_client_id;
  if (!clientId) {
    throw httpError("Default client is not configured for this user", 500);
  }
  return clientId;
}

async function upsertSocialAccountForClient(userId, clientId, payload) {
  const access = await assertClientAccess(userId, clientId);

  const providerAccountId = payload.providerAccountId || payload.accountName;
  if (!providerAccountId) {
    throw httpError("Missing provider account identifier for social profile", 400);
  }

  const additionalProfiles = await countAdditionalProfilesForClient(
    clientId,
    normalizePlatform(payload.platform),
    [providerAccountId]
  );

  if (additionalProfiles > 0) {
    await assertWithinWorkspacePlanLimit({
      workspaceId: access.workspace_id,
      metric: "profiles",
      amount: additionalProfiles
    });
  }

  const result = await query(
    `INSERT INTO social_profiles (user_id, client_id, platform, provider_account_id, display_name, access_token, refresh_token, expiry, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (client_id, platform, provider_account_id)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expiry = EXCLUDED.expiry,
       updated_at = NOW()
     RETURNING id, client_id, platform, provider_account_id, display_name, expiry, created_at, updated_at`,
    [
      userId,
      clientId,
      normalizePlatform(payload.platform),
      providerAccountId,
      payload.accountName || null,
      encrypt(payload.accessToken),
      payload.refreshToken ? encrypt(payload.refreshToken) : null,
      payload.expiry || null
    ]
  );

  return result.rows[0];
}

async function upsertSocialAccount(userId, payload) {
  const clientId = await getDefaultClientIdForUser(userId);
  return upsertSocialAccountForClient(userId, clientId, payload);
}

async function getSocialAccountsByUser(userId) {
  const result = await query(
    `SELECT id, client_id, platform, provider_account_id, display_name, expiry, created_at, updated_at
     FROM social_profiles
     WHERE user_id = $1
     ORDER BY platform ASC, updated_at DESC`,
    [userId]
  );

  return result.rows;
}

async function getSocialAccountsByClient(userId, clientId) {
  await assertClientAccess(userId, clientId);

  const result = await query(
    `SELECT id, client_id, platform, display_name, profile_image_url,
            provider_id, provider_type, provider_meta, is_connected,
            connected_at, last_synced_at, created_at
     FROM social_profiles
     WHERE client_id = $1
     ORDER BY platform ASC, created_at DESC`,
    [clientId]
  );
  return result.rows.map(fmtProfile);
}

async function disconnectSocialAccount(userId, socialAccountId) {
  // Verify the profile exists and the user has access to its client.
  const { rows: ownerRows } = await query(
    `SELECT client_id FROM social_profiles WHERE id = $1`,
    [socialAccountId]
  );
  if (!ownerRows[0]) throw Errors.socialProfileNotFound();
  await assertClientAccess(userId, ownerRows[0].client_id);

  // Soft-disconnect: set is_connected=false and clear tokens so they cannot be
  // used, but keep the row so history and settings are preserved.
  const result = await query(
    `UPDATE social_profiles
     SET is_connected  = FALSE,
         access_token  = '',
         refresh_token = NULL
     WHERE id = $1
     RETURNING id`,
    [socialAccountId]
  );

  if (result.rowCount === 0) throw Errors.socialProfileNotFound();
}

module.exports = {
  disconnectSocialAccount,
  upsertSocialAccount,
  upsertSocialAccountForClient,
  getSocialAccountsByClient,
  getSocialAccountsByUser
};
