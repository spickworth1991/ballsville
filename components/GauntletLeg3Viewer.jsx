"use client";

import { useState, useMemo } from "react";

function safeDivisions(payload) {
  if (!payload || !payload.divisions) return [];
  return Object.values(payload.divisions).filter(Boolean);
}

function classNames(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function GauntletLeg3Viewer({ payload }) {
  const [viewMode, setViewMode] = useState("matchups"); // "matchups" | "bracket"

  const divisions = useMemo(() => safeDivisions(payload), [payload]);
  const status = payload?.status ?? {};
  const missing = payload?.missingSeedLeagues ?? [];

  if (!payload) {
    return (
      <div className="mt-4 text-sm text-red-500">
        No Leg 3 data found for this year.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Summary row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm">
        <div className="space-y-1">
          <div className="font-semibold text-slate-100">
            Leg 3 Status
          </div>
          <div className="text-slate-300">
            Built at:{" "}
            <span className="font-mono">
              {status.builtAt
                ? new Date(status.builtAt).toLocaleString()
                : "Unknown"}
            </span>
          </div>
          <div className="text-slate-300">
            Divisions:{" "}
            <span className="font-semibold">
              {status.totalDivisions ?? divisions.length}
            </span>{" "}
            · Fully-seeded leagues:{" "}
            <span className="font-semibold">
              {status.fullySeededLeagues ?? 0}
            </span>{" "}
            · Partial:{" "}
            <span className="font-semibold">
              {status.partialLeagues ?? 0}
            </span>{" "}
            · Missing seeds in leagues:{" "}
            <span className="font-semibold">
              {status.missingSeedLeagues ?? missing.length}
            </span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="inline-flex overflow-hidden rounded-full border border-slate-600 bg-slate-800 text-xs font-medium text-slate-100">
          <button
            type="button"
            onClick={() => setViewMode("matchups")}
            className={classNames(
              "px-3 py-1.5 transition",
              viewMode === "matchups"
                ? "bg-amber-500 text-slate-900"
                : "hover:bg-slate-700"
            )}
          >
            Matchups
          </button>
          <button
            type="button"
            onClick={() => setViewMode("bracket")}
            className={classNames(
              "px-3 py-1.5 transition",
              viewMode === "bracket"
                ? "bg-amber-500 text-slate-900"
                : "hover:bg-slate-700"
            )}
          >
            Bracket
          </button>
        </div>
      </div>

      {/* Optional missing seeds list */}
      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-600/60 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          <div className="mb-1 font-semibold tracking-wide">
            Leagues still missing seeds
          </div>
          <ul className="space-y-1">
            {missing.map((row) => (
              <li key={row.leagueId}>
                <span className="font-semibold">{row.leagueName}</span>{" "}
                <span className="text-amber-200">
                  ({row.division} · {row.godName}) – needs seeds:{" "}
                  {Array.isArray(row.neededSeeds)
                    ? row.neededSeeds.join(", ")
                    : String(row.neededSeeds ?? "")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main content */}
      <div className="space-y-8">
        {divisions.map((division) => (
          <DivisionBlock
            key={division.division}
            division={division}
            viewMode={viewMode}
          />
        ))}
      </div>

      {/* Grand Championship */}
      {payload.grandChampionship && (
        <GrandChampionshipBlock gc={payload.grandChampionship} />
      )}
    </div>
  );
}

function DivisionBlock({ division, viewMode }) {
  const gods = division?.gods ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold uppercase tracking-widest text-slate-100">
          {division.division} Division
        </h2>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          {gods.length} Gods
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {gods.map((god) => (
          <GodCard key={god.godName} god={god} viewMode={viewMode} />
        ))}
      </div>
    </section>
  );
}

function GodCard({ god, viewMode }) {
  const champion = god.champion;

  return (
    <div className="flex flex-col rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
            God
          </div>
          <div className="text-lg font-semibold text-slate-50">
            {god.godName}
          </div>
        </div>
        {champion && (
          <div className="text-right text-xs text-emerald-300">
            <div className="uppercase tracking-[0.2em] text-emerald-400">
              Champion
            </div>
            <div className="font-semibold">
              {champion.ownerName || champion.championOwnerName || "TBD"}
            </div>
            {champion.championPoints != null && (
              <div className="font-mono text-emerald-200">
                {champion.championPoints.toFixed
                  ? champion.championPoints.toFixed(2)
                  : champion.championPoints}
                {" pts"}
              </div>
            )}
          </div>
        )}
      </div>

      {viewMode === "matchups" ? (
        <GodMatchups god={god} />
      ) : (
        <GodBracket god={god} />
      )}
    </div>
  );
}

function GodMatchups({ god }) {
  const pairings = god.pairings || god.staticPairs || [];

  if (!pairings.length) {
    return (
      <div className="text-xs text-slate-400">
        No static matchups available yet.
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      {pairings.map((pair, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-slate-700/80 bg-slate-800/70 px-3 py-2"
        >
          <div className="mb-1 flex justify-between text-slate-300">
            <span className="font-semibold">
              {pair.label || `Match ${idx + 1}`}
            </span>
            {pair.side && (
              <span className="uppercase tracking-[0.2em] text-slate-400">
                {pair.side}
              </span>
            )}
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between">
              <span>
                #{pair.seedA ?? pair.seed1} {pair.ownerA ?? pair.owner1}
              </span>
              <span className="text-slate-400">
                {pair.leagueA ?? pair.league1}
              </span>
            </div>
            <div className="flex justify-between">
              <span>
                #{pair.seedB ?? pair.seed2} {pair.ownerB ?? pair.owner2}
              </span>
              <span className="text-slate-400">
                {pair.leagueB ?? pair.league2}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GodBracket({ god }) {
  const rounds = god.bracketRounds || [];

  if (!rounds.length) {
    return (
      <div className="text-xs text-slate-400">
        Bracket not ready yet (waiting on scores or seeds).
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-xs md:flex-row">
      {rounds.map((round) => (
        <div
          key={round.roundNumber ?? round.name}
          className="flex-1 rounded-lg border border-slate-700/80 bg-slate-800/60 p-2"
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
            {round.name || `Round ${round.roundNumber}`}
            {round.week && (
              <span className="ml-1 text-slate-400">(Wk {round.week})</span>
            )}
          </div>
          <div className="space-y-1.5">
            {(round.results || round.matches || []).map((match, idx) => {
              const tA = match.teamA || {};
              const tB = match.teamB || {};
              const winner = match.winner;
              const loser = match.loser;

              const scoreA =
                match.scoreA ?? tA.scores?.[round.week] ?? null;
              const scoreB =
                match.scoreB ?? tB.scores?.[round.week] ?? null;

              const isWinnerA =
                winner && winner.ownerId && winner.ownerId === tA.ownerId;
              const isWinnerB =
                winner && winner.ownerId && winner.ownerId === tB.ownerId;

              return (
                <div
                  key={match.matchIndex ?? idx}
                  className="rounded-md border border-slate-700/80 bg-slate-900/70 px-2 py-1.5"
                >
                  <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                    <span>Match {match.matchIndex ?? idx + 1}</span>
                  </div>
                  <div className="space-y-0.5 font-mono">
                    <MatchLine
                      team={tA}
                      score={scoreA}
                      winner={isWinnerA}
                    />
                    <MatchLine
                      team={tB}
                      score={scoreB}
                      winner={isWinnerB}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchLine({ team, score, winner }) {
  if (!team || !team.ownerName) {
    return (
      <div className="flex justify-between text-slate-500">
        <span>—</span>
      </div>
    );
  }

  return (
    <div
      className={classNames(
        "flex items-center justify-between rounded px-1 py-0.5",
        winner ? "bg-emerald-500/15 text-emerald-100" : "text-slate-200"
      )}
    >
      <span>
        #{team.seed ?? "?"} {team.ownerName}
      </span>
      <span className="text-right text-[11px]">
        {score != null ? score.toFixed ? score.toFixed(2) : score : "—"}
      </span>
    </div>
  );
}

function GrandChampionshipBlock({ gc }) {
  const round = gc;
  const results = round.results || [];

  if (!results.length) return null;

  const match = results[0];
  const tA = match.teamA || {};
  const tB = match.teamB || {};
  const winner = match.winner;

  const scoreA = match.scoreA ?? tA.scores?.[round.week] ?? null;
  const scoreB = match.scoreB ?? tB.scores?.[round.week] ?? null;

  const isWinnerA =
    winner && winner.ownerId && winner.ownerId === tA.ownerId;
  const isWinnerB =
    winner && winner.ownerId && winner.ownerId === tB.ownerId;

  return (
    <section className="mt-6 rounded-xl border border-amber-500/70 bg-amber-500/10 p-4">
      <div className="mb-2 text-xs uppercase tracking-[0.3em] text-amber-300">
        Grand Championship
        {round.week && (
          <span className="ml-1 text-amber-200">(Wk {round.week})</span>
        )}
      </div>
      <div className="space-y-1 text-xs font-mono text-amber-50">
        <MatchLine team={tA} score={scoreA} winner={isWinnerA} />
        <MatchLine team={tB} score={scoreB} winner={isWinnerB} />
      </div>
    </section>
  );
}
