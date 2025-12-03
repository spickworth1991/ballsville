// src/app/gauntlet/leg3/page.jsx
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/src/lib/supabaseClient";

function formatDateTime(dt) {
  if (!dt) return "Never";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

export default function PublicGauntletLeg3Page() {
  const [payload, setPayload] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("matchups"); // "matchups" | "bracket"

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

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Gauntlet Leg 3 – Bracket View
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

          {error && (
            <div className="text-xs text-red-400 max-w-xs text-right">
              {error}
            </div>
          )}
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
            Please check back later once the Leg 3 bracket has been generated.
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
                    Data is precomputed from Sleeper and stored in Supabase.
                  </p>
                </div>

                {/* View toggle */}
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
              </div>
            </section>

            {/* Legions – stacked vertically */}
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
                        <h3 className="text-xl font-semibold">
                          {divisionName}
                        </h3>
                        <p className="text-xs text-slate-400">
                          4 Gods per Legion &mdash; brackets seeded from Leg 3
                          survivors.
                        </p>
                      </div>
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-4 py-1 text-xs text-slate-300">
                        {gods.length} Gods
                      </span>
                    </div>

                    <div className="space-y-4 overflow-y-auto max-h-[620px] pr-1">
                      {gods.map((god) => (
                        <GodCard
                          key={god.index}
                          god={god}
                          viewMode={viewMode}
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
                  Week 17 matchups for the God champions and the bracket is
                  rebuilt, standings will update automatically.
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

function GodCard({ god, viewMode }) {
  const pairings = Array.isArray(god?.pairings) ? god.pairings : [];
  const bracketRounds = Array.isArray(god?.bracketRounds)
    ? god.bracketRounds
    : [];
  const champion = god?.champion || null;

  // Only show champion once WEEK 16 actually has a non-zero score
  const hasWeek16Score =
    champion &&
    champion.leg3Weekly &&
    typeof champion.leg3Weekly[16] === "number" &&
    champion.leg3Weekly[16] !== 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-100">
            God {god.index}
          </div>
          <div className="mt-1 text-[0.7rem] text-slate-400">
            Light:{" "}
            <span className="text-slate-200">{god.lightLeagueName}</span>
            <span className="mx-1 text-slate-600">•</span>
            Dark:{" "}
            <span className="text-slate-200">{god.darkLeagueName}</span>
          </div>
        </div>

        {hasWeek16Score && (
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-3 py-1 text-[0.7rem] text-emerald-200 border border-emerald-500/40">
            <span>🏆 Champion</span>
            <span className="font-semibold truncate max-w-[160px]">
              {champion.ownerName}
            </span>
          </div>
        )}
      </div>

      {viewMode === "matchups" ? (
        <GodMatchupsTable pairings={pairings} />
      ) : (
        <GodBracket rounds={bracketRounds} />
      )}
    </div>
  );
}

function GodMatchupsTable({ pairings }) {
  const rows = Array.isArray(pairings) ? pairings : [];

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
      <div className="grid grid-cols-5 bg-slate-900/80 px-2 py-1 text-[0.65rem] font-medium text-slate-300">
        <span className="text-center">Match</span>
        <span className="text-center">Light (Seed)</span>
        <span className="text-center">Light Score</span>
        <span className="text-center">Dark Score</span>
        <span className="text-center">Dark (Seed)</span>
      </div>
      <div className="divide-y divide-slate-800 text-[0.7rem]">
        {rows.map((m) => (
          <div
            key={m.match}
            className="grid grid-cols-5 px-2 py-1.5 items-center"
          >
            <div className="text-center font-mono text-slate-300">
              {m.match}
            </div>

            <div className="text-center">
              <div className="truncate text-slate-100">{m.lightOwnerName}</div>
              <div className="text-[0.6rem] text-amber-300">
                Seed {m.lightSeed}
              </div>
            </div>

            <div className="text-center font-mono text-xs text-slate-100">
              {m.lightLeg3Total.toFixed(2)}
            </div>

            <div className="text-center font-mono text-xs text-slate-100">
              {m.darkLeg3Total.toFixed(2)}
            </div>

            <div className="text-center">
              <div className="truncate text-slate-100">{m.darkOwnerName}</div>
              <div className="text-[0.6rem] text-sky-300">
                Seed {m.darkSeed}
              </div>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="px-2 py-2 text-center text-xs text-slate-500">
            No pairings available yet.
          </div>
        )}
      </div>
    </div>
  );
}

function GodBracket({ rounds }) {
  const safeRounds = Array.isArray(rounds) ? rounds : [];

  if (!safeRounds.length) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-950/50 px-3 py-2 text-[0.7rem] text-slate-400">
        Bracket rounds will appear here as Leg 3 weeks complete.
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <div className="flex gap-6 min-h-[180px] pb-2">
        {safeRounds.map((round, roundIdx) => {
          const results = Array.isArray(round.results) ? round.results : [];
          const isLastRound = roundIdx === safeRounds.length - 1;

          return (
            <div
              key={round.roundNumber}
              className="relative min-w-[220px] rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-[0.7rem]"
            >
              {!isLastRound && (
                <div className="pointer-events-none absolute -right-3 top-4 bottom-4 hidden md:block">
                  <div className="h-full border-r border-dashed border-slate-700 opacity-70" />
                </div>
              )}

              <div className="mb-2 text-center text-[0.7rem] font-semibold text-slate-100">
                Round {round.roundNumber}{" "}
                <span className="text-slate-400">(Week {round.week})</span>
              </div>

              {results.length === 0 ? (
                <div className="text-center text-xs text-slate-500">
                  TBD – waiting on scores.
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((match) => (
                    <BracketMatchCard key={match.matchIndex} match={match} />
                  ))}
                </div>
              )}
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

  return (
    <div className="relative rounded-md border border-slate-800 bg-slate-950/90 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between text-[0.65rem] text-slate-400">
        <span>Match {match.matchIndex}</span>
      </div>

      <div className="absolute left-0 top-3 bottom-3 border-l border-slate-700/60" />

      <div className="space-y-0.5 pl-3">
        <div
          className={`flex items-center justify-between gap-2 rounded-sm px-1 py-0.5 ${
            teamAIsWinner
              ? "bg-emerald-900/40 text-emerald-200 border border-emerald-500/40"
              : "text-slate-200"
          }`}
        >
          <span className="truncate max-w-[110px]">
            {teamA.ownerName ?? "?"}
          </span>
          <span className="flex items-center gap-1 text-[0.65rem]">
            <span className="text-slate-400">
              Seed {teamA.seed ?? "?"}
            </span>
            <span className="font-mono">
              {scoreA.toFixed(2)}
            </span>
          </span>
        </div>

        <div
          className={`flex items-center justify-between gap-2 rounded-sm px-1 py-0.5 ${
            teamBIsWinner
              ? "bg-emerald-900/40 text-emerald-200 border border-emerald-500/40"
              : "text-slate-200"
          }`}
        >
          <span className="truncate max-w-[110px]">
            {teamB.ownerName ?? "?"}
          </span>
          <span className="flex items-center gap-1 text-[0.65rem]">
            <span className="text-slate-400">
              Seed {teamB.seed ?? "?"}
            </span>
            <span className="font-mono">
              {scoreB.toFixed(2)}
            </span>
          </span>
        </div>
      </div>

      {(teamAIsWinner || teamBIsWinner) && (
        <div className="mt-1 pl-3 text-[0.6rem] text-emerald-300">
          Advances →
        </div>
      )}
    </div>
  );
}
