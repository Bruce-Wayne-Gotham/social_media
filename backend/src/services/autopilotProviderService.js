const { httpError } = require("../utils/httpError");
const { getAutopilotConfig } = require("../config/autopilot");
const { createAutopilotPrompt } = require("./autopilotProviders/openaiProvider");
const { createAutopilotProvider } = require("./autopilotProvider");

function buildOpenAiInput({ clientName, strategy, count, platforms }) {
  return createAutopilotPrompt({ clientName, strategy, count, platforms });
}

function createAutopilotProviderService({ config = getAutopilotConfig(), fetchImpl } = {}) {
  if (config.provider !== "openai") {
    throw httpError(`Unsupported autopilot provider: ${config.provider}`, 500);
  }

  const provider = createAutopilotProvider({
    ...config,
    openAiApiKey: config.openAiApiKey || config.openai?.apiKey || "",
    openAiBaseUrl: config.openAiBaseUrl || config.openai?.baseUrl || "",
    openAiModel: config.openAiModel || config.openai?.model || "",
    openAiProject: config.openAiProject || config.openai?.project || "",
    requestTimeoutMs: config.requestTimeoutMs || config.openai?.requestTimeoutMs,
    fetchImpl
  });

  return {
    provider: provider.name,
    async generateDrafts(input) {
      const result = await provider.generateDrafts(input);
      return {
        provider: result.provider,
        generationSource: "autopilot_ai",
        drafts: result.drafts.map((draft) => draft.content),
        usage: {
          totalTokens: result.usage?.totalTokens || 0
        }
      };
    }
  };
}

function getAutopilotProvider(config = getAutopilotConfig()) {
  return createAutopilotProvider(config);
}

module.exports = {
  buildOpenAiInput,
  createAutopilotProviderService,
  getAutopilotProvider
};
