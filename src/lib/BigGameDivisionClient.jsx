// app/big-game/division/BigGameDivisionClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";

// Same pill styling as the main Big Game grid
function statusPillClass(kind) {
  if (kind === "FULL") return "badge-status badge-status-full";
  if (kind === "FILLING") return "badge-status badge-status-filling";
  if (kind === "DRAFTING") return "badge-status badge-status-drafting";
  if (kind === "TBD") return "badge-status badge-status-tbd";
  return "badge-status badge-status-default";
}

export default function BigGameDivisionClient() {
  const searchParams = useSearchParams();
  const yearFromQuery = Number(searchParams.get("year"));
  const year = yearFromQuery || new Date().getFullYear();
  const division = searchParams.get("division") || "";

  const [header, setHeader] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [allDivisions, setAllDivisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      const supabase = getSupabase();
      if (!supabase) return;

      // All divisions for nav pills
      const { data: all, error: allErr } = await supabase
        .from("biggame_leagues")
        .select("division_name")
        .eq("year", year)
        .eq("is_active", true);

      if (!allErr && all) {
        const uniq = Array.from(
          new Set(all.map((row) => row.division_name).filter(Boolean))
        ).sort();
        setAllDivisions(uniq);
      }

      // Header + leagues for this division
      const { data, error } = await supabase
        .from("biggame_leagues")
        .select("*")
        .eq("year", year)
        .eq("division_name", division)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!error) {
        const allRows = data || [];
        const headerRow =
          allRows.find((r) => r.is_division_header) || allRows[0] || null;
        const leagueRows = allRows.filter((r) => !r.is_division_header);

        setHeader(headerRow);
        setLeagues(leagueRows);
      }

      setLoading(false);
    }

    if (division) run();
  }, [year, division]);

  if (!division) {
    return (
      <div className="container-site max-w-4xl py-12">
        <p className="text-muted">
          No division selected. Go back to{" "}
          <Link href="/big-game" className="text-accent underline">
            The BIG Game
          </Link>
          .
        </p>
      </div>
    );
  }

  const divisionTitle = header?.division_name || division;
  const divisionImagePath = header?.division_image_path || null;
  const divisionOrder =
    header?.division_order != null ? Number(header.division_order) : null;
  const dLabel = divisionOrder != null ? `D${divisionOrder}` : null;

  // Aggregate league status + open spots
  const {
    leagueCount,
    statusCounts,
    openSpots,
    isFullDivision,
  } = useMemo(() => {
    const leagueCountLocal = leagues.length;

    const counts = {
      FULL: 0,
      FILLING: 0,
      DRAFTING: 0,
      TBD: 0,
      OTHER: 0,
    };

    let open = 0;

    for (const lg of leagues) {
      const s = (lg.league_status || "TBD").toUpperCase();
      if (s === "FULL") counts.FULL += 1;
      else if (s === "FILLING") counts.FILLING += 1;
      else if (s === "DRAFTING") counts.DRAFTING += 1;
      else if (s === "TBD") counts.TBD += 1;
      else counts.OTHER += 1;

      if (s === "FILLING" && lg.spots_available != null) {
        const n = Number(lg.spots_available);
        if (!Number.isNaN(n)) open += n;
      }
    }

    const isFull = leagueCountLocal > 0 && counts.FULL === leagueCountLocal;

    return {
      leagueCount: leagueCountLocal,
      statusCounts: counts,
      openSpots: open,
      isFullDivision: isFull,
    };
  }, [leagues]);

  const { FULL, FILLING, DRAFTING, TBD } = statusCounts;

  // Header title: include D# and - FULL when all leagues full
  const headerTitle = dLabel
    ? `${dLabel} - ${divisionTitle}${isFullDivision ? " - FULL" : ""}`
    : `${divisionTitle}${isFullDivision ? " - FULL" : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header (division-level, not ribboned) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">
            Big Game · {year}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold">
            {headerTitle}
          </h1>
          <p className="text-sm text-muted">
            8 Bestball leagues. Click a card to open the league link.
          </p>

          {/* Status breakdown for this division */}
          {leagueCount > 0 && (
            <div className="mt-2 space-y-1 text-xs text-muted">
              {isFullDivision ? (
                <p>
                  Status:{" "}
                  <span className="font-semibold text-emerald-400">
                    Full division · {leagueCount}/8
                  </span>
                </p>
              ) : (
                <>
                  <p>
                    Status:{" "}
                    <span className="font-semibold">
                      Drafting: {DRAFTING} · Filling: {FILLING} · Full: {FULL} ·
                      TBD: {TBD}
                    </span>
                  </p>
                  {openSpots > 0 && (
                    <p>
                      Open spots in this division:{" "}
                        <span className="font-semibold text-accent">
                        {openSpots}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <Link href="/big-game" className="btn btn-outline text-sm">
          ← Back to BIG Game
        </Link>
      </div>

      {/* Other divisions nav */}
      {allDivisions.length > 1 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {allDivisions.map((d) => (
            <Link
              key={d}
              href={`/big-game/division?year=${year}&division=${encodeURIComponent(
                d
              )}`}
              className={`rounded-full px-3 py-1 border ${
                d === division
                  ? "border-accent bg-card-surface text-accent"
                  : "border-subtle bg-panel text-muted hover:border-accent"
              }`}
            >
              {d}
            </Link>
          ))}
        </div>
      )}

      {/* Leagues grid */}
      {loading ? (
        <p className="text-sm text-muted">Loading leagues…</p>
      ) : leagueCount === 0 ? (
        <p className="text-sm text-muted">
          No leagues found for this division/year.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {leagues.map((lg) => {
            const imgSrc =
              lg.league_image_path ||
              divisionImagePath ||
              "/photos/biggame/default-league.jpg";

            const leagueStatus = (lg.league_status || "TBD").toUpperCase();
            const isFilling = leagueStatus === "FILLING";
            const isFullLeague = leagueStatus === "FULL";

            const spots =
              lg.spots_available != null &&
              !Number.isNaN(Number(lg.spots_available))
                ? Number(lg.spots_available)
                : null;

            const disabled = isFullLeague;

            const href = disabled || !lg.league_url ? "#" : lg.league_url;

            return (
              <a
                key={lg.id}
                href={href}
                target={disabled ? undefined : "_blank"}
                rel={disabled ? undefined : "noreferrer"}
                aria-disabled={disabled}
                onClick={(e) => {
                  if (disabled) e.preventDefault();
                }}
                className={`group rounded-2xl border border-subtle bg-card-surface overflow-hidden flex flex-col transition
                  ${
                    disabled
                      ? "opacity-60 pointer-events-none"
                      : "hover:border-accent hover:-translate-y-0.5"
                  }`}
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={imgSrc}
                    alt={lg.league_name}
                    className={`w-full h-full object-cover transition-transform duration-500
                      ${
                        disabled
                          ? "grayscale"
                          : "group-hover:scale-105"
                      }`}
                  />

                  {/* Status pill over the image */}
                  <div className="absolute top-2 left-2">
                    <span className={statusPillClass(leagueStatus)}>
                      {leagueStatus === "FULL" && "Full"}
                      {leagueStatus === "FILLING" && "Filling"}
                      {leagueStatus === "DRAFTING" && "Drafting"}
                      {leagueStatus === "TBD" && "TBD"}
                    </span>
                  </div>

                  {/* FULL ribbon for this league when full */}
                  {isFullLeague && (
                    <div className="absolute -right-10 top-2 w-24 bg-emerald-500 text-[9px] font-bold uppercase text-center py-1 shadow-lg transform rotate-45">
                      Full
                    </div>
                  )}

                  {/* Tiny “spots left” chip when filling */}
                  {isFilling && spots != null && spots > 0 && (
                    <div className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/70 text-white font-medium">
                      {spots} spot{spots === 1 ? "" : "s"} left
                    </div>
                  )}
                </div>

                <div className="p-3 text-xs space-y-1">
                  <p className="font-semibold text-sm">
                    {lg.league_name || "Unnamed league"}
                  </p>
                  <p className="text-muted">
                    Division {divisionTitle} · #{lg.display_order ?? "?"}
                  </p>
                  <p className="text-[11px] text-muted">
                    Status:{" "}
                    <span className="font-medium">
                      {leagueStatus === "FULL" && "Full"}
                      {leagueStatus === "FILLING" && "Filling"}
                      {leagueStatus === "DRAFTING" && "Drafting"}
                      {leagueStatus === "TBD" && "TBD"}
                    </span>
                    {isFilling && spots != null && spots > 0 && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-medium text-accent">
                          {spots} open
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
