"use client";

import { useEffect, useState } from "react";

function statusBadge(status) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "needs_approval") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-[var(--line)] bg-white/70 text-[var(--foreground)]";
}

function actionLabel(action) {
  if (action === "requested") return "Requested approval";
  if (action === "approved") return "Approved";
  if (action === "rejected") return "Rejected";
  if (action === "commented") return "Commented";
  if (action === "unapproved") return "Approval reset";
  if (action === "updated") return "Updated";
  if (action === "created") return "Created";
  return action;
}

export function ApprovalDetailPanel({
  post,
  clientsById = {},
  loading = false,
  submitting = false,
  error = "",
  onRequestApproval,
  onApprove,
  onReject,
  onComment,
  title = "Post detail"
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    setNote("");
  }, [post?.id]);

  async function submit(handler, requireNote = false) {
    const trimmed = note.trim();
    if (requireNote && !trimmed) {
      return;
    }
    await handler?.(trimmed);
    setNote("");
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Review</p>
        <h2 className="mt-2 text-2xl">{title}</h2>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading post...</p>
      ) : !post ? (
        <p className="text-sm text-[var(--muted)]">Select a post from the approvals inbox or history.</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              {clientsById[post.client_id] || post.client_name ? <span>{clientsById[post.client_id] || post.client_name}</span> : null}
              <span className={`rounded-full border px-3 py-1 ${statusBadge(post.approval_status)}`}>{post.approval_status}</span>
              {`${post.generation_source || ""}`.startsWith("autopilot_") ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-800">{post.generation_source === "autopilot_ai" ? "autopilot ai" : "autopilot stub"}</span>
              ) : null}
              <span>{post.status}</span>
              <span>{new Date(post.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-base">{post.content}</p>
            {post.media_url ? (
              <p className="mt-3 break-all text-sm text-[var(--muted)]">Media: {post.media_url}</p>
            ) : null}
            {post.scheduled_time ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Scheduled: {new Date(post.scheduled_time).toLocaleString()}</p>
            ) : null}
            {Array.isArray(post.risk_flags) && post.risk_flags.length ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Risk checks</p>
                <ul className="mt-2 list-disc pl-5">
                  {post.risk_flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {(post.targets || []).map((target) => (
                <span
                  className="rounded-full border border-[var(--line)] px-3 py-1"
                  key={`${post.id}-${target.platform}-${target.socialAccountId || "legacy"}`}
                >
                  {target.platform}: {target.publishStatus}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Comment or decision note</label>
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none"
              placeholder="Add context for the creator or approver."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-3">
              {onRequestApproval && post.approval_status === "draft" ? (
                <button
                  className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-60"
                  type="button"
                  disabled={submitting}
                  onClick={() => submit(onRequestApproval)}
                >
                  Request approval
                </button>
              ) : null}
              {onComment ? (
                <button
                  className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-60"
                  type="button"
                  disabled={submitting || !note.trim()}
                  onClick={() => submit(onComment, true)}
                >
                  Add comment
                </button>
              ) : null}
              {onApprove && post.approval_status === "needs_approval" ? (
                <button
                  className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                  type="button"
                  disabled={submitting}
                  onClick={() => submit(onApprove)}
                >
                  Approve
                </button>
              ) : null}
              {onReject && post.approval_status === "needs_approval" ? (
                <button
                  className="rounded-2xl bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-60"
                  type="button"
                  disabled={submitting}
                  onClick={() => submit(onReject)}
                >
                  Reject
                </button>
              ) : null}
            </div>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Thread</p>
            <div className="mt-3 space-y-3">
              {(post.events || []).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No approval activity yet.</p>
              ) : (
                post.events.map((event) => (
                  <article key={event.id} className="rounded-2xl border border-[var(--line)] bg-white/60 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <span>{actionLabel(event.action)}</span>
                      <span>{event.actor}</span>
                      <span>{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                    {(event.from_status || event.to_status) ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {event.from_status || "none"} to {event.to_status || "none"}
                      </p>
                    ) : null}
                    {event.note ? <p className="mt-2 whitespace-pre-wrap text-sm">{event.note}</p> : null}
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



