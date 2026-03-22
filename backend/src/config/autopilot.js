const { httpError } = require("../utils/httpError");

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(`${value}`.trim().toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAutopilotConfig(env = process.env) {
  const rateLimitWindowMs = parseNumber(
    env.AUTOPILOT_RATE_LIMIT_WINDOW_MS,
    parseNumber(env.AUTOPILOT_AI_RATE_LIMIT_WINDOW_SECONDS ?? env.AUTOPILOT_RATE_LIMIT_WINDOW_SECONDS, 3600) * 1000
  );

  const openAiApiKey = (env.OPENAI_API_KEY || env.AUTOPILOT_OPENAI_API_KEY || "").trim();
  const openAiBaseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
  const openAiModel = (env.OPENAI_MODEL || env.AUTOPILOT_OPENAI_MODEL || env.AUTOPILOT_MODEL || "gpt-5-mini").trim();
  const openAiProject = (env.OPENAI_PROJECT_ID || "").trim();
  const requestTimeoutMs = parseNumber(env.AUTOPILOT_REQUEST_TIMEOUT_MS, 30000);
  const enabled = parseBoolean(env.AUTOPILOT_AI_ENABLED ?? env.AUTOPILOT_ENABLED, false);
  const provider = (env.AUTOPILOT_AI_PROVIDER || env.AUTOPILOT_PROVIDER || "openai").trim().toLowerCase();
  const rateLimitMaxRequests = parseNumber(
    env.AUTOPILOT_AI_RATE_LIMIT_MAX_REQUESTS ?? env.AUTOPILOT_RATE_LIMIT_MAX_REQUESTS ?? env.AUTOPILOT_RATE_LIMIT_REQUESTS,
    10
  );
  const rateLimitMaxDrafts = parseNumber(
    env.AUTOPILOT_AI_RATE_LIMIT_MAX_DRAFTS ?? env.AUTOPILOT_RATE_LIMIT_MAX_DRAFTS ?? env.AUTOPILOT_RATE_LIMIT_DRAFTS,
    30
  );

  return {
    enabled,
    provider,
    rateLimitWindowMs,
    rateLimitWindowSeconds: Math.ceil(rateLimitWindowMs / 1000),
    rateLimitWindowMinutes: Math.max(1, Math.ceil(rateLimitWindowMs / 60000)),
    rateLimitMaxRequests,
    rateLimitMaxDrafts,
    maxRequestsPerWindow: rateLimitMaxRequests,
    maxDraftsPerWindow: rateLimitMaxDrafts,
    requestTimeoutMs,
    openAiApiKey,
    openAiBaseUrl,
    openAiModel,
    openAiProject,
    model: openAiModel,
    openai: {
      apiKey: openAiApiKey,
      baseUrl: openAiBaseUrl,
      model: openAiModel,
      project: openAiProject,
      requestTimeoutMs,
      temperature: Number.isFinite(Number(env.OPENAI_TEMPERATURE)) ? Number(env.OPENAI_TEMPERATURE) : 0.4
    }
  };
}

function assertAutopilotEnabled(config = getAutopilotConfig()) {
  if (!config.enabled) {
    throw httpError("Autopilot draft generation is currently disabled", 503);
  }
}

const autopilotConfig = getAutopilotConfig();

module.exports = {
  autopilotConfig,
  assertAutopilotEnabled,
  getAutopilotConfig,
  AUTOPILOT_ENABLED: autopilotConfig.enabled,
  AUTOPILOT_PROVIDER: autopilotConfig.provider,
  AUTOPILOT_RATE_LIMIT_REQUESTS: autopilotConfig.rateLimitMaxRequests,
  AUTOPILOT_RATE_LIMIT_WINDOW_MINUTES: autopilotConfig.rateLimitWindowMinutes,
  AUTOPILOT_RATE_LIMIT_WINDOW_SECONDS: autopilotConfig.rateLimitWindowSeconds,
  AUTOPILOT_RATE_LIMIT_MAX_DRAFTS: autopilotConfig.rateLimitMaxDrafts,
  AUTOPILOT_OPENAI_MODEL: autopilotConfig.openAiModel,
  AUTOPILOT_REQUEST_TIMEOUT_MS: autopilotConfig.requestTimeoutMs
};
