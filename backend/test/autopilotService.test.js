const test = require("node:test");
const assert = require("node:assert/strict");

const { createAutopilotService } = require("../src/services/autopilotService");

test("refuses generation when the feature flag is disabled", async () => {
  const service = createAutopilotService({
    getConfig: () => ({ enabled: false }),
    providerFactory: () => {
      throw new Error("should not be called");
    },
    enforceRateLimit: async () => {},
    recordUsage: async () => {}
  });

  await assert.rejects(
    () =>
      service.generateDrafts({
        workspaceId: "workspace-1",
        clientId: "client-1",
        userId: "user-1",
        clientName: "Northwind",
        strategy: {},
        count: 2,
        platforms: ["linkedin"]
      }),
    /currently disabled/i
  );
});

test("records workspace usage after successful generation", async () => {
  const recorded = [];
  const service = createAutopilotService({
    getConfig: () => ({ enabled: true }),
    providerFactory: () => ({
      generateDrafts: async () => ({
        drafts: [{ content: "One" }, { content: "Two" }],
        provider: "openai",
        model: "gpt-test",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      })
    }),
    enforceRateLimit: async () => {},
    recordUsage: async (entry) => {
      recorded.push(entry);
    }
  });

  const result = await service.generateDrafts({
    workspaceId: "workspace-1",
    clientId: "client-1",
    userId: "user-1",
    clientName: "Northwind",
    strategy: {},
    count: 2,
    platforms: ["linkedin"]
  });

  assert.equal(result.drafts.length, 2);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].workspaceId, "workspace-1");
  assert.equal(recorded[0].generatedDraftCount, 2);
  assert.equal(recorded[0].totalTokens, 30);
});

test("records failed attempts before surfacing provider errors", async () => {
  const recorded = [];
  const service = createAutopilotService({
    getConfig: () => ({ enabled: true }),
    providerFactory: () => ({
      generateDrafts: async () => {
        const error = new Error("provider down");
        error.statusCode = 502;
        throw error;
      }
    }),
    enforceRateLimit: async () => {},
    recordUsage: async (entry) => {
      recorded.push(entry);
    }
  });

  await assert.rejects(
    () =>
      service.generateDrafts({
        workspaceId: "workspace-1",
        clientId: "client-1",
        userId: "user-1",
        clientName: "Northwind",
        strategy: {},
        count: 2,
        platforms: ["linkedin"]
      }),
    /provider down/i
  );

  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].status, "failed");
  assert.equal(recorded[0].generatedDraftCount, 0);
});
