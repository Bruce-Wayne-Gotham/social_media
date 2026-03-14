const { connectAccountSchema } = require("../validators/socialAccountValidators");
const socialAccountService = require("../services/socialAccountService");
const {
  buildFrontendRedirectUrl,
  completeAuthorization,
  startAuthorization
} = require("../services/socialOAuthService");

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
    await socialAccountService.upsertSocialAccount(payload.userId, payload);

    res.redirect(buildFrontendRedirectUrl(platform, "success"));
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
