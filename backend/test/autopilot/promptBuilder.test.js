const test = require("node:test");
const assert = require("node:assert/strict");

const { buildDraftPrompt } = require("../../src/services/autopilot/promptBuilder");

test("buildDraftPrompt includes strategy and output instructions", () => {
  const prompt = buildDraftPrompt({
    clientName: "Northwind",
    count: 2,
    platforms: ["linkedin", "instagram"],
    strategy: {
      brand_voice_notes: "Confident and practical",
      content_do: ["Use customer outcomes"],
      content_dont: ["Sound generic"],
      content_pillars: ["Team productivity"],
      cta_style: "Invite a reply",
      default_hashtags: ["northwind", "ops"],
      banned_terms: ["guaranteed"],
      required_disclaimer: "Results vary"
    }
  });

  assert.match(prompt.system, /Return valid JSON only/);
  assert.match(prompt.user, /"client_name": "Northwind"/);
  assert.match(prompt.user, /"draft_count": 2/);
  assert.match(prompt.user, /"required_disclaimer": "Results vary"/);
});
