"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/src/lib/api";

function truncate(value, max = 28) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export default function ConnectCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [selected, setSelected] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const candidates = useMemo(() => session?.candidates || [], [session]);

  useEffect(() => {
    const token = localStorage.getItem("socialhub_token");
    if (!token) {
      router.push("/");
      return;
    }

    if (!sessionId) {
      setError("Missing connect session id.");
      setLoading(false);
      return;
    }

    async function load() {
      const [{ session: sessionPayload }, { workspace: currentWorkspace }] = await Promise.all([
        apiRequest(`/oauth-connect-sessions/${sessionId}`),
        apiRequest("/workspaces/current")
      ]);

      setSession(sessionPayload);
      setWorkspace(currentWorkspace);

      if (currentWorkspace?.id) {
        const { clients: nextClients } = await apiRequest(`/workspaces/${currentWorkspace.id}/clients`);
        setClients(nextClients);

        const preferred = sessionPayload.clientId || nextClients[0]?.id || "";
        setClientId(preferred);
      }

      const defaults = {};
      for (const c of sessionPayload.candidates || []) {
        defaults[c.providerAccountId] = true;
      }
      setSelected(defaults);
    }

    load()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [router, sessionId]);

  function toggleCandidate(id) {
    setSelected((current) => ({ ...current, [id]: !current[id] }));
  }

  async function handleConnect() {
    setSubmitting(true);
    setError("");

    try {
      const providerAccountIds = Object.entries(selected)
        .filter(([, checked]) => checked)
        .map(([id]) => id);

      await apiRequest(`/oauth-connect-sessions/${sessionId}/consume`, {
        method: "POST",
        body: JSON.stringify({
          clientId,
          providerAccountIds
        })
      });

      router.push(`/dashboard?connection=success&platform=${encodeURIComponent(session?.platform || "")}`);
    } catch (consumeError) {
      setError(consumeError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-3xl px-6 py-12">Loading connection...</main>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl">Connect social profiles</h1>
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        <button
          className="mt-6 rounded-full border border-[var(--line)] px-4 py-2 text-sm"
          type="button"
          onClick={() => router.push("/dashboard")}
        >
          Back to dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="rounded-[2.5rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[0_25px_80px_rgba(30,20,10,0.08)] backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Connections</p>
        <h1 className="mt-3 text-4xl leading-tight">Finish connecting {session?.platform}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Choose the client and the profile(s) you want to connect.
        </p>
      </header>

      <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
        <label className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Client</label>
        <div className="mt-3 flex flex-col gap-2">
          {workspace?.id ? (
            <select
              className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-[var(--muted)]">No workspace found for this user.</p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Profiles</p>
        <div className="mt-4 space-y-3">
          {candidates.length ? (
            candidates.map((candidate) => (
              <label
                key={candidate.providerAccountId}
                className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white/60 p-4"
              >
                <div>
                  <p className="font-semibold">{candidate.accountName || "Profile"}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {candidate.kind ? `${candidate.kind} - ` : ""}
                    {truncate(candidate.providerAccountId)}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(selected[candidate.providerAccountId])}
                  onChange={() => toggleCandidate(candidate.providerAccountId)}
                />
              </label>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No connectable profiles were detected.</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-white disabled:opacity-60"
            type="button"
            disabled={submitting || !clientId || candidates.length === 0}
            onClick={handleConnect}
          >
            {submitting ? "Connecting..." : "Connect selected"}
          </button>
          <button
            className="rounded-2xl border border-[var(--line)] px-5 py-3 text-sm"
            type="button"
            onClick={() => router.push("/dashboard")}
          >
            Cancel
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </section>
    </main>
  );
}

