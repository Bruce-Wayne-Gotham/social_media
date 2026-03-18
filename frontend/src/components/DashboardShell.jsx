"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/src/lib/api";
import { WorkspaceClientPanel } from "./WorkspaceClientPanel";
import { ConnectAccounts } from "./ConnectAccounts";
import { CalendarPanel } from "./CalendarPanel";
import { PostComposer } from "./PostComposer";
import { PostList } from "./PostList";
import { ApprovalInboxPanel } from "./ApprovalInboxPanel";
import { ApprovalDetailPanel } from "./ApprovalDetailPanel";
import { MagicLinkPanel } from "./MagicLinkPanel";
import { LinkTrackingPanel } from "./LinkTrackingPanel";

export function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedPostLoading, setSelectedPostLoading] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [approvalLink, setApprovalLink] = useState(null);
  const [creatingApprovalLink, setCreatingApprovalLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function clientsById(list) {
    const map = {};
    for (const c of list || []) {
      map[c.id] = c.name;
    }
    return map;
  }

  async function loadWorkspacesAndClients(nextWorkspaceId, preferredClientId) {
    const { workspaces: ws } = await apiRequest("/workspaces");
    setWorkspaces(ws);

    const resolvedWorkspaceId = nextWorkspaceId || ws[0]?.id || "";
    setWorkspaceId(resolvedWorkspaceId);

    if (!resolvedWorkspaceId) {
      setClients([]);
      setClientId("");
      return { workspaces: ws, clients: [] };
    }

    const { clients: cs } = await apiRequest(`/workspaces/${resolvedWorkspaceId}/clients`);
    setClients(cs);

    const hasMultiple = cs.length > 1;
    const resolvedClientId = preferredClientId && cs.some((c) => c.id === preferredClientId)
      ? preferredClientId
      : hasMultiple
        ? "all"
        : cs[0]?.id || "";
    setClientId(resolvedClientId);

    return { workspaces: ws, clients: cs, workspaceId: resolvedWorkspaceId, clientId: resolvedClientId };
  }

  async function loadPostsForClient(nextClientId, nextClients) {
    if (!nextClientId) {
      setPosts([]);
      return [];
    }

    if (nextClientId === "all") {
      const lists = await Promise.all(
        (nextClients || []).map(async (c) => {
          const { posts: p } = await apiRequest(`/clients/${c.id}/posts`);
          return p;
        })
      );
      const merged = lists.flat();
      setPosts(merged);
      return merged;
    }

    const { posts: p } = await apiRequest(`/clients/${nextClientId}/posts`);
    setPosts(p);
    return p;
  }

  async function loadProfilesForClient(nextClientId) {
    if (!nextClientId || nextClientId === "all") {
      setAccounts([]);
      return [];
    }

    const { profiles } = await apiRequest(`/clients/${nextClientId}/social-profiles`);
    setAccounts(profiles);
    return profiles;
  }

  async function loadPostDetail(postId) {
    if (!postId) {
      setSelectedPostId("");
      setSelectedPost(null);
      return null;
    }

    setSelectedPostLoading(true);
    setApprovalError("");
    try {
      const { post } = await apiRequest(`/posts/${postId}`);
      setSelectedPostId(postId);
      setSelectedPost(post);
      return post;
    } catch (loadError) {
      setApprovalError(loadError.message || "Failed to load post detail");
      setSelectedPost(null);
      return null;
    } finally {
      setSelectedPostLoading(false);
    }
  }

  async function syncSelectedPost(nextPosts, preferredPostId = "") {
    const keepExisting = preferredPostId && nextPosts.some((post) => post.id === preferredPostId);
    const nextPending = nextPosts.find((post) => post.approval_status === "needs_approval");
    const nextSelectedId = keepExisting ? preferredPostId : (nextPending?.id || "");

    if (!nextSelectedId) {
      setSelectedPostId("");
      setSelectedPost(null);
      return;
    }

    await loadPostDetail(nextSelectedId);
  }

  async function refreshApprovalState(nextClientId = clientId, nextClients = clients, preferredPostId = selectedPostId) {
    const nextPosts = await loadPostsForClient(nextClientId, nextClients);
    await syncSelectedPost(nextPosts, preferredPostId);
    return nextPosts;
  }

  async function loadDashboard() {
    setError("");
    const { user: nextUser } = await apiRequest("/auth/me");
    setUser(nextUser);

    const loaded = await loadWorkspacesAndClients(nextUser?.defaultWorkspaceId, nextUser?.defaultClientId);
    await Promise.all([
      loadProfilesForClient(loaded.clientId),
      refreshApprovalState(loaded.clientId, loaded.clients)
    ]);
  }

  useEffect(() => {
    const token = localStorage.getItem("socialhub_token");
    if (!token) {
      router.push("/");
      return;
    }

    loadDashboard()
      .catch(() => {
        setError("Unable to load dashboard. Your session may have expired.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const connectionStatus = searchParams.get("connection");
  const platform = searchParams.get("platform");
  const message = searchParams.get("message");

  if (loading) {
    return <div className="p-10 text-center">Loading dashboard...</div>;
  }

  const byId = clientsById(clients);
  const currentClientName = clients.find((client) => client.id === clientId)?.name || "";

  async function handleApprovalMutation(path, note, keepSelection = false) {
    if (!selectedPostId) return;

    setApprovalSubmitting(true);
    setApprovalError("");
    try {
      const { post } = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(note ? { note } : {})
      });
      setSelectedPost(post);
      await refreshApprovalState(clientId, clients, keepSelection ? post.id : "");
    } catch (mutationError) {
      setApprovalError(mutationError.message || "Approval action failed");
    } finally {
      setApprovalSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 rounded-[2.5rem] border border-[var(--line)] bg-[var(--surface)] p-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">SocialHub</p>
          <h1 className="mt-2 text-5xl">Control your publishing pipeline.</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Draft once, route approvals cleanly, and monitor channel-specific publishing from a single workspace.
          </p>
        </div>
        <div className="text-sm text-[var(--muted)]">
          <p>{user?.email}</p>
          <button
            className="mt-2 rounded-full border border-[var(--line)] px-4 py-2"
            type="button"
            onClick={() => {
              localStorage.removeItem("socialhub_token");
              router.push("/");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {connectionStatus ? (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${connectionStatus === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-700"}`}
        >
          {connectionStatus === "success"
            ? `${platform} connected successfully.`
            : `Failed to connect ${platform}: ${message || "Unknown error"}`}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <WorkspaceClientPanel
            workspaces={workspaces}
            workspaceId={workspaceId}
            onWorkspaceChange={async (nextWorkspaceId) => {
              const previousWorkspaceId = workspaceId;
              setWorkspaceId(nextWorkspaceId);
              setError("");
              setApprovalLink(null);
              try {
                await apiRequest("/workspaces/current", {
                  method: "PATCH",
                  body: JSON.stringify({ workspaceId: nextWorkspaceId })
                });
                const { clients: nextClients, clientId: nextClientId } = await loadWorkspacesAndClients(
                  nextWorkspaceId,
                  ""
                );
                await Promise.all([
                  loadProfilesForClient(nextClientId),
                  refreshApprovalState(nextClientId, nextClients, "")
                ]);
              } catch (e) {
                setWorkspaceId(previousWorkspaceId);
                setError(e.message || "Failed to load workspace");
              }
            }}
            clients={clients}
            clientId={clientId}
            onClientChange={async (nextClientId) => {
              setClientId(nextClientId);
              setError("");
              setApprovalLink(null);
              try {
                await Promise.all([
                  loadProfilesForClient(nextClientId),
                  refreshApprovalState(nextClientId, clients, "")
                ]);
              } catch (e) {
                setError(e.message || "Failed to load client");
              }
            }}
            onCreateClient={async (name) => {
              setError("");
              const { client } = await apiRequest(`/workspaces/${workspaceId}/clients`, {
                method: "POST",
                body: JSON.stringify({ name })
              });
              const nextClients = [client, ...clients];
              setClients(nextClients);
              setClientId(client.id);
              await Promise.all([
                loadProfilesForClient(client.id),
                refreshApprovalState(client.id, nextClients, "")
              ]);
            }}
          />

          <ApprovalInboxPanel
            posts={posts}
            clientsById={byId}
            selectedPostId={selectedPostId}
            onSelectPost={loadPostDetail}
          />

          <MagicLinkPanel
            clientId={clientId}
            clientName={currentClientName}
            approvalLink={approvalLink}
            creating={creatingApprovalLink}
            onCreate={async () => {
              if (!clientId || clientId === "all") return;
              setCreatingApprovalLink(true);
              setError("");
              try {
                const { approvalLink: nextLink } = await apiRequest(`/clients/${clientId}/approval-links`, {
                  method: "POST",
                  body: JSON.stringify({})
                });
                setApprovalLink(nextLink);
              } catch (createError) {
                setError(createError.message || "Failed to create approval link");
              } finally {
                setCreatingApprovalLink(false);
              }
            }}
          />

          <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Settings</p>
              <h2 className="mt-2 text-2xl">Client connections</h2>
              {clientId === "all" ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Select a specific client to connect or disconnect social profiles.
                </p>
              ) : null}
            </div>
            <ConnectAccounts accounts={accounts} clientId={clientId === "all" ? "" : clientId} onRefresh={loadDashboard} />
          </section>

          <PostList
            posts={posts}
            clientsById={byId}
            selectedPostId={selectedPostId}
            onSelectPost={loadPostDetail}
          />
        </div>

        <div className="space-y-6">
          <CalendarPanel posts={posts} clientsById={byId} />
          <ApprovalDetailPanel
            post={selectedPost}
            clientsById={byId}
            loading={selectedPostLoading}
            submitting={approvalSubmitting}
            error={approvalError}
            onRequestApproval={selectedPost?.approval_status === "draft"
              ? async (note) => handleApprovalMutation(`/posts/${selectedPost.id}/request-approval`, note, false)
              : null}
            onComment={selectedPost
              ? async (note) => handleApprovalMutation(`/posts/${selectedPost.id}/comments`, note, true)
              : null}
            onApprove={selectedPost?.approval_status === "needs_approval"
              ? async (note) => handleApprovalMutation(`/posts/${selectedPost.id}/approve`, note, false)
              : null}
            onReject={selectedPost?.approval_status === "needs_approval"
              ? async (note) => handleApprovalMutation(`/posts/${selectedPost.id}/reject`, note, false)
              : null}
          />
          <LinkTrackingPanel clientId={clientId} selectedPostId={selectedPostId} />
          <PostComposer clientId={clientId} onCreated={async () => {
            await Promise.all([
              loadProfilesForClient(clientId),
              refreshApprovalState(clientId, clients, selectedPostId)
            ]);
          }} />
        </div>
      </div>
    </main>
  );
}
