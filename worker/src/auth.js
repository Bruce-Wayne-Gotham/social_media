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
    `UPDATE social_profiles
     SET access_token = $2,
         refresh_token = $3,
         expiry = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [
      target.social_profile_id,
      encrypt(tokens.accessToken),
      tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokens.expiry
    ]
  );
}

// TODO: Implement Reddit token refresh via https://www.reddit.com/api/v1/access_token
async function refreshRedditToken(target, refreshToken) {
  // TODO: POST https://www.reddit.com/api/v1/access_token
  //   grant_type=refresh_token, Authorization: Basic base64(clientId:clientSecret)
  throw new Error("Reddit token refresh not yet implemented");
}

// TODO: Implement Pinterest token refresh via https://api.pinterest.com/v5/oauth/token
async function refreshPinterestToken(target, refreshToken) {
  // TODO: POST https://api.pinterest.com/v5/oauth/token
  //   grant_type=refresh_token, Authorization: Basic base64(clientId:clientSecret)
  throw new Error("Pinterest token refresh not yet implemented");
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
  // Telegram uses bot tokens — they do not expire and cannot be refreshed
  if (target.platform === "telegram") {
    return accessToken;
  }

  if (!target.refresh_token) {
    throw new Error(`Missing refresh token for ${target.platform}`);
  }

  const refreshToken = decrypt(target.refresh_token);
  let nextTokens;

  if (target.platform === "youtube") {
    nextTokens = await refreshYoutubeToken(target, refreshToken);
  } else if (target.platform === "reddit") {
    nextTokens = await refreshRedditToken(target, refreshToken);
  } else if (target.platform === "pinterest") {
    nextTokens = await refreshPinterestToken(target, refreshToken);
  } else {
    throw new Error(`Unsupported platform: ${target.platform}`);
  }

  await updateAccountTokens(client, target, nextTokens);
  return nextTokens.accessToken;
}

async function resolveAccessToken(client, target) {
  if (!target.social_profile_id || !target.access_token) {
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
