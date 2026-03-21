const { httpError } = require("../../../utils/httpError");
const { buildDraftPrompt } = require("../promptBuilder");

function extractMessageContent(message) {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
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

async function parseErrorResponse(response) {
  try {
    const payload = await response.json();
    return payload?.error?.message || payload?.message || "";
  } catch (_error) {
    return "";
  }
}

class OpenAIDraftProvider {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async generateDrafts(request) {
    if (!this.config.apiKey) {
      throw httpError("AI provider is not configured: missing AI_API_KEY", 500);
    }

    const prompt = buildDraftPrompt(request);
    const response = await this.fetchImpl(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.7,
        response_format: {
          type: "json_object"
        },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ]
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    if (!response.ok) {
      const detail = await parseErrorResponse(response);
      const statusCode = response.status === 429 ? 503 : 502;
      throw httpError(detail || `AI provider request failed with status ${response.status}`, statusCode);
    }

    const payload = await response.json();
    const content = extractMessageContent(payload?.choices?.[0]?.message);

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_error) {
      throw httpError("AI provider returned an invalid draft payload", 502);
    }

    return {
      prompt,
      drafts: Array.isArray(parsed?.drafts) ? parsed.drafts : []
    };
  }
}

module.exports = {
  OpenAIDraftProvider
};
