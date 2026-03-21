function normalizeTextList(values) {
  return (values || []).map((value) => `${value}`.trim()).filter(Boolean);
}

function buildDraftPrompt({ clientName, strategy, count, platforms }) {
  const platformLabel = platforms.map((platform) => platform[0].toUpperCase() + platform.slice(1)).join(", ");

  return {
    system: [
      "You create social media drafts for agencies.",
      "Return valid JSON only.",
      "Match the client's strategy while staying specific, concise, and safe for review.",
      "Never include explanations, markdown fences, or extra keys."
    ].join(" "),
    user: JSON.stringify(
      {
        task: "Generate review-ready social media drafts.",
        output_schema: {
          drafts: [
            {
              content: "string",
              hashtags: ["string"]
            }
          ]
        },
        requirements: {
          draft_count: count,
          platforms,
          platform_summary: platformLabel,
          client_name: clientName,
          brand_voice_notes: strategy.brand_voice_notes || "",
          content_pillars: normalizeTextList(strategy.content_pillars),
          content_do: normalizeTextList(strategy.content_do),
          content_dont: normalizeTextList(strategy.content_dont),
          cta_style: strategy.cta_style || "",
          default_hashtags: normalizeTextList(strategy.default_hashtags),
          banned_terms: normalizeTextList(strategy.banned_terms),
          required_disclaimer: strategy.required_disclaimer || "",
          notes: [
            "Each draft must feel distinct from the others.",
            "Keep the writing grounded and non-generic.",
            "If you include hashtags, return them as plain strings without the leading # symbol."
          ]
        }
      },
      null,
      2
    )
  };
}

module.exports = {
  buildDraftPrompt
};
