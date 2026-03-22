const { assertAutopilotEnabled, getAutopilotConfig } = require("../config/autopilot");
const { httpError } = require("../utils/httpError");

function normalizeTextList(values) {
  return (values || []).map((value) => `${value}`.trim()).filter(Boolean);
}

function buildStubDraft({ clientName, strategy, index, platforms }) {
  const pillarList = normalizeTextList(strategy.content_pillars);
  const pillar = pillarList[index % (pillarList.length || 1)] || `${clientName} client service`;
  const platformLabel = platforms.map((platform) => platform[0].toUpperCase() + platform.slice(1)).join(", ");
  const voiceSentence = strategy.brand_voice_notes
    ? `Voice: ${strategy.brand_voice_notes.replace(/\s+/g, " ").trim()}.`
    : "Voice: clear, agency-ready, and client-safe.";
  const doSentence = strategy.content_do.length
    ? `Do: ${strategy.content_do[index % strategy.content_do.length]}.`
    : "Do: focus on a concrete business outcome.";
  const dontSentence = strategy.content_dont.length
    ? `Avoid: ${strategy.content_dont[index % strategy.content_dont.length]}.`
    : "Avoid: vague claims or overpromising.";
  const ctaSentence = strategy.cta_style
    ? `CTA: ${strategy.cta_style}.`
    : "CTA: invite the audience to reply or book a call.";
  const disclaimer = strategy.required_disclaimer ? `\n\n${strategy.required_disclaimer}` : "";

  return `${clientName} draft ${index + 1} for ${platformLabel}: ${pillar}.\n\n${voiceSentence} ${doSentence} ${dontSentence} ${ctaSentence}${disclaimer}`;
}

function buildOpenAiInput({ clientName, strategy, count, platforms }) {
  const pillars = normalizeTextList(strategy.content_pillars).join(", ") || "general client service";
  const contentDo = normalizeTextList(strategy.content_do).join("; ") || "Focus on clear business outcomes.";
  const contentDont = normalizeTextList(strategy.content_dont).join("; ") || "Avoid vague or exaggerated claims.";
  const hashtags = normalizeTextList(strategy.default_hashtags).join(" ") || "None";
  const disclaimer = `${strategy.required_disclaimer || ""}`.trim() || "None";
  const voice = `${strategy.brand_voice_notes || ""}`.trim() || "Clear, agency-ready, and client-safe.";
  const cta = `${strategy.cta_style || ""}`.trim() || "Invite the audience to reply or book a call.";

  return [
    "You generate production-ready social post drafts for an agency content workflow.",
    `Return exactly ${count} draft objects.`,
    "Each draft must be platform-aware, client-safe, and ready for human approval.",
    "Do not wrap the response in markdown or add commentary.",
    `Client: ${clientName}`,
    `Platforms: ${platforms.join(", ")}`,
    `Brand voice: ${voice}`,
    `Content pillars: ${pillars}`,
    `Do: ${contentDo}`,
    `Avoid: ${contentDont}`,
    `CTA style: ${cta}`,
    `Default hashtags for context only: ${hashtags}`,
    `Required disclaimer: ${disclaimer}`,
    "Each draft should be distinct and usable as a standalone caption."
  ].join("\n");
}

function buildDraftSchema(count) {
  return {
    type: "object",
    properties: {
      drafts: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          properties: {
            content: {
              type: "string",
              minLength: 1
            }
          },
          required: ["content"],
          additionalProperties: false
        }
      }
    },
    required: ["drafts"],
    additionalProperties: false
  };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const messages = Array.isArray(payload?.output) ? payload.output : [];
  for (const message of messages) {
    for (const content of message?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }

  return "";
}

function createAutopilotProviderService({ config = getAutopilotConfig(), fetchImpl = global.fetch } = {}) {
  return {
    async generateDrafts({ clientName, strategy, count, platforms }) {
      if (config.provider === "stub") {
        return {
          provider: "stub",
          generationSource: "autopilot_stub",
          drafts: Array.from({ length: count }, (_, index) => buildStubDraft({
            clientName,
            strategy,
            index,
            platforms
          })),
          usage: {
            totalTokens: 0
          }
        };
      }

      if (config.provider !== "openai") {
        throw httpError(`Unsupported autopilot provider: ${config.provider}`, 500);
      }

      if (!config.openai?.apiKey) {
        throw httpError("Autopilot AI provider is not configured", 503);
      }

      const response = await fetchImpl(`${config.openai.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.openai.model,
          store: false,
          input: buildOpenAiInput({ clientName, strategy, count, platforms }),
          text: {
            format: {
              type: "json_schema",
              name: "autopilot_drafts",
              strict: true,
              schema: buildDraftSchema(count)
            }
          }
        })
      });

      const payload = JSON.parse(await response.text());
      const outputText = extractOutputText(payload);
      if (!outputText) {
        throw httpError("Autopilot provider returned invalid structured output", 502);
      }

      let parsed;
      try {
        parsed = JSON.parse(outputText);
      } catch (_error) {
        throw httpError("Autopilot provider returned invalid structured output", 502);
      }

      const drafts = Array.isArray(parsed?.drafts) ? parsed.drafts : null;
      if (!Array.isArray(drafts) || drafts.length !== count) {
        throw httpError("Autopilot provider returned invalid structured output", 502);
      }

      return {
        provider: "openai",
        generationSource: "autopilot_openai",
        drafts: drafts.map((draft) => `${draft.content || ""}`.trim()),
        usage: {
          totalTokens: payload?.usage?.total_tokens || 0
        }
      };
    }
  };
}

function getAutopilotProvider(config = getAutopilotConfig()) {
  assertAutopilotEnabled(config);
  return createAutopilotProviderService({ config });
}

module.exports = {
  buildOpenAiInput,
  createAutopilotProviderService,
  getAutopilotProvider
};
