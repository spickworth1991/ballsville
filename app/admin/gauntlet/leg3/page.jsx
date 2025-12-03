// src/app/admin/gauntlet/leg3/page.jsx
"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const divisions = payload?.divisions || {};
  const grand = payload?.grandChampionship || null;

  const grandParticipants = grand?.participants || [];
  const grandStandings = grand?.standings || [];

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
              Gauntlet Leg 3 – Bracket View
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Romans, Greeks, and Egyptians &mdash; seeded from Weeks 13–17
              Best Ball.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Last updated:{" "}
              <span className="font-mono">{formatDateTime(updatedAt)}</span>
            </p>
          </div>

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
            <GauntletUpdateButton />
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
            {/* Overall summary */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
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
                Data is precomputed from Sleeper and stored in Supabase.
                This view is read-only; use the script / GitHub Action to
                regenerate scores.
              </p>
            </section>

            {/* Legions grid */}
            <section className="grid gap-6 md:grid-cols-3">
              {Object.entries(divisions).map(([divisionName, division]) => (
                <div
                  key={divisionName}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-md flex flex-col"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{divisionName}</h3>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                      {division.gods?.length || 0} Gods
                    </span>
                  </div>

                  <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1">
                    {(division.gods || []).map((god) => {
                      const rounds = god.bracketRounds || [];

                      return (
                        <div
                          key={god.index}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-100">
                              God {god.index}
                            </div>
                            <div className="flex flex-col text-[0.7rem] text-slate-400 text-right">
                              <span className="truncate max-w-[180px]">
                                Light:{" "}
                                <span className="text-slate-200">
                                  {god.lightLeagueName}
                                </span>
                              </span>
                              <span className="truncate max-w-[180px]">
                                Dark:{" "}
                                <span className="text-slate-200">
                                  {god.darkLeagueName}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Champion tag if resolved */}
                          {god.champion && (
                            <div className="mt-2 text-[0.7rem] text-emerald-300">
                              🏆 Champion:&nbsp;
                              <span className="font-semibold">
                                {god.champion.ownerName}
                              </span>{" "}
                              <span className="text-slate-400">
                                ({god.champion.leagueName})
                              </span>
                            </div>
                          )}

                          {/* Bracket view */}
                          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-2">
                            {rounds.length === 0 ? (
                              // Fallback: old single-round table using pairings
                              <div>
                                <div className="grid grid-cols-5 bg-slate-900/80 px-2 py-1 text-[0.65rem] font-medium text-slate-300">
                                  <span className="text-center">Match</span>
                                  <span className="text-center">
                                    Light (Seed)
                                  </span>
                                  <span className="text-center">Score</span>
                                  <span className="text-center">
                                    Dark (Seed)
                                  </span>
                                  <span className="text-center">Score</span>
                                </div>
                                <div className="divide-y divide-slate-800 text-[0.7rem]">
                                  {(god.pairings || []).map((m) => (
                                    <div
                                      key={m.match}
                                      className="grid grid-cols-5 px-2 py-1.5 items-center"
                                    >
                                      <div className="text-center font-mono text-slate-300">
                                        {m.match}
                                      </div>
                                      <div className="text-center">
                                        <div className="truncate text-slate-100">
                                          {m.lightOwnerName}
                                        </div>
                                        <div className="text-[0.6rem] text-amber-300">
                                          Seed {m.lightSeed}
                                        </div>
                                      </div>
                                      <div className="text-center font-mono text-xs text-slate-100">
                                        {m.lightLeg3Total.toFixed(2)}
                                      </div>
                                      <div className="text-center">
                                        <div className="truncate text-slate-100">
                                          {m.darkOwnerName}
                                        </div>
                                        <div className="text-[0.6rem] text-sky-300">
                                          Seed {m.darkSeed}
                                        </div>
                                      </div>
                                      <div className="text-center font-mono text-xs text-slate-100">
                                        {m.darkLeg3Total.toFixed(2)}
                                      </div>
                                    </div>
                                  ))}

                                  {(!god.pairings ||
                                    god.pairings.length === 0) && (
                                    <div className="px-2 py-2 text-center text-xs text-slate-500">
                                      No pairings available yet.
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-4 min-w-full">
                                {rounds
                                  .slice()
                                  .sort(
                                    (a, b) => a.roundNumber - b.roundNumber
                                  )
                                  .map((round) => (
                                    <div
                                      key={round.roundNumber}
                                      className="flex-1 min-w-[170px]"
                                    >
                                      <div className="mb-2 text-center text-[0.7rem] font-semibold text-slate-300">
                                        Week {round.week} – Round{" "}
                                        {round.roundNumber}
                                      </div>
                                      <div className="space-y-2">
                                        {round.matches.map((match) => {
                                          const a = match.teamA;
                                          const b = match.teamB;
                                          const winnerId =
                                            match.winnerRosterId;
                                          const aWin =
                                            winnerId &&
                                            winnerId === a.rosterId;
                                          const bWin =
                                            winnerId &&
                                            winnerId === b.rosterId;

                                          return (
                                            <div
                                              key={match.match}
                                              className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1.5 text-[0.7rem]"
                                            >
                                              <div className="mb-1 text-[0.65rem] text-slate-500 flex justify-between">
                                                <span>
                                                  Match {match.match}
                                                </span>
                                              </div>

                                              {/* Team A */}
                                              <div
                                                className={`flex items-center justify-between rounded px-1 py-0.5 ${
                                                  aWin
                                                    ? "bg-emerald-900/50 text-emerald-100"
                                                    : "text-slate-100"
                                                }`}
                                              >
                                                <div className="flex-1 min-w-0">
                                                  <div className="truncate">
                                                    {a.ownerName}
                                                  </div>
                                                  <div className="text-[0.6rem] text-slate-400">
                                                    Seed {a.seed}
                                                  </div>
                                                </div>
                                                <div className="ml-2 font-mono text-[0.7rem]">
                                                  {a.score.toFixed(2)}
                                                </div>
                                              </div>

                                              {/* Team B */}
                                              <div
                                                className={`mt-1 flex items-center justify-between rounded px-1 py-0.5 ${
                                                  bWin
                                                    ? "bg-emerald-900/50 text-emerald-100"
                                                    : "text-slate-100"
                                                }`}
                                              >
                                                <div className="flex-1 min-w-0">
                                                  <div className="truncate">
                                                    {b.ownerName}
                                                  </div>
                                                  <div className="text-[0.6rem] text-slate-400">
                                                    Seed {b.seed}
                                                  </div>
                                                </div>
                                                <div className="ml-2 font-mono text-[0.7rem]">
                                                  {b.score.toFixed(2)}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {round.matches.length === 0 && (
                                          <div className="rounded-md border border-dashed border-slate-700 bg-slate-950/40 px-2 py-2 text-center text-[0.7rem] text-slate-500">
                                            No games for this round yet.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {(!division.gods || division.gods.length === 0) && (
                      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-3 text-center text-xs text-slate-400">
                        No Gods built for this Legion yet.
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
