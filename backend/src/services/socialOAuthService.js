const { normalizePlatform } = require("../utils/platforms");
const { fetchJson } = require("../utils/http");
const {
  createOAuthState,
  verifyOAuthState
} = require("../utils/oauthState");

const PROVIDERS = {
  // TODO: Telegram uses Bot API tokens, not standard OAuth. Implement bot token setup separately.
  telegram: {
    clientId: process.env.TELEGRAM_BOT_TOKEN,
    clientSecret: process.env.TELEGRAM_BOT_TOKEN,
    authorizationUrl: "https://oauth.telegram.org/auth",
    tokenUrl: "https://oauth.telegram.org/auth/request",
    scopes: []
  },
  // TODO: Implement Reddit OAuth 2.0 flow
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    authorizationUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: ["identity", "submit"]
  },
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  },
  // TODO: Implement Pinterest OAuth 2.0 flow
  pinterest: {
    clientId: process.env.PINTEREST_CLIENT_ID,
    clientSecret: process.env.PINTEREST_CLIENT_SECRET,
    authorizationUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scopes: ["boards:read", "pins:read", "pins:write"]
  }
};

function getProvider(platform) {
  const normalizedPlatform = normalizePlatform(platform);
  const provider = PROVIDERS[normalizedPlatform];

  if (!provider) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  if (!provider.clientId) {
    throw new Error(
      `Missing OAuth client ID for ${normalizedPlatform}. Set ${normalizedPlatform.toUpperCase()}_CLIENT_ID in backend/.env`
    );
  }

  // Token exchanges require a client secret for these providers.
  if (!provider.clientSecret) {
    throw new Error(
      `Missing OAuth client secret for ${normalizedPlatform}. Set ${normalizedPlatform.toUpperCase()}_CLIENT_SECRET in backend/.env`
    );
  }

  return { ...provider, platform: normalizedPlatform };
}

function getRedirectUri(platform) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:4000";
  return `${baseUrl}/api/social-accounts/oauth/${platform}/callback`;
}

function buildFrontendRedirectUrl(platform, status, message) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const url = new URL("/dashboard", frontendUrl);
  url.searchParams.set("platform", platform);
  url.searchParams.set("connection", status);

  if (message) {
    url.searchParams.set("message", message);
  }

  return url.toString();
}

function buildFrontendConnectCallbackUrl(sessionId) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const url = new URL("/connect/callback", frontendUrl);
  url.searchParams.set("session", sessionId);
  return url.toString();
}

function getExpiry(expiresIn) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
}

async function startAuthorization({ platform, userId, clientId }) {
  const provider = getProvider(platform);
  const redirectUri = getRedirectUri(provider.platform);
  const statePayload = {
    platform: provider.platform,
    userId,
    clientId: clientId || null
  };

  const params = new URLSearchParams({
    response_type: "code",
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    scope: provider.scopes.join(" "),
    state: ""
  });

  if (provider.platform === "youtube") {
    params.set("access_type", "offline");
    params.set("include_granted_scopes", "true");
    params.set("prompt", "consent");
  }

  if (provider.platform === "reddit") {
    params.set("duration", "permanent");
  }

  params.set("state", createOAuthState(statePayload));

  const authUrl = new URL(provider.authorizationUrl);
  authUrl.search = params.toString();

  return {
    platform: provider.platform,
    authUrl: authUrl.toString()
  };
}

async function exchangeCodeForToken(provider, code, redirectUri, statePayload) {
  if (provider.platform === "youtube") {
    const body = new URLSearchParams({
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    return fetchJson(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
  }

  if (provider.platform === "reddit") {
    // TODO: Reddit uses HTTP Basic Auth with base64(clientId:clientSecret)
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    });
    const credentials = Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString("base64");

    return fetchJson(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`
      },
      body: body.toString()
    });
  }

  if (provider.platform === "pinterest") {
    // TODO: Pinterest token exchange
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    });
    const credentials = Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString("base64");

    return fetchJson(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`
      },
      body: body.toString()
    });
  }

  // TODO: Telegram OAuth stub
  if (provider.platform === "telegram") {
    throw new Error("Telegram OAuth not yet implemented — use Bot Token setup instead");
  }

  throw new Error(`Unsupported platform: ${provider.platform}`);
}

