const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_REQUESTS_PER_WINDOW = 10;
const DEFAULT_WINDOW_MINUTES = 60;
const DEFAULT_DRAFTS_PER_DAY = 100;

function parseBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(`${value}`.trim().toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getAiConfig() {
  return {
    enabled: parseBoolean(process.env.AI_DRAFT_GENERATION_ENABLED, false),
    provider: (process.env.AI_PROVIDER || "openai").trim().toLowerCase(),
    baseUrl: (process.env.AI_BASE_URL || DEFAULT_BASE_URL).trim(),
    apiKey: (process.env.AI_API_KEY || "").trim(),
    model: (process.env.AI_MODEL || DEFAULT_MODEL).trim(),
    timeoutMs: parseNumber(process.env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    rateLimit: {
      requestsPerWindow: parseNumber(
        process.env.AI_RATE_LIMIT_REQUESTS_PER_WINDOW,
        DEFAULT_REQUESTS_PER_WINDOW
      ),
      windowMinutes: parseNumber(
        process.env.AI_RATE_LIMIT_WINDOW_MINUTES,
        DEFAULT_WINDOW_MINUTES
      ),
      draftsPerDay: parseNumber(
        process.env.AI_RATE_LIMIT_DRAFTS_PER_DAY,
        DEFAULT_DRAFTS_PER_DAY
      )
    }
  };
}

module.exports = {
  getAiConfig
};
