"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminR2Url as r2Url } from "@/lib/r2Client";
import OwnerModal from "@/components/leaderboards/OwnerModal";

const ELIMINATION_WEEKS = 14;
const WEEK_WORDS = [
  "ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN",
  "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN",
];

function points(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function weekScore(owner, week) {
  return points(owner?.weekly?.[week] ?? owner?.weekly?.[String(week)]);
}

function entryKey(owner) {
  return String(owner?.ownerId || owner?.ownerName || "");
}

function ownerLabel(owner) {
  return String(owner?.username || owner?.ownerName || "Unknown manager");
}

function teamLabel(owner) {
  return String(owner?.teamName || owner?.ownerName || "Unknown team");
}

function avatarUrl(owner) {
  const avatar = String(owner?.avatar || "").trim();
  return avatar ? `https://sleepercdn.com/avatars/${encodeURIComponent(avatar)}` : "";
}

function buildCompetition(owners) {
  const byLeague = new Map();
  for (const owner of owners) {
    const leagueName = String(owner?.leagueName || "Unknown league");
    if (!byLeague.has(leagueName)) byLeague.set(leagueName, []);
    byLeague.get(leagueName).push(owner);
  }

  const eliminations = [];
  const weeklyLeagueRows = new Map();

  for (const [leagueName, leagueOwners] of byLeague) {
    const alive = new Map(leagueOwners.map((owner) => [entryKey(owner), owner]));

    for (let week = 1; week <= ELIMINATION_WEEKS; week += 1) {
      const entrants = [...alive.values()];
      const scored = entrants.filter((owner) => weekScore(owner, week) !== null);
      const hasStarted = scored.some((owner) => Number(weekScore(owner, week)) !== 0);
      if (!scored.length || !hasStarted) continue;

      const ranked = scored
        .map((owner) => ({ ...owner, weekScore: weekScore(owner, week) }))
        .sort(
          (a, b) =>
            b.weekScore - a.weekScore ||
            ownerLabel(a).localeCompare(ownerLabel(b))
        );
      const chopped = ranked[ranked.length - 1];
      weeklyLeagueRows.set(`${leagueName}|||${week}`, ranked);
      eliminations.push({ ...chopped, leagueName, week });
      alive.delete(entryKey(chopped));
    }
  }

  return { byLeague, eliminations, weeklyLeagueRows };
}

function PlayerAvatar({ owner }) {
  const src = avatarUrl(owner);
  const initial = ownerLabel(owner).slice(0, 1).toUpperCase() || "?";
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-300/50 bg-slate-950 text-sm font-black text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,.25)] sm:h-9 sm:w-9">
      {initial}
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </span>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
      {label}
      <select
        value={value}
        onChange={onChange}
        className="min-w-0 rounded-lg border border-slate-600 bg-slate-950/90 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-red-500"
      >
        {children}
      </select>
    </label>
  );
}

