"use client";

function metricLabel(key) {
  switch (key) {
    case "seats":
      return "Seats";
    case "clients":
      return "Clients";
    case "profiles":
      return "Profiles";
    case "postsPerMonth":
      return "Posts / month";
    case "aiCredits":
      return "AI credits";
    default:
      return key;
  }
}

export function BillingPanel({
  billing,
  loading = false,
  error = "",
  startingCheckout = false,
  onUpgrade
}) {
  const limits = billing?.plan?.limits || {};
  const usage = billing?.usage || {};
  const metrics = ["seats", "clients", "profiles", "postsPerMonth", "aiCredits"];

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,242,234,0.82))] p-6 shadow-[0_12px_40px_rgba(32,26,23,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Billing</p>
          <h2 className="mt-2 text-2xl">Plan and usage</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            One free plan, one paid plan, and clear limits for agency operations. Safe Mode stays on in every tier.
          </p>
        </div>
        <div className="rounded-full border border-[rgba(216,95,56,0.24)] bg-white/80 px-3 py-1 text-sm">
          {billing?.plan?.name || "Free"}
        </div>
      </div>

      {loading ? <p className="text-sm text-[var(--muted)]">Loading billing...</p> : null}
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {!loading && billing ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.map((metric) => (
              <div key={metric} className="rounded-2xl border border-[var(--line)] bg-white/68 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{metricLabel(metric)}</p>
                <p className="mt-2 text-2xl">
                  {usage[metric] || 0}
                  <span className="ml-2 text-base text-[var(--muted)]">/ {limits[metric] ?? 0}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[rgba(216,95,56,0.06)] p-4">
            <div className="text-sm text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">Current subscription</p>
              {billing.subscription?.status
                ? `Subscription: ${billing.subscription.status}`
                : "Subscription: free plan"}
            </div>
            {billing.upgradeAvailable ? (
              <button
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60"
                type="button"
                disabled={startingCheckout}
                onClick={() => onUpgrade?.()}
              >
                {startingCheckout ? "Opening Stripe..." : "Upgrade to Agency Pro"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
