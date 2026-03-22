const { query } = require("../config/db");
const { createAutopilotProvider } = require("./autopilotProvider");
const { createAutopilotUsageService } = require("./autopilotUsageService");
const { assertWithinWorkspacePlanLimit } = require("./billingService");

async function getWorkspaceAutopilotSnapshot(workspaceId) {
  const config = getAutopilotConfig();
  const [workspaceResult, usage] = await Promise.all([
    query(
      `SELECT autopilot_generation_enabled
       FROM workspaces
       WHERE id = $1`,
      [workspaceId]
    ),
    getWorkspaceUsageStats(workspaceId, config)
  ]);

  const workspaceEnabled = workspaceResult.rows[0]?.autopilot_generation_enabled !== false;

  return {
    provider: config.provider,
    enabled: config.enabled && workspaceEnabled,
    envEnabled: config.enabled,
    workspaceEnabled,
    rateLimitWindowSeconds: config.rateLimitWindowSeconds,
    rateLimitMaxDrafts: config.rateLimitMaxDrafts,
    rateLimitMaxRequests: config.rateLimitMaxRequests,
    draftsGeneratedInWindow: usage.draftCount,
    requestsInWindow: usage.requestCount
  };
}

function createAutopilotService({
  getConfig = getAutopilotConfig,
  providerFactory = createAutopilotProvider,
  enforceRateLimit,
  recordUsage,
  assertWorkspaceEnabled,
  queryFn = query
} = {}) {
  const workspaceEnabledAssertion = assertWorkspaceEnabled || (async ({ workspaceId, config }) => {
    const snapshot = await getWorkspaceAutopilotSnapshot(workspaceId, {
      queryFn,
      getConfig: () => config
    });

    if (!snapshot.workspaceEnabled) {
      const error = new Error("Autopilot draft generation is disabled for this workspace");
      error.statusCode = 503;
      throw error;
    }
  });

  const rateLimitEnforcer = enforceRateLimit || (({ workspaceId, requestedDraftCount, config }) => {
    const usageService = createAutopilotUsageService({ queryFn, config });
    return usageService.assertWithinRateLimit({ workspaceId, requestedDraftCount });
  });

  const usageRecorder = recordUsage || ((entry) => {
    const usageService = createAutopilotUsageService({
      queryFn,
      config: getConfig()
    });
    return usageService.recordUsage(entry);
  });

  async function recordGuardFailure({
    workspaceId,
    clientId,
    userId,
    platforms,
    count,
    config,
    status,
    error
  }) {
    await usageRecorder({
      workspaceId,
      clientId,
      userId,
      provider: config.provider,
      model: config.openAiModel || config.openai?.model || null,
      platforms,
      status,
      requestedDraftCount: count,
      generatedDraftCount: 0,
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      providerRequestId: null,
      errorMessage: error.message
    });
  }

  return {
    async generateDrafts({ workspaceId, clientId, userId, clientName, strategy, count, platforms }) {
      const config = getConfig();
      try {
        assertAutopilotEnabled(config);
      } catch (error) {
        await recordGuardFailure({
          workspaceId,
          clientId,
          userId,
          platforms,
          count,
          config,
          status: "disabled",
          error
        });
        throw error;
      }

      try {
        await workspaceEnabledAssertion({ workspaceId, config });
      } catch (error) {
        if (error.statusCode === 503) {
          await recordGuardFailure({
            workspaceId,
            clientId,
            userId,
            platforms,
            count,
            config,
            status: "disabled",
            error
          });
        }
        throw error;
      }

      try {
        await rateLimitEnforcer({ workspaceId, requestedDraftCount: count, config });
      } catch (error) {
        if (error.statusCode === 429) {
          await recordGuardFailure({
            workspaceId,
            clientId,
            userId,
            platforms,
            count,
            config,
            status: "rate_limited",
            error
          });
        }
        throw error;
      }

      await assertWithinWorkspacePlanLimit({
        workspaceId,
        metric: "aiCredits",
        amount: count
      });

      const provider = providerFactory(config);

      try {
        const result = await provider.generateDrafts({
          workspaceId,
          clientId,
          userId,
          clientName: clientName || strategy.name,
          strategy,
          count,
          platforms
        });

        await usageRecorder({
          workspaceId,
          clientId,
          userId,
          provider: result.provider || provider.name || config.provider,
          model: result.model || provider.model || config.openai?.model || null,
          platforms,
          status: "succeeded",
          requestedDraftCount: count,
          generatedDraftCount: Array.isArray(result.drafts) ? result.drafts.length : 0,
          promptTokens: result.usage?.promptTokens ?? result.usage?.inputTokens ?? 0,
          outputTokens: result.usage?.outputTokens ?? result.usage?.completionTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
          providerRequestId: result.requestId ?? result.usage?.providerResponseId ?? null,
          errorMessage: null
        });

        return result;
      } catch (error) {
        await usageRecorder({
          workspaceId,
          clientId,
          userId,
          provider: config.provider,
          model: config.openai?.model || null,
          platforms,
          status: "failed",
          requestedDraftCount: count,
          generatedDraftCount: 0,
          promptTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          providerRequestId: null,
          errorMessage: error.message
        });
        throw error;
      }
    }
  };
}

module.exports = {
  generateDrafts: draftGenerationService.generateDrafts,
  generateAutopilotDrafts: draftGenerationService.generateDrafts,
  getWorkspaceAutopilotSnapshot
};
