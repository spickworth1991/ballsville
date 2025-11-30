// src/lib/BigGameDivisionsClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabaseClient";

function statusPillClass(kind) {
  if (kind === "FULL") return "badge-status badge-status-full";
  if (kind === "FILLING") return "badge-status badge-status-filling";
  if (kind === "DRAFTING") return "badge-status badge-status-drafting";
  if (kind === "TBD") return "badge-status badge-status-tbd";
  return "badge-status badge-status-default";
}

/**
 * Group rows into divisions using division_name.
 * We treat is_division_header = true as the source of theme info.
 * Also compute league-status breakdown + total open spots.
 */
function transformDivisions(rows) {
  // Only look at active rows
  const active = rows.filter((r) => r.is_active !== false);

  const byDivision = new Map();

  for (const row of active) {
    const name = row.division_name || "";
    if (!name) continue;
    if (!byDivision.has(name)) {
      byDivision.set(name, { header: null, leagues: [] });
    }
    const group = byDivision.get(name);
    if (row.is_division_header) {
      if (!group.header) group.header = row;
    } else {
      group.leagues.push(row);
    }
  }

  const divisions = [];

  for (const [division_name, group] of byDivision.entries()) {
    const header = group.header || group.leagues[0] || null;
    const leagues = group.leagues;
    const league_count = leagues.length;
    const year = header?.year ?? new Date().getFullYear();
    const image_url =
      header?.division_image_path || "/photos/biggame/default.jpg";
    const division_order =
      header?.division_order != null ? Number(header.division_order) : null;

    // Count league statuses + open spots
    const statusCounts = {
      FULL: 0,
      FILLING: 0,
      DRAFTING: 0,
      TBD: 0,
      OTHER: 0,
    };
    let openSpots = 0;

    for (const lg of leagues) {
      const s = (lg.league_status || "TBD").toUpperCase();
      if (s === "FULL") statusCounts.FULL += 1;
      else if (s === "FILLING") statusCounts.FILLING += 1;
      else if (s === "DRAFTING") statusCounts.DRAFTING += 1;
      else if (s === "TBD") statusCounts.TBD += 1;
      else statusCounts.OTHER += 1;

      if (s === "FILLING" && lg.spots_available != null) {
        const n = Number(lg.spots_available);
        if (!Number.isNaN(n)) openSpots += n;
      }
    }

    // ✅ Division is FULL ONLY when *all* leagues are FULL
    const isFullyFull =
      league_count > 0 && statusCounts.FULL === league_count;

    divisions.push({
      division_name,
      year,
      image_url,
      division_order,
      league_count,
      statusCounts,
      openSpots,
      isFullyFull,
    });
  }

  // Sort by explicit division_order first, then by name
  divisions.sort((a, b) => {
    const ao = a.division_order ?? 9999;
    const bo = b.division_order ?? 9999;
    if (ao !== bo) return ao - bo;
    return a.division_name.localeCompare(b.division_name);
  });

  return divisions;
}

export default function BigGameDivisionsClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const supabase = getSupabase();
        const currentYear = new Date().getFullYear();

        const { data, error } = await supabase
          .from("biggame_leagues")
          .select("*")
          .eq("year", currentYear)
          .eq("is_active", true)
          .order("division_name", { ascending: true })
          .order("display_order", { ascending: true });

        if (error) throw error;
        if (!cancelled) {
          setRows(data || []);
        }
      } catch (err) {
        console.error("Failed to load biggame_leagues:", err);
        if (!cancelled) {
          setErrorMsg(
            "Unable to load Big Game divisions right now. Please refresh or try again later."
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

  const divisions = useMemo(() => transformDivisions(rows), [rows]);

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Divisions</h2>
        <p className="text-sm text-muted">Loading divisions…</p>
      </section>
    );
  }

  if (errorMsg) {
    return (
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Divisions</h2>
        <p className="text-sm text-danger">{errorMsg}</p>
      </section>
    );
  }

  if (divisions.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Divisions</h2>
        <p className="text-sm text-muted">
          No divisions are configured yet. Add them from{" "}
          <span className="font-semibold">/admin/biggame</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Divisions</h2>
          <p className="text-sm text-muted">
            Each division has its own theme, artwork, and 8-league panel.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {divisions.map((division, index) => {
          const dLabel =
            division.division_order != null
              ? division.division_order
              : index + 1;

          const { FULL, FILLING, DRAFTING, TBD } = division.statusCounts;
          const isFull = division.isFullyFull;

          return (
            <div
              key={division.division_name}
              className="group rounded-2xl border border-subtle bg-card-surface overflow-hidden flex flex-col shadow-[0_0_25px_rgba(15,23,42,0.8)] hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] transition-all"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src={division.image_url}
                  alt={division.division_name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                {/* Division index chip (D1, D2, etc.) */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/70 border border-white/10 text-white">
                    D{dLabel}
                  </span>
                </div>

                 {/* Diagonal FULL ribbon when all 8 leagues are full */}
                {isFull && (
                  <div className="absolute -right-10 top-4 w-32 bg-emerald-500 text-white backdrop-blur text-[10px] font-bold uppercase text-center py-1 shadow-lg transform rotate-45">
                    Full
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">
                    Big Game Division
                  </p>
                  <h3 className="text-sm font-semibold text-fg">
                    {division.division_name}
                  </h3>
                  <p className="text-muted text-[11px]">
                    {division.league_count || 0}/8 leagues configured.
                  </p>
                </div>

                {/* Status area */}
                {isFull ? (
                  // FULL division: just a single FULL badge
                  <div className="space-y-1">
                    <span className={statusPillClass("FULL")}>
                      Full division · {division.league_count}/8
                    </span>
                  </div>
                ) : (
                  // Not full: show breakdown + open spots
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {FILLING > 0 && (
                        <span className={statusPillClass("FILLING")}>
                          Filling: {FILLING}
                        </span>
                      )}
                      {DRAFTING > 0 && (
                        <span className={statusPillClass("DRAFTING")}>
                          Drafting: {DRAFTING}
                        </span>
                      )}
                      {TBD > 0 && (
                        <span className={statusPillClass("TBD")}>
                          TBD: {TBD}
                        </span>
                      )}
                      {FULL > 0 && (
                        <span className={statusPillClass("FULL")}>
                          Full: {FULL}
                        </span>
                      )}
                    </div>
                    {division.openSpots > 0 && (
                      <p className="text-[11px] text-muted">
                        Open spots across this division:{" "}
                        <span className="font-semibold text-accent">
                          {division.openSpots}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-auto flex justify-between items-center gap-3">
                  <Link
                    href={`/big-game/division?year=${
                      division.year
                    }&division=${encodeURIComponent(division.division_name)}`}
                    className="btn btn-ghost text-xs sm:text-sm"
                  >
                    View Division
                  </Link>

                  <span className="text-[11px] text-muted">
                    Bestball · BIG Game
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
