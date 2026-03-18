export function MagicLinkPanel({ clientId = "", clientName = "", approvalLink = null, creating = false, onCreate }) {
  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Client review</p>
        <h2 className="mt-2 text-2xl">Magic link</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Generate a client-scoped approval inbox link for the selected client.</p>
      </div>

      {!clientId || clientId === "all" ? (
        <p className="text-sm text-[var(--muted)]">Select a specific client to create an approval link.</p>
      ) : (
        <div className="space-y-3">
          <button
            className="rounded-2xl border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-60"
            type="button"
            disabled={creating}
            onClick={onCreate}
          >
            {creating ? "Creating..." : `Create link for ${clientName || "client"}`}
          </button>
          {approvalLink ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-4 text-sm">
              <p className="text-[var(--muted)]">Expires {new Date(approvalLink.expiresAt).toLocaleString()}</p>
              <input
                className="mt-3 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                readOnly
                value={approvalLink.url}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
