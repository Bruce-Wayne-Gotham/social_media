const { query } = require("../../config/db");
const { getAiConfig } = require("../../config/ai");
const { httpError } = require("../../utils/httpError");
const { assertClientAccess } = require("../accessService");
const { createDraftProvider } = require("./providers");

function normalizeTextList(values) {
  return (values || []).map((value) => `${value}`.trim()).filter(Boolean);
}

function getPromptSize(prompt) {
  return `${prompt?.system || ""}${prompt?.user || ""}`.length;
}

function getResponseSize(drafts) {
  return JSON.stringify(drafts || []).length;
}

function normalizeGeneratedDrafts(drafts, strategy, expectedCount) {
  if (!Array.isArray(drafts) || drafts.length < expectedCount) {
    throw httpError("AI provider returned fewer drafts than requested", 502);
  }

  return drafts.slice(0, expectedCount).map((draft, index) => {
    const content = `${draft?.content || ""}`.trim();
    if (!content) {
      throw httpError(`AI provider returned an empty draft at position ${index + 1}`, 502);
    }

    return {
      content,
      hashtags: normalizeTextList(draft?.hashtags).length
        ? normalizeTextList(draft.hashtags)
        : normalizeTextList(strategy.default_hashtags)
    };
  });
}

async function getClientStrategy(dbQuery, clientId) {
  const result = await dbQuery(
    `SELECT
       id,
       workspace_id,
       name,
       brand_voice_notes,
       content_do,
       content_dont,
       content_pillars,
       cta_style,
       default_hashtags,
       banned_terms,
       required_disclaimer
     FROM clients
     WHERE id = $1`,
    [clientId]
  );

  return result.rows[0] || null;
}

async function getUsageSnapshot(dbQuery, workspaceId, windowMinutes) {
  const [requestsResult, draftsResult] = await Promise.all([
    dbQuery(
      `SELECT COUNT(*)::int AS request_count
       FROM ai_generation_usage_events
       WHERE workspace_id = $1
         AND status IN ('succeeded', 'failed')
         AND created_at >= NOW() - make_interval(mins => $2::int)`,
      [workspaceId, windowMinutes]
    ),
    dbQuery(
      `SELECT COALESCE(SUM(generated_draft_count), 0)::int AS drafts_generated_today
       FROM ai_generation_usage_events
       WHERE workspace_id = $1
         AND status = 'succeeded'
         AND created_at >= DATE_TRUNC('day', NOW())`,
      [workspaceId]
    )
  ]);

  return {
    requestCount: requestsResult.rows[0]?.request_count || 0,
    draftsGeneratedToday: draftsResult.rows[0]?.drafts_generated_today || 0
  };
}

async function enforceWorkspacePolicy(dbQuery, workspaceId, requestCount, config) {
  const snapshot = await getUsageSnapshot(dbQuery, workspaceId, config.rateLimit.windowMinutes);

  if (snapshot.requestCount >= config.rateLimit.requestsPerWindow) {
    throw httpError(
      `This workspace has reached the AI draft request limit for the last ${config.rateLimit.windowMinutes} minutes`,
      429
    );
  }

  if (snapshot.draftsGeneratedToday + requestCount > config.rateLimit.draftsPerDay) {
    throw httpError("This workspace has reached its daily AI draft limit", 429);
  }
}

async function recordUsageEvent(dbQuery, event) {
  await dbQuery(
    `INSERT INTO ai_generation_usage_events
       (workspace_id, client_id, user_id, provider, model, requested_draft_count, generated_draft_count, prompt_chars, response_chars, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      event.workspaceId,
      event.clientId,
      event.userId,
      event.provider,
      event.model,
      event.requestedDraftCount,
      event.generatedDraftCount,
      event.promptChars,
      event.responseChars,
      event.status,
      event.errorMessage || null
    ]
  );
}

function createDraftGenerationService(dependencies = {}) {
  const dbQuery = dependencies.query || query;
  const getConfig = dependencies.getAiConfig || getAiConfig;
  const assertAccess = dependencies.assertClientAccess || assertClientAccess;
  const getProvider = dependencies.createDraftProvider || createDraftProvider;

  return {
    async generateDrafts({ userId, clientId, payload }) {
      const config = getConfig();

      if (!config.enabled) {
        throw httpError("AI draft generation is currently disabled", 503);
      }

      const access = await assertAccess(userId, clientId);
      const strategy = await getClientStrategy(dbQuery, clientId);

      if (!strategy) {
        throw httpError("Client not found", 404);
      }

      await enforceWorkspacePolicy(dbQuery, access.workspace_id, payload.count, config);

      const provider = getProvider(config);

      try {
        const result = await provider.generateDrafts({
          clientName: strategy.name,
          strategy,
          count: payload.count,
          platforms: payload.platforms
        });

        const drafts = normalizeGeneratedDrafts(result.drafts, strategy, payload.count);

        await recordUsageEvent(dbQuery, {
          workspaceId: access.workspace_id,
          clientId,
          userId,
          provider: config.provider,
          model: config.model,
          requestedDraftCount: payload.count,
          generatedDraftCount: drafts.length,
          promptChars: getPromptSize(result.prompt),
          responseChars: getResponseSize(drafts),
          status: "succeeded"
        });

        return {
          drafts,
          strategy
        };
      } catch (error) {
        await recordUsageEvent(dbQuery, {
          workspaceId: access.workspace_id,
          clientId,
          userId,
          provider: config.provider,
          model: config.model,
          requestedDraftCount: payload.count,
          generatedDraftCount: 0,
          promptChars: 0,
          responseChars: 0,
          status: "failed",
          errorMessage: error.message
        });
        throw error;
      }
    }
  };
}

const draftGenerationService = createDraftGenerationService();

module.exports = {
  createDraftGenerationService,
  enforceWorkspacePolicy,
  getClientStrategy,
  getUsageSnapshot,
  normalizeGeneratedDrafts,
  recordUsageEvent,
  ...draftGenerationService
};
