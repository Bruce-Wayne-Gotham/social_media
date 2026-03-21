const test = require("node:test");
const assert = require("node:assert/strict");

const { createAutopilotUsageService } = require("../src/services/autopilotUsageService");

test("assertWithinRateLimit allows usage under the caps", async () => {
  const service = createAutopilotUsageService({
    config: {
      maxRequestsPerWindow: 3,
      maxDraftsPerWindow: 10,
      rateLimitWindowMs: 60000
    },
    queryFn: async () => ({
      rows: [{ request_count: 1, draft_count: 4 }]
    })
  });

  await assert.doesNotReject(() => service.assertWithinRateLimit({
    workspaceId: "workspace-1",
    requestedDraftCount: 2
  }));
});

test("assertWithinRateLimit blocks when request cap is exceeded", async () => {
  const service = createAutopilotUsageService({
    config: {
      maxRequestsPerWindow: 2,
      maxDraftsPerWindow: 10,
      rateLimitWindowMs: 60000
    },
    queryFn: async () => ({
      rows: [{ request_count: 2, draft_count: 4 }]
    })
  });

  await assert.rejects(
    () => service.assertWithinRateLimit({
      workspaceId: "workspace-1",
      requestedDraftCount: 1
    }),
    (error) => error.statusCode === 429 && /rate limit/i.test(error.message)
  );
});

test("assertWithinRateLimit blocks when draft cap is exceeded", async () => {
  const service = createAutopilotUsageService({
    config: {
      maxRequestsPerWindow: 5,
      maxDraftsPerWindow: 5,
      rateLimitWindowMs: 60000
    },
    queryFn: async () => ({
      rows: [{ request_count: 1, draft_count: 5 }]
    })
  });

  await assert.rejects(
    () => service.assertWithinRateLimit({
      workspaceId: "workspace-1",
      requestedDraftCount: 1
    }),
    (error) => error.statusCode === 429 && /quota/i.test(error.message)
  );
});

test("recordUsage inserts a workspace usage row", async () => {
  let captured;
  const service = createAutopilotUsageService({
    config: {
      maxRequestsPerWindow: 5,
      maxDraftsPerWindow: 5,
      rateLimitWindowMs: 60000
    },
    queryFn: async (_sql, params) => {
      captured = params;
      return {
        rows: [{ id: "usage-1", created_at: "2026-03-21T00:00:00.000Z" }]
      };
    }
  });

  const result = await service.recordUsage({
    workspaceId: "workspace-1",
    clientId: "client-1",
    userId: "user-1",
    provider: "openai",
    model: "gpt-4.1",
    status: "succeeded",
    requestedDraftCount: 2,
    generatedDraftCount: 2,
    promptTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
    providerRequestId: "resp_1"
  });

  assert.equal(captured[0], "workspace-1");
  assert.equal(captured[5], "succeeded");
  assert.equal(result.id, "usage-1");
});
