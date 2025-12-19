// app/mini-leagues/MiniLeaguesClient.jsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = ["FULL", "FILLING", "TBD", "DRAFTING"];

function Badge({ status }) {
  const s = String(status || "").toUpperCase();
  const ok = STATUS_OPTIONS.includes(s) ? s : "TBD";

  return (
    <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-sm">
      {ok}
    </span>
  );
}

export default function MiniLeaguesClient({ initialData }) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    if (data) return;
    (async () => {
      try {
        const res = await fetch("/api/mini-leagues");
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      }
    })();
  }, [data]);

  const divisions = useMemo(() => {
    const arr = Array.isArray(data?.divisions) ? [...data.divisions] : [];
    arr.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
    return arr;
  }, [data]);

  if (!data) {
    return (
      <main className="min-h-screen text-fg relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-glow" />
        </div>
        <section className="section">
          <div className="container-site">
            <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
              <h1 className="text-2xl font-semibold">Mini-Leagues</h1>
              <p className="mt-2 text-sm text-muted">Unable to load data.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-fg relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          {/* HERO */}
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">
                  the Mini-Leagues game
                </p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-primary">
                  {data?.hero?.title || "Mini-Leagues"}
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">
                  {data?.hero?.subtitle || ""}
                </p>

                <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    Season ends after Week 14
                  </span>
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    Game ends after Week 15
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden shadow-lg">
                <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    MINI-LEAGUES
                  </span>
                  {data?.hero?.image ? (
                    <Image
                      src={data.hero.image}
                      alt="Mini-Leagues"
                      width={120}
                      height={80}
                      className="rounded-md"
                      priority
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted leading-snug">
                    Optional wagering. Bonuses stack. Great odds.
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* SETTINGS + HOW IT WORKS */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary">BALLSVILLE Settings</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {(data?.settings || []).map((x, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-[2px]">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary">How the Game Works</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {(data?.howItWorks || []).map((x, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-[2px]">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-xl border border-subtle bg-card-trans p-4 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-fg">Wagering Snapshot</h3>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Without a wager</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {(data?.wagering?.withoutWager || []).map((x, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="mt-[2px]">•</span>
                          <span>{x}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">With a wager</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {(data?.wagering?.withWager || []).map((x, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="mt-[2px]">•</span>
                          <span>{x}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CASH + ETIQUETTE */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary">How the Cash Works</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {(data?.cash || []).map((x, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-[2px]">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary">Draft Etiquette</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {(data?.etiquette || []).map((x, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-[2px]">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* DIVISIONS */}
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold">Divisions</h2>
                <p className="mt-1 text-sm text-muted max-w-prose">
                  Each Division contains 10 leagues (12 teams each). Status is managed by admins.
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {divisions.map((d) => (
                <div
                  key={d?.id}
                  className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-primary">
                        Division {d?.id}
                      </h3>
                      <p className="text-xs text-muted mt-1">
                        10 leagues • 12 teams each
                      </p>
                    </div>
                    <Badge status={d?.status} />
                  </div>

                  {d?.image ? (
                    <div className="rounded-xl overflow-hidden border border-subtle">
                      <Image
                        src={d.image}
                        alt={`Division ${d.id}`}
                        width={1200}
                        height={600}
                        className="w-full h-auto"
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {(d?.leagues || []).slice(0, 10).map((lg, idx) => (
                      <a
                        key={`${d?.id}-${idx}`}
                        href={lg?.url || "#"}
                        target={lg?.url ? "_blank" : undefined}
                        rel={lg?.url ? "noreferrer" : undefined}
                        className="rounded-xl border border-subtle bg-card-trans p-4 backdrop-blur-sm hover:bg-subtle-surface/60 transition"
                      >
                        <div className="flex items-center gap-3">
                          {lg?.image ? (
                            <Image
                              src={lg.image}
                              alt={lg?.name || "League"}
                              width={44}
                              height={44}
                              className="rounded-md"
                            />
                          ) : (
                            <div className="h-11 w-11 rounded-md border border-subtle bg-subtle-surface" />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold truncate">
                              {lg?.name || `League ${idx + 1}`}
                            </div>
                            <div className="text-xs text-muted truncate">
                              {lg?.url ? "Open in Sleeper" : "Link coming soon"}
                            </div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* LAST YEAR */}
          {data?.lastYear?.image ? (
            <section className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm space-y-3">
              <h2 className="text-2xl font-semibold">{data?.lastYear?.title || "Last Year’s Winners"}</h2>
              <div className="rounded-xl overflow-hidden border border-subtle">
                <Image
                  src={data.lastYear.image}
                  alt={data?.lastYear?.title || "Last Year’s Winners"}
                  width={1600}
                  height={900}
                  className="w-full h-auto"
                />
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
