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
import { AutopilotPanel } from "./AutopilotPanel";
import { BillingPanel } from "./BillingPanel";

export function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [clientDetail, setClientDetail] = useState(null);
  const [billing, setBilling] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountsError, setAccountsError] = useState("");
  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState("");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedPostLoading, setSelectedPostLoading] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [approvalLink, setApprovalLink] = useState(null);
  const [creatingApprovalLink, setCreatingApprovalLink] = useState(false);
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  const [autopilotError, setAutopilotError] = useState("");
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
      setClientDetail(null);
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

  async function loadClientDetail(nextClientId) {
    if (!nextClientId || nextClientId === "all") {
      setClientDetail(null);
      return null;
    }
    try {
      const { client } = await apiRequest(`/clients/${nextClientId}`);
      setClientDetail(client);
      return client;
    } catch (_error) {
      setClientDetail(null);
      return null;
    }
  }

  async function loadBillingForWorkspace(nextWorkspaceId) {
    if (!nextWorkspaceId) {
      setBilling(null);
      return null;
    }

    setBillingLoading(true);
    setBillingError("");
    try {
      const { billing: nextBilling } = await apiRequest(`/billing/workspaces/${nextWorkspaceId}`);
      setBilling(nextBilling);
      return nextBilling;
    } catch (loadError) {
      setBillingError(loadError.message || "Failed to load billing");
      setBilling(null);
      return null;
    } finally {
      setBillingLoading(false);
    }
  }

  async function loadPostsForClient(nextClientId, nextClients) {
    setPostsError("");
    if (!nextClientId) {
      setPosts([]);
      return [];
    }

    if (nextClientId === "all") {
      try {
        const lists = await Promise.all(
          (nextClients || []).map(async (c) => {
            const { posts: p } = await apiRequest(`/clients/${c.id}/posts`);
            return p;
          })
        );
        const merged = lists.flat();
        setPosts(merged);
        return merged;
      } catch (loadError) {
        setPosts([]);
        setPostsError(loadError.message || "Failed to load posts");
        return [];
      }
    }
    try {
      const { posts: p } = await apiRequest(`/clients/${nextClientId}/posts`);
      setPosts(p);
      return p;
    } catch (loadError) {
      setPosts([]);
      setPostsError(loadError.message || "Failed to load posts");
      return [];
    }
  }

  async function loadProfilesForClient(nextClientId) {
    setAccountsError("");
    if (!nextClientId || nextClientId === "all") {
      setAccounts([]);
      return [];
    }
    try {
      const { profiles } = await apiRequest(`/clients/${nextClientId}/social-profiles`);
      setAccounts(profiles);
      return profiles;
    } catch (loadError) {
      setAccounts([]);
      setAccountsError(loadError.message || "Failed to load social profiles");
      return [];
    }
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
    await Promise.allSettled([
      loadBillingForWorkspace(loaded.workspaceId),
      loadClientDetail(loaded.clientId),
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
  const billingStatus = searchParams.get("billing");
  const platform = searchParams.get("platform");
  const message = searchParams.get("message");

  if (loading) {
    return <div className="p-10 text-center">Loading dashboard...</div>;
  }

  const byId = clientsById(clients);
  const currentClientName = clients.find((client) => client.id === clientId)?.name || "";
  const pendingApprovals = posts.filter((post) => post.approval_status === "needs_approval").length;
  const scheduledPosts = posts.filter((post) => post.scheduled_time).length;

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

  async function saveStrategy(strategyPayload) {
    if (!clientId || clientId === "all") {
      return null;
    }

    setSavingStrategy(true);
    setAutopilotError("");
    try {
      const { client } = await apiRequest(`/clients/${clientId}`, {
        method: "PATCH",
        body: JSON.stringify(strategyPayload)
      });
      setClientDetail(client);
      return client;
    } catch (saveError) {
      setAutopilotError(saveError.message || "Failed to save content strategy");
      throw saveError;
    } finally {
      setSavingStrategy(false);
    }
  }

  async function generateDrafts(strategyPayload, generationPayload) {
    if (!clientId || clientId === "all") {
      return;
    }

    setGeneratingDrafts(true);
    setAutopilotError("");
    try {
      await saveStrategy(strategyPayload);
      await apiRequest(`/clients/${clientId}/generate-drafts`, {
        method: "POST",
        body: JSON.stringify(generationPayload)
      });
      await Promise.all([
        loadBillingForWorkspace(workspaceId),
        refreshApprovalState(clientId, clients, "")
      ]);
    } catch (generationError) {
      setAutopilotError(generationError.message || "Failed to generate drafts");
    } finally {
      setGeneratingDrafts(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 overflow-hidden rounded-[2.5rem] border border-[rgba(32,26,23,0.1)] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,246,237,0.85))] p-8 shadow-[0_24px_80px_rgba(32,26,23,0.08)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">SocialHub</p>
            <h1 className="mt-2 max-w-3xl text-5xl leading-tight">Keep LinkedIn, Instagram, and YouTube moving without losing approval control.</h1>
            <p className="mt-4 max-w-2xl text-[15px] text-[var(--muted)]">
              SocialHub is tuned for agency teams: client workspaces, Safe Mode approvals, usage visibility, and one place to steer the queue.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-[rgba(32,26,23,0.08)] bg-white/70 px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            <p className="font-semibold text-[var(--foreground)]">{user?.email}</p>
            <p className="mt-1">Workspace-led operations with approval-first publishing.</p>
            <button
              className="mt-3 rounded-full border border-[var(--line)] px-4 py-2"
              type="button"
              onClick={() => {
                localStorage.removeItem("socialhub_token");
                router.push("/");
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-[1.5rem] border border-[rgba(32,26,23,0.08)] bg-white/68 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Workspace</p>
            <p className="mt-2 text-2xl">{workspaces.length || 0}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[rgba(32,26,23,0.08)] bg-white/68 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Clients</p>
            <p className="mt-2 text-2xl">{clients.length || 0}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[rgba(32,26,23,0.08)] bg-white/68 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Approvals Waiting</p>
            <p className="mt-2 text-2xl">{pendingApprovals}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[rgba(32,26,23,0.08)] bg-white/68 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Scheduled</p>
            <p className="mt-2 text-2xl">{scheduledPosts}</p>
          </div>
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

      {billingStatus ? (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${billingStatus === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"}`}
        >
          {billingStatus === "success"
            ? "Billing updated successfully."
            : "Stripe checkout was cancelled before completion."}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!error && (billingError || accountsError || postsError) ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some dashboard sections could not load completely.
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
              setAutopilotError("");
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
                  loadBillingForWorkspace(nextWorkspaceId),
                  loadClientDetail(nextClientId),
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
              setAutopilotError("");
              try {
                await Promise.all([
                  loadClientDetail(nextClientId),
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
                loadBillingForWorkspace(workspaceId),
                loadClientDetail(client.id),
                loadProfilesForClient(client.id),
                refreshApprovalState(client.id, nextClients, "")
              ]);
            }}
          />

          <BillingPanel
            billing={billing}
            loading={billingLoading}
            error={billingError}
            startingCheckout={startingCheckout}
            onUpgrade={async () => {
              if (!workspaceId) {
                return;
              }

              setStartingCheckout(true);
              setBillingError("");
              try {
                const { checkoutUrl } = await apiRequest(`/billing/workspaces/${workspaceId}/checkout`, {
                  method: "POST",
                  body: JSON.stringify({})
                });
                window.location.assign(checkoutUrl);
              } catch (checkoutError) {
                setBillingError(checkoutError.message || "Failed to start Stripe checkout");
              } finally {
                setStartingCheckout(false);
              }
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
          <AutopilotPanel
            client={clientDetail}
            saving={savingStrategy}
            generating={generatingDrafts}
            error={autopilotError}
            onSaveStrategy={saveStrategy}
            onGenerateDrafts={generateDrafts}
          />
          <LinkTrackingPanel clientId={clientId} selectedPostId={selectedPostId} />
          <PostComposer clientId={clientId} onCreated={async () => {
            await Promise.all([
              loadBillingForWorkspace(workspaceId),
              loadClientDetail(clientId),
              loadProfilesForClient(clientId),
              refreshApprovalState(clientId, clients, selectedPostId)
            ]);
          }} />
        </div>
      </div>
    </main>
  );
}
