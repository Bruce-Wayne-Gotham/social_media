const { encrypt, decrypt } = require("./crypto");
const { fetchJson } = require("./http");

function shouldRefresh(expiry) {
  if (!expiry) {
    return false;
  }

  return Date.now() + 60_000 >= new Date(expiry).getTime();
}

function getExpiry(expiresIn, fallbackExpiry) {
  if (!expiresIn) {
    return fallbackExpiry || null;
  }

  return new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
}

async function updateAccountTokens(client, target, tokens) {
  await client.query(
    `UPDATE social_accounts
     SET access_token = $2,
         refresh_token = $3,
         expiry = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [
      target.social_account_id,
      encrypt(tokens.accessToken),
      tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokens.expiry
    ]
  );
}

async function refreshLinkedInToken(target, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET
  });

  const payload = await fetchJson("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expiry: getExpiry(payload.expires_in, target.expiry)
  };
}

async function refreshYoutubeToken(target, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET
  });

  const payload = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  return {
    accessToken: payload.access_token,
    refreshToken,
    expiry: getExpiry(payload.expires_in, target.expiry)
  };
}

async function refreshAccessToken(client, target, accessToken) {
  if (target.platform === "instagram") {
    return accessToken;
  }

  if (!target.refresh_token) {
    throw new Error(`Missing refresh token for ${target.platform}`);
  }

  const refreshToken = decrypt(target.refresh_token);
  let nextTokens;

  if (target.platform === "linkedin") {
    nextTokens = await refreshLinkedInToken(target, refreshToken);
  } else if (target.platform === "youtube") {
    nextTokens = await refreshYoutubeToken(target, refreshToken);
  } else {
    throw new Error(`Unsupported platform: ${target.platform}`);
  }

  await updateAccountTokens(client, target, nextTokens);
  return nextTokens.accessToken;
}

async function resolveAccessToken(client, target) {
  if (!target.social_account_id || !target.access_token) {
    throw new Error(`No connected account for ${target.platform}`);
  }

  const accessToken = decrypt(target.access_token);

  if (!shouldRefresh(target.expiry)) {
    return accessToken;
  }

  return refreshAccessToken(client, target, accessToken);
}

module.exports = {
  resolveAccessToken
};
