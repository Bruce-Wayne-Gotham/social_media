"use client";

import { useMemo, useState } from "react";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(date) {
  // Week starts Monday (agency-friendly).
  const d = startOfDay(date);
  const day = d.getDay(); // 0..6, Sunday=0
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function endOfMonth(date) {
  const d = startOfDay(date);
  d.setMonth(d.getMonth() + 1, 0);
  return d;
}

function clampText(value, max = 40) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

export function CalendarPanel({ posts = [], clientsById = {} }) {
  const [mode, setMode] = useState("month"); // month | week
  const [anchor, setAnchor] = useState(() => new Date());

  const scheduled = useMemo(() => {
    return (posts || [])
      .filter((p) => p && p.scheduled_time)
      .map((p) => ({
        id: p.id,
        clientId: p.client_id,
        approvalStatus: p.approval_status,
        status: p.status,
        content: p.content,
        when: new Date(p.scheduled_time)
      }))
      .sort((a, b) => a.when.getTime() - b.when.getTime());
  }, [posts]);

  const range = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(anchor);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { days, title: `Week of ${start.toLocaleDateString()}` };
    }

    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = addDays(startOfWeek(addDays(monthEnd, 7)), 6);

    const days = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      days.push(d);
    }
    return { days, title: anchor.toLocaleString(undefined, { month: "long", year: "numeric" }) };
  }, [mode, anchor]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const item of scheduled) {
      const key = startOfDay(item.when).toISOString();
      const next = map.get(key) || [];
      next.push(item);
      map.set(key, next);
    }
    return map;
  }, [scheduled]);

  const today = useMemo(() => startOfDay(new Date()), []);

  function buttonClass(variant) {
    if (variant === "primary") {
      return "rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white shadow-sm hover:bg-[var(--accent-dark)]";
    }
    if (variant === "active") {
      return "rounded-full border border-[var(--accent)] bg-white/80 px-4 py-2 text-sm text-[var(--foreground)]";
    }
    return "rounded-full border border-[var(--line)] bg-transparent px-4 py-2 text-sm hover:bg-white/50";
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Calendar</p>
          <h2 className="mt-2 text-2xl">Scheduled posts</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{range.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={buttonClass("primary")}
            type="button"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </button>
          <button
            className={buttonClass("default")}
            type="button"
            onClick={() => setAnchor((d) => addDays(d, mode === "week" ? -7 : -30))}
          >
            Prev
          </button>
          <button
            className={buttonClass("default")}
            type="button"
            onClick={() => setAnchor((d) => addDays(d, mode === "week" ? 7 : 30))}
          >
            Next
          </button>
          <button
            className={mode === "week" ? buttonClass("active") : buttonClass("default")}
            type="button"
            onClick={() => setMode("week")}
          >
            Week
          </button>
          <button
            className={mode === "month" ? buttonClass("active") : buttonClass("default")}
            type="button"
            onClick={() => setMode("month")}
          >
            Month
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs text-[var(--muted)]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {range.days.map((day) => {
          const key = startOfDay(day).toISOString();
          const items = byDay.get(key) || [];
          const isToday = isSameDay(day, today);

          return (
            <div
              key={key}
              className={`min-h-28 rounded-2xl border border-[var(--line)] bg-white/55 p-3 ${isToday ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent" : ""}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--muted)]">{day.getDate()}</p>
                {items.length ? (
                  <span className="rounded-full border border-[var(--line)] bg-white/70 px-2 py-0.5 text-[10px] text-[var(--muted)]">
                    {items.length}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 space-y-2">
                {items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border border-[var(--line)] bg-white/70 px-2 py-2 ${
                      item.approvalStatus === "approved"
                        ? "border-emerald-200 bg-emerald-50/60"
                        : item.approvalStatus === "needs_approval"
                          ? "border-amber-200 bg-amber-50/60"
                          : item.approvalStatus === "rejected"
                            ? "border-rose-200 bg-rose-50/60"
                            : ""
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                      {(clientsById[item.clientId] || "Client") + " - " + item.approvalStatus}
                    </p>
                    <p className="mt-1 text-xs">{clampText(item.content, 48)}</p>
                  </div>
                ))}
                {items.length > 3 ? (
                  <p className="text-[10px] text-[var(--muted)]">+{items.length - 3} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
