// src/lib/DynastyLeaguesClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Transform raw rows into:
 * - orphans: list of orphan openings
 * - years: sorted list of years (desc)
 * - byYear: Map<year, Map<themeName, leagues[]>>
 */
function transformLeagues(rows) {
  // Only show leagues marked active (or with null is_active treated as active)
  const active = rows.filter((r) => r.is_active !== false);

  const orphans = active.filter(
    (r) => r.is_orphan || r.status === "ORPHAN OPEN"
  );

  // IMPORTANT: keep orphans in the main list too, so they still show in their theme
  const nonOrphans = active;

  const byYear = new Map();

  for (const lg of nonOrphans) {
    const year = lg.year || new Date().getFullYear();
    const themeName =
      (lg.theme_name && lg.theme_name.trim()) ||
      (lg.kind && lg.kind.trim()) ||
      "Dynasty";

    if (!byYear.has(year)) {
      byYear.set(year, new Map());
    }
    const themeMap = byYear.get(year);
    if (!themeMap.has(themeName)) {
      themeMap.set(themeName, []);
    }
    themeMap.get(themeName).push(lg);
  }

  // sort leagues within each theme by division number then name
  for (const [year, themeMap] of byYear.entries()) {
    for (const [themeName, leagues] of themeMap.entries()) {
      const sorted = leagues.slice().sort((a, b) => {
        const ao = a.display_order ?? 9999;
        const bo = b.display_order ?? 9999;
        if (ao !== bo) return ao - bo;
        return (a.name || "").localeCompare(b.name || "");
      });
      themeMap.set(themeName, sorted);
    }
    byYear.set(year, themeMap);
  }

  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return { orphans, years, byYear };
}

