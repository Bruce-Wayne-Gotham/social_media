const crypto = require("node:crypto");

const { httpError } = require("../../utils/httpError");

function createAutopilotPrompt({ clientName, strategy, count, platforms }) {
  const payload = {
    clientName,
    draftCount: count,
    targetPlatforms: platforms,
    strategy: {
      brandVoiceNotes: strategy.brand_voice_notes || "",
      contentDo: strategy.content_do || [],
      contentDont: strategy.content_dont || [],
      contentPillars: strategy.content_pillars || [],
      ctaStyle: strategy.cta_style || "",
      defaultHashtags: strategy.default_hashtags || [],
      bannedTerms: strategy.banned_terms || [],
      requiredDisclaimer: strategy.required_disclaimer || ""
    }
  };

  return [
    "You generate social media drafts for an agency workflow.",
    "Return strict JSON only and follow the provided schema.",
    "Each draft must be concise, platform-aware, and safe for approval review.",
    "Avoid banned terms, avoid exaggerated claims, and include the required disclaimer when provided.",
    "Provide an array of hashtags as plain strings when useful.",
    "",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

function extractTextFromResponse(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const text = output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .filter((item) => item?.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("")
    .trim();

  if (!text) {
    throw httpError("Autopilot provider returned an empty response", 502);
  }

  return text;
}

function normalizeHashtag(value) {
  const normalized = `${value || ""}`.trim().replace(/\s+/g, "");
  if (!normalized) {
    return "";
  }

  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

function parseDraftGenerationResponse(payload, expectedCount, strategy = {}) {
  const text = extractTextFromResponse(payload);
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    throw httpError("Autopilot provider returned invalid JSON", 502);
  }

  const drafts = Array.isArray(parsed?.drafts) ? parsed.drafts : null;
  if (!drafts || drafts.length !== expectedCount) {
    throw httpError("Autopilot provider returned an unexpected number of drafts", 502);
  }

  return drafts.map((draft, index) => {
    const content = typeof draft?.content === "string" ? draft.content.trim() : "";
    if (!content) {
      throw httpError(`Autopilot provider returned an empty draft at index ${index}`, 502);
    }

    const hashtags = [
      ...(strategy.default_hashtags || []),
      ...(Array.isArray(draft?.hashtags) ? draft.hashtags : [])
    ]
      .map(normalizeHashtag)
      .filter(Boolean);

    return {
      content,
      hashtags: Array.from(new Set(hashtags))
    };
  });
}

function createOpenAiAutopilotProvider({
  apiKey,
  baseUrl,
  model,
  project,
  requestTimeoutMs,
  fetchImpl = fetch
}) {
  async function generateDrafts(input) {
    if (!apiKey) {
      throw httpError("Autopilot is enabled but OPENAI_API_KEY is not configured", 503);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    const clientRequestId = crypto.randomUUID();

    try {
      const response = await fetchImpl(`${baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(project ? { "OpenAI-Project": project } : {}),
          "X-Client-Request-Id": clientRequestId
        },
        body: JSON.stringify({
          model,
          input: createAutopilotPrompt(input),
          text: {
            format: {
              type: "json_schema",
              name: "autopilot_draft_batch",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  drafts: {
                    type: "array",
                    minItems: input.count,
                    maxItems: input.count,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        content: { type: "string" },
                        hashtags: {
                          type: "array",
                          items: { type: "string" }
                        }
                      },
                      required: ["content", "hashtags"]
                    }
                  }
                },
                required: ["drafts"]
              }
            }
          }
        }),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || payload?.message || "Autopilot provider request failed";
        throw httpError(message, response.status >= 400 && response.status < 600 ? response.status : 502);
      }

      return {
        drafts: parseDraftGenerationResponse(payload, input.count, input.strategy),
        provider: "openai",
        model,
        requestId: response.headers.get("x-request-id") || clientRequestId,
        usage: {
          inputTokens: payload?.usage?.input_tokens || 0,
          outputTokens: payload?.usage?.output_tokens || 0,
          totalTokens: payload?.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      if (error.name === "AbortError") {
        throw httpError("Autopilot provider request timed out", 504);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    generateDrafts,
    name: "openai",
    model
  };
}

module.exports = {
  createAutopilotPrompt,
  createOpenAiAutopilotProvider,
  parseDraftGenerationResponse
};
