const test = require("node:test");
const assert = require("node:assert/strict");

const { assertAutopilotEnabled, getAutopilotConfig } = require("../src/config/autopilot");

test("getAutopilotConfig reads env overrides", () => {
  const config = getAutopilotConfig({
    AUTOPILOT_ENABLED: "true",
    AUTOPILOT_PROVIDER: "stub",
    AUTOPILOT_RATE_LIMIT_MAX_REQUESTS: "7",
    AUTOPILOT_RATE_LIMIT_MAX_DRAFTS: "15",
    AUTOPILOT_RATE_LIMIT_WINDOW_MS: "90000",
    AUTOPILOT_OPENAI_MODEL: "gpt-5",
    OPENAI_API_KEY: "key"
  });

  assert.equal(config.enabled, true);
  assert.equal(config.provider, "stub");
  assert.equal(config.maxRequestsPerWindow, 7);
  assert.equal(config.maxDraftsPerWindow, 15);
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
