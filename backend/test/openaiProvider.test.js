const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAutopilotPrompt,
  parseDraftGenerationResponse
} = require("../src/services/autopilotProviders/openaiProvider");

test("builds a prompt that carries strategy and draft count", () => {
  const prompt = createAutopilotPrompt({
    clientName: "Northwind",
    count: 2,
    platforms: ["linkedin"],
    strategy: {
      brand_voice_notes: "Helpful and direct",
      content_do: ["Focus on ROI"],
      content_dont: [],
      content_pillars: ["Case studies"],
      cta_style: "Invite replies",
      default_hashtags: ["#northwind"],
      banned_terms: ["guarantee"],
      required_disclaimer: "Subject to approval."
    }
  });

  assert.match(prompt, /Northwind/);
  assert.match(prompt, /"draftCount": 2/);
  assert.match(prompt, /Subject to approval\./);
});

test("parses provider JSON output into normalized drafts", () => {
  const drafts = parseDraftGenerationResponse(
    {
      output_text: JSON.stringify({
        drafts: [{ content: "First draft" }, { content: "Second draft" }]
      })
    },
    2
  );

  assert.deepEqual(drafts, [
    { content: "First draft", hashtags: [] },
    { content: "Second draft", hashtags: [] }
  ]);
});

test("rejects unexpected draft counts", () => {
  assert.throws(
    () =>
      parseDraftGenerationResponse(
        {
          output_text: JSON.stringify({
            drafts: [{ content: "Only one" }]
          })
        },
        2
      ),
    /unexpected number of drafts/i
  );
});
