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
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Agency</p>
        <h2 className="mt-2 text-2xl">Workspace and Clients</h2>
      </div>

      <div className="space-y-4">
        <div>
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

        <div className="flex flex-wrap gap-3">
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

        {creating ? (
          <form
            className="rounded-2xl border border-[var(--line)] bg-white/60 p-4"
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

