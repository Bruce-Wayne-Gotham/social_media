const test = require("node:test");
const assert = require("node:assert/strict");

const { assertAutopilotEnabled, getAutopilotConfig } = require("../src/config/autopilot");

test("getAutopilotConfig reads env overrides", () => {
  const config = getAutopilotConfig({
    AUTOPILOT_AI_ENABLED: "true",
    AUTOPILOT_AI_PROVIDER: "openai",
    AUTOPILOT_AI_RATE_LIMIT_MAX_REQUESTS: "7",
    AUTOPILOT_AI_RATE_LIMIT_MAX_DRAFTS: "15",
    AUTOPILOT_RATE_LIMIT_WINDOW_MS: "90000",
    OPENAI_MODEL: "gpt-5",
    OPENAI_API_KEY: "key"
  });

  assert.equal(config.enabled, true);
  assert.equal(config.provider, "openai");
  assert.equal(config.rateLimitMaxRequests, 7);
  assert.equal(config.rateLimitMaxDrafts, 15);
  assert.equal(config.rateLimitWindowMs, 90000);
  assert.equal(config.openai.model, "gpt-5");
  assert.equal(config.openai.apiKey, "key");
});

test("assertAutopilotEnabled rejects disabled config", () => {
  assert.throws(
    () => assertAutopilotEnabled({ enabled: false }),
    (error) => error.statusCode === 503 && /disabled/i.test(error.message)
  );
});
