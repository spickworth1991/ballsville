// src/app/admin/gauntlet/leg3/page.jsx
"use client";

import { useEffect, useState, useRef } from "react";
import { getSupabase } from "@/src/lib/supabaseClient";
import GauntletUpdateButton from "@/components/GauntletUpdateButton";

function formatDateTime(dt) {
  if (!dt) return "Never";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

export default function GauntletLeg3Page() {
  const [payload, setPayload] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("matchups"); // "matchups" | "bracket"
  const [roundFilter, setRoundFilter] = useState("1"); // "1" | "2" | "3" | "4"

  async function loadData() {
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("gauntlet_leg3")
        .select("year, payload, updated_at")
        .eq("year", "2025")
        .maybeSingle();

      if (error) {
        console.error(error);
        setError("Failed to load Gauntlet data.");
      } else if (!data) {
        setPayload(null);
        setUpdatedAt(null);
      } else {
        setPayload(data.payload);
        setUpdatedAt(data.updated_at);
      }
    } catch (err) {
      console.error(err);
      setError("Unexpected error loading data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  // Initial load on mount
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔄 30-second polling: check updated_at, reload only when it changes
  useEffect(() => {
    if (!payload) return; // don't bother polling until we have something

    const supabase = getSupabase();
    let cancelled = false;

    async function checkForUpdate() {
      try {
        // Skip if tab isn't visible to avoid useless calls when user is away
        if (typeof document !== "undefined" && document.hidden) return;

        const { data, error } = await supabase
          .from("gauntlet_leg3")
          .select("updated_at")
          .eq("year", "2025")
          .maybeSingle();

        if (error) {
          console.error("Poll error (gauntlet_leg3.updated_at):", error);
          return;
        }

        if (!data?.updated_at) return;

        // If Supabase has a newer timestamp, pull fresh payload
        if (!cancelled && data.updated_at !== updatedAt) {
          await loadData();
        }
      } catch (err) {
        console.error("Poll exception (gauntlet_leg3):", err);
      }
    }

    const intervalId = setInterval(checkForUpdate, 30_000); // every 30 seconds

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, updatedAt]);

  const divisions = payload?.divisions || {};
  const grand = payload?.grandChampionship || null;

  const grandParticipants = Array.isArray(grand?.participants)
    ? grand.participants
    : [];
  const grandStandings = Array.isArray(grand?.standings)
    ? grand.standings
    : [];

  const hasWeek17Scores =
    grandParticipants.length > 0 &&
    grandParticipants.some(
      (p) => typeof p.week17Score === "number" && p.week17Score !== 0
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Gauntlet Leg 3 – Bracket View (Admin)
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Romans, Greeks, and Egyptians &mdash; Leg 3 playoff bracket +
              Week 17 Grand Championship.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Last updated:{" "}
              <span className="font-mono">{formatDateTime(updatedAt)}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-3">
              {error && (
                <span className="text-xs text-red-400 max-w-xs text-right">
                  {error}
                </span>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium shadow-md transition
                ${
                  refreshing || loading
                    ? "bg-slate-700 text-slate-300 cursor-wait"
                    : "bg-amber-400 text-slate-950 hover:bg-amber-300"
                }`}
              >
                {refreshing || loading ? "Refreshing…" : "Refresh"}
              </button>
              <GauntletUpdateButton
                lastUpdatedAt={updatedAt}
                onRefresh={handleRefresh}
              />
            </div>
          </div>
        </header>

        {/* Loading / Empty states */}
        {loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          </div>
        ) : !payload ? (
          <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-300">
            No Gauntlet Leg 3 data found yet.
            <br />
            Run the{" "}
            <span className="font-semibold">buildGauntletLeg3Supabase</span>{" "}
            script (or GitHub Action) to generate it, then click{" "}
            <span className="font-semibold">Refresh</span>.
          </div>
        ) : (
          <main className="space-y-8">
            {/* Overall summary + view toggle */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {payload.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Year:{" "}
                    <span className="font-mono text-amber-300">
                      {payload.year}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Precomputed from Sleeper and stored in Supabase.
                  </p>
                </div>

                {/* View + round toggle */}
                <div className="flex flex-col items-end gap-2">
                  {/* Matchups vs Bracket */}
                  <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 p-1 text-xs shadow-inner">
                    <button
                      type="button"
                      onClick={() => setViewMode("matchups")}
                      className={`px-3 py-1.5 rounded-full transition ${
                        viewMode === "matchups"
                          ? "bg-amber-400 text-slate-950 font-semibold shadow"
                          : "text-slate-300 hover:text-slate-100"
                      }`}
                    >
                      Matchups
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("bracket")}
                      className={`px-3 py-1.5 rounded-full transition ${
                        viewMode === "bracket"
                          ? "bg-amber-400 text-slate-950 font-semibold shadow"
                          : "text-slate-300 hover:text-slate-100"
                      }`}
                    >
                      Bracket
                    </button>
                  </div>

                  {/* Round selector for matchups (R1–R4) */}
                  {viewMode === "matchups" && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="hidden sm:inline">Matchups round:</span>
                      <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 p-1 shadow-inner">
                        {["1", "2", "3", "4"].map((r) => {
                          const week = 12 + Number(r); // 13–16
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setRoundFilter(r)}
                              className={`px-2 py-1 rounded-full transition ${
                                roundFilter === r
                                  ? "bg-emerald-400 text-slate-950 font-semibold shadow"
                                  : "text-slate-300 hover:text-slate-100"
                              }`}
                            >
                              R{r}
                              <span className="ml-1 hidden text-[0.6rem] text-slate-400 sm:inline">
                                (W{week})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Legions – stacked; Gods are collapsible “tabs” */}
            <section className="space-y-6">
              {Object.entries(divisions).map(([divisionName, division]) => {
                const gods = Array.isArray(division?.gods)
                  ? division.gods
                  : [];

                return (
                  <div
                    key={divisionName}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-md"
                  >
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{divisionName}</h3>
                        <p className="text-xs text-slate-400">
                          4 Gods per Legion &mdash; bracket winners feed the
                          Week 17 Grand Championship.
                        </p>
                      </div>
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-4 py-1 text-xs text-slate-300">
                        {gods.length} Gods
                      </span>
                    </div>

                    <div className="space-y-3">
                      {gods.map((god) => (
                        <GodCard
                          key={god.index}
                          god={god}
                          viewMode={viewMode}
                          roundFilter={roundFilter}
                        />
                      ))}

                      {gods.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-3 text-center text-xs text-slate-400">
                          No Gods built for this Legion yet.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Grand Championship – Week 17 */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Grand Championship &mdash; Week 17
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    All God champions (Romans, Greeks, Egyptians) battle in
                    Week 17 Best Ball.
                  </p>
                </div>
                {grand && (
                  <div className="text-xs text-slate-400">
                    Week:{" "}
                    <span className="font-mono text-amber-300">
                      {grand.week}
                    </span>
                    <span className="mx-2 text-slate-600">•</span>
                    Participants:{" "}
                    <span className="font-mono">
                      {grandParticipants.length}
                    </span>
                  </div>
                )}
              </div>

              {!grand || grandParticipants.length === 0 ? (
                <div className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                  Grand Championship standings will appear here once at least
                  one God champion has Week 17 scores.
                </div>
              ) : !hasWeek17Scores ? (
                <div className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                  Week 17 has not posted any scores yet. Once Sleeper shows
                  Week 17 matchups for the God champions and you re-run the
                  Gauntlet build script, standings will update automatically.
                </div>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-[0.7rem] uppercase tracking-wide text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-center">Rank</th>
                        <th className="px-3 py-2">Legion</th>
                        <th className="px-3 py-2">God</th>
                        <th className="px-3 py-2">Owner</th>
                        <th className="px-3 py-2">League</th>
                        <th className="px-3 py-2 text-right">Wk 17 Score</th>
                        <th className="px-3 py-2 text-right">Leg 3 Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-[0.7rem]">
                      {grandStandings.map((p) => (
                        <tr key={`${p.leagueId}-${p.rosterId}`}>
                          <td className="px-3 py-2 text-center font-mono text-amber-300">
                            {p.rank}
                          </td>
                          <td className="px-3 py-2 text-slate-100">
                            {p.division}
                          </td>
                          <td className="px-3 py-2 text-slate-200">
                            God {p.godIndex}
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-slate-100 truncate max-w-[140px]">
                              {p.ownerName}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-slate-300 truncate max-w-[220px]">
                              {p.leagueName}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-100">
                            {p.week17Score.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-100">
                            {p.leg3Total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-3 py-2 text-[0.65rem] text-slate-500">
                    Ties are broken by total Leg 3 score, then by better seed.
                  </p>
                </div>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

/* ================== Child Components ================== */

function GodCard({ god, viewMode, roundFilter }) {
  const [isOpen, setIsOpen] = useState(false);
  const cardRef = useRef(null);

  const pairings = Array.isArray(god?.pairings) ? god.pairings : [];
  const bracketRounds = Array.isArray(god?.bracketRounds)
    ? god.bracketRounds
    : [];
  const champion = god?.champion || null;

  // Close when clicking outside this GodCard
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Champion only once WEEK 16 has real (non-zero) score
  const hasWeek16Score =
    champion &&
    champion.leg3Weekly &&
    typeof champion.leg3Weekly[16] === "number" &&
    champion.leg3Weekly[16] !== 0;

  // Determine which round we want to show in Matchups view
  const desiredIndex = Math.max(
    0,
    (parseInt(roundFilter || "1", 10) || 1) - 1
  );
  const selectedRound =
    bracketRounds[desiredIndex] &&
    Array.isArray(bracketRounds[desiredIndex].results)
      ? bracketRounds[desiredIndex]
      : null;

  let matchupRows = [];

  if (
    viewMode === "matchups" &&
    selectedRound &&
    Array.isArray(selectedRound.results) &&
    selectedRound.results.length
  ) {
    // Use actual results for the selected round
    matchupRows = selectedRound.results.map((m) => {
      const teamA = m.teamA || {};
      const teamB = m.teamB || {};

      const scoreA =
        typeof m.scoreA === "number" ? m.scoreA : Number(m.scoreA || 0);
      const scoreB =
        typeof m.scoreB === "number" ? m.scoreB : Number(m.scoreB || 0);

      const winnerId = m?.winner?.rosterId || null;

      // Decide orientation (Light always on left when it's Light vs Dark)
      const aLight = teamA.side === "light";
      const bLight = teamB.side === "light";
      const aDark = teamA.side === "dark";
      const bDark = teamB.side === "dark";

      const isLightVsDark = (aLight && bDark) || (aDark && bLight);

      let lightTeam;
      let darkTeam;

      if (isLightVsDark) {
        if (aLight && bDark) {
          lightTeam = teamA;
          darkTeam = teamB;
        } else {
          lightTeam = teamB;
          darkTeam = teamA;
        }
      } else {
        lightTeam = teamA;
        darkTeam = teamB;
      }

      let lightScore;
      let darkScore;
      let lightLineup = null;
      let darkLineup = null;

      if (lightTeam === teamA && darkTeam === teamB) {
        lightScore = scoreA;
        darkScore = scoreB;
        lightLineup = m.lineupA || null;
        darkLineup = m.lineupB || null;
      } else if (lightTeam === teamB && darkTeam === teamA) {
        lightScore = scoreB;
        darkScore = scoreA;
        lightLineup = m.lineupB || null;
        darkLineup = m.lineupA || null;
      } else {
        lightScore = scoreA;
        darkScore = scoreB;
        lightLineup = m.lineupA || null;
        darkLineup = m.lineupB || null;
      }

      const lightIsWinner = winnerId && winnerId === lightTeam.rosterId;
      const darkIsWinner = winnerId && winnerId === darkTeam.rosterId;

      const isPlayed =
        typeof lightScore === "number" &&
        typeof darkScore === "number" &&
        (lightScore !== 0 || darkScore !== 0);

      return {
        match: m.matchIndex,
        round: selectedRound.roundNumber,
        week: selectedRound.week,
        lightOwnerName: lightTeam.ownerName,
        darkOwnerName: darkTeam.ownerName,
        lightSeed: lightTeam.seed,
        darkSeed: darkTeam.seed,
        lightScore: Number((lightScore || 0).toFixed(2)),
        darkScore: Number((darkScore || 0).toFixed(2)),
        lightIsWinner,
        darkIsWinner,
        isPlayed,
        // full best-ball lineups for the breakdown view
        lightLineup,
        darkLineup,
      };
    });
  } else if (
    viewMode === "matchups" &&
    (!selectedRound || !selectedRound.results?.length) &&
    (roundFilter === "1" || !roundFilter) &&
    pairings.length > 0
  ) {
    // No rounds played yet → static Round 1 seed preview (Week 13)
    matchupRows = pairings.map((p) => ({
      match: p.match,
      round: p.round,
      week: p.week,
      lightOwnerName: p.lightOwnerName,
      darkOwnerName: p.darkOwnerName,
      lightSeed: p.lightSeed,
      darkSeed: p.darkSeed,
      lightScore: Number((p.lightLeg3Total || 0).toFixed(2)),
      darkScore: Number((p.darkLeg3Total || 0).toFixed(2)),
      lightIsWinner: false,
      darkIsWinner: false,
      isPlayed: false,
    }));
  }

  const hasBracketContent =
    viewMode === "matchups"
      ? matchupRows.length > 0
      : bracketRounds.length > 0;

  return (
    <div
      ref={cardRef}
      className="rounded-xl border border-slate-800 bg-slate-950/60"
    >
      {/* Header row acts like a tab/accordion trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-900/80 transition"
      >
        <div>
          <div className="text-sm font-semibold text-slate-100">
            God {god.index}
          </div>
          <div className="mt-1 text-[0.7rem] text-slate-400">
            <span className="font-semibold text-amber-200">Light</span>:{" "}
            <span className="text-slate-200">{god.lightLeagueName}</span>
            <span className="mx-1 text-slate-600">•</span>
            <span className="font-semibold text-sky-300">Dark</span>:{" "}
            <span className="text-slate-200">{god.darkLeagueName}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {/* Champion pill – gated by real Week 16 data */}
          {hasWeek16Score && (
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-3 py-1 text-[0.7rem] text-emerald-200 border border-emerald-500/40">
              <span>🏆 Champion</span>
              <span className="font-semibold truncate max-w-[160px]">
                {champion.ownerName}
              </span>
            </div>
          )}
          <span className="flex items-center text-[0.7rem] text-slate-300">
            {isOpen ? "Hide bracket" : "Show bracket"}{" "}
            <span className="ml-1 text-xs">{isOpen ? "▴" : "▾"}</span>
          </span>
        </div>
      </button>

      {/* Collapsible content */}
      <div
        className={`overflow-hidden border-t border-slate-800 transition-all duration-300 ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-3">
          {hasBracketContent ? (
            viewMode === "matchups" ? (
              <GodMatchupsTable rows={matchupRows} roundFilter={roundFilter} />
            ) : (
              <GodBracket rounds={bracketRounds} />
            )
          ) : (
            <div className="text-[0.7rem] text-slate-500">
              No bracket data for this God yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GodMatchupsTable({ rows, roundFilter }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const meta = safeRows[0] || null;

  const [expandedMatch, setExpandedMatch] = useState(null);
  const containerRef = useRef(null);

  const expandedRow =
    expandedMatch != null
      ? safeRows.find((r) => r.match === expandedMatch)
      : null;

  // Close expanded matchup when clicking outside the table
  useEffect(() => {
    if (expandedMatch == null) return;

    function handleClickOutside(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) {
        setExpandedMatch(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expandedMatch]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 text-[0.7rem]"
    >
      {/* Round meta bar */}
      <div className="flex items-center justify-between px-2 pt-2 pb-1 text-[0.65rem] text-slate-400">
        <span>
          {meta
            ? `Round ${meta.round} • Week ${meta.week}`
            : `Round ${roundFilter || "?"}`}
        </span>
        {expandedRow && (
          <button
            type="button"
            onClick={() => setExpandedMatch(null)}
            className="text-xs text-amber-300 hover:text-amber-200"
          >
            Close matchup breakdown
          </button>
        )}
      </div>

      {/* Header row */}
      <div className="grid grid-cols-5 bg-slate-900/80 px-2 py-1 text-[0.65rem] font-medium text-slate-300">
        <span className="text-center">Match</span>
        <span className="text-center">Light (Seed)</span>
        <span className="text-center">Light Score</span>
        <span className="text-center">Dark Score</span>
        <span className="text-center">Dark (Seed)</span>
      </div>

      {/* Match rows + inline breakdowns */}
      <div className="divide-y divide-slate-800">
        {safeRows.map((m) => {
          const lightLost = m.isPlayed && !m.lightIsWinner;
          const darkLost = m.isPlayed && !m.darkIsWinner;
          const isExpanded = expandedMatch === m.match;

          return (
            <div
              key={m.match}
              className="border-b border-slate-800 last:border-b-0"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedMatch((prev) => (prev === m.match ? null : m.match))
                }
                className={`grid grid-cols-5 px-2 py-1.5 items-center w-full text-left transition ${
                  isExpanded ? "bg-slate-900/80" : "hover:bg-slate-900/40"
                }`}
              >
                {/* Match # */}
                <div className="text-center font-mono text-slate-300">
                  {m.match}
                </div>

                {/* Light side */}
                <div className="text-center">
                  <div
                    className={`truncate ${
                      m.lightIsWinner
                        ? "text-emerald-300 font-semibold"
                        : lightLost
                        ? "text-red-300 line-through"
                        : "text-slate-100"
                    }`}
                  >
                    {m.lightOwnerName}
                  </div>
                  <div className="text-[0.6rem] text-amber-300">
                    Seed {m.lightSeed}
                  </div>
                  {lightLost && (
                    <div className="text-[0.6rem] text-red-400">
                      ✕ Eliminated
                    </div>
                  )}
                </div>

                {/* Light score */}
                <div className="text-center font-mono text-xs text-slate-100">
                  {m.lightScore.toFixed(2)}
                </div>

                {/* Dark score */}
                <div className="text-center font-mono text-xs text-slate-100">
                  {m.darkScore.toFixed(2)}
                </div>

                {/* Dark side */}
                <div className="text-center">
                  <div
                    className={`truncate ${
                      m.darkIsWinner
                        ? "text-emerald-300 font-semibold"
                        : darkLost
                        ? "text-red-300 line-through"
                        : "text-slate-100"
                    }`}
                  >
                    {m.darkOwnerName}
                  </div>
                  <div className="text-[0.6rem] text-sky-300">
                    Seed {m.darkSeed}
                  </div>
                  {darkLost && (
                    <div className="text-[0.6rem] text-red-400">
                      ✕ Eliminated
                    </div>
                  )}
                </div>
              </button>

              {isExpanded && <MatchupBreakdown row={m} />}
            </div>
          );
        })}

        {safeRows.length === 0 && (
          <div className="px-2 py-2 text-center text-xs text-slate-500">
            No matchups for this round yet.
          </div>
        )}
      </div>
    </div>
  );
}

function InjuryTag({ status, injury_status }) {
  const raw = (injury_status || status || "").toString().toLowerCase();
  if (!raw) return null;

  if (raw.includes("question")) {
    return (
      <span className="ml-1 inline-flex items-center rounded-full border border-yellow-400/60 bg-yellow-400/10 px-1.5 py-0.5 text-[0.6rem] text-yellow-300">
        Ques.
      </span>
    );
  }

  if (raw === "ir" || raw.includes("injured reserve")) {
    return (
      <span className="ml-1 inline-flex items-center rounded-full border border-red-500/70 bg-red-500/10 px-1.5 py-0.5 text-[0.6rem] text-red-300">
        IR
      </span>
    );
  }

  if (raw.includes("out")) {
    return (
      <span className="ml-1 inline-flex items-center rounded-full border border-red-500/70 bg-red-500/10 px-1.5 py-0.5 text-[0.6rem] text-red-300">
        OUT
      </span>
    );
  }

  // Other statuses (PUP, SUS, etc.) could get a neutral tag if you want
  return null;
}

function LineupSide({ title, seed, lineup }) {
  if (!lineup) {
    return (
      <div className="text-xs text-slate-500">
        No lineup data yet for this matchup.
      </div>
    );
  }

  const slotsOrder = ["QB", "RB", "WR", "TE", "FLEX", "SF"];

  const startersBySlot = slotsOrder.map((slot) => ({
    slot,
    players: (lineup.starters || [])
      .filter((p) => p.slot === slot)
      .sort((a, b) => b.points - a.points),
  }));

  const benchSorted = (lineup.bench || [])
    .slice()
    .sort((a, b) => b.points - a.points);

  const total =
    lineup.total ??
    lineup.starters?.reduce((sum, p) => sum + Number(p.points || 0), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold text-slate-100">
          {title}
          {typeof seed === "number" && (
            <span className="ml-2 text-[0.7rem] text-slate-400">
              Seed {seed}
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-emerald-300">
          {Number(total || 0).toFixed(2)} pts
        </div>
      </div>

      {/* Starters */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
        <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
          Starters
        </div>
        <div className="space-y-1">
          {startersBySlot.map(({ slot, players }) =>
            players.length ? (
              <div key={slot}>
                <div className="text-[0.65rem] font-semibold text-slate-300">
                  {slot}
                </div>
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md bg-slate-900/80 px-2 py-1"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-100">
                        {p.name}
                        <InjuryTag
                          status={p.status}
                          injury_status={p.injury_status}
                        />
                      </span>
                      <span className="text-[0.65rem] text-slate-400">
                        {p.team || "FA"} • {p.pos}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-100">
                      {Number(p.points || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Bench */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
        <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
          Bench
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {benchSorted.length === 0 && (
            <div className="text-[0.65rem] text-slate-500">
              No bench players recorded.
            </div>
          )}
          {benchSorted.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1"
            >
              <div className="flex flex-col">
                <span className="text-xs text-slate-200">
                  {p.name}
                  <InjuryTag
                    status={p.status}
                    injury_status={p.injury_status}
                  />
                </span>
                <span className="text-[0.65rem] text-slate-400">
                  {p.team || "FA"} • {p.pos}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {Number(p.points || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchupBreakdown({ row }) {
  const { lightLineup, darkLineup, week } = row || {};

  // If we have absolutely no lineups (early season / seed preview mode)
  if (!lightLineup && !darkLineup) {
    return (
      <div className="border-t border-slate-800 bg-slate-950/80 px-3 py-3 text-xs text-slate-500">
        Lineup breakdown will appear here once Week {week} Best Ball scores are
        available for this matchup.
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950/80 px-3 py-3">
      <div className="mb-2 text-[0.7rem] text-slate-400">
        Matchup breakdown for{" "}
        <span className="font-mono text-amber-300">
          Week {week} • Match {row.match}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <LineupSide
          title={row.lightOwnerName || "Light"}
          seed={row.lightSeed}
          lineup={lightLineup}
        />
        <LineupSide
          title={row.darkOwnerName || "Dark"}
          seed={row.darkSeed}
          lineup={darkLineup}
        />
      </div>
    </div>
  );
}

function GodBracket({ rounds }) {
  const safeRounds = Array.isArray(rounds) ? rounds : [];

  if (!safeRounds.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 px-3 py-2 text-[0.7rem] text-slate-400">
        Bracket rounds will appear here as Leg 3 weeks complete.
      </div>
    );
  }

  // Use Round 1 to define vertical scale
  const firstRound = safeRounds[0];
  const firstRoundMatches = Array.isArray(firstRound.results)
    ? firstRound.results.length
    : 0;

  if (!firstRoundMatches) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 px-3 py-2 text-[0.7rem] text-slate-400">
        Bracket rounds will appear here as Leg 3 weeks complete.
      </div>
    );
  }

  // Finer grid: each "match height" = 4 sub-rows
  const UNITS_PER_MATCH = 4;

  // Row 1 = headers, rows 2..(1 + N*UNITS_PER_MATCH) = match area
  const totalRows = 1 + firstRoundMatches * UNITS_PER_MATCH;

  return (
    <div className="overflow-x-auto text-[0.65rem]">
      <div
        className="inline-grid gap-x-4"
        style={{
          gridTemplateColumns: `repeat(${safeRounds.length}, minmax(160px, 1fr))`,
          gridTemplateRows: `repeat(${totalRows}, minmax(0, auto))`,
        }}
      >
        {safeRounds.map((round, roundIdx) => {
          const results = Array.isArray(round.results) ? round.results : [];
          const col = roundIdx + 1; // 1-based column index
          const r = roundIdx + 1; // 1-based round index
          const blockSize = Math.pow(2, r - 1); // how many R1 matches feed into one match

          return (
            <div key={round.roundNumber} className="contents">
              {/* Round header: always the top row of this column */}
              <div
                className="mb-1 text-center font-semibold text-slate-100"
                style={{ gridColumn: col, gridRow: 1 }}
              >
                R{round.roundNumber}{" "}
                <span className="text-slate-400">(W{round.week})</span>
              </div>

              {/* Matches for this round */}
              {results.map((match, matchIdx) => {
                const m = matchIdx + 1; // 1-based match index in this round

                // Which block of Round-1 matches does this match "own"?
                const startIndex = 1 + (m - 1) * blockSize;
                const endIndex = startIndex + blockSize - 1;
                const centerIndex = (startIndex + endIndex) / 2; // can be .5

                // Center of that block in sub-rows:
                const centerSubRow =
                  2 + (centerIndex - 1) * UNITS_PER_MATCH + UNITS_PER_MATCH / 2;

                // Give each bracket card one "match height"
                const rowSpan = UNITS_PER_MATCH;

                // Start row so that the card is centered around centerSubRow
                const rowStart = Math.round(centerSubRow - rowSpan / 2);

                return (
                  <div
                    key={match.matchIndex}
                    style={{
                      gridColumn: col,
                      gridRow: `${rowStart} / span ${rowSpan}`,
                    }}
                  >
                    <BracketMatchCard match={match} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatchCard({ match }) {
  const winnerId = match?.winner?.rosterId;
  const teamA = match?.teamA || {};
  const teamB = match?.teamB || {};
  const scoreA = typeof match?.scoreA === "number" ? match.scoreA : 0;
  const scoreB = typeof match?.scoreB === "number" ? match.scoreB : 0;

  const teamAIsWinner = winnerId && winnerId === teamA.rosterId;
  const teamBIsWinner = winnerId && winnerId === teamB.rosterId;

  const teamAPlayed = scoreA !== 0 || scoreB !== 0;
  const teamBPlayed = scoreA !== 0 || scoreB !== 0;

  const teamALost = teamAPlayed && !teamAIsWinner && winnerId;
  const teamBLost = teamBPlayed && !teamBIsWinner && winnerId;

  return (
    <div className="relative rounded-md border border-slate-800 bg-slate-950/90 px-1.5 py-1">
      {/* small connector stub to the next-round column */}
      <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-3 translate-y-[-50%] bg-slate-700 md:block" />

      {/* match label */}
      <div className="mb-0.5 flex items-center justify-between text-[0.6rem] text-slate-400">
        <span>Match {match.matchIndex}</span>
      </div>

      {/* internal connector trunk */}
      <div className="absolute left-0 top-3 bottom-3 border-l border-slate-700/60" />

      <div className="space-y-0.5 pl-2.5">
        {/* Team A row */}
        <div
          className={`flex items-center justify-between gap-1 rounded-sm px-1 py-0.5 ${
            teamAIsWinner
              ? "bg-emerald-900/40 text-emerald-200 border border-emerald-500/40"
              : teamALost
              ? "text-red-300 line-through"
              : "text-slate-200"
          }`}
        >
          <span className="truncate max-w-[90px]">
            {teamA.ownerName ?? "?"}
          </span>
          <span className="flex items-center gap-1 text-[0.6rem]">
            <span className="text-slate-400">S{teamA.seed ?? "?"}</span>
            <span className="font-mono">{scoreA.toFixed(1)}</span>
            {teamALost && (
              <span className="text-red-400 text-[0.55rem] ml-0.5">✕</span>
            )}
          </span>
        </div>

        {/* Team B row */}
        <div
          className={`flex items-center justify-between gap-1 rounded-sm px-1 py-0.5 ${
            teamBIsWinner
              ? "bg-emerald-900/40 text-emerald-200 border border-emerald-500/40"
              : teamBLost
              ? "text-red-300 line-through"
              : "text-slate-200"
          }`}
        >
          <span className="truncate max-w-[90px]">
            {teamB.ownerName ?? "?"}
          </span>
          <span className="flex items-center gap-1 text-[0.6rem]">
            <span className="text-slate-400">S{teamB.seed ?? "?"}</span>
            <span className="font-mono">{scoreB.toFixed(1)}</span>
            {teamBLost && (
              <span className="text-red-400 text-[0.55rem] ml-0.5">✕</span>
            )}
          </span>
        </div>
      </div>

      {(teamAIsWinner || teamBIsWinner) && (
        <div className="mt-0.5 pl-2.5 text-[0.55rem] text-emerald-300">
          Advances →
        </div>
      )}
    </div>
  );
}
