const { autopilotConfig } = require("../../config/autopilot");
const { httpError } = require("../../utils/httpError");
const openaiAutopilotProvider = require("./providers/openaiAutopilotProvider");

function getAutopilotProvider() {
  if (!autopilotConfig.enabled) {
    throw httpError("Autopilot AI generation is currently disabled", 503);
  }

  if (autopilotConfig.provider === "openai") {
    return openaiAutopilotProvider;
  }

  throw httpError(`Unsupported Autopilot provider: ${autopilotConfig.provider}`, 500);
}

module.exports = {
  getAutopilotProvider
};
