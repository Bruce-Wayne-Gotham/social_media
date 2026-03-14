"use client";

import { useState } from "react";
import { apiRequest } from "@/src/lib/api";

const platformOptions = [
  { value: "twitter", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" }
];

export function PostComposer({ onCreated }) {
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [platforms, setPlatforms] = useState(["twitter", "linkedin"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function togglePlatform(platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await apiRequest("/posts", {
        method: "POST",
        body: JSON.stringify({
          content,
          mediaUrl,
          hashtags: hashtags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : null,
          platforms
        })
      });

      setContent("");
      setMediaUrl("");
      setHashtags("");
      setScheduledTime("");
      await onCreated();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Composer</p>
        <h2 className="mt-2 text-2xl">Create a new post</h2>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <textarea
          className="min-h-40 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
          placeholder="What do you want to publish?"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
        />
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
          type="url"
          placeholder="Media URL"
          value={mediaUrl}
          onChange={(event) => setMediaUrl(event.target.value)}
        />
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
          placeholder="Hashtags, comma separated"
          value={hashtags}
          onChange={(event) => setHashtags(event.target.value)}
        />
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
          type="datetime-local"
          value={scheduledTime}
          onChange={(event) => setScheduledTime(event.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          {platformOptions.map((platform) => (
            <label
              className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/60 px-4 py-2 text-sm"
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
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-white disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Saving..." : "Create post"}
        </button>
      </form>
    </section>
  );
}
