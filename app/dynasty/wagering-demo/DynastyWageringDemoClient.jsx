// app/dynasty/wagering-demo/DynastyWageringDemoClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CURRENT_SEASON } from "@/src/lib/season";

const SEASON = CURRENT_SEASON;

const DEFAULT_TRACKER = {
  updated: "",
  pot: 0,
  entries: [],
};

function money(n) {
  const v = Number(n || 0) || 0;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function computePot(entries) {
  return (Array.isArray(entries) ? entries : []).reduce((acc, e) => {
    const n = Number(e?.amount);
    if (!Number.isFinite(n)) return acc;
    return acc + n;
  }, 0);
}

export default function DynastyWageringDemoClient() {
  const [tracker, setTracker] = useState(DEFAULT_TRACKER);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const bust = useMemo(() => `v=${Date.now()}`, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr("");
      setLoading(true);
      try {
        const res = await fetch(`/r2/data/dynasty/wagering_tracker_${SEASON}.json?${bust}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const incoming = { ...DEFAULT_TRACKER, ...(data?.tracker || data || {}) };
          const pot = computePot(incoming.entries);
          if (!cancelled) setTracker({ ...incoming, pot });
        } else {
          if (!cancelled) setTracker(DEFAULT_TRACKER);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load wagering tracker");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bust]);

  const entries = Array.isArray(tracker.entries) ? tracker.entries : [];
  const pot = computePot(entries);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">The BALLSVILLE Game</p>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                Dynasty Wagering <span className="text-primary">(Week 17)</span>
              </h1>

              <p className="text-sm sm:text-base text-muted max-w-prose">
                Live tracker pulled from the admin screen. Season {SEASON}
                {tracker.updated ? ` · Updated ${tracker.updated}` : ""}.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/dynasty" className="btn btn-outline">
                  ← Back to Dynasty
                </Link>
                <Link href="/dynasty/intro" className="btn btn-outline">
                  Dynasty Intro
                </Link>
                <Link href="/constitution/dynasty" className="btn btn-outline">
                  Dynasty Rules
                </Link>
              </div>

              <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                  Public view (read-only)
                </span>
                <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                  Admin updates live
                </span>
              </div>
            </div>
          </header>

          {/* Explanation (mirrors the old demo layout) */}
          <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm space-y-4">
            <h2 className="text-2xl sm:text-3xl font-semibold">How it Works</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 space-y-2">
                <p className="text-sm font-semibold">The $50 credit (🪙)</p>
                <ul className="text-sm text-muted space-y-1 list-disc list-inside">
                  <li>Top 2 teams in each league receive a $50 credit (🪙).</li>
                  <li>Each finalist chooses to wager or bank by Week 17 kickoff (declared in chat).</li>
                  <li>If someone doesn’t reply, they bank by default.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 space-y-2">
                <p className="text-sm font-semibold">Bonuses (Week 17)</p>
                <ul className="text-sm text-muted space-y-1 list-disc list-inside">
                  <li>💰 $200 Wager Bonus: highest scorer among those who wagered.</li>
                  <li>🏆 $250 Championship Bonus: highest scorer overall among all finalists.</li>
                  <li>🥈 $100 for 2nd overall · 🥉 $50 for 3rd overall.</li>
                  <li>League winner earns +$125 for outscoring their opponent in Week 17.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4">
              <p className="text-sm text-muted">
                This page only tracks the live wager pool (what’s actually been put in). Bonus payouts are handled by the
                Dynasty rules.
              </p>
            </div>
          </section>

          {/* Tracker */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold">Wager Tracker</h2>
                <p className="mt-1 text-sm text-muted max-w-prose">
                  Total pot is computed automatically from the entries below.
                </p>
              </div>

              <div className="rounded-2xl border border-subtle bg-card-surface px-4 py-3 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Total Pot</div>
                <div className="mt-1 text-2xl font-semibold text-primary">{money(pot)}</div>
              </div>
            </div>

            {err ? (
              <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-red-300">{err}</div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">Loading…</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-subtle bg-card-surface shadow-sm">
                <table className="min-w-[680px] w-full text-sm">
                  <thead className="bg-subtle-surface">
                    <tr className="text-left">
                      <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        Username
                      </th>
                      <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, idx) => (
                      <tr key={String(e?.id || e?.username || idx)} className="hover:bg-subtle-surface/50 transition">
                        <td className="px-4 py-3 border-b border-subtle font-semibold">
                          {String(e?.username || "").trim() || "—"}
                        </td>
                        <td className="px-4 py-3 border-b border-subtle text-muted">{money(e?.amount)}</td>
                      </tr>
                    ))}
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-muted">
                          No entries yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
