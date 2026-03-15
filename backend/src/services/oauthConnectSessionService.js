const { query } = require("../config/db");
const { encrypt, decrypt } = require("../utils/crypto");
const { httpError } = require("../utils/httpError");

async function createSession({ userId, clientId, platform, accessToken, refreshToken, expiry, candidates }) {
  const result = await query(
    `INSERT INTO oauth_connect_sessions
       (user_id, client_id, platform, access_token, refresh_token, expiry, profile_candidates)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, user_id, client_id, platform, profile_candidates, created_at`,
    [
      userId,
      clientId || null,
      platform,
      encrypt(accessToken),
      refreshToken ? encrypt(refreshToken) : null,
      expiry || null,
      JSON.stringify(candidates || [])
    ]
  );

  return result.rows[0];
}

async function getSessionForUser(userId, sessionId) {
  const result = await query(
    `SELECT id, user_id, client_id, platform, access_token, refresh_token, expiry, profile_candidates, consumed_at, created_at
     FROM oauth_connect_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  return result.rows[0] || null;
}

async function assertClientAccess(userId, clientId) {
  const result = await query(
    `SELECT 1
     FROM clients c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE c.id = $1 AND wm.user_id = $2`,
    [clientId, userId]
  );
  if (result.rowCount === 0) {
    throw httpError("Client not found", 404);
  }
}

async function consumeSession(userId, sessionId, { clientId, providerAccountIds }) {
  const session = await getSessionForUser(userId, sessionId);
  if (!session) {
    throw httpError("Connect session not found", 404);
  }

  if (session.consumed_at) {
    throw httpError("Connect session already used", 409);
  }

  const resolvedClientId = clientId || session.client_id;
  if (!resolvedClientId) {
    throw httpError("Client is required", 400);
  }

  await assertClientAccess(userId, resolvedClientId);

  const candidates = Array.isArray(session.profile_candidates) ? session.profile_candidates : [];
  const selected = new Set(providerAccountIds || []);
  const selectedCandidates = candidates.filter((c) => c && selected.has(c.providerAccountId));

  if (selectedCandidates.length === 0) {
    throw httpError("Select at least one profile to connect", 400);
  }

  const accessToken = decrypt(session.access_token);
  const refreshToken = session.refresh_token ? decrypt(session.refresh_token) : null;

  // Create/update one social profile per selected provider account id.
  const created = [];
  for (const candidate of selectedCandidates) {
    const result = await query(
      `INSERT INTO social_accounts
         (user_id, client_id, platform, provider_account_id, account_name, access_token, refresh_token, expiry, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
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
        resolvedClientId,
        session.platform,
        candidate.providerAccountId,
        candidate.accountName || null,
        encrypt(accessToken),
        refreshToken ? encrypt(refreshToken) : null,
        session.expiry || null
      ]
    );

    created.push(result.rows[0]);
  }

  await query("UPDATE oauth_connect_sessions SET consumed_at = NOW(), client_id = $2 WHERE id = $1", [
    sessionId,
    resolvedClientId
  ]);

  return { connected: created };
}

module.exports = {
  consumeSession,
  createSession,
  getSessionForUser
};

