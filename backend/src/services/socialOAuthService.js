const { normalizePlatform } = require("../utils/platforms");
const { fetchJson } = require("../utils/http");
const {
  createOAuthState,
  verifyOAuthState
} = require("../utils/oauthState");

const META_API_VERSION = process.env.META_API_VERSION || "v23.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || "202502";

const PROVIDERS = {
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email", "w_member_social"]
  },
  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    authorizationUrl: `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`,
    scopes: [
      "instagram_business_basic",
      "instagram_business_content_publish",
      "pages_show_list",
      "business_management"
    ]
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

  params.set("state", createOAuthState(statePayload));

  const authUrl = new URL(provider.authorizationUrl);
  authUrl.search = params.toString();

  return {
    platform: provider.platform,
    authUrl: authUrl.toString()
  };
}

async function exchangeCodeForToken(provider, code, redirectUri, statePayload) {
  if (provider.platform === "linkedin") {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: redirectUri
    });

    return fetchJson(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
  }

  if (provider.platform === "instagram") {
    const url = new URL(provider.tokenUrl);
    url.searchParams.set("client_id", provider.clientId);
    url.searchParams.set("client_secret", provider.clientSecret);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("code", code);

    return fetchJson(url.toString());
  }

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

  throw new Error(`Unsupported platform: ${provider.platform}`);
}

async function resolveAccountProfile(provider, accessToken) {
  if (provider.platform === "linkedin") {
    const profile = await fetchJson("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      accountName: profile.name || profile.localizedFirstName || profile.email || "linkedin-account",
      providerAccountId: profile.sub || profile.email || "linkedin"
    };
  }

  if (provider.platform === "instagram") {
    const profile = await fetchJson(
      `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=instagram_business_account{id,username},name&access_token=${encodeURIComponent(accessToken)}`
    );

    const page = (profile.data || []).find((item) => item.instagram_business_account?.id);
    if (!page) {
      throw new Error("No Instagram business account is linked to this Facebook account");
    }

    return {
      accountName: page.instagram_business_account.username || page.name || "instagram-account",
      providerAccountId: page.instagram_business_account.id
    };
  }

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

  throw new Error(`Unsupported platform: ${provider.platform}`);
}

async function listConnectableProfiles(provider, accessToken) {
  // Keep this minimal and reliable. We return an array even if we can only detect one profile.
  if (provider.platform === "linkedin") {
    const profile = await resolveAccountProfile(provider, accessToken);
    return [
      {
        providerAccountId: profile.providerAccountId,
        accountName: profile.accountName,
        kind: "member"
      }
    ];
  }

  if (provider.platform === "instagram") {
    const profile = await resolveAccountProfile(provider, accessToken);
    return [
      {
        providerAccountId: profile.providerAccountId,
        accountName: profile.accountName,
        kind: "business_account"
      }
    ];
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
  getRedirectUri,
  LINKEDIN_VERSION,
  META_API_VERSION
};
