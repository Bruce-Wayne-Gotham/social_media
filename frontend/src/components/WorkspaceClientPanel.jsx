"use client";

import { useMemo, useState } from "react";

export function WorkspaceClientPanel({
  workspaces = [],
  workspaceId = "",
  onWorkspaceChange,
  clients = [],
  clientId = "",
  onClientChange,
  onCreateClient
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const canCreateClient = Boolean(workspaceId);
  const hasMultipleClients = clients.length > 1;

  const clientOptions = useMemo(() => {
    const base = [];
    if (clients.length) {
      base.push({ id: "all", name: "All clients" });
    }
    return base.concat(clients);
  }, [clients]);

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,250,245,0.78))] p-6 shadow-[0_12px_40px_rgba(32,26,23,0.04)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Agency</p>
        <h2 className="mt-2 text-2xl">Workspace and Clients</h2>
          <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
            Switch context quickly, then stay focused on one client when you need to connect profiles, compose posts, or review approvals.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm">
          <p className="text-[var(--muted)]">Active workspace</p>
          <p className="mt-1 font-semibold text-[var(--foreground)]">
            {workspaces.find((workspace) => workspace.id === workspaceId)?.name || "None selected"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <label className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Workspace</label>
          <select
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
            value={workspaceId}
            onChange={(e) => onWorkspaceChange?.(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Client</label>
          <select
            className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/60 px-4 py-3 outline-none"
            value={clientId}
            onChange={(e) => onClientChange?.(e.target.value)}
            disabled={!clients.length}
          >
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {hasMultipleClients ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Use "All clients" for planning. Select a specific client to manage connections.
            </p>
          ) : null}
        </div>

        <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/60 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Actions</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create a new client when a new brand needs its own approvals, profiles, and strategy settings.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-60"
              type="button"
              disabled={!canCreateClient}
              onClick={() => {
                setCreating((v) => !v);
                setError("");
              }}
            >
              {creating ? "Cancel" : "Create client"}
            </button>
          </div>
        </div>

        {creating ? (
          <form
            className="rounded-2xl border border-[var(--line)] bg-white/70 p-4 md:col-span-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const trimmed = name.trim();
              if (!trimmed) {
                setError("Client name is required.");
                return;
              }

              try {
                await onCreateClient?.(trimmed);
                setName("");
                setCreating(false);
              } catch (err) {
                setError(err.message || "Unable to create client.");
              }
            }}
          >
            <label className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">New client name</label>
            <input
              className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc"
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <button
              className="mt-3 rounded-2xl bg-[var(--accent)] px-4 py-2 text-white"
              type="submit"
            >
              Create
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
