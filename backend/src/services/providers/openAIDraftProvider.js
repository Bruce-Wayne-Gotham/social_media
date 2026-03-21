const { fetchJson } = require("../../utils/http");
const { httpError } = require("../../utils/httpError");

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
    `Default hashtags available separately in the product: ${hashtags}. Do not include hashtag-only lines unless they improve the draft.`,
    `Banned terms that must not appear: ${bannedTerms}.`,
    disclaimer,
    'Return valid JSON only with this shape: {"drafts":[{"content":"..."}]}',
    "Each draft must be a complete post body with no markdown fences, no commentary, and no extra keys."
  ].join("\n");
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

function normalizeDrafts(rawPayload, expectedCount) {
  const drafts = Array.isArray(rawPayload?.drafts) ? rawPayload.drafts : null;
  if (!drafts || drafts.length !== expectedCount) {
    throw httpError("AI provider returned an unexpected draft count", 502);
  }

  return drafts.map((draft, index) => {
    const content = `${draft?.content || ""}`.trim();
    if (!content) {
      throw httpError(`AI provider returned an empty draft at position ${index + 1}`, 502);
    }

    return { content };
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
      const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs || 30000);

      let response;
      try {
        response = await fetchJson(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
            ...(config.project ? { "OpenAI-Project": config.project } : {})
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: config.model,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "You generate concise, brand-safe social media drafts and always respond with valid JSON."
              },
              {
                role: "user",
                content: prompt
              }
            ]
          })
        });
      } catch (error) {
        if (error.name === "AbortError") {
          throw httpError("OpenAI draft generation timed out", 504);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      const rawText = extractMessageContent(response.choices?.[0]);
      const parsed = JSON.parse(extractJson(rawText));
      const drafts = normalizeDrafts(parsed, input.count);

      return {
        drafts,
        usage: {
          provider: "openai",
          model: config.model,
          promptTokens: Number(response.usage?.prompt_tokens) || 0,
          completionTokens: Number(response.usage?.completion_tokens) || 0,
          providerResponseId: response.id || null
        }
      };
    }
  };
}

module.exports = {
  createOpenAIDraftProvider,
  _internal: {
    extractJson,
    extractMessageContent,
    normalizeDrafts
  }
};
