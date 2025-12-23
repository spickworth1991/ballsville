// src/lib/DynastyLeaguesClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const R2_ROWS_KEY = "data/dynasty/leagues.json";

/**
 * Transform raw rows into:
 * - orphans: list of orphan openings
 * - years: sorted list of years (desc)
 * - byYear: Map<year, Map<themeName, leagues[]>>
 */
function transformLeagues(rows) {
  // Only show leagues marked active (or with null/undefined treated as active)
  const active = (rows || []).filter((r) => r?.is_active !== false);

  const orphans = active.filter((r) => r?.is_orphan || r?.status === "ORPHAN OPEN");

  // IMPORTANT: keep orphans in the main list too, so they still show in their theme
  const byYear = new Map();

  for (const lg of active) {
    const year = Number(lg?.year) || new Date().getFullYear();
    const themeName =
      (typeof lg?.theme_name === "string" && lg.theme_name.trim()) ||
      (typeof lg?.kind === "string" && lg.kind.trim()) ||
      "Dynasty";

    if (!byYear.has(year)) byYear.set(year, new Map());
    const themeMap = byYear.get(year);
    if (!themeMap.has(themeName)) themeMap.set(themeName, []);
    themeMap.get(themeName).push(lg);
  }

  // sort leagues within each theme by display_order then name
  for (const [year, themeMap] of byYear.entries()) {
    for (const [themeName, leagues] of themeMap.entries()) {
      const sorted = leagues.slice().sort((a, b) => {
        const ao = a?.display_order ?? 9999;
        const bo = b?.display_order ?? 9999;
        if (ao !== bo) return ao - bo;
        return String(a?.name || "").localeCompare(String(b?.name || ""));
      });
      themeMap.set(themeName, sorted);
    }
    byYear.set(year, themeMap);
  }

  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return { orphans, years, byYear };
}

function imageSrcForRow(row) {
  const key = typeof row?.imageKey === "string" ? row.imageKey.trim() : "";
  if (key) return `/r2/${key}`;
  const url = typeof row?.image_url === "string" ? row.image_url.trim() : "";
  return url;
}

function PremiumSection({ title, subtitle, kicker, children, className = "" }) {
  return (
    <section
      className={[
        "mt-6 relative overflow-hidden rounded-3xl bg-card-surface",
        "shadow-2xl shadow-black/30",
        "px-6 py-6 sm:px-10 sm:py-8",
        className,
      ].join(" ")}
    >
      {/* subtle glow accents like hero */}
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen">
        <div className="absolute -top-24 -left-10 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <header className="text-center space-y-2">
          {kicker ? (
            <p className="text-xs uppercase tracking-[0.35em] text-accent">{kicker}</p>
          ) : null}
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-muted max-w-3xl mx-auto">{subtitle}</p>
          ) : null}
        </header>

        <div>{children}</div>
      </div>
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-subtle bg-subtle-surface px-4 py-4 text-sm text-muted text-center">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

