const { httpError } = require("../utils/httpError");
const { getAutopilotConfig } = require("../config/autopilot");
const { createAutopilotPrompt } = require("./autopilotProviders/openaiProvider");
const { createAutopilotProvider } = require("./autopilotProvider");

function buildOpenAiInput({ clientName, strategy, count, platforms }) {
  return createAutopilotPrompt({ clientName, strategy, count, platforms });
}

function createStubProviderService() {
  return {
    provider: "stub",
    async generateDrafts({ clientName, count, platforms }) {
      return {
        provider: "stub",
        generationSource: "autopilot_stub",
        drafts: Array.from({ length: count }, (_, index) => ({
          content: `${clientName} draft ${index + 1} for ${platforms.join(", ")}`
        }))
      };
    }
  };
}

function createLegacyOpenAiProviderService(config, fetchImpl = fetch) {
  const openai = config.openai || {};
  if (!openai.apiKey) {
    throw httpError("OPENAI_API_KEY is required when Autopilot AI is enabled", 503);
  }

  return {
    provider: "openai",
    async generateDrafts(input) {
      const response = await fetchImpl(`${openai.baseUrl.replace(/\/+$/, "")}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openai.apiKey}`
        },
        body: JSON.stringify({
          model: openai.model,
          input: buildOpenAiInput(input),
          text: {
            format: {
              type: "json_schema",
              schema: {
                type: "object",
                properties: {
                  drafts: {
                    type: "array",
                    minItems: input.count,
                    maxItems: input.count,
                    items: {
                      type: "object",
                      properties: {
                        content: { type: "string" }
                      },
                      required: ["content"]
                    }
                  }
                },
                required: ["drafts"]
              }
            }
          }
        })
      });

      const payload = JSON.parse(await response.text());
      const drafts = Array.isArray(payload?.output_text)
        ? payload.output_text
        : JSON.parse(payload.output_text || "{}").drafts;

      if (!Array.isArray(drafts) || drafts.length !== input.count) {
        throw httpError("Autopilot provider returned invalid structured output", 502);
      }

      return {
        provider: "openai",
        generationSource: "autopilot_openai",
        drafts: drafts.map((draft) => draft.content),
        usage: {
          totalTokens: payload?.usage?.total_tokens || 0
        }
      };
    }
  };
}

function createAutopilotProviderService({ config = getAutopilotConfig(), fetchImpl } = {}) {
  if (config.provider === "stub") {
    return createStubProviderService();
  }

  if (config.provider === "openai") {
    return createLegacyOpenAiProviderService(config, fetchImpl);
  }

  throw httpError(`Unsupported autopilot provider: ${config.provider}`, 500);
}

function getAutopilotProvider(config = getAutopilotConfig()) {
  return createAutopilotProvider(config);
}

module.exports = {
  buildOpenAiInput,
  createAutopilotProviderService,
  getAutopilotProvider
};
