export function PostList({ posts = [] }) {
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
            <article className="rounded-2xl border border-[var(--line)] bg-white/60 p-4" key={post.id}>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                <span>{post.status}</span>
                <span>{new Date(post.created_at).toLocaleString()}</span>
                {post.scheduled_time ? <span>Scheduled: {new Date(post.scheduled_time).toLocaleString()}</span> : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap">{post.content}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {post.targets.map((target) => (
                  <span
                    className="rounded-full border border-[var(--line)] px-3 py-1"
                    key={`${post.id}-${target.platform}`}
                  >
                    {target.platform}: {target.publishStatus}
                  </span>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