export default function DynastyLeaguesClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const bust = `v=${Date.now()}`;
        const res = await fetch(`/r2/${R2_ROWS_KEY}?${bust}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setRows([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        if (!cancelled) setRows(list);
      } catch (err) {
        console.error("Failed to load dynasty leagues from R2:", err);
        if (!cancelled) setErrorMsg("Unable to load leagues right now. Please refresh or try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const { orphans, years, byYear } = useMemo(() => transformLeagues(rows), [rows]);
  const hasOrphans = orphans.length > 0;

  if (loading) {
    return (
      <PremiumSection title="Dynasty Leagues" subtitle="Loading the directory…">
        <p className="text-center text-sm text-muted">Loading leagues…</p>
      </PremiumSection>
    );
  }

  if (errorMsg) {
    return (
      <PremiumSection title="Dynasty Leagues">
        <p className="text-center text-sm text-danger">{errorMsg}</p>
      </PremiumSection>
    );
  }

  return (
    <>
      {/* ORPHAN OPENINGS (TOP LIST) */}
      <PremiumSection
        kicker="Roster Availability"
        title="Orphan Openings"
        subtitle="When a Dynasty Empire roster becomes available, it will appear here. These are rare and usually go fast."
      >
        {!hasOrphans ? (
          <EmptyState>
            No orphan teams are available right now. Check back after the season or follow announcements in the BALLSVILLE chat.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orphans.map((o, idx) => (
              <Link
                key={o?.id || `${o?.year}-${o?.theme_name}-${o?.name}-${idx}`}
                href={o?.sleeper_url || "#"}
                className={[
                  "group rounded-2xl border border-accent/60 bg-card-surface p-4",
                  "hover:border-accent hover:-translate-y-0.5 transition",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.03)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {imageSrcForRow(o) ? (
                      <img
                        src={imageSrcForRow(o)}
                        alt={o?.name || "Orphan team"}
                        className="h-12 w-12 shrink-0 rounded-full border border-subtle bg-panel object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{o?.name || "Orphan Team"}</p>
                      <p className="text-[11px] text-muted truncate">
                        {o?.year} · {o?.theme_name || o?.kind || "Dynasty"}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full border border-accent bg-panel px-2 py-1 text-[11px] tracking-wide uppercase text-accent">
                    Orphan Open
                  </span>
                </div>

                <p className="mt-2 text-[11px] text-muted">
                  Click for Sleeper league details and to request the team.
                </p>
              </Link>
            ))}
          </div>
        )}
      </PremiumSection>

      {/* PAYOUTS */}
      <PremiumSection
        kicker="Money Stuff"
        title="Payouts & Bonuses"
        subtitle="Each league is a 12-team SF, 3WR build that ladders into the Dynasty Empire structure and shared Week 17 upside."
      >
        <div className="flex flex-wrap justify-center gap-3 text-xs sm:text-sm">
          <span className="rounded-xl bg-panel border border-subtle px-3 py-2">
            <span className="font-semibold text-foreground">$25</span> annually
          </span>
          <span className="rounded-xl bg-panel border border-subtle px-3 py-2">
            Max payouts – <span className="font-semibold text-foreground">$2,300</span>
          </span>
          <span className="rounded-xl bg-panel border border-subtle px-3 py-2 text-center">
            $1,500 possible wager pot + $200 wager BONUS + $250 🏆 Championship
          </span>
          <span className="rounded-xl bg-panel border border-subtle px-3 py-2 text-center">
            + $100 🥈, + $50 🥉, + $125 league winner, + $225 EMPIRE win
          </span>
        </div>

        <div className="mt-5 mx-auto max-w-4xl space-y-3 text-center">
          <p className="text-sm text-muted">
            These custom leagues play the season out with the same odds to win cash. In the championship round, you win $50 just for making it. You can
            keep it, or push your $50 into the pot for a shot at big money.
          </p>

          <p className="text-sm text-muted">
            There are <span className="font-semibold text-foreground">3 BONUS prizes</span>: $200 to the wager winner (most points in Week 17 among
            wagering players), $100 to 2nd, and $50 to 3rd. A final passive bonus of $200 goes to the overall highest scorer among all league finalists,
            regardless of wagering.
          </p>
        </div>
      </PremiumSection>

      {/* DIRECTORY */}
      <PremiumSection
        kicker="All Leagues"
        title="League Directory"
        subtitle="All full & active Dynasty Empire leagues, grouped by season and theme. New seasons appear automatically once added in the admin dashboard."
      >
        {years.length === 0 ? (
          <EmptyState>No leagues are configured yet.</EmptyState>
        ) : (
          <div className="space-y-12">
            {years.map((year) => {
              const themeMap = byYear.get(year) || new Map();
              const themeNames = Array.from(themeMap.keys()).sort((a, b) => a.localeCompare(b));
              if (themeNames.length === 0) return null;

              return (
                <div key={year} className="space-y-6">
                  <div className="flex items-center justify-center">
                    <p className="text-xs uppercase tracking-[0.25em] text-accent">{year} Season</p>
                  </div>

                  {themeNames.map((themeName) => {
                    const leaguesInTheme = themeMap.get(themeName) || [];
                    if (leaguesInTheme.length === 0) return null;
                    const themeBlurb = leaguesInTheme[0]?.theme_blurb || "";

                    return (
                      <div key={themeName} className="space-y-4">
                        <div className="text-center">
                          <h3 className="text-2xl sm:text-3xl font-semibold text-foreground">
                            {themeName} <span className="text-muted">– {year}</span>
                          </h3>
                          {themeBlurb ? (
                            <p className="mt-2 text-sm text-muted max-w-4xl mx-auto">{themeBlurb}</p>
                          ) : null}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {leaguesInTheme.map((lg, idx) => {
                            const isFilling = lg?.status === "CURRENTLY FILLING" || lg?.status === "DRAFTING";
                            const img = imageSrcForRow(lg);

                            return (
                              <Link
                                key={lg?.id || `${year}-${themeName}-${lg?.name}-${idx}`}
                                href={lg?.sleeper_url || "#"}
                                className={[
                                  "group rounded-2xl border border-subtle bg-card-surface p-4",
                                  "hover:border-accent hover:-translate-y-0.5 transition",
                                  "shadow-[0_0_0_1px_rgba(255,255,255,0.03)]",
                                ].join(" ")}
                              >
                                <div className="flex items-center gap-3">
                                  {img ? (
                                    <img
                                      src={img}
                                      alt={lg?.name || "League"}
                                      className="h-12 w-12 shrink-0 rounded-full border border-subtle bg-panel object-cover"
                                    />
                                  ) : null}

                                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-foreground truncate">{lg?.name}</p>
                                      <p className="text-[11px] text-muted truncate">
                                        12-team SF · Division {lg?.display_order ?? "–"}
                                      </p>
                                    </div>

                                    <span className="shrink-0 rounded-full border border-subtle bg-panel px-2 py-1 text-[11px] tracking-wide uppercase">
                                      {lg?.status || "FULL & ACTIVE"}
                                    </span>
                                  </div>
                                </div>

                                {isFilling && lg?.fill_note ? (
                                  <p className="mt-2 text-[11px] text-accent text-center">{lg.fill_note}</p>
                                ) : null}
                                {lg?.note ? (
                                  <p className="mt-1 text-[11px] text-muted text-center">{lg.note}</p>
                                ) : null}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </PremiumSection>
    </>
  );
}
