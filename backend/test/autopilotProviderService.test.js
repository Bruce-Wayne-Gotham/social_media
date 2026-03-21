const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOpenAiInput,
  createAutopilotProviderService
} = require("../src/services/autopilotProviderService");

function createStrategy() {
  return {
    brand_voice_notes: "Confident and practical",
    content_do: ["Lead with a customer result"],
    content_dont: ["Avoid hype"],
    content_pillars: ["Case studies", "Product education"],
    cta_style: "Invite readers to book a demo",
    default_hashtags: ["#B2B", "#Growth"],
    required_disclaimer: "Results vary."
  };
}

test("unsupported stub provider is rejected", async () => {
  assert.throws(
    () =>
      createAutopilotProviderService({
        config: {
          provider: "stub",
          openai: {}
        }
      }),
    /unsupported autopilot provider/i
  );
});

test("openai provider sends structured output request and parses drafts", async () => {
  let request;
  const service = createAutopilotProviderService({
    config: {
      provider: "openai",
      openai: {
        apiKey: "test-key",
        baseUrl: "https://example.com/v1",
        model: "gpt-4.1"
      }
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          id: "resp_123",
          model: "gpt-4.1",
          output_text: JSON.stringify({
            drafts: [
              { content: "Draft one" },
              { content: "Draft two" }
            ]
          }),
          usage: {
            input_tokens: 11,
            output_tokens: 22,
            total_tokens: 33
          }
        }),
        headers: {
          get: () => "resp_123"
        }
      };
    }
  });

  const result = await service.generateDrafts({
    clientName: "Northwind",
    strategy: createStrategy(),
    count: 2,
    platforms: ["linkedin", "instagram"]
  });

  const body = JSON.parse(request.options.body);

  assert.equal(request.url, "https://example.com/v1/responses");
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.schema.properties.drafts.minItems, 2);
  assert.equal(result.generationSource, "autopilot_ai");
  assert.deepEqual(result.drafts, ["Draft one", "Draft two"]);
  assert.equal(result.usage.totalTokens, 33);
});

test("openai provider rejects invalid structured output", async () => {
  const service = createAutopilotProviderService({
    config: {
      provider: "openai",
      openai: {
        apiKey: "test-key",
        baseUrl: "https://example.com/v1",
        model: "gpt-4.1"
      }
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        output_text: "not-json"
      }),
      headers: {
        get: () => null
      }
    })
  });

  await assert.rejects(
    () => service.generateDrafts({
      clientName: "Northwind",
      strategy: createStrategy(),
      count: 1,
      platforms: ["linkedin"]
    }),
    (error) => error.statusCode === 502 && /invalid json/i.test(error.message)
  );
});

test("buildOpenAiInput includes strategy guidance", () => {
  const prompt = buildOpenAiInput({
    clientName: "Northwind",
    strategy: createStrategy(),
    count: 1,
    platforms: ["linkedin"]
  });

  assert.match(prompt, /Northwind/);
  assert.match(prompt, /Results vary/);
  assert.match(prompt, /Case studies/);
});
