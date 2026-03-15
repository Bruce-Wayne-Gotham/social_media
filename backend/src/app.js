const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const clientRoutes = require("./routes/clientRoutes");
const socialAccountRoutes = require("./routes/socialAccountRoutes");
const socialProfileRoutes = require("./routes/socialProfileRoutes");
const oauthConnectSessionRoutes = require("./routes/oauthConnectSessionRoutes");
const postRoutes = require("./routes/postRoutes");

const app = express();

app.use(helmet());
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
      // Non-browser clients (curl, server-to-server) often send no Origin.
      if (!origin) return callback(null, true);

      // For local dev, be permissive to avoid "Failed to fetch" from CORS mismatches.
      if (!isProduction) return callback(null, true);

      return callback(null, allowedOrigins.has(origin));
    },
    credentials: true
  })
);
app.options("*", cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/social-accounts", socialAccountRoutes);
app.use("/api/social-profiles", socialProfileRoutes);
app.use("/api/oauth-connect-sessions", oauthConnectSessionRoutes);
app.use("/api/posts", postRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);

  // Convert Zod's verbose issue arrays into a single friendly message.
  if (err && (err.name === "ZodError" || Array.isArray(err.issues))) {
    const issue = err.issues?.[0];
    const message = issue?.message || "Invalid request payload.";
    return res.status(400).json({ error: message });
  }

  res.status(err.statusCode || 500).json({
    error: err.message || "Internal server error"
  });
});

module.exports = app;

