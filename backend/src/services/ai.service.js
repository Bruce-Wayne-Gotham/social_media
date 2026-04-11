"use strict";

// AI adaptation service.
// Uses fetch() to call an OpenAI-compatible /v1/chat/completions endpoint.
// Stub mode activates when AI_STUB_MODE=true OR AI_API_KEY is not set.

const SYSTEM_PROMPTS = {
  telegram: `You are writing a Telegram channel message for a brand.
Adapt the content for Telegram. Rules:
- Direct and conversational tone
- Max 4096 characters
- 0 to 3 hashtags only, or none if they feel unnatural
- No formal corporate language
- Return ONLY the adapted message text, nothing else.`,

  reddit: `You are writing a Reddit post for a brand managing a subreddit.
Adapt the content for Reddit. Rules:
- Genuine, community-first tone — never promotional or salesy
- Title: max 300 chars, phrased as a discussion starter or helpful share
- Body: optional, conversational, adds context or invites discussion
- NEVER use hashtags — Reddit does not use them
- Return ONLY valid JSON: { "title": "...", "body": "..." }`,

  youtube: `You are writing a YouTube video description for a brand channel.
Adapt the content for YouTube. Rules:
- Title: compelling, 60-100 characters, naturally searchable
- Description: informative, 150-400 characters, 3-5 hashtags at the end
- Return ONLY valid JSON: { "title": "...", "description": "..." }`,

  pinterest: `You are writing a Pinterest pin for a brand.
Adapt the content for Pinterest. Rules:
- Title: aspirational, max 100 characters
- Description: visual-first, action-oriented, max 500 chars, 2-5 hashtags
- Return ONLY valid JSON: { "title": "...", "description": "..." }`,
};

function isStubMode() {
  return process.env.AI_STUB_MODE === "true" || !process.env.AI_API_KEY;
}

function getStub(platform, originalContent) {
  const base = originalContent.slice(0, 60);
  switch (platform) {
    case "telegram":
      return {
        content: "[Telegram] " + originalContent.slice(0, 200),
        title:   null,
        notes:   "Stub mode — shortened for Telegram.",
      };
    case "reddit":
      return {
        content: originalContent,
        title:   base + " — thoughts?",
        notes:   "Stub mode — conversational Reddit title, body preserved.",
      };
    case "youtube":
      return {
        content: originalContent + " #YouTube #Brand",
        title:   base,
        notes:   "Stub mode — hashtags appended for YouTube.",
      };
    case "pinterest":
      return {
        content: originalContent + " #Brand #Pinterest",
        title:   base,
        notes:   "Stub mode — aspirational hashtags for Pinterest.",
      };
    default:
      return { content: originalContent, title: null, notes: "Stub mode." };
  }
}

function parseAIText(platform, text) {
  if (platform === "telegram") {
    return { content: text, title: null };
  }

  // All other platforms return JSON.
  let parsed;
  try {
    // Strip possible markdown code fences the model may add.
    const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    // Fallback: treat entire response as content with no title.
    return { content: text, title: null };
  }

  if (platform === "reddit") {
    return { content: parsed.body ?? "", title: parsed.title ?? null };
  }
  // youtube and pinterest both use "description"
  return { content: parsed.description ?? "", title: parsed.title ?? null };
}

// ─── adaptContent ─────────────────────────────────────────────────────────────
// Returns { content, title, notes } for a single platform.
// Does NOT write to the database.

async function adaptContent(platform, originalContent /*, providerMeta unused for now */) {
  if (isStubMode()) {
    return getStub(platform, originalContent);
  }

  const res = await fetch(`${process.env.AI_BASE_URL}/v1/chat/completions`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model:    process.env.AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[platform] },
        { role: "user",   content: originalContent },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  const { content, title } = parseAIText(platform, text);

  return {
    content,
    title,
    notes: "AI-generated adaptation.",
  };
}

module.exports = { adaptContent };
