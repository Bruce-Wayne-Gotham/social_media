export function PostList({ posts = [], clientsById = {}, selectedPostId = "", onSelectPost }) {
  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">History</p>
        <h2 className="mt-2 text-2xl">Recent posts</h2>
      </div>

      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No posts yet.</p>
        ) : (
          posts.map((post) => (
            <button
              className={`w-full rounded-2xl border p-4 text-left ${selectedPostId === post.id ? "border-[var(--accent)] bg-white/80" : "border-[var(--line)] bg-white/60"}`}
              key={post.id}
              type="button"
              onClick={() => onSelectPost?.(post.id)}
            >
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                {clientsById[post.client_id] ? <span>{clientsById[post.client_id]}</span> : null}
                {post.approval_status ? (
                  <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1">
                    {post.approval_status}
                  </span>
                ) : null}
                {post.generation_source === "autopilot_ai" ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-800">
                    autopilot ai
                  </span>
                ) : null}
                {Array.isArray(post.risk_flags) && post.risk_flags.length ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                    {post.risk_flags.length} risk flag{post.risk_flags.length === 1 ? "" : "s"}
                  </span>
                ) : null}
                <span>{post.status}</span>
                <span>{new Date(post.created_at).toLocaleString()}</span>
                {post.scheduled_time ? <span>Scheduled: {new Date(post.scheduled_time).toLocaleString()}</span> : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap">{post.content}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {post.targets.map((target) => (
                  <span
                    className="rounded-full border border-[var(--line)] px-3 py-1"
                    key={`${post.id}-${target.platform}-${target.socialAccountId || "legacy"}`}
                  >
                    {target.platform}: {target.publishStatus}
                  </span>
                ))}
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
