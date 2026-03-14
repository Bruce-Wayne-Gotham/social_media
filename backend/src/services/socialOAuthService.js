const { normalizePlatform } = require("../utils/platforms");
const { fetchJson } = require("../utils/http");
const {
  createCodeVerifier,
  createCodeChallenge,
  createOAuthState,
  verifyOAuthState
} = require("../utils/oauthState");

const META_API_VERSION = process.env.META_API_VERSION || "v23.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || "202502";

const PROVIDERS = {
  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"]
  },
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
    throw new Error(`Missing OAuth client ID for ${normalizedPlatform}`);
  }

  return { ...provider, platform: normalizedPlatform };
}

function getRedirectUri(platform) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:4000";
  return `${baseUrl}/api/social-accounts/oauth/${platform}/callback`;
}

function buildBasicAuth(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    return null;
  }

  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
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

function getExpiry(expiresIn) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
}

async function startAuthorization({ platform, userId }) {
  const provider = getProvider(platform);
  const redirectUri = getRedirectUri(provider.platform);
  const statePayload = {
    platform: provider.platform,
    userId
  };

  const params = new URLSearchParams({
    response_type: "code",
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    scope: provider.scopes.join(" "),
    state: ""
  });

  if (provider.platform === "twitter") {
    const codeVerifier = createCodeVerifier();
    statePayload.codeVerifier = codeVerifier;
    params.set("code_challenge", createCodeChallenge(codeVerifier));
    params.set("code_challenge_method", "S256");
  }

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
  if (provider.platform === "twitter") {
    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      code_verifier: statePayload.codeVerifier
    });

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const basicAuth = buildBasicAuth(provider.clientId, provider.clientSecret);
    if (basicAuth) {
      headers.Authorization = `Basic ${basicAuth}`;
    }

    return fetchJson(provider.tokenUrl, {
      method: "POST",
      headers,
      body: body.toString()
    });
  }

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
  if (provider.platform === "twitter") {
    const profile = await fetchJson("https://api.x.com/2/users/me?user.fields=name,username", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      accountName: profile.data?.username || profile.data?.name || "twitter-account"
    };
  }

  if (provider.platform === "linkedin") {
    const profile = await fetchJson("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      accountName: profile.name || profile.localizedFirstName || profile.email || "linkedin-account"
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
      accountName: page.instagram_business_account.username || page.name || "instagram-account"
    };
  }

  if (provider.platform === "youtube") {
    const profile = await fetchJson("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      accountName: profile.name || profile.email || "youtube-account"
    };
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
    platform: provider.platform,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiry: getExpiry(tokenResponse.expires_in),
    accountName: profile.accountName
  };
}

module.exports = {
  buildFrontendRedirectUrl,
  completeAuthorization,
  getProvider,
  startAuthorization,
  getRedirectUri,
  LINKEDIN_VERSION,
  META_API_VERSION
};
