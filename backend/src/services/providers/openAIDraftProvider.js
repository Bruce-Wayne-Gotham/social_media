const { httpError } = require("../../utils/httpError");

const OUTPUT_SCHEMA_NAME = "autopilot_draft_batch";

function stringifyList(items, fallback) {
  return items.length ? items.join(", ") : fallback;
}

function buildPrompt({ strategy, platforms, count }) {
  const platformList = platforms.join(", ");
  const contentDo = stringifyList(strategy.content_do, "Highlight one concrete business outcome.");
  const contentDont = stringifyList(strategy.content_dont, "Avoid vague claims, fluff, and overpromising.");
  const pillars = stringifyList(strategy.content_pillars, `${strategy.name} services`);
  const hashtags = stringifyList(strategy.default_hashtags, "none");
  const disclaimer = strategy.required_disclaimer
    ? `Include this exact disclaimer verbatim at the end of every draft: ${strategy.required_disclaimer}`
    : "No disclaimer is required.";
  const bannedTerms = stringifyList(strategy.banned_terms, "none");

  return [
    `Generate ${count} distinct approval-ready social media draft posts for the client \"${strategy.name}\".`,
    `The drafts should work for these platforms: ${platformList}.`,
    `Brand voice: ${strategy.brand_voice_notes || "Clear, confident, agency-ready, and client-safe."}`,
    `Content pillars to rotate through: ${pillars}.`,
    `Things to do: ${contentDo}.`,
    `Things to avoid: ${contentDont}.`,
    `Call to action style: ${strategy.cta_style || "Invite the audience to reply, learn more, or book a call."}`,
    `Default hashtags available separately in the product: ${hashtags}.`,
    `Banned terms that must not appear: ${bannedTerms}.`,
    disclaimer,
    "Return valid JSON only that matches the provided schema.",
    "Each draft must be a complete post body with no markdown fences, no commentary, and no extra keys."
  ].join("\n");
}

function buildResponseSchema(expectedCount) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["drafts"],
    properties: {
      drafts: {
        type: "array",
        minItems: expectedCount,
        maxItems: expectedCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["content"],
          properties: {
            content: {
              type: "string",
              minLength: 1,
              maxLength: 4000
            }
          }
        }
      }
    }
  };
}

function extractMessageContent(choice) {
  const content = choice?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item?.text === "string") {
          return item.text;
        }

        if (typeof item?.text?.value === "string") {
          return item.text.value;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function extractJson(text) {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) {
    throw httpError("AI provider returned an empty draft payload", 502);
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of outputItems) {
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      if (content?.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return "";
}

function normalizeDrafts(rawPayload, expectedCount, strategy = { default_hashtags: [] }) {
  const drafts = Array.isArray(rawPayload?.drafts) ? rawPayload.drafts : null;
  if (!drafts || drafts.length !== expectedCount) {
    throw httpError("AI provider returned an unexpected draft count", 502);
  }

  return drafts.map((draft, index) => {
    const content = `${draft?.content || ""}`.trim();
    if (!content) {
      throw httpError(`AI provider returned an empty draft at position ${index + 1}`, 502);
    }

    return {
      content,
      hashtags: Array.isArray(strategy.default_hashtags) ? strategy.default_hashtags : []
    };
  });
}

function createOpenAIDraftProvider(config) {
  if (!config.apiKey) {
    throw httpError("OPENAI_API_KEY is required when Autopilot AI is enabled", 503);
  }

  return {
    providerName: "openai",
    model: config.model,
    async generateDrafts(input) {
      const prompt = buildPrompt(input);
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), config.requestTimeoutMs || 30000);

      try {
        const response = await fetch(`${config.baseUrl}/responses`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
            ...(config.project ? { "OpenAI-Project": config.project } : {})
          },
          body: JSON.stringify({
            model: config.model,
            store: false,
            input: prompt,
            text: {
              format: {
                type: "json_schema",
                name: OUTPUT_SCHEMA_NAME,
                strict: true,
                schema: buildResponseSchema(input.count)
              }
            }
          })
        });

        const rawBody = await response.text();
        let payload = {};

        if (rawBody) {
          try {
            payload = JSON.parse(rawBody);
          } catch (_error) {
            payload = {};
          }
        }

        if (!response.ok) {
          const message = payload?.error?.message || rawBody || "AI provider request failed";
          throw httpError(message, response.status >= 500 ? 503 : 502);
        }

        const rawText = extractOutputText(payload);
        if (!rawText) {
          throw httpError("AI provider returned an empty draft payload", 502);
        }

        const parsed = JSON.parse(extractJson(rawText));
        const drafts = normalizeDrafts(parsed, input.count, input.strategy);
        return {
          drafts,
          usage: {
            provider: "openai",
            model: payload.model || config.model,
            promptTokens: Number(payload.usage?.input_tokens) || 0,
            completionTokens: Number(payload.usage?.output_tokens) || 0,
            totalTokens: Number(payload.usage?.total_tokens) || 0,
            providerResponseId: payload.id || null
          }
        };
      } catch (error) {
        if (error.name === "AbortError") {
          throw httpError("AI provider request timed out", 504);
        }

        if (error instanceof SyntaxError) {
          throw httpError("AI provider returned invalid JSON", 502);
        }

        throw error.statusCode ? error : httpError(error.message || "AI provider request failed", 502);
      } finally {
        clearTimeout(timeoutHandle);
      }
    }
  };
}

module.exports = {
  createOpenAIDraftProvider,
  _internal: {
    buildPrompt,
    extractJson,
    extractMessageContent,
    normalizeDrafts
  }
};
