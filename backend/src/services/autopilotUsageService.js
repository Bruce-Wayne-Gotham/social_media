const { getAutopilotConfig } = require("../config/autopilot");
const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");

function createAutopilotUsageService({ queryFn = query, config = getAutopilotConfig() } = {}) {
  async function getWorkspaceUsageInWindow(workspaceId, now = new Date()) {
    const windowStart = new Date(now.getTime() - config.rateLimitWindowMs);
    const result = await queryFn(
      `SELECT
         COUNT(*)::int AS request_count,
         COALESCE(SUM(requested_count), 0)::int AS draft_count
       FROM workspace_ai_generation_usage
       WHERE workspace_id = $1
         AND status IN ('processing', 'succeeded', 'failed', 'disabled')
         AND created_at >= $2`,
      [workspaceId, windowStart.toISOString()]
    );

    return {
      requestCount: result.rows[0]?.request_count || 0,
      draftCount: result.rows[0]?.draft_count || 0
    };
  }

  async function assertWithinRateLimit({ workspaceId, requestedDraftCount, now = new Date() }) {
    const usage = await getWorkspaceUsageInWindow(workspaceId, now);

    if (usage.requestCount + 1 > config.rateLimitMaxRequests) {
      throw httpError("Autopilot rate limit exceeded for this workspace", 429);
    }

    if (usage.draftCount + requestedDraftCount > config.rateLimitMaxDrafts) {
      throw httpError("Autopilot draft quota exceeded for this workspace", 429);
    }
  }

  async function recordUsage({
    workspaceId,
    clientId,
    userId,
    provider,
    model,
    status,
    requestedDraftCount,
    generatedDraftCount,
    promptTokens,
    outputTokens,
    totalTokens,
    providerRequestId,
    errorMessage
  }) {
    const result = await queryFn(
      `INSERT INTO workspace_ai_generation_usage (
         workspace_id,
         client_id,
         user_id,
         provider,
         model,
         status,
         requested_count,
         generated_count,
         input_tokens,
         output_tokens,
         total_tokens,
         provider_request_id,
         error_message
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, created_at`,
      [
        workspaceId,
        clientId,
        userId,
        provider,
        model,
        status,
        requestedDraftCount,
        generatedDraftCount,
        promptTokens,
        outputTokens,
        totalTokens,
        providerRequestId,
        errorMessage || null
      ]
    );

    return result.rows[0] || null;
  }

  return {
    assertWithinRateLimit,
    getWorkspaceUsageInWindow,
    recordUsage
  };
}

const defaultService = createAutopilotUsageService();

module.exports = {
  assertWithinRateLimit: defaultService.assertWithinRateLimit,
  createAutopilotUsageService,
  getWorkspaceUsageInWindow: defaultService.getWorkspaceUsageInWindow,
  recordUsage: defaultService.recordUsage
};
