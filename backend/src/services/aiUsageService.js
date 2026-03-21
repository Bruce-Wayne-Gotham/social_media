const { query } = require("../config/db");
const { getAutopilotConfig } = require("../config/autopilot");
const { httpError } = require("../utils/httpError");

function getRateLimitIntervalSeconds(config) {
  return Math.max(1, Math.ceil(config.rateLimitWindowMs / 1000));
}

async function getWorkspaceUsageStats(workspaceId, config = getAutopilotConfig()) {
  const result = await query(
    `SELECT
       COUNT(*)::int AS request_count,
       COALESCE(SUM(requested_draft_count), 0)::int AS requested_draft_count,
       COALESCE(SUM(generated_draft_count), 0)::int AS generated_draft_count
     FROM autopilot_generation_usage
     WHERE workspace_id = $1
       AND feature_key = 'autopilot_generation'
       AND created_at >= NOW() - ($2 * INTERVAL '1 second')
       AND status IN ('reserved', 'succeeded', 'failed')`,
    [workspaceId, getRateLimitIntervalSeconds(config)]
  );

  return result.rows[0] || {
    request_count: 0,
    requested_draft_count: 0,
    generated_draft_count: 0
  };
}

async function assertWorkspaceAutopilotEnabled(workspaceId) {
  const config = getAutopilotConfig();
  if (!config.enabled) {
    throw httpError("Autopilot AI generation is currently disabled", 503);
  }

  const result = await query(
    `SELECT autopilot_generation_enabled
     FROM workspaces
     WHERE id = $1`,
    [workspaceId]
  );

  if (!result.rows.length) {
    throw httpError("Workspace not found", 404);
  }

  if (result.rows[0].autopilot_generation_enabled === false) {
    throw httpError("Autopilot AI generation is disabled for this workspace", 503);
  }
}

async function assertWithinRateLimit(workspaceId, requestedDraftCount) {
  const config = getAutopilotConfig();
  const usage = await getWorkspaceUsageStats(workspaceId, config);

  if (Number(usage.request_count || 0) + 1 > config.maxRequestsPerWindow) {
    throw httpError("Autopilot generation request limit exceeded for this workspace", 429);
  }

  if (Number(usage.requested_draft_count || 0) + requestedDraftCount > config.maxDraftsPerWindow) {
    throw httpError("Autopilot generation draft limit exceeded for this workspace", 429);
  }
}

async function createUsageRecord({ workspaceId, clientId, userId, provider, model, draftCount, status = "reserved", errorMessage = null }) {
  const result = await query(
    `INSERT INTO autopilot_generation_usage (
       workspace_id,
       client_id,
       user_id,
       feature_key,
       provider,
       model,
       requested_draft_count,
       generated_draft_count,
       status,
       error_message
     )
     VALUES ($1, $2, $3, 'autopilot_generation', $4, $5, $6, 0, $7, $8)
     RETURNING id`,
    [workspaceId, clientId, userId, provider, model, draftCount, status, errorMessage]
  );

  return result.rows[0]?.id || null;
}

async function markUsageSucceeded(requestId, { generatedDraftCount, promptTokens, completionTokens, providerResponseId }) {
  if (!requestId) {
    return;
  }

  await query(
    `UPDATE autopilot_generation_usage
     SET status = 'succeeded',
         generated_draft_count = $2,
         prompt_tokens = $3,
         completion_tokens = $4,
         provider_response_id = $5,
         error_message = NULL
     WHERE id = $1`,
    [requestId, generatedDraftCount, promptTokens, completionTokens, providerResponseId || null]
  );
}

async function markUsageFailed(requestId, error) {
  if (!requestId) {
    return;
  }

  await query(
    `UPDATE autopilot_generation_usage
     SET status = 'failed',
         error_message = $2
     WHERE id = $1`,
    [requestId, `${error?.message || "Unknown AI generation error"}`.slice(0, 2000)]
  );
}

module.exports = {
  assertWithinRateLimit,
  assertWorkspaceAutopilotEnabled,
  createUsageRecord,
  getWorkspaceUsageStats,
  markUsageFailed,
  markUsageSucceeded
};
