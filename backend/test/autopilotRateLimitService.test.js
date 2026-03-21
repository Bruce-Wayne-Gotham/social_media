const test = require("node:test");
const assert = require("node:assert/strict");

const { assertWithinAutopilotRateLimit } = require("../src/services/autopilotRateLimitService");

const baseConfig = {
  rateLimitWindowMinutes: 60,
  rateLimitRequests: 2,
  rateLimitDrafts: 6
};

test("allows requests inside the workspace window limits", () => {
  assert.doesNotThrow(() => {
    assertWithinAutopilotRateLimit({
      usage: { request_count: 1, requested_draft_count: 3 },
      requestedDraftCount: 3,
      config: baseConfig
    });
  });
});

test("blocks requests when the workspace request budget is exhausted", () => {
  assert.throws(
    () =>
      assertWithinAutopilotRateLimit({
        usage: { request_count: 2, requested_draft_count: 1 },
        requestedDraftCount: 1,
        config: baseConfig
      }),
    /request limit exceeded/i
  );
});

test("blocks requests when the workspace draft budget is exhausted", () => {
  assert.throws(
    () =>
      assertWithinAutopilotRateLimit({
        usage: { request_count: 1, requested_draft_count: 6 },
        requestedDraftCount: 1,
        config: baseConfig
      }),
    /draft limit exceeded/i
  );
});
