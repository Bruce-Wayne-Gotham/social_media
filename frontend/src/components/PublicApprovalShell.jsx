"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/src/lib/api";
import { ApprovalInboxPanel } from "./ApprovalInboxPanel";
import { ApprovalDetailPanel } from "./ApprovalDetailPanel";

export function PublicApprovalShell({ token }) {
  const [overview, setOverview] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview(preferredPostId = "") {
    const result = await apiRequest(`/approval-links/${token}`);
    setOverview(result);

    const pending = result.posts || [];
    const nextSelectedId = preferredPostId && pending.some((post) => post.id === preferredPostId)
      ? preferredPostId
      : pending[0]?.id || "";

    if (!nextSelectedId) {
      setSelectedPostId("");
      setSelectedPost(null);
      return;
    }

    await loadPost(nextSelectedId);
  }

  async function loadPost(postId) {
    setDetailLoading(true);
    setError("");
    try {
      const { post } = await apiRequest(`/approval-links/${token}/posts/${postId}`);
      setSelectedPostId(postId);
      setSelectedPost(post);
    } catch (loadError) {
      setError(loadError.message || "Failed to load post");
      setSelectedPost(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadOverview()
      .catch((loadError) => setError(loadError.message || "Unable to load approval link"))
      .finally(() => setLoading(false));
  }, [token]);

  async function mutate(path, note, keepSelection = false) {
    if (!selectedPostId) return;

    setSubmitting(true);
    setError("");
    try {
      await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(note ? { note } : {})
      });
      await loadOverview(keepSelection ? selectedPostId : "");
    } catch (mutationError) {
      setError(mutationError.message || "Approval action failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-6 py-12">Loading approval link...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="rounded-[2.5rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[0_25px_80px_rgba(30,20,10,0.08)] backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Client approvals</p>
        <h1 className="mt-3 text-4xl leading-tight">{overview?.link?.clientName || "Client"} review inbox</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          This link is scoped to one client and expires {overview?.link?.expiresAt ? new Date(overview.link.expiresAt).toLocaleString() : "soon"}.
        </p>
      </header>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ApprovalInboxPanel
          posts={overview?.posts || []}
          clientsById={{ [overview?.link?.clientId]: overview?.link?.clientName }}
          selectedPostId={selectedPostId}
          onSelectPost={loadPost}
        />

        <ApprovalDetailPanel
          post={selectedPost}
          clientsById={{ [overview?.link?.clientId]: overview?.link?.clientName }}
          loading={detailLoading}
          submitting={submitting}
          error={error}
          onComment={selectedPost ? async (note) => mutate(`/approval-links/${token}/posts/${selectedPost.id}/comments`, note, true) : null}
          onApprove={selectedPost?.approval_status === "needs_approval"
            ? async (note) => mutate(`/approval-links/${token}/posts/${selectedPost.id}/approve`, note, false)
            : null}
          onReject={selectedPost?.approval_status === "needs_approval"
            ? async (note) => mutate(`/approval-links/${token}/posts/${selectedPost.id}/reject`, note, false)
            : null}
          title="Approval detail"
        />
      </div>
    </main>
  );
}
