function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function clampText(value, max = 80) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

export function ApprovalInboxPanel({ posts = [], clientsById = {}, selectedPostId = "", onSelectPost }) {
  const pending = (posts || []).filter((post) => post.approval_status === "needs_approval");

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Approvals</p>
        <h2 className="mt-2 text-2xl">Inbox</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Posts waiting for approval across the current client selection.</p>
      </div>

      <div className="space-y-3">
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No posts are waiting for approval.</p>
        ) : (
          pending.map((post) => (
            <button
              key={post.id}
              className={`w-full rounded-2xl border p-4 text-left ${selectedPostId === post.id ? "border-[var(--accent)] bg-white/80" : "border-[var(--line)] bg-white/60"}`}
              type="button"
              onClick={() => onSelectPost?.(post.id)}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                {clientsById[post.client_id] ? <span>{clientsById[post.client_id]}</span> : null}
                <span>{post.approval_status}</span>
                {`${post.generation_source || ""}`.startsWith("autopilot_") ? <span>autopilot ai</span> : null}
                {Array.isArray(post.risk_flags) && post.risk_flags.length ? <span>{post.risk_flags.length} risk flag{post.risk_flags.length === 1 ? "" : "s"}</span> : null}
                {post.approval_requested_at ? <span>Requested {formatWhen(post.approval_requested_at)}</span> : null}
              </div>
              <p className="mt-3 text-sm">{clampText(post.content)}</p>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