export default function HighlanderChoppingBlock({ season }) {
  const currentSeason = Number(season);
  const [year, setYear] = useState(currentSeason);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [week, setWeek] = useState(0);
  const [league, setLeague] = useState("");
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [selectedRoster, setSelectedRoster] = useState(null);
  const [rosterLoadingKey, setRosterLoadingKey] = useState("");
  const [rosterError, setRosterError] = useState("");
  const rosterPartsCache = useRef(new Map());
  const manifestCache = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function load() {
      try {
        const response = await fetch(
          r2Url(`data/leaderboards/leaderboards_${year}.json?v=${Date.now()}`),
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error(`Leaderboard data returned ${response.status}.`);
        const json = await response.json();
        if (!cancelled) {
          setPayload(json?.[year] || json?.[String(year)] || json);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Highlander scores could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    setLeague("");
    setWeek(0);
    load();
    timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [year]);

  const highlander = payload?.highlander || null;
  const owners = useMemo(
    () => (Array.isArray(highlander?.owners) ? highlander.owners : []),
    [highlander]
  );
  const competition = useMemo(() => buildCompetition(owners), [owners]);
  const leagueMeta = highlander?.leagueMeta || {};
  const leagueNames = useMemo(
    () => [...competition.byLeague.keys()].sort((a, b) => a.localeCompare(b)),
    [competition]
  );
  const availableWeeks = useMemo(
    () => [...new Set(competition.eliminations.map((row) => row.week))].sort((a, b) => a - b),
    [competition]
  );
  const selectedWeek = week || availableWeeks[availableWeeks.length - 1] || 1;
  const allChopped = useMemo(
    () =>
      competition.eliminations
        .filter((row) => row.week === selectedWeek)
        .sort(
          (a, b) =>
            b.weekScore - a.weekScore ||
            a.leagueName.localeCompare(b.leagueName)
        ),
    [competition, selectedWeek]
  );
  const leagueRows = league
    ? competition.weeklyLeagueRows.get(`${league}|||${selectedWeek}`) || []
    : [];
  const titleLeague = league || "Highlander Game";
  const yearChoices = [currentSeason, currentSeason - 1, currentSeason - 2];

  async function fetchRosterPart(partName) {
    const cacheKey = `${year}:${partName}`;
    if (rosterPartsCache.current.has(cacheKey)) {
      return rosterPartsCache.current.get(cacheKey);
    }
    const request = fetch(
      r2Url(`data/leaderboards/${partName}?v=${Date.now()}`),
      { cache: "no-store" }
    ).then((response) => {
      if (!response.ok) throw new Error(`Roster data returned ${response.status}.`);
      return response.json();
    });
    rosterPartsCache.current.set(cacheKey, request);
    try {
      return await request;
    } catch (error) {
      rosterPartsCache.current.delete(cacheKey);
      throw error;
    }
  }

  async function openLineup(owner) {
    if (!league) return;
    const loadingKey = `${entryKey(owner)}:${selectedWeek}`;
    setRosterLoadingKey(loadingKey);
    setRosterError("");

    try {
      let manifestRequest = manifestCache.current.get(year);
      if (!manifestRequest) {
        manifestRequest = fetch(
          r2Url(`data/leaderboards/weekly_manifest_${year}.json?v=${Date.now()}`),
          { cache: "no-store" }
        ).then((response) => {
          if (!response.ok) throw new Error(`Roster manifest returned ${response.status}.`);
          return response.json();
        });
        manifestCache.current.set(year, manifestRequest);
      }
      const manifest = await manifestRequest;
      const indexedPart = manifest?.leagueParts?.highlander?.[owner.leagueName];
      const partNames = indexedPart
        ? [indexedPart]
        : Array.isArray(manifest?.parts)
          ? manifest.parts
          : [];

      let match = null;
      for (const partName of partNames) {
        const chunk = await fetchRosterPart(partName);
        const rows = chunk?.[year]?.highlander?.[owner.leagueName]?.[selectedWeek] ||
          chunk?.[String(year)]?.highlander?.[owner.leagueName]?.[String(selectedWeek)] || [];
        match = rows.find(
          (row) =>
            String(row?.ownerId || "") === String(owner?.ownerId || "") ||
            row?.ownerName === owner?.ownerName
        );
        if (match) break;
      }

      if (!match) throw new Error(`No Week ${selectedWeek} lineup was found for ${ownerLabel(owner)}.`);
      setSelectedOwner(owner);
      setSelectedRoster({
        week: selectedWeek,
        starters: Array.isArray(match.starters) ? match.starters : [],
        bench: Array.isArray(match.bench) ? match.bench : [],
      });
    } catch (error) {
      manifestCache.current.delete(year);
      setRosterError(error?.message || "This lineup could not be loaded.");
    } finally {
      setRosterLoadingKey("");
    }
  }

  return (
    <section id="chopping-block" className="section pt-0 scroll-mt-24">
      <div className="container-site">
        <div className="relative overflow-hidden rounded-3xl border border-red-500/35 bg-[#03070d] shadow-[0_24px_80px_rgba(0,0,0,.45)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,.24),transparent_45%),radial-gradient(circle_at_50%_110%,rgba(220,38,38,.28),transparent_48%),linear-gradient(115deg,rgba(127,29,29,.12),transparent_35%,rgba(8,47,73,.16))]" />
          <div className="relative px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[.4em] text-red-400 sm:text-xs">
                There can only be one
              </p>
              <h2 className="mt-2 bg-gradient-to-b from-white via-slate-200 to-slate-500 bg-clip-text font-serif text-3xl font-black uppercase tracking-tight text-transparent drop-shadow-[0_3px_0_rgba(127,29,29,.8)] sm:text-5xl">
                {titleLeague}
              </h2>
              <div className="mx-auto mt-3 max-w-2xl border-y border-red-500/50 bg-red-950/35 py-2 text-xl font-black uppercase italic tracking-wide text-white shadow-[0_0_24px_rgba(239,68,68,.2)] sm:text-3xl">
                Week {WEEK_WORDS[selectedWeek] || selectedWeek} Chopping Block
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Select label="Season" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearChoices.map((choice) => <option key={choice}>{choice}</option>)}
              </Select>
              <Select label="Week" value={selectedWeek} onChange={(e) => setWeek(Number(e.target.value))}>
                {(availableWeeks.length ? availableWeeks : [1]).map((choice) => (
                  <option key={choice} value={choice}>Week {choice}</option>
                ))}
              </Select>
              <Select label="View league" value={league} onChange={(e) => setLeague(e.target.value)}>
                <option value="">All chopped players</option>
                {leagueNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </Select>
            </div>

            {league ? (
              <button
                type="button"
                onClick={() => setLeague("")}
                className="mt-4 rounded-full border border-red-400/50 bg-red-950/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-red-100 transition hover:bg-red-900/60"
              >
                ← Back to all chopped
              </button>
            ) : null}

            {rosterError ? (
              <div className="mt-3 rounded-lg border border-red-500/35 bg-red-950/35 px-3 py-2 text-sm text-red-200">
                {rosterError}
              </div>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-600/70 bg-black/65 shadow-2xl">
              {loading ? (
                <div className="p-10 text-center text-sm text-slate-300">Loading the chopping block…</div>
              ) : error ? (
                <div className="p-10 text-center text-sm text-red-300">{error}</div>
              ) : !highlander ? (
                <div className="p-10 text-center text-sm text-slate-300">No Highlander leaderboard was found for {year}.</div>
              ) : (league ? leagueRows : allChopped).length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-300">No scored Highlander games are available for this week yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left sm:min-w-[650px]">
                    <thead className="border-b border-slate-500 bg-slate-950/95 text-xs uppercase tracking-wider text-blue-200">
                      <tr>
                        <th className="w-10 px-1.5 py-3 text-center sm:w-16 sm:px-3">#</th>
                        <th className="px-1.5 py-3 sm:px-3"><span className="sm:hidden">Manager</span><span className="hidden sm:inline">Team</span></th>
                        <th className="hidden px-3 py-3 sm:table-cell">Manager</th>
                        {!league ? <th className="hidden px-3 py-3 md:table-cell">League</th> : null}
                        <th className="px-1.5 py-3 text-right sm:px-3">Points</th>
                        <th className="w-20 px-1.5 py-3 text-center sm:w-28 sm:px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(league ? leagueRows : allChopped).map((owner, index) => {
                        const isChopped = league
                          ? index === leagueRows.length - 1
                          : true;
                        return (
                          <tr
                            key={`${owner.leagueName}-${entryKey(owner)}-${selectedWeek}`}
                            onClick={() => {
                              if (league) openLineup(owner);
                              else setLeague(owner.leagueName);
                            }}
                            className={`border-b border-slate-700/80 transition last:border-0 ${
                              isChopped
                                ? "bg-gradient-to-r from-red-950/80 via-red-900/35 to-black shadow-[inset_4px_0_0_#ef4444]"
                                : "odd:bg-slate-950/75 even:bg-slate-900/65"
                            } cursor-pointer hover:bg-red-900/55`}
                          >
                            <td className="px-1.5 py-2 text-center text-base font-black text-amber-100 sm:px-3 sm:text-lg">{index + 1}</td>
                            <td className="min-w-0 px-1.5 py-2 sm:px-3">
                              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                <PlayerAvatar owner={owner} />
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-white sm:text-base">
                                    <span className="sm:hidden">{ownerLabel(owner)}</span>
                                    <span className="hidden sm:inline">{teamLabel(owner)}</span>
                                  </div>
                                  {!league ? <div className="truncate text-[10px] text-slate-400 md:hidden">{owner.leagueName}</div> : null}
                                  {league && rosterLoadingKey === `${entryKey(owner)}:${selectedWeek}` ? (
                                    <div className="text-[10px] font-semibold text-cyan-300">Loading lineup…</div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-3 py-2 text-sm text-blue-200 sm:table-cell">@{ownerLabel(owner).replace(/^@/, "")}</td>
                            {!league ? <td className="hidden px-3 py-2 text-sm text-slate-300 md:table-cell">{owner.leagueName}</td> : null}
                            <td className="px-1.5 py-2 text-right text-base font-black tabular-nums text-amber-200 sm:px-3 sm:text-xl">{Number(owner.weekScore).toFixed(2)}</td>
                            <td className="px-1.5 py-2 text-center sm:px-3">
                              {isChopped ? (
                                <span className="inline-block -rotate-3 rounded border-2 border-red-500 px-1 py-1 text-[9px] font-black uppercase tracking-normal text-red-400 shadow-[0_0_12px_rgba(239,68,68,.4)] sm:px-2 sm:text-xs sm:tracking-wider">Chopped</span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase tracking-normal text-emerald-300 sm:text-xs sm:tracking-wider">Alive</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>{league ? `Select a manager to see their Week ${selectedWeek} best-ball lineup.` : "Select a chopped manager to see their full league rankings."}</span>
              {league && leagueMeta?.[league]?.leagueId ? (
                <a
                  href={`https://sleeper.com/leagues/${leagueMeta[league].leagueId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-300 hover:text-blue-200 hover:underline"
                >
                  Open league on Sleeper ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {selectedOwner && selectedRoster ? (
        <OwnerModal
          owner={selectedOwner}
          selectedRoster={selectedRoster}
          onClose={() => {
            setSelectedOwner(null);
            setSelectedRoster(null);
          }}
          allOwners={owners}
        />
      ) : null}
    </section>
  );
}
