"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/src/lib/api";
import { ConnectAccounts } from "./ConnectAccounts";
import { PostComposer } from "./PostComposer";
import { PostList } from "./PostList";

export function DashboardShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    const [{ user: nextUser }, { accounts: nextAccounts }, { posts: nextPosts }] = await Promise.all([
      apiRequest("/auth/me"),
      apiRequest("/social-accounts"),
      apiRequest("/posts")
    ]);

    setUser(nextUser);
    setAccounts(nextAccounts);
    setPosts(nextPosts);
  }

  useEffect(() => {
    const token = localStorage.getItem("socialhub_token");
    if (!token) {
      router.push("/");
      return;
    }

    loadDashboard()
      .catch(() => {
        localStorage.removeItem("socialhub_token");
        router.push("/");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const connectionStatus = searchParams.get("connection");
  const platform = searchParams.get("platform");
  const message = searchParams.get("message");

  if (loading) {
    return <div className="p-10 text-center">Loading dashboard...</div>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 rounded-[2.5rem] border border-[var(--line)] bg-[var(--surface)] p-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">SocialHub</p>
          <h1 className="mt-2 text-5xl">Control your publishing pipeline.</h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Draft once, schedule cleanly, and monitor channel-specific publishing from a single workspace.
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <ConnectAccounts accounts={accounts} onRefresh={loadDashboard} />
          <PostList posts={posts} />
        </div>
        <PostComposer onCreated={loadDashboard} />
      </div>
    </main>
  );
}
