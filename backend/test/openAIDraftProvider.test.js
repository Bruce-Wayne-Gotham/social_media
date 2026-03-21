const test = require("node:test");
const assert = require("node:assert/strict");

const { _internal } = require("../src/services/providers/openAIDraftProvider");

test("extractJson unwraps fenced json payloads", () => {
  const actual = _internal.extractJson("```json\n{\"drafts\":[{\"content\":\"hi\"}]}\n```");
  assert.equal(actual, "{\"drafts\":[{\"content\":\"hi\"}]}");
});

test("extractMessageContent flattens content arrays", () => {
  const actual = _internal.extractMessageContent({
    message: {
      content: [
        { text: "{\"drafts\":" },
        { text: "[{\"content\":\"A\"}]}" }
      ]
    }
  });

  assert.equal(actual, "{\"drafts\":[{\"content\":\"A\"}]}");
});

test("normalizeDrafts rejects count mismatches", () => {
  assert.throws(
    () => _internal.normalizeDrafts({ drafts: [{ content: "one" }] }, 2),
    /unexpected draft count/i
  );
});
