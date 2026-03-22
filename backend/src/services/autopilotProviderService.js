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

function createAutopilotProviderService({ config = getAutopilotConfig(), fetchImpl } = {}) {
  if (config.provider !== "openai") {
    throw httpError(`Unsupported autopilot provider: ${config.provider}`, 500);
  }

  const provider = createAutopilotProvider({
    ...config,
    openAiApiKey: config.openAiApiKey || config.openai?.apiKey || "",
    openAiBaseUrl: config.openAiBaseUrl || config.openai?.baseUrl || "",
    openAiModel: config.openAiModel || config.openai?.model || "",
    openAiProject: config.openAiProject || config.openai?.project || "",
    requestTimeoutMs: config.requestTimeoutMs || config.openai?.requestTimeoutMs,
    fetchImpl
  });

  return {
    provider: provider.name,
    async generateDrafts(input) {
      const result = await provider.generateDrafts(input);
      return {
        provider: result.provider,
        generationSource: "autopilot_ai",
        drafts: result.drafts.map((draft) => draft.content),
        usage: {
          totalTokens: result.usage?.totalTokens || 0
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
