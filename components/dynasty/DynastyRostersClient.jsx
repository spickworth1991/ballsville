"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const SHEETS = {
  dragons: {
    label: "Dragons Rosters",
    src:
      "https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vRfd5XPuActPfhdKNd1Vzcke8gcxwD-36JkbHPQK7rA3Y-EeerrKaqT7kLBKO9eqVPOHRRIA_3LCq_m/pubhtml/sheet?headers=false&gid=0",
  },
  heroes: {
    label: "Heroes Rosters",
    src:
      "https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vRfd5XPuActPfhdKNd1Vzcke8gcxwD-36JkbHPQK7rA3Y-EeerrKaqT7kLBKO9eqVPOHRRIA_3LCq_m/pubhtml/sheet?headers=false&gid=823857217",
  },
};

export default function DynastyRostersClient() {
  const [tab, setTab] = useState("dragons");
  const current = useMemo(() => SHEETS[tab] ?? SHEETS.dragons, [tab]);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">
                Dynasty Empire
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                All <span className="text-primary">Dynasty</span> Rosters
              </h1>
              <p className="text-sm sm:text-base text-muted max-w-prose">
                Live roster reference for every Dynasty Empire league. Use the tabs to
                switch between Dragons and Heroes.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link prefetch={false} href="/dynasty" className="btn btn-outline">
                  ← Back to Dynasty
                </Link>
                <Link prefetch={false} href="/dynasty/wagers" className="btn btn-outline">
                  Wagering
                </Link>
              </div>
            </div>
          </header>

          <div className="rounded-2xl border border-subtle bg-card-surface p-3 sm:p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab("dragons")}
                className={`btn ${tab === "dragons" ? "btn-primary" : "btn-outline"}`}
              >
                🐉 {SHEETS.dragons.label}
              </button>
              <button
                type="button"
                onClick={() => setTab("heroes")}
                className={`btn ${tab === "heroes" ? "btn-primary" : "btn-outline"}`}
              >
                🛡️ {SHEETS.heroes.label}
              </button>
            </div>

            <p className="mt-3 text-xs text-muted">
              Viewing: <span className="font-semibold text-fg">{current.label}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Embedded Sheet
              </span>
              <a
                href={current.src}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline"
              >
                Open in Google Sheets →
              </a>
            </div>

            <iframe
              title={current.label}
              src={current.src}
              className="w-full h-[78vh] bg-white"
              loading="lazy"
            />
          </div>

          
        </div>
      </section>
    </main>
  );
}
