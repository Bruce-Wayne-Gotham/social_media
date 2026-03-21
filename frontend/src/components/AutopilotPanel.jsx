"use client";

import { useEffect, useState } from "react";

const platformOptions = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" }
];

function listToText(values) {
  return (values || []).join("\n");
}

function textToList(value) {
  return value
    .split(/\r?\n|,/) 
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatAutopilotStatus(client) {
  const autopilot = client?.autopilot;
  if (!autopilot) {
    return "Select a specific client to manage content strategy and generate drafts.";
  }

  if (!autopilot.envEnabled) {
    return "Autopilot AI generation is disabled by backend configuration. Strategy editing still works.";
  }

  if (!autopilot.workspaceEnabled) {
    return "Autopilot AI generation is disabled for this workspace. Strategy editing still works.";
  }

  return `Provider: ${autopilot.provider}. Usage this window: ${autopilot.draftsGeneratedInWindow}/${autopilot.rateLimitMaxDrafts} drafts per ${autopilot.rateLimitWindowSeconds} seconds. Generated drafts always land in the approvals queue.`;
}

export function AutopilotPanel({
  client,
  saving = false,
  generating = false,
  error = "",
  onSaveStrategy,
  onGenerateDrafts
}) {
  const [brandVoiceNotes, setBrandVoiceNotes] = useState("");
  const [contentDo, setContentDo] = useState("");
  const [contentDont, setContentDont] = useState("");
  const [contentPillars, setContentPillars] = useState("");
  const [ctaStyle, setCtaStyle] = useState("");
  const [defaultHashtags, setDefaultHashtags] = useState("");
  const [bannedTerms, setBannedTerms] = useState("");
  const [requiredDisclaimer, setRequiredDisclaimer] = useState("");
  const [count, setCount] = useState(3);
  const [platforms, setPlatforms] = useState(["linkedin", "instagram", "youtube"]);

  useEffect(() => {
    setBrandVoiceNotes(client?.brand_voice_notes || "");
    setContentDo(listToText(client?.content_do));
    setContentDont(listToText(client?.content_dont));
    setContentPillars(listToText(client?.content_pillars));
    setCtaStyle(client?.cta_style || "");
    setDefaultHashtags(listToText(client?.default_hashtags));
    setBannedTerms(listToText(client?.banned_terms));
    setRequiredDisclaimer(client?.required_disclaimer || "");
  }, [client?.id]);

  function buildStrategyPayload() {
    return {
      brandVoiceNotes,
      contentDo: textToList(contentDo),
      contentDont: textToList(contentDont),
      contentPillars: textToList(contentPillars),
      ctaStyle,
      defaultHashtags: textToList(defaultHashtags),
      bannedTerms: textToList(bannedTerms),
      requiredDisclaimer
    };
  }

  function togglePlatform(platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  const generationEnabled = Boolean(client?.autopilot?.enabled);

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Autopilot v1</p>
        <h2 className="mt-2 text-2xl">Provider-backed draft generation</h2>
        {!client ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Select a specific client to manage content strategy and generate drafts.</p>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">{formatAutopilotStatus(client)}</p>
        )}
      </div>

      {!client ? null : (
        <div className="space-y-4">
          <textarea
            className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
            placeholder="Brand voice notes"
            value={brandVoiceNotes}
            onChange={(event) => setBrandVoiceNotes(event.target.value)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <textarea
              className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
              placeholder="Do list, one per line"
              value={contentDo}
              onChange={(event) => setContentDo(event.target.value)}
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
              placeholder="Do not list, one per line"
              value={contentDont}
              onChange={(event) => setContentDont(event.target.value)}
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
              placeholder="Content pillars, one per line"
              value={contentPillars}
              onChange={(event) => setContentPillars(event.target.value)}
            />
            <textarea
              className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
              placeholder="Default hashtags, one per line"
              value={defaultHashtags}
              onChange={(event) => setDefaultHashtags(event.target.value)}
            />
          </div>
          <input
            className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
            placeholder="CTA style"
            value={ctaStyle}
            onChange={(event) => setCtaStyle(event.target.value)}
          />
          <textarea
            className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
            placeholder="Banned terms, one per line"
            value={bannedTerms}
            onChange={(event) => setBannedTerms(event.target.value)}
          />
          <textarea
            className="min-h-24 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
            placeholder="Required disclaimer"
            value={requiredDisclaimer}
            onChange={(event) => setRequiredDisclaimer(event.target.value)}
          />

          <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="w-24 rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none"
                type="number"
                min="1"
                max="12"
                value={count}
                onChange={(event) => setCount(Number(event.target.value) || 1)}
              />
              <span className="text-sm text-[var(--muted)]">drafts to generate</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {platformOptions.map((platform) => (
                <label
                  className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm"
                  key={platform.value}
                >
                  <input
                    checked={platforms.includes(platform.value)}
                    onChange={() => togglePlatform(platform.value)}
                    type="checkbox"
                  />
                  {platform.label}
                </label>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-60"
              type="button"
              disabled={saving || generating}
              onClick={() => onSaveStrategy?.(buildStrategyPayload())}
            >
              {saving ? "Saving..." : "Save strategy"}
            </button>
            <button
              className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60"
              type="button"
              disabled={saving || generating || platforms.length === 0 || !generationEnabled}
              onClick={() => onGenerateDrafts?.(buildStrategyPayload(), { count, platforms })}
            >
              {generating ? "Generating..." : "Generate drafts"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
