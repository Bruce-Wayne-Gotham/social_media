"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/src/lib/api";

const initialForm = {
  originalUrl: "",
  utmSource: "socialhub",
  utmMedium: "social",
  utmCampaign: "",
  utmContent: "",
  utmTerm: ""
};

export function LinkTrackingPanel({ clientId = "", selectedPostId = "" }) {
  const [form, setForm] = useState(initialForm);
  const [report, setReport] = useState({ summary: { total_links: 0, total_clicks: 0 }, byPost: [], links: [] });
  const [latestLink, setLatestLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadReport(nextClientId = clientId) {
    if (!nextClientId || nextClientId === "all") {
      setReport({ summary: { total_links: 0, total_clicks: 0 }, byPost: [], links: [] });
      return;
    }

    setLoading(true);
    try {
      const nextReport = await apiRequest(`/clients/${nextClientId}/tracked-links/report`);
      setReport(nextReport);
    } catch (loadError) {
      setError(loadError.message || "Failed to load link tracking");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLatestLink(null);
    setError("");
    loadReport(clientId);
  }, [clientId]);

  const selectedPostClicks = report.byPost.find((row) => row.post_id === selectedPostId)?.total_clicks || 0;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (!clientId || clientId === "all") {
        throw new Error("Select a specific client before creating a tracked link.");
      }

      const payload = {
        ...form,
        postId: selectedPostId || null
      };
      const { trackedLink } = await apiRequest(`/clients/${clientId}/tracked-links`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setLatestLink(trackedLink);
      setForm(initialForm);
      await loadReport(clientId);
    } catch (submitError) {
      setError(submitError.message || "Failed to create tracked link");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Link tracking</p>
        <h2 className="mt-2 text-2xl">UTM builder + short links</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Create tracked links for the current client and optionally attach them to the selected post.</p>
      </div>

      {!clientId || clientId === "all" ? (
        <p className="text-sm text-[var(--muted)]">Select a specific client to create tracked links.</p>
      ) : (
        <div className="space-y-5">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
              type="url"
              placeholder="Original URL"
              value={form.originalUrl}
              onChange={(event) => setForm((current) => ({ ...current, originalUrl: event.target.value }))}
              required
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none" placeholder="utm_source" value={form.utmSource} onChange={(event) => setForm((current) => ({ ...current, utmSource: event.target.value }))} />
              <input className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none" placeholder="utm_medium" value={form.utmMedium} onChange={(event) => setForm((current) => ({ ...current, utmMedium: event.target.value }))} />
              <input className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none" placeholder="utm_campaign" value={form.utmCampaign} onChange={(event) => setForm((current) => ({ ...current, utmCampaign: event.target.value }))} />
              <input className="rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none" placeholder="utm_content" value={form.utmContent} onChange={(event) => setForm((current) => ({ ...current, utmContent: event.target.value }))} />
            </div>
            <input className="w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none" placeholder="utm_term" value={form.utmTerm} onChange={(event) => setForm((current) => ({ ...current, utmTerm: event.target.value }))} />
            {selectedPostId ? <p className="text-xs text-[var(--muted)]">This link will be attached to post {selectedPostId}.</p> : <p className="text-xs text-[var(--muted)]">Select a post in history or approvals if you want post-level click rollups.</p>}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-white disabled:opacity-60" disabled={submitting} type="submit">
              {submitting ? "Creating..." : "Create short link"}
            </button>
          </form>

          {latestLink ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Latest short link</p>
              <input className="mt-3 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" readOnly value={latestLink.shortUrl} />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(latestLink.shortUrl);
                    } catch (_error) {
                      setError("Copy failed. Copy the short link manually.");
                    }
                  }}
                >
                  Copy short link
                </button>
                <a className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm" href={latestLink.shortUrl} target="_blank" rel="noreferrer">Open</a>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Client totals</p>
              <p className="mt-3 text-3xl">{report.summary.total_clicks || 0}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Clicks across {report.summary.total_links || 0} tracked links</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Selected post</p>
              <p className="mt-3 text-3xl">{selectedPostId ? selectedPostClicks : 0}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Clicks for the current selected post</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Recent tracked links</p>
            <div className="mt-3 space-y-3">
              {loading ? (
                <p className="text-sm text-[var(--muted)]">Loading links...</p>
              ) : report.links.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No tracked links for this client yet.</p>
              ) : (
                report.links.slice(0, 6).map((link) => (
                  <article key={link.id} className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <span>{link.short_code}</span>
                      <span>{link.click_count} clicks</span>
                    </div>
                    <p className="mt-2 break-all text-sm">{link.shortUrl}</p>
                    <p className="mt-2 break-all text-xs text-[var(--muted)]">{link.destination_url}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
