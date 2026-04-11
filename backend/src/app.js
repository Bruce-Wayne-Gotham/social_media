const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const clientRoutes = require("./routes/clientRoutes");
const socialAccountRoutes = require("./routes/socialAccountRoutes");
const socialProfileRoutes = require("./routes/socialProfileRoutes");
const oauthConnectSessionRoutes = require("./routes/oauthConnectSessionRoutes");
const postRoutes = require("./routes/posts");
const approvalMagicLinkRoutes = require("./routes/approvalMagicLinkRoutes");
const mediaAssetRoutes = require("./routes/mediaAssetRoutes");
const trackedLinkRoutes = require("./routes/trackedLinkRoutes");
const billingRoutes = require("./routes/billingRoutes");
const trackedLinkController = require("./controllers/trackedLinkController");
const billingController = require("./controllers/billingController");
const { UPLOAD_ROOT } = require("./config/media");

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false
}));
const isProduction = process.env.NODE_ENV === "production";
const configuredFrontendUrl = process.env.FRONTEND_URL;
const allowedOrigins = new Set(
  [
    configuredFrontendUrl,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000"
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!isProduction) return callback(null, true);
      return callback(null, allowedOrigins.has(origin));
    },
    credentials: true
  })
);
app.options("*", cors());
app.use(morgan("dev"));
app.post("/api/billing/webhooks/stripe", express.raw({ type: "application/json" }), billingController.handleStripeWebhook);
app.use(express.json({ limit: "1mb" }));
app.use("/media", express.static(path.resolve(UPLOAD_ROOT)));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/l/:code", trackedLinkController.redirect);
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/social-accounts", socialAccountRoutes);
app.use("/api/social-profiles", socialProfileRoutes);
app.use("/api/oauth-connect-sessions", oauthConnectSessionRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/approval-links", approvalMagicLinkRoutes);
app.use("/api/media-assets", mediaAssetRoutes);
app.use("/api/tracked-links", trackedLinkRoutes);
app.use("/api/billing", billingRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);

  // Contract-compliant errors from the new API layer.
  if (err.isApiError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.details != null) body.error.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  if (err && (err.name === "ZodError" || Array.isArray(err.issues))) {
    const issue = err.issues?.[0];
    const message = issue?.message || "Invalid request payload.";
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
  }

  res.status(err.statusCode || 500).json({
    error: { code: "INTERNAL_ERROR", message: err.message || "Internal server error" }
  });
});

module.exports = app;
