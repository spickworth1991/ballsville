"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLeaderboard } from "../../app/leaderboards/context/LeaderboardContext";
import  OwnerModal from "./OwnerModal";

const WEEKS_WINDOW = 3; // how many weeks to show at once

function LeaderboardOwnerAvatar({ owner }) {
  const name = String(owner?.ownerName || "?");
  return owner?.avatar ? (
    <img
      src={`https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(owner.avatar)}`}
      alt=""
      loading="lazy"
      className="h-8 w-8 shrink-0 rounded-full border border-accent/35 bg-panel object-cover"
    />
  ) : (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent/25 bg-accent/10 text-[10px] font-black text-accent">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function matchupStatus(matchup) {
  if (!matchup || matchup.opponentScore == null) return "Matchup details unavailable";
  const margin = Number(matchup.teamScore || 0) - Number(matchup.opponentScore || 0);
  if (margin === 0) return "Tied";
  return `${margin > 0 ? "Leading" : "Trailing"} by ${Math.abs(margin).toFixed(2)}`;
}

function teamWeek(team) {
  return Number(
    team?.latestMatchup?.week ||
      team?.latestRoster?.week ||
      Object.keys(team?.weekly || {}).map(Number).filter(Number.isFinite).sort((a, b) => b - a)[0] ||
      0,
  );
}

function highlanderState(team, leagueOwners, throughWeek) {
  const alive = new Set(leagueOwners.map((owner) => String(owner.ownerId)));
  const chopped = new Map();
  for (let week = 1; week <= Math.min(14, Math.max(0, throughWeek - 1)); week += 1) {
    const scored = leagueOwners
      .filter((owner) => alive.has(String(owner.ownerId)))
      .map((owner) => ({ owner, score: Number(owner.weekly?.[week] || 0) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(a.owner.ownerName).localeCompare(String(b.owner.ownerName)));
    if (scored.length < 2) continue;
    const eliminated = scored[scored.length - 1].owner;
    alive.delete(String(eliminated.ownerId));
    chopped.set(String(eliminated.ownerId), week);
  }
  const choppedWeek = chopped.get(String(team.ownerId));
  if (choppedWeek) return { primary: `Chopped in Week ${choppedWeek}`, tone: "danger", secondary: `${alive.size} teams remain` };
  const ranked = leagueOwners
    .filter((owner) => alive.has(String(owner.ownerId)) && Number(owner.weekly?.[throughWeek] || 0) > 0)
    .sort((a, b) => Number(b.weekly?.[throughWeek] || 0) - Number(a.weekly?.[throughWeek] || 0));
  const position = ranked.findIndex((owner) => String(owner.ownerId) === String(team.ownerId)) + 1;
  const score = Number(team.weekly?.[throughWeek] || 0);
  return {
    primary: throughWeek > 14 ? "Advanced to the wager stage" : `Alive · ${alive.size} remain`,
    tone: "success",
    secondary: throughWeek > 14 ? "Weeks 15–17" : `${score.toFixed(2)} points this week`,
    scale: position > 0 ? { position, total: ranked.length, score, label: `#${position} this week · lowest score is chopped`, cutFrom: ranked.length } : null,
  };
}

function recordText(record) {
  if (!record) return "Record updates after the next data refresh";
  return `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`;
}

function seasonCardDetails(team, phase) {
  const record = team.record;
  const place = Number(team.leaguePlace || 0);
  const size = Number(team.leagueSize || 0);
  return {
    phase,
    primary: `${recordText(record)} record${place ? ` · #${place} of ${size}` : ""}`,
    secondary: record?.usesMedian
      ? `H2H ${record.h2hWins}-${record.h2hLosses}${record.h2hTies ? `-${record.h2hTies}` : ""} · Median ${record.medianWins}-${record.medianLosses}${record.medianTies ? `-${record.medianTies}` : ""}`
      : "Current league standing",
    tone: place === 1 ? "success" : "neutral",
  };
}

function weeklyScale(team, leagueOwners, week, label, cutFrom) {
  const ranked = leagueOwners
    .filter((owner) => Number(owner.weekly?.[week] || 0) > 0)
    .sort((a, b) => Number(b.weekly?.[week] || 0) - Number(a.weekly?.[week] || 0));
  const position = ranked.findIndex((owner) => String(owner.ownerId) === String(team.ownerId)) + 1;
  return position > 0
    ? { position, total: ranked.length, score: Number(team.weekly?.[week] || 0), label, cutFrom: cutFrom === "last" ? ranked.length : cutFrom }
    : null;
}

function valueScale(team, owners, valueFor, label, cutFrom) {
  const ranked = [...owners].sort((a, b) => valueFor(b) - valueFor(a));
  const position = ranked.findIndex((owner) => String(owner.ownerId) === String(team.ownerId)) + 1;
  return position > 0
    ? { position, total: ranked.length, score: valueFor(team), label, cutFrom }
    : null;
}

function modeCardDetails(team, block, year) {
  const week = teamWeek(team);
  const leagueOwners = (block?.owners || []).filter((owner) => owner.leagueName === team.leagueName);
  const raceAt = (cutoff) => {
    const pointsThrough = (owner) => Object.entries(owner.weekly || {}).reduce(
      (sum, [weekNumber, points]) => sum + (Number(weekNumber) <= cutoff ? Number(points || 0) : 0),
      0,
    );
    const ranked = [...leagueOwners].sort((a, b) => pointsThrough(b) - pointsThrough(a));
    const points = pointsThrough(team);
    const leader = pointsThrough(ranked[0] || {});
    const position = ranked.filter((owner) => pointsThrough(owner) > points).length + 1;
    const tiedLeaders = ranked.filter((owner) => pointsThrough(owner) === leader).length;
    const nextScore = ranked.find((owner) => pointsThrough(owner) < leader);
    return {
      position,
      leader,
      points,
      size: ranked.length,
      tiedLeaders,
      leadBy: position === 1 && tiedLeaders === 1 && nextScore ? points - pointsThrough(nextScore) : 0,
      behindBy: position > 1 ? leader - points : 0,
    };
  };
  const raceStandingText = (race, final = false) => {
    if (race.position === 1 && race.tiedLeaders > 1) return `${final ? "Finished tied" : "Tied"} for the league lead at ${race.points.toFixed(2)}`;
    if (race.position === 1) return `${final ? "Won the league" : "Leading the league"} by ${race.leadBy.toFixed(2)} points`;
    return `${final ? "Finished" : "Trailing the league leader"} by ${race.behindBy.toFixed(2)} points`;
  };

  if (team.modeKey === "highlander") {
    if (week <= 14) return { phase: "Chopping block", ...highlanderState(team, leagueOwners, week) };
    if (week === 15) return { phase: "Four-player wager round", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} survival points`, secondary: "Top 2 advance · highest wagering score wins the league pot", tone: "neutral", scale: weeklyScale(team, leagueOwners, week, "Week 15 survival", 3) };
    if (week === 16) return { phase: "Highlander league final", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} final points`, secondary: "Two finalists · highest score becomes league winner", tone: "neutral", scale: weeklyScale(team, leagueOwners, week, "Week 16 head-to-head", 2) };
    return { phase: "The Highlander Game", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} championship points`, secondary: "Ten league winners · a wager is required to compete", tone: "neutral" };
  }
  if (team.modeKey === "big_game") {
    const race = raceAt(15);
    if (week <= 15) return { phase: "League points race · through Week 15", primary: `#${race.position} of ${race.size} in league`, secondary: raceStandingText(race), note: "Margin includes the current week’s live scores and can change.", tone: race.position === 1 ? "success" : "neutral" };
    const divisionOwners = (block?.owners || []).filter((owner) => owner.division === team.division && Number(owner.weekly?.[week] || 0) > 0);
    if (week === 16) return { phase: "Division wager week", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} points · ${raceStandingText(race, true)}`, secondary: race.position === 1 ? "Eligible for the division pots" : `League race finished #${race.position} of ${race.size}`, tone: race.position === 1 ? "success" : "neutral", scale: weeklyScale(team, divisionOwners, week, "Division scoring field", null) };
    return { phase: "Big Game championship", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} points · ${raceStandingText(race, true)}`, secondary: race.position === 1 ? "Championship eligibility follows wager choice" : `League race finished #${race.position} of ${race.size}`, tone: race.position === 1 ? "success" : "neutral" };
  }
  if (team.modeKey === "mini_game") {
    const race = raceAt(14);
    if (week <= 14) return { phase: "League points race · through Week 14", primary: `#${race.position} of ${race.size} in league`, secondary: raceStandingText(race), note: "Margin includes the current week’s live scores and can change.", tone: race.position === 1 ? "success" : "neutral" };
    const divisionOwners = (block?.owners || []).filter((owner) => owner.division === team.division && Number(owner.weekly?.[week] || 0) > 0);
    return { phase: week === 15 ? "Week 15 wager & bonus race" : "Mini League final results", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} points · ${raceStandingText(race, true)}`, secondary: race.position === 1 ? "Eligible for bonuses and optional wagering" : `League race finished #${race.position} of ${race.size}`, tone: race.position === 1 ? "success" : "neutral", scale: week === 15 ? weeklyScale(team, divisionOwners, week, "Division bonus field", null) : null };
  }
  if (team.modeKey === "gauntlet") {
    if (Number(year) <= 2025) {
      if (week <= 8) return seasonCardDetails(team, "Leg 1 · Redraft");
      if (week <= 12) return { phase: "Leg 2 · Guillotine", primary: `${Number(team.total || 0).toFixed(2)} cumulative points`, secondary: "Lowest cumulative points are cut each week", tone: "neutral", scale: valueScale(team, leagueOwners, (owner) => Number(owner.total || 0), "Cumulative chopping block", leagueOwners.length) };
      return { phase: "Leg 3 · Best Ball bracket", primary: matchupStatus(team.latestMatchup), secondary: `${Number(team.weekly?.[week] || 0).toFixed(2)} points this round`, tone: matchupStatus(team.latestMatchup).startsWith("Leading") ? "success" : "neutral" };
    }
    if (week <= 5) return seasonCardDetails(team, "Trial 1 · Redraft");
    if (week <= 10) {
      const margin = Number(team.latestMatchup?.teamScore || 0) - Number(team.latestMatchup?.opponentScore || 0);
      return { ...seasonCardDetails(team, "Trial 2 · Pirate"), primary: margin >= 0 ? `Protecting the booty by ${Math.abs(margin).toFixed(2)}` : `Booty at risk by ${Math.abs(margin).toFixed(2)}`, tone: margin >= 0 ? "success" : "danger" };
    }
    if (week <= 14) return { phase: "Trial 3 · Guillotine", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} survival points`, secondary: "Lowest weekly score is chopped", tone: "neutral", scale: weeklyScale(team, leagueOwners, week, "Weekly chopping block", "last") };
    if (week === 15) return { phase: "Trial 4 · Playoffs", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} best-ball points`, secondary: "Top 3 advance · bottom 3 eliminated", tone: "neutral", scale: weeklyScale(team, leagueOwners, week, "Six-team playoff field", 4) };
    if (week === 16) return { phase: "Trial 4 · League final", primary: `${Number(team.weekly?.[week] || 0).toFixed(2)} best-ball points`, secondary: "#1 wins · bottom 2 eliminated", tone: "neutral", scale: weeklyScale(team, leagueOwners, week, "Three-team league final", 2) };
    return { phase: "Trial 5 · Championship", primary: matchupStatus(team.latestMatchup), secondary: "League winners may bank or wager", tone: "neutral" };
  }
  if (team.modeKey === "dynasty") return seasonCardDetails(team, week < 16 ? "Dynasty season" : week === 16 ? "Dynasty league finals" : week === 17 ? "Wager & bonus round" : "Heroes vs Dragons");
  if (team.modeKey === "auction") return seasonCardDetails(team, week < 15 ? "Auction season" : week <= 16 ? "Auction playoffs" : "Week 17 championship");
  return seasonCardDetails(team, week < 15 ? "Redraft season" : week <= 16 ? "Six-team playoffs" : "Week 17 wager championship");
}

function MyBallsville({ yearBlock, year, onOpenTeam }) {
  const storageKey = `ballsville:my-manager:${year}`;
  const collapsedKey = "ballsville:my-ballsville-collapsed";
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState(false);

  const modes = useMemo(
    () => Object.entries(yearBlock || {}).filter(([key, block]) => !key.startsWith("__") && Array.isArray(block?.owners)),
    [yearBlock],
  );
  const managers = useMemo(() => {
    const unique = new Map();
    modes.forEach(([, block]) => block.owners.forEach((owner) => {
      const id = String(owner.ownerId || "");
      if (id && !unique.has(id)) unique.set(id, owner);
    }));
    return [...unique.values()].sort((a, b) => String(a.ownerName).localeCompare(String(b.ownerName)));
  }, [modes]);

  useEffect(() => {
    setSelectedId(window.localStorage.getItem(storageKey) || "");
    setCollapsed(window.localStorage.getItem(collapsedKey) === "1");
    setQuery("");
    setChoosing(false);
    setPage(1);
  }, [storageKey]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      window.localStorage.setItem(collapsedKey, value ? "0" : "1");
      return !value;
    });
  };

  const selectedManager = managers.find((owner) => String(owner.ownerId) === selectedId) || null;
  const teams = useMemo(() => {
    if (!selectedId) return [];
    return modes.flatMap(([modeKey, block]) => {
      const ranked = [...block.owners].sort(
        (a, b) => Number(b.total || 0) - Number(a.total || 0) || String(a.ownerName).localeCompare(String(b.ownerName)),
      );
      const rankByTeam = new Map(ranked.map((owner, index) => [`${owner.ownerId}:${owner.leagueName}`, index + 1]));
      return block.owners
        .filter((owner) => String(owner.ownerId) === selectedId)
        .map((owner) => ({
          ...owner,
          modeKey,
          modeName: block.name || modeKey,
          modeRank: rankByTeam.get(`${owner.ownerId}:${owner.leagueName}`),
        }));
    }).sort((a, b) => Number(a.modeRank || 999999) - Number(b.modeRank || 999999));
  }, [modes, selectedId]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return managers.slice(0, 8);
    return managers.filter((owner) =>
      [owner.ownerName, owner.username, owner.teamName].some((value) => String(value || "").toLowerCase().includes(needle)),
    ).slice(0, 8);
  }, [managers, query]);
  const totalPages = Math.max(1, Math.ceil(teams.length / 6));
  const visibleTeams = teams.slice((page - 1) * 6, page * 6);

  const choose = (owner) => {
    const id = String(owner.ownerId);
    window.localStorage.setItem(storageKey, id);
    setSelectedId(id);
    setQuery("");
    setChoosing(false);
    setPage(1);
  };
  const clear = () => {
    window.localStorage.removeItem(storageKey);
    setSelectedId("");
    setQuery("");
    setChoosing(false);
  };

  return (
    <section className="relative z-20 rounded-3xl border border-accent/25 bg-card-surface shadow-md">
      <div className={`${collapsed ? "" : "border-b border-subtle"} bg-[radial-gradient(circle_at_top_left,rgba(122,212,242,.14),transparent_48%)] p-4 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-accent">My Ballsville</div>
            <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">Every team. One scoreboard.</h2>
            {collapsed && selectedManager ? <div className="mt-1 text-xs text-muted">{selectedManager.ownerName} · {teams.length} team{teams.length === 1 ? "" : "s"}</div> : null}
          </div>
          <div className="flex gap-2">
            {selectedManager && !choosing && !collapsed ? (
              <>
              <button type="button" onClick={() => setChoosing(true)} className="rounded-xl border border-subtle bg-panel/50 px-3 py-2 text-xs font-bold text-foreground">Change</button>
              <button type="button" onClick={clear} className="rounded-xl border border-subtle px-3 py-2 text-xs font-bold text-muted">Clear</button>
              </>
            ) : null}
            <button type="button" onClick={toggleCollapsed} className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-black text-accent">
              {collapsed ? "Show teams ↓" : "Collapse ↑"}
            </button>
          </div>
        </div>

        {!collapsed && selectedManager && !choosing ? (
          <div className="mt-4 flex items-center gap-3">
            <LeaderboardOwnerAvatar owner={selectedManager} />
            <div className="min-w-0">
              <div className="truncate font-black text-foreground">{selectedManager.ownerName}</div>
              <div className="text-xs text-muted">{teams.length} team{teams.length === 1 ? "" : "s"} in {year}</div>
            </div>
          </div>
        ) : !collapsed ? (
          <div className="mt-4 max-w-xl">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find my teams by manager name…"
              className="w-full rounded-xl border border-subtle bg-panel/60 px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent/50"
              autoFocus={choosing}
            />
            {query.trim() ? <div className="ballsville-scrollbar mt-2 max-h-72 overflow-y-auto rounded-2xl border border-subtle bg-card-surface p-1 shadow-xl">
              {matches.length ? matches.map((owner) => (
                <button key={owner.ownerId} type="button" onClick={() => choose(owner)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-panel/60">
                  <LeaderboardOwnerAvatar owner={owner} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-foreground">{owner.ownerName}</span>
                    <span className="block truncate text-xs text-muted">@{owner.username || owner.ownerName}</span>
                  </span>
                </button>
              )) : <div className="p-4 text-center text-sm text-muted">No managers found.</div>}
            </div> : <div className="mt-2 text-xs text-muted">Start typing a manager name to find every team.</div>}
          </div>
        ) : null}
      </div>

      {!collapsed && selectedManager && !choosing ? (
        <div className="p-4 sm:p-6">
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleTeams.map((team) => {
              const details = modeCardDetails(team, yearBlock?.[team.modeKey], year);
              const matchup = team.latestMatchup;
              const fallbackWeek = team.latestRoster?.week || Object.keys(team.weekly || {}).map(Number).sort((a, b) => b - a)[0];
              const displayWeek = matchup?.week || fallbackWeek;
              const displayScore = matchup?.teamScore ?? team.weekly?.[displayWeek] ?? 0;
              return (
                <button
                  key={`${team.modeKey}:${team.leagueName}:${team.rosterId || team.ownerId}`}
                  type="button"
                  onClick={() => onOpenTeam(team)}
                  className="rounded-2xl border border-subtle bg-panel/30 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-foreground">{team.leagueName}</div>
                      <div className="mt-0.5 text-xs text-muted">{team.modeName} · Rank #{team.modeRank}</div>
                    </div>
                    <div className="rounded-lg bg-black/25 px-2 py-1 text-xs font-black text-accent">W{displayWeek || "—"}</div>
                  </div>
                  <div className="mt-3 rounded-xl border border-subtle bg-black/15 px-3 py-2.5">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">{details.phase}</div>
                    <div className={`mt-1 text-sm font-black ${details.tone === "danger" ? "text-red-300" : details.tone === "success" ? "text-emerald-300" : "text-foreground"}`}>{details.primary}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{details.secondary}</div>
                    {details.note ? (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-accent/10 px-2 py-1.5 text-[10px] leading-snug text-muted" title={details.note}>
                        <span aria-hidden="true" className="font-black text-accent">ⓘ</span>
                        <span>{details.note}</span>
                      </div>
                    ) : null}
                    {details.scale ? (
                      <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-wider text-muted">
                          <span>{details.scale.label}</span>
                          <span>#{details.scale.position} of {details.scale.total}</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-400/70 via-amber-300/70 to-red-400/80">
                          {details.scale.cutFrom && details.scale.total > 1 ? (
                            <span
                              className="absolute top-[-3px] h-3.5 w-px bg-white/70"
                              style={{ left: `${Math.min(100, Math.max(0, ((details.scale.cutFrom - 1) / (details.scale.total - 1)) * 100))}%` }}
                            />
                          ) : null}
                          <span
                            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-card-surface shadow-lg"
                            style={{ left: `${details.scale.total <= 1 ? 50 : ((details.scale.position - 1) / (details.scale.total - 1)) * 100}%` }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-muted">
                          <span>{details.scale.cutFrom ? "Safe" : "High"}</span>
                          <span>{details.scale.cutFrom ? "Chop / cut line" : "Low"}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">You</div>
                      <div className="text-2xl font-black tabular-nums text-foreground">{Number(displayScore).toFixed(2)}</div>
                    </div>
                    <span className="text-xs font-black text-muted">VS</span>
                    <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-bold uppercase tracking-wider text-muted">{matchup?.opponentName || "Opponent"}</div>
                        <div className="text-2xl font-black tabular-nums text-foreground">{matchup?.opponentScore == null ? "—" : Number(matchup.opponentScore).toFixed(2)}</div>
                      </div>
                      {matchup?.opponentName ? <LeaderboardOwnerAvatar owner={{ ownerName: matchup.opponentName, avatar: matchup.opponentAvatar }} /> : null}
                    </div>
                  </div>
                  <div className={`mt-3 rounded-xl px-3 py-2 text-center text-xs font-black ${matchupStatus(matchup).startsWith("Leading") ? "bg-emerald-500/10 text-emerald-300" : matchupStatus(matchup).startsWith("Trailing") ? "bg-red-500/10 text-red-300" : "bg-accent/10 text-accent"}`}>
                    {matchupStatus(matchup)}
                  </div>
                </button>
              );
            })}
          </div>
          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-3 text-xs">
              <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-subtle px-3 py-2 disabled:opacity-40">Previous</button>
              <span className="text-muted">{page} / {totalPages}</span>
              <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-subtle px-3 py-2 disabled:opacity-40">Next</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Leaderboard view (controls + table)
 *
 * NOTE: The old Navbar was a separate component when leaderboards lived in a separate repo.
 * In Ballsville main we keep these controls embedded with the leaderboard UI.
 */
export default function Leaderboard({
  data,
  years: yearsProp,
  current,
  setCurrent,
  basePath,
  lastUpdated,
  showWeeks,
  setShowWeeks,
}) {
  const [pendingOpen, setPendingOpen] = useState(null);
  if (!data || !current?.year) return null;

  // Prefer the explicit list from props; otherwise fall back to whatever is in data
  const years = useMemo(() => {
    const base = yearsProp?.length ? yearsProp : Object.keys(data || {});
    return [...base].map(String).sort((a, b) => b.localeCompare(a));
  }, [yearsProp, data]);

  // Available modes for selected year
  const availableModes = useMemo(() => {
    const yearBlock = data?.[current.year] || {};
    const order = { big_game: 1, mini_game: 2, highlander: 3, redraft_2025: 4, redraft: 4, gauntlet: 5, dynasty: 6 };
    return Object.keys(yearBlock)
      .filter((key) => !String(key).startsWith("__"))
      .sort(
      (a, b) => (order[a] ?? 99) - (order[b] ?? 99) || a.localeCompare(b)
      );
  }, [data, current.year]);

  // Keep mode valid
  const activeMode = useMemo(() => {
    if (availableModes.includes(current.mode)) return current.mode;
    return (
      availableModes.find((k) => k === "redraft_2025") ||
      availableModes.find((k) => k === "redraft") ||
      availableModes[0] ||
      ""
    );
  }, [availableModes, current.mode]);

  useEffect(() => {
    if (activeMode && activeMode !== current.mode) {
      setCurrent((prev) => ({ ...prev, mode: activeMode, filterType: "all", filterValue: null }));
    }
  }, [activeMode, current.mode, setCurrent]);

  const activeBlock = data?.[current.year]?.[activeMode] || null;
  const isGauntlet = activeMode === "gauntlet";
  const isRedraft2025 = activeMode === "redraft_2025";

  const shortModeName = (val, key) => {
    const name = val?.name || key;
    const parts = String(name).split(" ").filter(Boolean);
    return parts[1] || name;
  };

  return (
    <div className="space-y-4">
      <MyBallsville
        yearBlock={data?.[current.year]}
        year={current.year}
        onOpenTeam={(team) => {
          setPendingOpen({ ownerId: team.ownerId, leagueName: team.leagueName, week: team.latestMatchup?.week || team.latestRoster?.week });
          setCurrent((prev) => ({ ...prev, mode: team.modeKey, filterType: "all", filterValue: null }));
        }}
      />
      {/* Table */}
      {activeBlock ? (
        <LeaderboardTable
          controls={(
            <LeaderboardControls
              data={data}
              years={years}
              current={{ ...current, mode: activeMode }}
              setCurrent={setCurrent}
              showWeeks={showWeeks}
              setShowWeeks={setShowWeeks}
              lastUpdated={lastUpdated}
              activeMode={activeMode}
              activeBlock={activeBlock}
              isGauntlet={isGauntlet}
              isRedraft2025={isRedraft2025}
              shortModeName={shortModeName}
            />
          )}
          data={activeBlock}
          year={Number(current.year)}
          category={activeMode}
          basePath={basePath}
          showWeeks={showWeeks}
          setShowWeeks={setShowWeeks}
          filterType={current.filterType}
          filterValue={current.filterValue}
          pendingOpen={pendingOpen}
          clearPendingOpen={() => setPendingOpen(null)}
        />
      ) : (
        <div className="rounded-3xl border border-subtle bg-card-surface shadow-md p-6 text-sm text-muted">
          No leaderboard data available.
        </div>
      )}
    </div>
  );
}

/* ---------------- Controls (embedded navbar) ---------------- */

function LeaderboardControls({
  data,
  years,
  current,
  setCurrent,
  showWeeks,
  setShowWeeks,
  lastUpdated,
  activeMode,
  activeBlock,
  isGauntlet,
  isRedraft2025,
  shortModeName,
}) {
  const [openSheet, setOpenSheet] = useState(null);
  const [search, setSearch] = useState("");

  const handleSelect = (updates) => {
    setCurrent((prev) => ({ ...prev, ...updates }));
    setOpenSheet(null);
    setSearch("");
  };
  const resetFilter = () => handleSelect({ filterType: "all", filterValue: null });

  const filteredDivisions = useMemo(() => {
    // Preserve backend-provided ordering (it already reflects divisionOrder/leagueOrder).
    const list = [...(activeBlock?.divisions || [])];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((d) => String(d).toLowerCase().includes(q));
  }, [activeBlock, search]);

  const filteredLeaguesByDivision = useMemo(() => {
    const map = activeBlock?.leaguesByDivision || {};
    // Preserve backend-provided ordering (it already reflects divisionOrder/leagueOrder).
    // Fallback to object keys if the backend didn't provide a divisions array.
    const divisions = (Array.isArray(activeBlock?.divisions) && activeBlock.divisions.length)
      ? [...activeBlock.divisions]
      : Object.keys(map);
    const q = search.trim().toLowerCase();

    const result = {};
    divisions.forEach((division) => {
      // Preserve backend-provided ordering (it already reflects divisionOrder/leagueOrder).
      const leagues = [...(map[division] || [])];
      if (!q) {
        result[division] = leagues;
        return;
      }
      const matches = leagues.filter((l) => String(l).toLowerCase().includes(q));
      if (matches.length) result[division] = matches;
    });
    return result;
  }, [activeBlock, search]);

  return (
    <section className="border-b border-subtle bg-[radial-gradient(circle_at_top_right,rgba(122,212,242,.10),transparent_42%)] p-4 sm:p-5">
      {/* Row 1 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-[0.16em] uppercase text-muted">
            Leaderboards{lastUpdated ? ` • Updated ${lastUpdated}` : ""}
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground leading-tight truncate" title={activeBlock?.name}>
            {activeBlock?.name || "Leaderboard"}
          </div>
          {(current.filterType !== "all" && current.filterValue) && (
            <div className="mt-1 text-xs text-muted">
              Filter: <span className="text-foreground font-semibold">{String(current.filterValue)}</span>
            </div>
          )}
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-2 md:w-auto md:min-w-[430px]">
          <label className="rounded-2xl border border-subtle bg-panel/45 px-3 py-2 transition focus-within:border-accent/45">
            <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-muted">Season</span>
            <select
              value={current.year}
              onChange={(event) => handleSelect({ year: event.target.value, filterType: "all", filterValue: null })}
              className="mt-0.5 w-full cursor-pointer bg-transparent text-sm font-black text-foreground outline-none"
            >
              {years.map((year) => <option key={year} value={year} className="bg-card-surface">{year}</option>)}
            </select>
          </label>
          <label className="rounded-2xl border border-subtle bg-panel/45 px-3 py-2 transition focus-within:border-accent/45">
            <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-muted">Game mode</span>
            <select
              value={activeMode}
              onChange={(event) => handleSelect({ mode: event.target.value, filterType: "all", filterValue: null })}
              className="mt-0.5 w-full cursor-pointer bg-transparent text-sm font-black text-foreground outline-none"
            >
              {Object.keys(data?.[current.year] || {}).filter((modeKey) => !String(modeKey).startsWith("__")).map((modeKey) => (
                <option key={modeKey} value={modeKey} className="bg-card-surface">{data?.[current.year]?.[modeKey]?.name || shortModeName(data?.[current.year]?.[modeKey], modeKey)}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 sm:justify-end">
            <button
              onClick={() => setShowWeeks(!showWeeks)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                showWeeks
                  ? "bg-accent/15 border-accent/40 text-foreground"
                  : "bg-panel/40 border-subtle text-muted hover:border-accent/30 hover:text-foreground"
              }`}
              title="Toggle weekly columns"
              aria-pressed={showWeeks}
            >
              Weekly
              <span
                className={`inline-block w-9 h-4 rounded-full p-[2px] transition ${
                  showWeeks ? "bg-foreground/80" : "bg-muted/30"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-card-surface transform transition ${
                    showWeeks ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Division/League picker */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isRedraft2025 || !activeBlock?.divisions?.length}
          onClick={() => {
            setSearch("");
            setOpenSheet("divisions");
          }}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-xl text-sm font-semibold border transition ${
            isRedraft2025 || !activeBlock?.divisions?.length
              ? "bg-panel/40 text-muted border-subtle cursor-not-allowed opacity-60"
              : "bg-panel border-subtle text-foreground hover:border-accent/40"
          }`}
          title={isRedraft2025 ? "No Divisions" : isGauntlet ? "Browse Legions" : "Browse Divisions"}
        >
          {isRedraft2025 ? "No Divisions" : isGauntlet ? "Legions" : "Divisions"}
        </button>

        <button
          type="button"
          disabled={!activeBlock?.leaguesByDivision}
          onClick={() => {
            setSearch("");
            setOpenSheet("leagues");
          }}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-xl text-sm font-semibold border transition ${
            !activeBlock?.leaguesByDivision
              ? "bg-panel/40 text-muted border-subtle cursor-not-allowed opacity-60"
              : "bg-panel border-subtle text-foreground hover:border-accent/40"
          }`}
          title="Browse Leagues"
        >
          Leagues
        </button>

        {current.filterType !== "all" && (
          <button
            type="button"
            onClick={resetFilter}
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-semibold bg-accent/15 border border-accent/40 text-foreground hover:bg-accent/20 transition"
            title="Clear filter"
          >
            Reset
          </button>
        )}
      </div>

      <Sheet
        open={!!openSheet}
        title={
          openSheet === "divisions"
            ? isGauntlet
              ? "Legions"
              : "Divisions"
            : openSheet === "leagues"
            ? "Leagues"
            : ""
        }
        onClose={() => {
          setOpenSheet(null);
          setSearch("");
        }}
        search={search}
        setSearch={setSearch}
      >
        {openSheet === "divisions" && (
          <div className="divide-y divide-subtle">
            {filteredDivisions.length === 0 && <EmptyState msg="No matches found." />}
            {filteredDivisions.map((div) => (
              <button
                key={div}
                className="w-full text-left px-4 py-3 hover:bg-panel/60 transition"
                onClick={() => handleSelect({ filterType: "division", filterValue: div })}
              >
                <div className="text-sm text-foreground font-semibold">{div}</div>
                <div className="text-xs text-muted">{isGauntlet ? "Legion" : "Division"}</div>
              </button>
            ))}
          </div>
        )}

        {openSheet === "leagues" && (
          <div className="space-y-6">
            {Object.keys(filteredLeaguesByDivision).length === 0 && (
              <EmptyState msg="No leagues match your search." />
            )}
            {Object.entries(filteredLeaguesByDivision).map(([division, leagues]) => (
              <div key={division} className="border border-subtle rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-panel/60 text-foreground text-sm font-semibold">
                  {division}
                </div>
                <div className="divide-y divide-subtle">
                  {leagues.map((league) => (
                    <button
                      key={league}
                      className="w-full text-left px-4 py-3 hover:bg-panel/60 transition"
                      onClick={() => handleSelect({ filterType: "league", filterValue: league })}
                    >
                      <div className="text-sm text-foreground font-semibold">{league}</div>
                      <div className="text-xs text-muted">League</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </section>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border ${
        active
          ? "bg-accent/15 border-accent/40 text-foreground"
          : "bg-panel/40 border-subtle text-muted hover:border-accent/30 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Sheet({ open, title, onClose, children, search, setSearch }) {
  // Lock body + ESC to close (runs only when open)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sheetUI = (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-[9999] flex items-end md:items-center md:justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-full md:max-w-3xl bg-card-surface border border-subtle shadow-2xl overflow-hidden rounded-t-3xl md:rounded-3xl flex flex-col"
          style={{ maxHeight: "82vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-panel/60 text-foreground hover:bg-panel transition"
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
            <div className="text-foreground font-semibold">{title}</div>
          </div>

          <div className="p-4 border-b border-subtle">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${String(title).toLowerCase()}…`}
                className="w-full bg-panel/40 border border-subtle rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {!!search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
                  aria-label="Clear"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div
            className="px-4 pb-6 overflow-y-auto min-h flex-1 md:max-h-[90vh]"
            style={{ maxHeight: "90vh", WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );

  // Render above everything (fixes embed z-index issues)
  return createPortal(sheetUI, document.body);
}

