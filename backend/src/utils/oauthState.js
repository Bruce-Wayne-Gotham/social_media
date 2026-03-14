const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function getSecret() {
  return process.env.JWT_SECRET || "change-me";
}

function createCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function createCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function createOAuthState(payload) {
  return jwt.sign(
    {
      type: "oauth",
      ...payload
    },
    getSecret(),
    { expiresIn: "10m" }
  );
}

function verifyOAuthState(token) {
  const payload = jwt.verify(token, getSecret());

  if (payload.type !== "oauth") {
    throw new Error("Invalid OAuth state");
  }

  return payload;
}

module.exports = {
  createCodeVerifier,
  createCodeChallenge,
  createOAuthState,
  verifyOAuthState
};
