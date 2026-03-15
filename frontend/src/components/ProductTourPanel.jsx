const steps = [
  {
    title: "Sign in and set up",
    description: "Create an account, then start connecting your publishing channels from the dashboard."
  },
  {
    title: "Draft a post",
    description: "Write your content once and include media URLs and hashtags."
  },
  {
    title: "Schedule or publish",
    description: "Pick target platforms and a time. SocialHub queues the job for publishing."
  },
  {
    title: "Track status",
    description: "See what’s scheduled, publishing, published, or failed, with per-platform results."
  }
];

export function ProductTourPanel() {
  return (
    <section className="rounded-[2.5rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[0_25px_80px_rgba(30,20,10,0.08)] backdrop-blur">
      <div className="max-w-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">How it works</p>
        <h2 className="mt-3 text-4xl leading-tight">Draft once. Ship everywhere.</h2>
        <p className="mt-4 text-sm text-[var(--muted)]">
          A simple workflow for SMB social teams: connect channels, schedule content, and track publishing status in one
          place.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <article
            key={step.title}
            className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-5"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{`Step ${index + 1}`}</p>
            <h3 className="mt-3 text-xl">{step.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{step.description}</p>
          </article>
        ))}
      </div>

      <p className="mt-6 text-sm text-[var(--muted)]">Create your account to get started.</p>
    </section>
  );
}

