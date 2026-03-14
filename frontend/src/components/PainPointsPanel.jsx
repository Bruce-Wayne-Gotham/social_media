const painPoints = [
  {
    title: "Limited analytics",
    description:
      "Buffer's analytics are often too basic for agencies and teams that need deeper engagement reporting across accounts."
  },
  {
    title: "No unified inbox",
    description:
      "Managing DMs, comments, and mentions still requires extra tools, which breaks the workflow for full social engagement."
  },
  {
    title: "Scaling costs",
    description:
      "Pricing scales per channel, so costs rise quickly once users manage multiple brands, clients, or publishing streams."
  },
  {
    title: "Occasional performance issues",
    description:
      "Users report glitches around scheduled publishing and duplicated posts, which creates avoidable operational friction."
  },
  {
    title: "Short-form platform gaps",
    description:
      "TikTok and YouTube Shorts workflows remain limited, making the product less compelling for creator-led teams."
  }
];

export function PainPointsPanel() {
  return (
    <section className="rounded-[2.5rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[0_25px_80px_rgba(30,20,10,0.08)] backdrop-blur">
      <div className="max-w-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Why Teams Switch</p>
        <h2 className="mt-3 text-4xl leading-tight">Where Buffer starts to feel narrow.</h2>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Common complaints from social teams cluster around shallow reporting, fragmented engagement workflows,
          and weak support for short-form publishing.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {painPoints.map((item) => (
          <article
            key={item.title}
            className="rounded-[1.75rem] border border-[var(--line)] bg-white/70 p-5"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Pain Point</p>
            <h3 className="mt-3 text-xl">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
