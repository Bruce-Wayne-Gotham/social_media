const { query } = require("../config/db");
const { encrypt } = require("../utils/crypto");
const { normalizePlatform } = require("../utils/platforms");
const { httpError } = require("../utils/httpError");

async function getDefaultClientIdForUser(userId) {
  const result = await query("SELECT default_client_id FROM users WHERE id = $1", [userId]);
  const clientId = result.rows[0]?.default_client_id;
  if (!clientId) {
    throw httpError("Default client is not configured for this user", 500);
  }
  return clientId;
}

async function upsertSocialAccountForClient(userId, clientId, payload) {
  const providerAccountId = payload.providerAccountId || payload.accountName;
  if (!providerAccountId) {
    throw httpError("Missing provider account identifier for social profile", 400);
  }

  const result = await query(
    `INSERT INTO social_accounts (user_id, client_id, platform, provider_account_id, account_name, access_token, refresh_token, expiry, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (client_id, platform, provider_account_id)
     DO UPDATE SET
       account_name = EXCLUDED.account_name,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expiry = EXCLUDED.expiry,
       updated_at = NOW()
     RETURNING id, client_id, platform, provider_account_id, account_name, expiry, created_at, updated_at`,
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
    `SELECT id, client_id, platform, provider_account_id, account_name, expiry, created_at, updated_at
     FROM social_accounts
     WHERE user_id = $1
     ORDER BY platform ASC, updated_at DESC`,
    [userId]
  );

  return result.rows;
}

async function getSocialAccountsByClient(userId, clientId) {
  // Simple authz: must be a member of the client's workspace.
  const authz = await query(
    `SELECT 1
     FROM clients c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE c.id = $1 AND wm.user_id = $2`,
    [clientId, userId]
  );
  if (authz.rowCount === 0) {
    throw httpError("Client not found", 404);
  }

  const result = await query(
    `SELECT id, client_id, platform, provider_account_id, account_name, expiry, created_at, updated_at
     FROM social_accounts
     WHERE client_id = $1
     ORDER BY platform ASC, updated_at DESC`,
    [clientId]
  );
  return result.rows;
}

async function disconnectSocialAccount(userId, socialAccountId) {
  const result = await query(
    `DELETE FROM social_accounts sa
     USING clients c, workspace_members wm
     WHERE sa.id = $1
       AND sa.client_id = c.id
       AND wm.workspace_id = c.workspace_id
       AND wm.user_id = $2
     RETURNING sa.id`,
    [socialAccountId, userId]
  );

  if (result.rowCount === 0) {
    throw httpError("Social profile not found", 404);
  }

  return { ok: true };
}

module.exports = {
  disconnectSocialAccount,
  upsertSocialAccount,
  upsertSocialAccountForClient,
  getSocialAccountsByClient,
  getSocialAccountsByUser
};
