const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDraftGenerationService,
  normalizeGeneratedDrafts
} = require("../../src/services/autopilot/draftGenerationService");

test("normalizeGeneratedDrafts falls back to default hashtags", () => {
  const drafts = normalizeGeneratedDrafts(
    [{ content: "Hello team", hashtags: [] }],
    { default_hashtags: ["agency", "growth"] },
    1
  );

  assert.deepEqual(drafts, [
    {
      content: "Hello team",
      hashtags: ["agency", "growth"]
    }
  ]);
});

test("generateDrafts rejects when feature flag is disabled", async () => {
  const service = createDraftGenerationService({
    getAiConfig: () => ({
      enabled: false
    })
  });

  await assert.rejects(
    () => service.generateDrafts({
      userId: "user-1",
      clientId: "client-1",
      payload: { count: 1, platforms: ["linkedin"] }
    }),
    (error) => error.statusCode === 503
  );
});

test("generateDrafts records successful usage and returns normalized drafts", async () => {
  const queries = [];
  const service = createDraftGenerationService({
    getAiConfig: () => ({
      enabled: true,
      provider: "openai",
      model: "gpt-test",
      rateLimit: {
        requestsPerWindow: 10,
        windowMinutes: 60,
        draftsPerDay: 20
      }
    }),
    assertClientAccess: async () => ({
      workspace_id: "workspace-1"
    }),
    query: async (text) => {
      queries.push(text);
      if (text.includes("FROM ai_generation_usage_events") && text.includes("COUNT(*)::int")) {
        return { rows: [{ request_count: 0 }] };
      }
      if (text.includes("SUM(generated_draft_count)")) {
        return { rows: [{ drafts_generated_today: 2 }] };
      }
      if (text.includes("FROM clients")) {
        return {
          rows: [{
            id: "client-1",
            workspace_id: "workspace-1",
            name: "Northwind",
            brand_voice_notes: "Plainspoken",
            content_do: ["Lead with results"],
            content_dont: ["Be vague"],
            content_pillars: ["Operations"],
            cta_style: "Reply for details",
            default_hashtags: ["northwind"],
            banned_terms: [],
            required_disclaimer: ""
          }]
        };
      }
      if (text.includes("INSERT INTO ai_generation_usage_events")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    },
    createDraftProvider: () => ({
      generateDrafts: async () => ({
        prompt: {
          system: "system",
          user: "user"
        },
        drafts: [
          { content: "Draft one", hashtags: ["northwind"] },
          { content: "Draft two", hashtags: [] }
        ]
      })
    })
  });

  const result = await service.generateDrafts({
    userId: "user-1",
    clientId: "client-1",
    payload: {
      count: 2,
      platforms: ["linkedin"]
    }
  });

  assert.equal(result.drafts.length, 2);
  assert.deepEqual(result.drafts[1].hashtags, ["northwind"]);
  assert.ok(queries.some((text) => text.includes("INSERT INTO ai_generation_usage_events")));
});

test("generateDrafts rejects when workspace has exceeded its daily quota", async () => {
  const service = createDraftGenerationService({
    getAiConfig: () => ({
      enabled: true,
      provider: "openai",
      model: "gpt-test",
      rateLimit: {
        requestsPerWindow: 10,
        windowMinutes: 60,
        draftsPerDay: 3
      }
    }),
    assertClientAccess: async () => ({
      workspace_id: "workspace-1"
    }),
    query: async (text) => {
      if (text.includes("COUNT(*)::int")) {
        return { rows: [{ request_count: 0 }] };
      }
      if (text.includes("SUM(generated_draft_count)")) {
        return { rows: [{ drafts_generated_today: 2 }] };
      }
      if (text.includes("FROM clients")) {
        return {
          rows: [{
            id: "client-1",
            workspace_id: "workspace-1",
            name: "Northwind"
          }]
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  await assert.rejects(
    () => service.generateDrafts({
      userId: "user-1",
      clientId: "client-1",
      payload: {
        count: 2,
        platforms: ["linkedin"]
      }
    }),
    (error) => error.statusCode === 429
  );
});
