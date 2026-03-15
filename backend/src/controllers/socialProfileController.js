const socialAccountService = require("../services/socialAccountService");
const { startAuthorization } = require("../services/socialOAuthService");

async function listProfiles(req, res, next) {
  try {
    const profiles = await socialAccountService.getSocialAccountsByClient(req.user.sub, req.params.clientId);
    res.json({ profiles });
  } catch (error) {
    next(error);
  }
}

async function startOAuth(req, res, next) {
  try {
    // Authz: ensure the user can access this client before initiating OAuth.
    await socialAccountService.getSocialAccountsByClient(req.user.sub, req.params.clientId);
    const connection = await startAuthorization({
      platform: req.params.platform,
      userId: req.user.sub,
      clientId: req.params.clientId
    });
    res.json(connection);
  } catch (error) {
    next(error);
  }
}

async function disconnect(req, res, next) {
  try {
    const result = await socialAccountService.disconnectSocialAccount(req.user.sub, req.params.socialProfileId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  disconnect,
  listProfiles,
  startOAuth
};
