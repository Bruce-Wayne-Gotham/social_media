const { httpError } = require("../../../utils/httpError");
const { OpenAIDraftProvider } = require("./openaiDraftProvider");

function createDraftProvider(config, fetchImpl = fetch) {
  if (config.provider === "openai") {
    return new OpenAIDraftProvider(config, fetchImpl);
  }

  throw httpError(`Unsupported AI provider: ${config.provider}`, 500);
}

module.exports = {
  createDraftProvider
};
