const { getAutopilotConfig } = require("../config/autopilot");
const { httpError } = require("../utils/httpError");
const { createOpenAiAutopilotProvider } = require("./autopilotProviders/openaiProvider");

const providerFactories = {
  openai: (config) =>
    createOpenAiAutopilotProvider({
      apiKey: config.openAiApiKey,
      baseUrl: config.openAiBaseUrl,
      model: config.openAiModel,
      project: config.openAiProject,
      requestTimeoutMs: config.requestTimeoutMs,
      fetchImpl: config.fetchImpl
    })
};

function createAutopilotProvider(config = getAutopilotConfig()) {
  const factory = providerFactories[config.provider];
  if (!factory) {
    throw httpError(`Unsupported Autopilot provider: ${config.provider}`, 500);
  }

  return factory(config);
}

module.exports = {
  createAutopilotProvider,
  providerFactories
};
