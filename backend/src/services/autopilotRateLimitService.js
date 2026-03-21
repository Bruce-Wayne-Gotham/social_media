const { getAutopilotConfig } = require("../config/autopilot");
const { httpError } = require("../utils/httpError");
const { getWorkspaceUsageInWindow } = require("./autopilotUsageService");

function assertWithinAutopilotRateLimit({ usage, requestedDraftCount, config }) {
  const maxRequests = config.maxRequestsPerWindow ?? config.rateLimitRequests;
  const maxDrafts = config.maxDraftsPerWindow ?? config.rateLimitDrafts;
  const windowMinutes = config.rateLimitWindowMinutes ?? Math.max(1, Math.ceil((config.rateLimitWindowMs || 60000) / 60000));
  const nextRequestCount = Number(usage?.request_count || usage?.requestCount || 0) + 1;
  const nextDraftCount = Number(usage?.requested_draft_count || usage?.draft_count || usage?.draftCount || 0) + requestedDraftCount;

  if (nextRequestCount > maxRequests) {
    throw httpError(
      `Autopilot request limit exceeded for this workspace. Try again after ${windowMinutes} minutes.`,
      429
    );
  }

  if (nextDraftCount > maxDrafts) {
    throw httpError(
      `Autopilot draft limit exceeded for this workspace. Try again after ${windowMinutes} minutes.`,
      429
    );
  }
}

async function enforceWorkspaceAutopilotRateLimit(workspaceId, requestedDraftCount, config = getAutopilotConfig()) {
  const usage = await getWorkspaceUsageInWindow(workspaceId, new Date());
  assertWithinAutopilotRateLimit({ usage, requestedDraftCount, config });
}

module.exports = {
  assertWithinAutopilotRateLimit,
  enforceWorkspaceAutopilotRateLimit
};
