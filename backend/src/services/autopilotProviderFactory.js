const { getAutopilotConfig } = require("../config/autopilot");
const { httpError } = require("../utils/httpError");
const { createOpenAiAutopilotProvider } = require("./autopilotProviders/openaiProvider");

function createAutopilotProvider(config = getAutopilotConfig()) {
  if (config.provider === "openai") {
    return createOpenAiAutopilotProvider({
      apiKey: config.openAiApiKey,
      baseUrl: config.openAiBaseUrl,
      model: config.openAiModel,
      requestTimeoutMs: config.requestTimeoutMs
    });
  }

  throw httpError(`Unsupported Autopilot provider: ${config.provider}`, 500);
}

module.exports = {
  createAutopilotProvider
};
