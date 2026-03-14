const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const socialAccountRoutes = require("./routes/socialAccountRoutes");
const postRoutes = require("./routes/postRoutes");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/social-accounts", socialAccountRoutes);
app.use("/api/posts", postRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    error: err.message || "Internal server error"
  });
});

module.exports = app;

