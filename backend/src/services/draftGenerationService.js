const { getAutopilotConfig } = require("../config/autopilot");
const { httpError } = require("../utils/httpError");
const {
  assertWithinRateLimit,
  assertWorkspaceAutopilotEnabled,
  createUsageRecord,
  markUsageFailed,
  markUsageSucceeded
} = require("./aiUsageService");
const { createOpenAIDraftProvider } = require("./providers/openAIDraftProvider");

function getProviderMetadata(config) {
  return {
    provider: config.provider,
    model: config.provider === "openai" ? config.openai.model : "unknown"
  };
}

function createProvider(config) {
  if (config.provider === "openai") {
    return createOpenAIDraftProvider(config.openai);
  }

  throw httpError(`Unsupported Autopilot AI provider: ${config.provider}`, 500);
}

async function generateDrafts({ workspaceId, clientId, userId, strategy, platforms, count }) {
  const config = getAutopilotConfig();
  const providerMetadata = getProviderMetadata(config);

  try {
    await assertWorkspaceAutopilotEnabled(workspaceId);
  } catch (error) {
    if (error.statusCode === 503) {
      await createUsageRecord({
        workspaceId,
        clientId,
        userId,
        provider: providerMetadata.provider,
        model: providerMetadata.model,
        draftCount: count,
        status: "disabled",
        errorMessage: error.message
      });
    }

    throw error;
  }

  try {
    await assertWithinRateLimit(workspaceId, count);
  } catch (error) {
    if (error.statusCode === 429) {
      await createUsageRecord({
        workspaceId,
        clientId,
        userId,
        provider: providerMetadata.provider,
        model: providerMetadata.model,
        draftCount: count,
        status: "rate_limited",
        errorMessage: error.message
      });
    }

    throw error;
  }

  const provider = createProvider(config);
  let requestId = null;

  try {
    requestId = await createUsageRecord({
      workspaceId,
      clientId,
      userId,
      provider: provider.providerName,
      model: provider.model,
      draftCount: count
    });

    const result = await provider.generateDrafts({
      strategy,
      platforms,
      count
    });

    await markUsageSucceeded(requestId, {
      generatedDraftCount: result.drafts.length,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      providerResponseId: result.usage.providerResponseId
    });

    return result;
  } catch (error) {
    await markUsageFailed(requestId, error);
    throw error;
  }
}

module.exports = {
  generateDrafts
};
