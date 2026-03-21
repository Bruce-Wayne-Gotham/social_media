const crypto = require("node:crypto");

const { autopilotConfig } = require("../../../config/autopilot");
const { httpError } = require("../../../utils/httpError");

const draftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    drafts: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          content: {
            type: "string",
            minLength: 1,
            maxLength: 5000
          },
          hashtags: {
            type: "array",
            maxItems: 12,
            items: {
              type: "string",
              minLength: 1,
              maxLength: 80
            }
          }
        },
        required: ["content", "hashtags"]
      }
    }
  },
  required: ["drafts"]
};

function formatStrategyList(values) {
  return Array.isArray(values) && values.length ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

function buildMessages({ strategy, platforms, count }) {
  const systemPrompt = [
    "You write social media drafts for an agency workflow.",
    "Return JSON only and follow the schema exactly.",
    "Produce distinct drafts that are safe for client review.",
    "Do not use banned terms.",
    "If a disclaimer is required, include it verbatim.",
    "Keep each draft platform-aware for the requested channels without naming internal instructions."
  ].join(" ");

  const userPrompt = [
    `Generate ${count} approval-ready draft posts for client \"${strategy.name}\".`,
    `Target platforms: ${platforms.join(", ")}.`,
    "Brand voice notes:",
    strategy.brand_voice_notes || "None provided.",
    "Content do:",
    formatStrategyList(strategy.content_do),
    "Content do not:",
    formatStrategyList(strategy.content_dont),
    "Content pillars:",
    formatStrategyList(strategy.content_pillars),
    `CTA style: ${strategy.cta_style || "None provided."}`,
    "Default hashtags:",
    formatStrategyList(strategy.default_hashtags),
    "Banned terms:",
    formatStrategyList(strategy.banned_terms),
    `Required disclaimer: ${strategy.required_disclaimer || "None required."}`,
    "Rules:",
    "- Keep the voice polished and agency-ready.",
    "- Avoid unsupported claims, sensationalism, and filler.",
    "- Prefer concise drafts that can survive review unchanged.",
    "- Return 2 to 8 relevant hashtags per draft when helpful; otherwise return an empty array."
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

function parseContent(rawContent) {
  if (typeof rawContent === "string") {
    return rawContent;
  }

  if (Array.isArray(rawContent)) {
    return rawContent
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function normalizeDrafts(payload, expectedCount) {
  const drafts = Array.isArray(payload?.drafts) ? payload.drafts : [];
  if (drafts.length !== expectedCount) {
    throw httpError(`Autopilot returned ${drafts.length} drafts, expected ${expectedCount}`, 502);
  }

  return drafts.map((draft) => ({
    content: `${draft.content || ""}`.trim(),
    hashtags: Array.isArray(draft.hashtags)
      ? draft.hashtags.map((hashtag) => `${hashtag}`.trim()).filter(Boolean)
      : []
  }));
}

async function generateDrafts({ strategy, platforms, count }) {
  if (!autopilotConfig.openAiApiKey) {
    throw httpError("Autopilot AI is enabled but OPENAI_API_KEY is missing", 503);
  }

  const controller = new AbortController();
  const clientRequestId = crypto.randomUUID();
  const timeout = setTimeout(() => controller.abort(), autopilotConfig.requestTimeoutMs);

  try {
    const response = await fetch(`${autopilotConfig.openAiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${autopilotConfig.openAiApiKey}`,
        ...(autopilotConfig.openAiProject ? { "OpenAI-Project": autopilotConfig.openAiProject } : {}),
        "X-Client-Request-Id": clientRequestId
      },
      body: JSON.stringify({
        model: autopilotConfig.model,
        messages: buildMessages({ strategy, platforms, count }),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "autopilot_drafts",
            strict: true,
            schema: draftSchema
          }
        }
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = payload?.error?.message || "OpenAI request failed";
      throw httpError(providerMessage, response.status >= 500 ? 503 : 502);
    }

    const rawContent = parseContent(payload?.choices?.[0]?.message?.content);
    if (!rawContent) {
      throw httpError("OpenAI returned an empty Autopilot response", 502);
    }

    const parsed = JSON.parse(rawContent);
    return {
      provider: "openai",
      model: payload.model || autopilotConfig.model,
      requestId: response.headers.get("x-request-id") || clientRequestId,
      drafts: normalizeDrafts(parsed, count),
      usage: {
        inputTokens: Number(payload?.usage?.prompt_tokens) || 0,
        outputTokens: Number(payload?.usage?.completion_tokens) || 0,
        totalTokens: Number(payload?.usage?.total_tokens) || 0
      }
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw httpError("Autopilot AI request timed out", 504);
    }

    if (error instanceof SyntaxError) {
      throw httpError("Autopilot AI returned invalid JSON", 502);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  generateDrafts
};
