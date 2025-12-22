// app/dynasty/wagering-demo/DynastyWageringDemoClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CURRENT_SEASON } from "@/src/lib/season";

const SEASON = CURRENT_SEASON;

const DEFAULT_TRACKER = {
  pot: 0,
  notes: "",
  entries: [],
};

function money(n) {
  const v = Number(n || 0) || 0;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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
          if (!cancelled) setTracker({ ...DEFAULT_TRACKER, ...(data?.tracker || data || {}) });
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

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">DYNASTY WAGERING</p>
            <h1 className="text-3xl sm:text-4xl font-semibold leading-tight text-primary">Wager Tracker</h1>
            <p className="text-sm text-muted mt-2 max-w-2xl">Live tracker pulled from the owner/admin panel.</p>
          </header>

          {err ? <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-red-300">{err}</div> : null}

          {loading ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">Loading…</div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Pot</div>
                <div className="mt-2 text-3xl font-semibold text-primary">{money(tracker.pot)}</div>
                {String(tracker.notes || "").trim() ? (
                  <p className="mt-3 text-sm text-muted whitespace-pre-line">{tracker.notes}</p>
                ) : null}
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Entries</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.2em] text-muted border-b border-subtle">
                        <th className="py-2 pr-4 text-left font-semibold">Username</th>
                        <th className="py-2 px-4 text-left font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(tracker.entries) ? tracker.entries : []).map((e, idx) => (
                        <tr key={`${e?.username || idx}`} className="border-b border-subtle">
                          <td className="py-2 pr-4 font-medium">{String(e?.username || "").trim() || "—"}</td>
                          <td className="py-2 px-4">{money(e?.amount)}</td>
                        </tr>
                      ))}
                      {(!tracker.entries || tracker.entries.length === 0) ? (
                        <tr>
                          <td colSpan={2} className="py-4 text-muted">No entries yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