function EmptyState({ msg }) {
  return <div className="text-center text-muted py-10 text-sm">{msg}</div>;
}

function formatStatValue(value) {
  if (value == null || value === "") return "-";
  const num = Number(value);
  if (Number.isFinite(num)) return num.toLocaleString();
  return String(value);
}

function SummaryChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-subtle bg-panel/35 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.24em] text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{formatStatValue(value)}</div>
    </div>
  );
}

function getModeOwnerLabel(card) {
  const rawName = String(card?.name || card?.key || "mode").trim();
  const cleaned = rawName.replace(/^\d{4}\s+/, "").trim() || "Mode";
  return `Unique ${cleaned} owners`;
}

function ModeMiniCard({ card }) {
  const draftedTeamsOutOf = `${formatStatValue(card?.draftedTeams)}/${formatStatValue(card?.totalRosterSlots)}`;
  const leaguesDraftedOutOf = `${formatStatValue(card?.draftedLeagues)}/${formatStatValue(card?.totalLeagues)}`;
  const draftingLeaguesOutOf = `${formatStatValue(card?.draftingLeagues)}/${formatStatValue(card?.totalLeagues)}`;
  const veteran = card?.draftTypeBreakdown?.veteran || null;
  const rookie = card?.draftTypeBreakdown?.rookie || null;

  return (
    <div className="rounded-2xl border border-subtle bg-panel/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-accent">{card?.name || card?.key || "Mode"}</div>
      <div className="mt-3 space-y-2 text-sm text-muted">
        {veteran || rookie ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span>Veteran leagues drafted</span>
              <span className="font-semibold text-foreground">
                {formatStatValue(veteran?.draftedLeagues)}/{formatStatValue(veteran?.totalLeagues)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Veteran teams drafted</span>
              <span className="font-semibold text-foreground">
                {formatStatValue(veteran?.draftedTeams)}/{formatStatValue(veteran?.totalRosterSlots)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Rookie leagues drafted</span>
              <span className="font-semibold text-foreground">
                {formatStatValue(rookie?.draftedLeagues)}/{formatStatValue(rookie?.totalLeagues)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Rookie teams drafted</span>
              <span className="font-semibold text-foreground">
                {formatStatValue(rookie?.draftedTeams)}/{formatStatValue(rookie?.totalRosterSlots)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Drafting leagues</span>
              <span className="font-semibold text-foreground">{draftingLeaguesOutOf}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{getModeOwnerLabel(card)}</span>
              <span className="font-semibold text-foreground">{formatStatValue(card?.uniqueOwnersOnceDrafted)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span>Drafted teams</span>
              <span className="font-semibold text-foreground">{draftedTeamsOutOf}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Leagues drafted</span>
              <span className="font-semibold text-foreground">{leaguesDraftedOutOf}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Drafting leagues</span>
              <span className="font-semibold text-foreground">{draftingLeaguesOutOf}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{getModeOwnerLabel(card)}</span>
              <span className="font-semibold text-foreground">{formatStatValue(card?.uniqueOwnersOnceDrafted)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OwnerYearComparisonCard({ item }) {
  if (!item || !Array.isArray(item.comparisons) || item.comparisons.length === 0) return null;

  return (
    <div className="rounded-2xl border border-subtle bg-panel/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-accent">{item.year} owner movement</div>
      <div className="mt-3 space-y-3 text-sm text-muted">
        {item.comparisons.map((comparison) => (
          <div
            key={`${item.year}-${comparison.compareYear}`}
            className="rounded-2xl border border-subtle bg-panel/35 px-3 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted">vs {comparison.compareYear}</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>Returned</span>
              <span className="font-semibold text-foreground">{formatStatValue(comparison.returned)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span>New</span>
              <span className="font-semibold text-foreground">{formatStatValue(comparison.newOwners)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopOwnersMiniBoard({ item, expanded, onToggle }) {
  const sourceRows = Array.isArray(item?.rows) ? item.rows : [];
  const rows = expanded ? sourceRows.slice(0, 10) : sourceRows.slice(0, 3);

  return (
    <div className="rounded-2xl border border-subtle bg-panel/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-accent">{item?.name || item?.key || "Mode leaders"}</div>
      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-muted">No owner leaderboard yet.</div>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div key={`${item?.key || "mode"}-${row.ownerName}-${index}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.22em] text-muted">#{index + 1}</div>
                <div className="truncate text-sm font-semibold text-foreground">{row.ownerName}</div>
              </div>
              <div className="text-right text-xs text-muted">
                <div>{formatStatValue(row.teamCount)} teams</div>
                <div>{formatStatValue(row.draftedTeamCount)} drafted</div>
                {Number(row.draftingTeamCount || 0) > 0 ? <div>{formatStatValue(row.draftingTeamCount)} drafting</div> : null}
                {Number(row.preDraftTeamCount || 0) > 0 ? <div>{formatStatValue(row.preDraftTeamCount)} pre-draft</div> : null}
                {row.averageTotal != null && row.hasPointData !== false ? (
                  <div>{formatStatValue(row.averageTotal)} avg points</div>
                ) : (
                  <div>No scored teams yet</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {sourceRows.length > 3 ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-accent transition hover:text-accent/80"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- Table (existing leaderboard UI) ---------------- */

function LeaderboardTable({ controls, data, year, category, basePath, showWeeks, setShowWeeks, filterType, filterValue, pendingOpen, clearPendingOpen }) {
  const { statsByYear } = useLeaderboard();
  const yearSummary = statsByYear?.[year] || {};
  const {
    draftedTeams = 0,
    draftedUniqueOwners = 0,
    draftingTeams = null,
    uniqueOwnersOnceDrafted = null,
    openDraftSlots = null,
    totalRosterSlots = null,
    totalLeagues = null,
    draftedLeagues = null,
    modeCards = [],
    topOwnersByMode = {},
    ownerYearComparisons = [],
  } = yearSummary;

  const norm = (s) => String(s || "").toLowerCase().trim();

  const filterOwnersByDivisionOrLeague = useMemo(() => {
    const t = String(filterType || "all");
    const v = filterValue == null ? "" : String(filterValue);
    const qv = norm(v);

    if (t === "division" && qv) {
      return (o) => {
        const dv = norm(o?.division ?? o?.divisionName ?? o?.theme_name ?? o?.themeName ?? "");
        return dv === qv;
      };
    }
    if (t === "league" && qv) {
      return (o) => {
        const lv = norm(o?.leagueName ?? o?.league ?? o?.name ?? "");
        return lv === qv;
      };
    }
    return () => true;
  }, [filterType, filterValue]);

  // Build a globally-ranked list (always from ALL owners, so Global Rank stays meaningful)
  const rankedOwners = useMemo(() => {
    const owners = Array.isArray(data?.owners) ? data.owners : [];
    const list = [...owners].sort(
      (a, b) =>
        Number(b?.total || 0) - Number(a?.total || 0) ||
        String(a?.ownerName || "").localeCompare(String(b?.ownerName || "")) ||
        String(a?.leagueName || "").localeCompare(String(b?.leagueName || ""))
    );
    return list.map((o, i) => ({ ...o, globalRank: i + 1 }));
  }, [data]);

  const scopedOwners = useMemo(() => {
    return rankedOwners.filter(filterOwnersByDivisionOrLeague);
  }, [rankedOwners, filterOwnersByDivisionOrLeague]);

  // -------- Owner Search ----------
  const [query, setQuery] = useState("");
  const [focusSuggest, setFocusSuggest] = useState(false);
  const [showMoreStats, setShowMoreStats] = useState(false);
  const [expandedBoards, setExpandedBoards] = useState({});
  const inputRef = useRef(null);

  const q = norm(query);

  // -------- Weekly sort/filter ----------
  const [weeklySortWeek, setWeeklySortWeek] = useState(null); // number | null
  const [weeklySortDir, setWeeklySortDir] = useState("desc"); // "asc" | "desc"

  // Suggestions / filtered list
  const filteredOwners = useMemo(() => {
    let base = !q ? scopedOwners : scopedOwners.filter((o) => norm(o.ownerName).includes(q));

    // When in weeks view and a sort week is selected, sort by that week's score
    if (showWeeks && weeklySortWeek != null) {
      const w = weeklySortWeek;
      base = [...base].sort((a, b) => {
        const av = typeof a.weekly?.[w] === "number" ? a.weekly[w] : -Infinity;
        const bv = typeof b.weekly?.[w] === "number" ? b.weekly[w] : -Infinity;
        if (av === bv) return (a.globalRank || 0) - (b.globalRank || 0);
        return weeklySortDir === "asc" ? av - bv : bv - av;
      });
    }
    return base;
  }, [q, scopedOwners, showWeeks, weeklySortWeek, weeklySortDir, norm]);

  const ownerSuggestions = useMemo(() => {
    if (!q) return [];
    const names = Array.from(new Set(scopedOwners.map((o) => o.ownerName)));
    const starts = names.filter((n) => norm(n).startsWith(q));
    const includes = names.filter((n) => !norm(n).startsWith(q) && norm(n).includes(q));
    return [...starts, ...includes].slice(0, 8);
  }, [q, scopedOwners]);

  const orderedModeCards = useMemo(() => {
    const cards = Array.isArray(modeCards)
      ? modeCards.filter((card) => card && !String(card?.key || "").startsWith("__"))
      : [];
    return [...cards].sort((a, b) => {
      if (a?.key === category) return -1;
      if (b?.key === category) return 1;
      return String(a?.name || a?.key || "").localeCompare(String(b?.name || b?.key || ""));
    });
  }, [category, modeCards]);

  const topOwnerBoards = useMemo(() => {
    return Object.values(topOwnersByMode || {})
      .filter((item) => item && !String(item?.key || "").startsWith("__"))
      .sort((a, b) => {
        if (a?.key === category) return -1;
        if (b?.key === category) return 1;
        return String(a?.name || a?.key || "").localeCompare(String(b?.name || b?.key || ""));
      });
  }, [category, topOwnersByMode]);

  const clearQuery = () => setQuery("");
  const draftingTeamsOutOf =
    totalRosterSlots == null ? draftingTeams : `${Number(draftingTeams || 0)}/${Number(totalRosterSlots || 0)}`;
  const leaguesDraftedOutOf =
    totalLeagues == null ? draftedLeagues : `${Number(draftedLeagues || 0)}/${Number(totalLeagues || 0)}`;
  const orderedOwnerYearComparisons = useMemo(() => {
    return Array.isArray(ownerYearComparisons) ? [...ownerYearComparisons] : [];
  }, [ownerYearComparisons]);
  const currentOwnerYearComparison = useMemo(() => {
    return orderedOwnerYearComparisons.find((item) => String(item?.year) === String(year)) || null;
  }, [orderedOwnerYearComparisons, year]);

  // -------- Pagination ----------
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setPage(1); // reset to page 1 whenever filter changes
  }, [q, year, category, filterType, filterValue]);

  useEffect(() => {
    setExpandedBoards({});
  }, [year, category]);

  // -------- Weekly data (per-year) ----------
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [selectedRoster, setSelectedRoster] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [visibleWeeksStart, setVisibleWeeksStart] = useState(0);
  const weeklyCache = useRef({}); // cache per year
  const weeklyManifestCache = useRef({});
  const weeklyPartCache = useRef({});
  const weeklyRequests = useRef({}); // share in-flight loads per year/part

  // Reset weeks pager & weekly sort when year/mode/toggle changes
  useEffect(() => {
    setVisibleWeeksStart(0);
  }, [year, category, showWeeks]);
  useEffect(() => {
    setWeeklySortWeek(null);
  }, [year, category, showWeeks]);

  const sumPoints = (arr = []) =>
    arr.reduce(
      (s, p) => s + Number(p?.points ?? p?.pts ?? p?.score ?? p?.value ?? 0),
      0
    );

  // When Weekly is turned on and weeklyData is ready, jump pager to latest non-zero week
  useEffect(() => {
    if (!showWeeks) return;

    const weeks = Array.isArray(data.weeks) ? [...data.weeks] : [];
    if (!weeks.length) return;

    // Descending: newest → oldest
    weeks.sort((a, b) => b - a);

    // Does ANY owner have non-zero points this week?
    const ownerHasPoints = (wk) => {
      for (const o of scopedOwners) {
        // 1) Use precomputed weekly totals on the owner if available
        const val = typeof o.weekly?.[wk] === "number" ? o.weekly[wk] : null;
        if (val != null && val > 0) return true;

        // 2) Fallback to roster records in weeklyData
        const leagueWeeks = weeklyData?.[year]?.[category]?.[o.leagueName] || {};
        const recArr = leagueWeeks[wk] || [];
        const rec = recArr.find((r) => r.ownerName === o.ownerName);
        if (rec) {
          const total = sumPoints(rec.starters) + sumPoints(rec.bench);
          if (total > 0) return true;
        }
      }
      return false;
    };

    let targetWeek = null;
    for (const wk of weeks) {
      if (ownerHasPoints(wk)) {
        targetWeek = wk;
        break;
      }
    }
    if (targetWeek == null) return;

    // Position pager so targetWeek is visible in the WEEKS_WINDOW
    const start = Math.floor((targetWeek - 1) / WEEKS_WINDOW) * WEEKS_WINDOW;
    setVisibleWeeksStart(start);
  }, [showWeeks, weeklyData, year, category, scopedOwners, data.weeks]);

  // Helper: load weekly data
  const loadWeeklyDataForYear = async ({ updateState = true, leagueName = "", mode = category } = {}) => {
    try {
      const base = (basePath || "/r2/data/leaderboards").replace(/\/$/, "");
      let manifest = weeklyManifestCache.current[year];
      if (!manifest) {
        const manRes = await fetch(`${base}/weekly_manifest_${year}.json`, { cache: "no-store" });
        if (!manRes.ok) return null;
        manifest = await manRes.json();
        weeklyManifestCache.current[year] = manifest;
      }
      const mappedPart = leagueName ? manifest.leagueParts?.[mode]?.[leagueName] : null;
      const parts = mappedPart ? [mappedPart] : (manifest.parts || []);
      const chunks = await Promise.all(
        parts.map(async (part) => {
          const cacheKey = `${year}:${part}`;
          if (weeklyPartCache.current[cacheKey]) return weeklyPartCache.current[cacheKey];
          if (!weeklyRequests.current[cacheKey]) {
            weeklyRequests.current[cacheKey] = fetch(`${base}/${part}`, { cache: "no-store" })
              .then((res) => res.ok ? res.json() : null)
              .finally(() => { delete weeklyRequests.current[cacheKey]; });
          }
          const chunk = await weeklyRequests.current[cacheKey];
          if (chunk) weeklyPartCache.current[cacheKey] = chunk;
          return chunk;
        }),
      );

      const combined = weeklyCache.current[year] || {};
      for (const chunk of chunks) {
        if (!chunk) continue;
        for (const y in chunk) {
          combined[y] = combined[y] || {};
          for (const mode in chunk[y]) {
            combined[y][mode] = combined[y][mode] || {};
            Object.assign(combined[y][mode], chunk[y][mode]);
          }
        }
      }
      weeklyCache.current[year] = combined;
      if (updateState && combined) setWeeklyData({ ...combined });
      return combined;
    } catch {
      return null;
    }
  };

  const handleWeeklyClick = async (owner, week) => {
    const wd = await loadWeeklyDataForYear({ leagueName: owner.leagueName });
    const leagueData = wd?.[year]?.[category]?.[owner.leagueName]?.[week];
    if (!leagueData) return;
    const match = leagueData.find((r) => r.ownerName === owner.ownerName);
    if (match) {
      const opponent = match.matchupId == null
        ? null
        : leagueData.find(
            (row) =>
              String(row.ownerId) !== String(match.ownerId) &&
              String(row.matchupId) === String(match.matchupId),
          );
      const opponentOwner = opponent
        ? data.owners.find(
            (row) => row.ownerName === opponent.ownerName && row.leagueName === owner.leagueName,
          )
        : null;
      setSelectedOwner(owner);
      setSelectedRoster({
        week,
        starters: match.starters,
        bench: match.bench,
        opponent: opponent
          ? { ownerName: opponent.ownerName, avatar: opponentOwner?.avatar || "", starters: opponent.starters, bench: opponent.bench }
          : null,
      });
    }
  };

  useEffect(() => {
    if (!pendingOpen || !clearPendingOpen) return;
    let cancelled = false;
    const open = async () => {
      const owner = data.owners.find(
        (row) =>
          String(row.ownerId) === String(pendingOpen.ownerId) &&
          row.leagueName === pendingOpen.leagueName,
      );
      if (!owner) return;
      const wd = await loadWeeklyDataForYear({ leagueName: owner.leagueName });
      if (cancelled || !wd) return;
      const week = Number(pendingOpen.week || owner.latestRoster?.week || 0);
      const leagueData = wd[year]?.[category]?.[owner.leagueName]?.[week];
      const match = leagueData?.find(
        (row) => String(row.ownerId) === String(owner.ownerId) || row.ownerName === owner.ownerName,
      );
      if (!match) return;
      const opponent = match.matchupId == null
        ? null
        : leagueData.find(
            (row) =>
              String(row.ownerId) !== String(match.ownerId) &&
              String(row.matchupId) === String(match.matchupId),
          );
      const opponentOwner = opponent
        ? data.owners.find((row) => row.ownerName === opponent.ownerName && row.leagueName === owner.leagueName)
        : null;
      setSelectedOwner(owner);
      setSelectedRoster({
        week,
        starters: match.starters,
        bench: match.bench,
        opponent: opponent
          ? { ownerName: opponent.ownerName, avatar: opponentOwner?.avatar || "", starters: opponent.starters, bench: opponent.bench }
          : null,
      });
      clearPendingOpen();
    };
    open();
    return () => { cancelled = true; };
  }, [pendingOpen, year, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowClickLatest = async (owner) => {
    const wd = await loadWeeklyDataForYear({ leagueName: owner.leagueName });
    if (!wd) return;

    const weeks = Array.isArray(data.weeks) ? [...data.weeks] : [];
    weeks.sort((a, b) => b - a);

    const mostRecentNonZero = weeks.find((wk) => {
      const val = typeof owner.weekly?.[wk] === "number" ? owner.weekly[wk] : null;
      if (val != null && val > 0) return true;

      const leagueData = wd[year]?.[category]?.[owner.leagueName]?.[wk];
      const match = leagueData?.find((r) => r.ownerName === owner.ownerName);
      if (!match) return false;
      const total = sumPoints(match.starters) + sumPoints(match.bench);
      return total > 0;
    });

    // Generated summaries identify the league's current published matchup week,
    // including teams that are still on zero. Older data falls back to the most
    // recent week with points.
    const summaryWeek = Number(owner.latestMatchup?.week || 0);
    const week = summaryWeek || mostRecentNonZero || weeks[0];
    if (!week) return;

    const leagueData = wd[year]?.[category]?.[owner.leagueName]?.[week];
    const match = leagueData?.find((r) => r.ownerName === owner.ownerName);
    if (!match) return;

    const opponent = match.matchupId == null
      ? null
      : leagueData.find(
          (row) =>
            String(row.ownerId) !== String(match.ownerId) &&
            String(row.matchupId) === String(match.matchupId),
        );
    const opponentOwner = opponent
      ? data.owners.find(
          (row) => row.ownerName === opponent.ownerName && row.leagueName === owner.leagueName,
        )
      : null;

    setSelectedOwner(owner);
    setSelectedRoster({
      week,
      starters: match.starters,
      bench: match.bench,
      opponent: opponent
        ? { ownerName: opponent.ownerName, avatar: opponentOwner?.avatar || "", starters: opponent.starters, bench: opponent.bench }
        : null,
    });
  };

  // Visible weeks in window
  const weeks = useMemo(() => {
    const w = Array.isArray(data.weeks) ? [...data.weeks] : [];
    return w.sort((a, b) => a - b);
  }, [data.weeks]);
  const currentWeeks = useMemo(() => {
    if (!weeks.length) return [];
    return weeks.slice(visibleWeeksStart, visibleWeeksStart + WEEKS_WINDOW);
  }, [weeks, visibleWeeksStart]);

  // Pagination slices
  const totalPages = Math.max(1, Math.ceil(filteredOwners.length / itemsPerPage));
  const currentOwners = filteredOwners.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const showLeagueColumn = useMemo(() => {
    // If we're in a league filter, league column is redundant
    if (filterType === "league") return false;
    return true;
  }, [filterType]);

  return (
    <div className="overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-md">
      {controls}
      <div className="p-4">
      {/* Stats */}
      <div className="mb-4 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryChip label="Drafted Teams" value={draftedTeams} />
            <SummaryChip label="Drafted Unique Owners" value={draftedUniqueOwners} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setShowMoreStats((prev) => !prev)}
              className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:border-accent/50 hover:bg-accent/15"
            >
              {showMoreStats ? "Hide more stats" : "More stats"}
            </button>

            <div className="relative w-full sm:min-w-[320px] sm:max-w-sm">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocusSuggest(true)}
                onBlur={() => setTimeout(() => setFocusSuggest(false), 120)}
                className="w-full rounded-xl border border-subtle bg-panel/40 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="Search owner..."
              />
              {!!query && (
                <button
                  type="button"
                  onClick={clearQuery}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
                  aria-label="Clear"
                >
                  Clear
                </button>
              )}

              {focusSuggest && ownerSuggestions.length > 0 && (
                <div className="absolute mt-2 w-full rounded-2xl border border-subtle bg-card-surface shadow-xl overflow-hidden z-10">
                  {ownerSuggestions.map((name) => (
                    <button
                      type="button"
                      key={name}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-panel/60 transition"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setQuery(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {showMoreStats && (
          <div className="rounded-3xl border border-subtle bg-subtle-surface/35 p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <SummaryChip label="Drafting Teams" value={draftingTeamsOutOf} />
              <SummaryChip label="Unique Owners Once Drafted" value={uniqueOwnersOnceDrafted} />
              <SummaryChip label="Open Draft Slots" value={openDraftSlots} />
              <SummaryChip label="Tracked Leagues" value={totalLeagues} />
              <SummaryChip label="Leagues Drafted" value={leaguesDraftedOutOf} />
            </div>

            {currentOwnerYearComparison && Array.isArray(currentOwnerYearComparison.comparisons) && currentOwnerYearComparison.comparisons.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-accent">Owner movement by year</div>
                <div className="mt-2 text-xs text-muted">
                  Returned counts are drafted owners shared by both years. New counts are owners in that year who were not in the compared earlier year.
                </div>
                <div className="mt-3">
                  <OwnerYearComparisonCard item={currentOwnerYearComparison} />
                </div>
              </div>
            )}

            {orderedModeCards.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-accent">Mode snapshots</div>
                <div className="mt-2 text-xs text-muted">
                  Mode owner counts overlap: the same person is counted once in every mode they play. Do not add these
                  figures together; Drafted Unique Owners above is the deduplicated Ballsville-wide total.
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {orderedModeCards.map((card) => (
                    <ModeMiniCard key={card.key || card.name} card={card} />
                  ))}
                </div>
              </div>
            )}

            {topOwnerBoards.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-accent">Top owners by mode</div>
                <div className="mt-2 text-xs text-muted">
                  Includes drafted, drafting, and pre-draft leagues. Expand any board to see more owners.
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {topOwnerBoards.map((item) => (
                    <TopOwnersMiniBoard
                      key={item.key || item.name}
                      item={item}
                      expanded={Boolean(expandedBoards[item.key || item.name])}
                      onToggle={() =>
                        setExpandedBoards((prev) => ({
                          ...prev,
                          [item.key || item.name]: !prev[item.key || item.name],
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Weekly navigation */}
      {showWeeks && weeks.length > WEEKS_WINDOW && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            onClick={() => setVisibleWeeksStart((s) => Math.max(0, s - WEEKS_WINDOW))}
            disabled={visibleWeeksStart === 0}
            className="px-3 py-2 rounded-xl border border-subtle bg-panel/40 text-foreground hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev Weeks
          </button>

          <div className="text-xs text-muted">
            Showing weeks {currentWeeks[0]}-{currentWeeks[currentWeeks.length - 1]}
          </div>

          <button
            type="button"
            onClick={() =>
              setVisibleWeeksStart((s) => Math.min(weeks.length - WEEKS_WINDOW, s + WEEKS_WINDOW))
            }
            disabled={visibleWeeksStart + WEEKS_WINDOW >= weeks.length}
            className="px-3 py-2 rounded-xl border border-subtle bg-panel/40 text-foreground hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Weeks
          </button>
        </div>
      )}

      {/* Weekly sort options */}
      {showWeeks && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {weeklySortWeek != null && (
            <button
              type="button"
              onClick={() => {
                setWeeklySortWeek(null);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-panel/60 border border-subtle text-foreground hover:border-accent/30"
            >
              Clear Weekly Sort
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="ballsville-scrollbar overflow-x-auto rounded-2xl border border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-panel/60 text-muted">
            <tr>
              <th className="sticky left-0 z-20 w-12 min-w-12 bg-panel p-2 text-left md:static md:z-auto md:w-auto md:min-w-0 md:bg-transparent">Rank</th>
              <th className="sticky left-12 z-20 min-w-[168px] bg-panel p-2 text-left md:static md:z-auto md:min-w-0 md:bg-transparent">Owner</th>
              <th className="p-2 text-left">Slot</th>
              {showLeagueColumn && <th className="hidden p-2 text-left md:table-cell">League</th>}
              {showWeeks &&
                currentWeeks.map((w) => (
                  <th key={w} className="p-2 text-center">
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg bg-panel/60 hover:bg-panel border border-subtle text-xs"
                      onClick={() => {
                        if (weeklySortWeek === w) {
                          setWeeklySortDir((d) => (d === "desc" ? "asc" : "desc"));
                        } else {
                          setWeeklySortWeek(w);
                          setWeeklySortDir("desc");
                        }
                      }}
                      title="Sort by this week's points"
                    >
                      W{w}
                      {weeklySortWeek === w ? (weeklySortDir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              <th className="p-2 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {currentOwners.map((o, idx) => (
              <tr
                key={`${o.ownerName}-${idx}`}
                className="group cursor-pointer border-t border-subtle hover:bg-panel/40"
                onClick={() => {
                  if (showWeeks) return; // weekly cells have their own click handler
                  handleRowClickLatest(o);
                }}
              >
                <td className="sticky left-0 z-10 w-12 min-w-12 bg-card-surface p-2 group-hover:bg-panel md:static md:z-auto md:w-auto md:min-w-0 md:bg-transparent">{o.globalRank}</td>
                <td className="sticky left-12 z-10 bg-card-surface p-2 font-semibold text-foreground group-hover:bg-panel md:static md:z-auto md:bg-transparent">
                  <div className="flex min-w-[150px] items-center gap-2">
                    <LeaderboardOwnerAvatar owner={o} />
                    <div className="min-w-0">
                      <div className="truncate">{o.ownerName}</div>
                      <div className="max-w-[118px] truncate text-[10px] font-medium text-muted md:hidden" title={o.leagueName}>
                        {o.leagueName}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-2 text-muted">{o.draftSlot ? `(${o.draftSlot})` : "-"}</td>
                {showLeagueColumn && <td className="hidden p-2 text-muted md:table-cell">{o.leagueName}</td>}
                {showWeeks &&
                  currentWeeks.map((w) => (
                    <td
                      key={w}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWeeklyClick(o, w);
                      }}
                      className="p-2 text-center text-foreground hover:bg-accent/10 rounded-lg transition"
                      title="Click for roster details"
                    >
                      {typeof o.weekly?.[w] === "number" ? o.weekly[w].toFixed(2) : "-"}
                    </td>
                  ))}
                <td className="p-2 font-bold text-foreground">{o.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-4 mt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-subtle bg-panel/40 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <div className="px-3 py-2 text-sm text-muted">Page {page} of {totalPages}</div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl border border-subtle bg-panel/40 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Owner modal (weekly details) */}
      {selectedOwner && selectedRoster && (
        <OwnerModal
          owner={selectedOwner}
          selectedRoster={selectedRoster}
          onClose={() => {
            setSelectedOwner(null);
            setSelectedRoster(null);
          }}
          onSelectOwner={(nextOwner) => {
            setSelectedOwner(null);
            setSelectedRoster(null);
            handleRowClickLatest(nextOwner);
          }}
          allOwners={data.owners}
          year={year}
          mode={category}
          basePath="/data"
        />
      )}
      </div>
    </div>
  );
}
