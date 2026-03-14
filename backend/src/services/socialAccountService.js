const { query } = require("../config/db");
const { encrypt } = require("../utils/crypto");
const { normalizePlatform } = require("../utils/platforms");

async function upsertSocialAccount(userId, payload) {
  const result = await query(
    `INSERT INTO social_accounts (user_id, platform, account_name, access_token, refresh_token, expiry, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, platform)
     DO UPDATE SET
       account_name = EXCLUDED.account_name,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expiry = EXCLUDED.expiry,
       updated_at = NOW()
     RETURNING id, platform, account_name, expiry, created_at, updated_at`,
    [
      userId,
      normalizePlatform(payload.platform),
      payload.accountName || null,
      encrypt(payload.accessToken),
      payload.refreshToken ? encrypt(payload.refreshToken) : null,
      payload.expiry || null
    ]
  );

  return result.rows[0];
}

async function getSocialAccountsByUser(userId) {
  const result = await query(
    `SELECT id, platform, account_name, expiry, created_at, updated_at
     FROM social_accounts
     WHERE user_id = $1
     ORDER BY platform ASC`,
    [userId]
  );

  return result.rows;
}

module.exports = {
  upsertSocialAccount,
  getSocialAccountsByUser
};