export default function DynastyLeaguesClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("dynasty_leagues")
          .select("*")
          .order("year", { ascending: false })
          .order("display_order", { ascending: true });

        if (error) throw error;
        if (!cancelled) {
          setRows(data || []);
        }
      } catch (err) {
        console.error("Failed to load dynasty_leagues:", err);
        if (!cancelled) {
          setErrorMsg(
            "Unable to load leagues right now. Please refresh or try again later."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const { orphans, years, byYear } = useMemo(
    () => transformLeagues(rows),
    [rows]
  );

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-semibold">Dynasty Leagues</h2>
        <p className="text-sm text-muted">Loading leagues…</p>
      </section>
    );
  }

  if (errorMsg) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-semibold">Dynasty Leagues</h2>
        <p className="text-sm text-danger">{errorMsg}</p>
      </section>
    );
  }

  const hasOrphans = orphans.length > 0;

  return (
    <>
      {/* ORPHAN OPENINGS (TOP LIST) */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-semibold">Orphan Openings</h2>
        <p className="text-sm text-muted max-w-prose">
          When a Dynasty Empire roster becomes available, it will appear here.
          These are rare and usually go fast.
        </p>

        {!hasOrphans ? (
          <div className="rounded-xl border border-subtle bg-panel px-4 py-3 text-xs sm:text-sm text-muted">
            No orphan teams are available right now. Check back after the season
            or follow announcements in the BALLSVILLE chat.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orphans.map((o) => (
              <Link
                key={o.id}
                href={o.sleeper_url || "#"}
                className="group rounded-xl border border-accent/60 bg-card-surface p-4 hover:border-accent hover:-translate-y-0.5 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {o.image_url && (
                      <img
                        src={o.image_url}
                        alt={o.name || "Orphan team"}
                        className="h-12 w-12 shrink-0 rounded-full border border-subtle bg-panel object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-semibold">
                        {o.name || "Orphan Team"}
                      </p>
                      <p className="text-[11px] text-muted">
                        {o.year} · {o.theme_name || o.kind || "Dynasty"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-accent bg-panel px-2 py-1 text-[11px] tracking-wide uppercase text-accent">
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
      </section>

      {/* GAME PAYOUTS / BONUSES (applies to all years) */}
      <section className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-semibold">
          Payouts &amp; Bonuses
        </h2>

        <p className="text-sm text-muted max-w-prose">
          Each league is a 12-team SF, 3WR build that ladders into the Dynasty
          Empire structure and shared Week 17 upside.
        </p>

        <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
          <span className="rounded-lg bg-panel border border-subtle px-3 py-2">
            <span className="font-semibold">$25</span> annually
          </span>
          <span className="rounded-lg bg-panel border border-subtle px-3 py-2">
            Max payouts – <span className="font-semibold">$2,300</span>
          </span>
          <span className="rounded-lg bg-panel border border-subtle px-3 py-2">
            $1,500 possible wager pot + $200 wager BONUS + $250 🏆 Championship
          </span>
          <span className="rounded-lg bg-panel border border-subtle px-3 py-2">
            + $100 🥈, + $50 🥉, + $125 league winner, + $225 EMPIRE win
          </span>
        </div>

        <p className="text-xs text-muted max-w-prose">
          These custom leagues play the season out with the same odds to win
          cash. In the championship round, you win $50 just for making it. You
          can keep it, or push your $50 into the pot for a shot at big money.
        </p>

        <p className="text-xs text-muted max-w-prose">
          There are <span className="font-semibold">3 BONUS prizes</span>: $200
          to the wager winner (most points in Week 17 among wagering players),
          $100 to 2nd, and $50 to 3rd. A final passive bonus of $200 goes to the
          overall highest scorer among all league finalists, regardless of
          wagering.
        </p>
      </section>

      {/* LEAGUE DIRECTORY BY YEAR / THEME */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">
            League Directory
          </h2>
          <p className="mt-1 text-sm text-muted max-w-prose">
            All full &amp; active Dynasty Empire leagues, grouped by season and
            theme. New seasons appear automatically once added in the admin
            dashboard.
          </p>
        </div>

        {years.length === 0 ? (
          <p className="text-sm text-muted">
            No leagues are configured yet. Add leagues from{" "}
            <span className="font-semibold">/admin/dynasty</span>.
          </p>
        ) : (
          years.map((year) => {
            const themeMap = byYear.get(year) || new Map();
            const themeNames = Array.from(themeMap.keys()).sort((a, b) =>
              a.localeCompare(b)
            );

            if (themeNames.length === 0) return null;

            return (
              <div key={year} className="space-y-4">
                <p className="text-xs uppercase tracking-[0.25em] text-accent">
                  {year} Season
                </p>

                {themeNames.map((themeName) => {
                  const leaguesInTheme = themeMap.get(themeName) || [];
                  if (leaguesInTheme.length === 0) return null;

                  const themeBlurb = leaguesInTheme[0]?.theme_blurb || "";

                  return (
                    <div key={themeName} className="space-y-2">
                      <h3 className="text-2xl sm:text-3xl font-semibold">
                        {themeName} – {year}
                      </h3>
                      {themeBlurb && (
                        <p className="text-xs text-muted max-w-prose">
                          {themeBlurb}
                        </p>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {leaguesInTheme.map((lg) => {
                          const isFilling =
                            lg.status === "CURRENTLY FILLING" ||
                            lg.status === "DRAFTING";
                          return (
                            <Link
                              key={lg.id}
                              href={lg.sleeper_url || "#"}
                              className="group rounded-xl border border-subtle bg-card-surface p-4 hover:border-accent hover:-translate-y-0.5 transition"
                            >
                              <div className="flex items-center gap-3">
                                {lg.image_url && (
                                  <img
                                    src={lg.image_url}
                                    alt={lg.name}
                                    className="h-12 w-12 shrink-0 rounded-full border border-subtle bg-panel object-cover"
                                  />
                                )}
                                <div className="flex-1 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold">
                                      {lg.name}
                                    </p>
                                    <p className="text-[11px] text-muted">
                                      12-team SF · Division{" "}
                                      {lg.display_order ?? "–"}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-subtle bg-panel px-2 py-1 text-[11px] tracking-wide uppercase">
                                    {lg.status || "FULL & ACTIVE"}
                                  </span>
                                </div>
                              </div>
                              {isFilling && lg.fill_note && (
                                <p className="mt-2 text-[11px] text-accent">
                                  {lg.fill_note}
                                </p>
                              )}
                              {lg.note && (
                                <p className="mt-1 text-[11px] text-muted">
                                  {lg.note}
                                </p>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
