const { connectAccountSchema } = require("../validators/socialAccountValidators");
const socialAccountService = require("../services/socialAccountService");
const {
  buildFrontendRedirectUrl,
  buildFrontendConnectCallbackUrl,
  completeAuthorization,
  listConnectableProfiles,
  startAuthorization
} = require("../services/socialOAuthService");
const oauthConnectSessionService = require("../services/oauthConnectSessionService");

async function listAccounts(req, res, next) {
  try {
    const accounts = await socialAccountService.getSocialAccountsByUser(req.user.sub);
    res.json({ accounts });
  } catch (error) {
    next(error);
  }
}

async function connectAccount(req, res, next) {
  try {
    const payload = connectAccountSchema.parse(req.body);
    const account = await socialAccountService.upsertSocialAccount(req.user.sub, payload);
    res.status(201).json({ account });
  } catch (error) {
    next(error);
  }
}

async function startOAuth(req, res, next) {
  try {
    const connection = await startAuthorization({
      platform: req.params.platform,
      userId: req.user.sub
    });

    res.json(connection);
  } catch (error) {
    next(error);
  }
}

async function completeOAuth(req, res) {
  const platform = req.params.platform;

  try {
    const code = req.query.code;
    const state = req.query.state;

    if (!code || !state) {
      throw new Error("Missing OAuth code or state");
    }

    const payload = await completeAuthorization({ platform, code, state });
    const candidates = await listConnectableProfiles(
      { platform: payload.platform },
      payload.accessToken
    );

    const session = await oauthConnectSessionService.createSession({
      userId: payload.userId,
      clientId: payload.clientId,
      platform: payload.platform,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiry: payload.expiry,
      candidates
    });

    res.redirect(buildFrontendConnectCallbackUrl(session.id));
  } catch (error) {
    console.error(error);
    res.redirect(buildFrontendRedirectUrl(platform, "error", error.message));
  }
}

module.exports = {
  listAccounts,
  connectAccount,
  startOAuth,
  completeOAuth
};
