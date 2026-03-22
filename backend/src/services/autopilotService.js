const { query } = require("../config/db");
const { getAutopilotConfig } = require("../config/autopilot");
const { getWorkspaceUsageStats } = require("./aiUsageService");
const draftGenerationService = require("./draftGenerationService");

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
    draftsGeneratedInWindow: Number(usage.generated_draft_count || 0),
    requestsInWindow: Number(usage.request_count || 0)
  };
}

module.exports = {
  generateDrafts: draftGenerationService.generateDrafts,
  generateAutopilotDrafts: draftGenerationService.generateDrafts,
  getWorkspaceAutopilotSnapshot
};