async function resolveAccountProfile(provider, accessToken) {
  if (provider.platform === "youtube") {
    const profile = await fetchJson("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      accountName: profile.name || profile.email || "youtube-account",
      providerAccountId: profile.sub || profile.email || "youtube"
    };
  }

  if (provider.platform === "reddit") {
    // TODO: GET https://oauth.reddit.com/api/v1/me
    const profile = await fetchJson("https://oauth.reddit.com/api/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "SocialHub/1.0"
      }
    });

    return {
      accountName: profile.name || "reddit-account",
      providerAccountId: profile.id || profile.name || "reddit"
    };
  }

  if (provider.platform === "pinterest") {
    // TODO: GET https://api.pinterest.com/v5/user_account
    const profile = await fetchJson("https://api.pinterest.com/v5/user_account", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      accountName: profile.username || profile.business_name || "pinterest-account",
      providerAccountId: profile.username || "pinterest"
    };
  }

  // TODO: Telegram profile resolution via getMe
  if (provider.platform === "telegram") {
    throw new Error("Telegram profile resolution not yet implemented");
  }

  throw new Error(`Unsupported platform: ${provider.platform}`);
}

async function listConnectableProfiles(provider, accessToken) {
  // Keep this minimal and reliable. We return an array even if we can only detect one profile.
  if (provider.platform === "reddit") {
    const profile = await resolveAccountProfile(provider, accessToken);
    return [
      {
        providerAccountId: profile.providerAccountId,
        accountName: profile.accountName,
        kind: "user"
      }
    ];
  }

  if (provider.platform === "pinterest") {
    const profile = await resolveAccountProfile(provider, accessToken);
    return [
      {
        providerAccountId: profile.providerAccountId,
        accountName: profile.accountName,
        kind: "account"
      }
    ];
  }

  if (provider.platform === "telegram") {
    // TODO: Telegram uses bot tokens — return the bot identity
    throw new Error("Telegram profile listing not yet implemented");
  }

  if (provider.platform === "youtube") {
    // Try to enumerate the channel (requires YouTube Data API access). If it fails, fall back to userinfo identity.
    try {
      const channels = await fetchJson(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      const items = channels.items || [];
      if (items.length) {
        return items.map((item) => ({
          providerAccountId: item.id,
          accountName: item.snippet?.title || "youtube-channel",
          kind: "channel"
        }));
      }
    } catch (_error) {
      // TODO: If we expand scopes later (youtube.readonly), channel enumeration becomes more reliable.
    }

    const profile = await resolveAccountProfile(provider, accessToken);
    return [
      {
        providerAccountId: profile.providerAccountId,
        accountName: profile.accountName,
        kind: "user"
      }
    ];
  }

  throw new Error(`Unsupported platform: ${provider.platform}`);
}

async function completeAuthorization({ platform, code, state }) {
  const statePayload = verifyOAuthState(state);
  const provider = getProvider(platform);

  if (statePayload.platform !== provider.platform) {
    throw new Error("OAuth state does not match the requested platform");
  }

  const redirectUri = getRedirectUri(provider.platform);
  const tokenResponse = await exchangeCodeForToken(provider, code, redirectUri, statePayload);
  const profile = await resolveAccountProfile(provider, tokenResponse.access_token);

  return {
    userId: statePayload.userId,
    clientId: statePayload.clientId || null,
    platform: provider.platform,
    providerAccountId: profile.providerAccountId,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiry: getExpiry(tokenResponse.expires_in),
    accountName: profile.accountName
  };
}

module.exports = {
  buildFrontendRedirectUrl,
  buildFrontendConnectCallbackUrl,
  completeAuthorization,
  getProvider,
  listConnectableProfiles,
  startAuthorization,
  getRedirectUri
};
