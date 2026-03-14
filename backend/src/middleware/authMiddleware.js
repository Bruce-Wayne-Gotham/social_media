const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "change-me");
    req.user = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = {
  requireAuth
};

