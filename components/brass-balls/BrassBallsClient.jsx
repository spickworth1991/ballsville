"use client";

import { useEffect, useMemo, useState } from "react";
import LiteYouTube from "@/components/LiteYouTube";
import Link from "next/link";
import { adminR2Url } from "@/lib/r2Client";

const num = (value) => Number(value || 0);
const text = (value) => String(value || "").trim();
const avatar = (id) =>
  id ? `/api/sleeper/avatar?id=${encodeURIComponent(id)}` : "";
const DEFAULT_MEDIA = {
  rules: "/photos/brass-balls/main-2026.png",
  board: "/photos/brass-balls/board-no-names-2026.png",
  assignments: "/photos/brass-balls/actual-board-2026.png",
};
const TERRITORY_COLORS = ["#7c3aed", "#dc2626", "#ea580c", "#16a34a", "#eab308", "#2563eb"];

function territoryState(doc) {
  const teams = Array.isArray(doc?.teams) ? doc.teams : [];
  const counts = new Map(teams.map((team) => [String(team.rosterId), 6]));
  const battles = [];
  const transfer = (winner, loser, amount) => {
    const available = counts.get(loser) || 0;
    const moved = Math.min(amount, available);
    counts.set(loser, available - moved);
    counts.set(winner, (counts.get(winner) || 0) + moved);
    return moved;
  };
  [...(doc?.weeks || [])]
    .sort((a, b) => num(a.week) - num(b.week))
    .filter((week) => week.completed)
    .forEach((week) => (week.matchups || []).forEach((pair) => {
      const attacker = String(pair.teamA?.rosterId || "");
      const defender = String(pair.teamB?.rosterId || "");
      const winner = String(pair.result?.winnerRosterId || "");
      let moved = 0;
      if (pair.battleType === "war" && winner && [attacker, defender].includes(winner)) {
        moved = transfer(winner, winner === attacker ? defender : attacker, 2);
      } else if (winner && winner === attacker) {
        moved = transfer(attacker, defender, 1);
      }
      battles.push({ week: week.week, pair, moved });
    }));
  return { counts, battles };
}

function TerritoryBoard({ doc }) {
  const teams = Array.isArray(doc?.teams) ? doc.teams : [];
  const { counts } = territoryState(doc);
  if (!teams.length) return (
    <div className="mt-8 rounded-3xl border border-dashed border-amber-300/30 p-8 text-center text-muted">
      North and South assignments will appear after they are published by the commissioner.
    </div>
  );
  return (
    <section className="mt-8 overflow-hidden rounded-[32px] border border-amber-400/35 bg-[radial-gradient(circle_at_50%_0%,rgba(120,53,15,.35),transparent_45%),#05070b] p-4 shadow-2xl sm:p-7">
      <div className="text-center">
        <div className="text-xs font-black uppercase tracking-[.3em] text-amber-300">Fantasy Football Territories</div>
        <h1 className="mt-2 text-3xl font-black uppercase text-white sm:text-5xl">The Brass Balls War Map</h1>
        <p className="mt-2 text-sm text-slate-400">Completed results through Week {Math.max(0, ...(doc.weeks || []).filter((w) => w.completed).map((w) => num(w.week))) || "—"}</p>
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        {["north", "south"].map((side) => (
          <div key={side} className="rounded-3xl border border-white/10 bg-black/45 p-4">
            <h2 className="text-center text-2xl font-black uppercase tracking-[.18em] text-white">The {side}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {teams.filter((team) => (team.side || "north") === side).sort((a, b) => num(b.color) - num(a.color)).map((team) => {
                const count = counts.get(String(team.rosterId)) || 0;
                const color = TERRITORY_COLORS[num(team.color) % TERRITORY_COLORS.length];
                return (
                  <div key={team.rosterId} className="rounded-2xl border border-white/10 bg-slate-950/90 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate font-bold text-white">{team.teamName || `@${team.username}`}</div>
                      <div className="text-xl font-black text-amber-200">{count}</div>
                    </div>
                    <div className="mt-3 flex min-h-8 flex-wrap gap-1" aria-label={`${count} territories`}>
                      {Array.from({ length: count }, (_, index) => (
                        <span key={index} className="h-6 w-7 border border-white/35 shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color, color, clipPath: "polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)" }} />
                      ))}
                    </div>
                    <div className="mt-2 truncate text-xs text-slate-400">@{String(team.username || "").replace(/^@/, "")}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function teamName(rosterId, rosters, users, fallback = "Team") {
  const roster = rosters.find(
    (row) => String(row.roster_id) === String(rosterId),
  );
  const user = users.find(
    (row) => String(row.user_id) === String(roster?.owner_id),
  );
  return text(
    user?.metadata?.team_name ||
      user?.display_name ||
      user?.username ||
      fallback,
  );
}

function teamIdentity(rosterId, rosters, users, fallback = "Team") {
  const roster = rosters.find(
    (row) => String(row.roster_id) === String(rosterId),
  );
  const user = users.find(
    (row) => String(row.user_id) === String(roster?.owner_id),
  );
  const username = text(user?.username || user?.display_name);
  const namedTeam = text(user?.metadata?.team_name);
  return {
    primary: namedTeam || (username ? `@${username.replace(/^@/, "")}` : fallback),
    secondary: namedTeam && username ? `@${username.replace(/^@/, "")}` : "",
  };
}

function computeBestBallLineup(matchup, players) {
  if (!matchup) return { total: null, selected: new Map() };

  const entries = Object.entries(matchup.players_points || {})
    .map(([id, score]) => {
      const player = players[id] || {};
      const position = text(
        player.position || player.fantasy_positions?.[0],
      ).toUpperCase();
      return { id: String(id), position, points: num(score) };
    })
    .filter((player) => ["QB", "RB", "WR", "TE"].includes(player.position));

  // Until the player directory arrives, Sleeper's aggregate is the safest
  // placeholder. Once it is available, optimize the league's best-ball slots.
  if (!entries.length) {
    return { total: num(matchup.points), selected: new Map() };
  }

  const remaining = [...entries];
  const selected = new Map();
  const take = (count, slot, eligible) => {
    for (let index = 0; index < count; index += 1) {
      const candidates = remaining
        .filter((player) => eligible.includes(player.position))
        .sort((a, b) => b.points - a.points);
      const player = candidates[0];
      if (!player) break;
      selected.set(player.id, slot);
      remaining.splice(
        remaining.findIndex((row) => row.id === player.id),
        1,
      );
    }
  };

  take(1, "QB", ["QB"]);
  take(2, "RB", ["RB"]);
  take(3, "WR", ["WR"]);
  take(1, "TE", ["TE"]);
  take(2, "FLEX", ["RB", "WR", "TE"]);
  take(1, "SUPER FLEX", ["QB", "RB", "WR", "TE"]);

  const total = entries.reduce(
    (sum, player) =>
      sum + (selected.has(player.id) ? num(player.points) : 0),
    0,
  );
  return { total, selected };
}

function TeamScore({ slot, matchup, rosters, users, players }) {
  const identity = teamIdentity(slot?.rosterId, rosters, users);
  const name = text(slot?.label) || identity.primary;
  const roster = rosters.find(
    (row) => String(row.roster_id) === String(slot?.rosterId),
  );
  const user = users.find(
    (row) => String(row.user_id) === String(roster?.owner_id),
  );
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4 text-white shadow-inner">
      {user?.avatar ? (
        <img
          src={avatar(user.avatar)}
          alt=""
          className="h-11 w-11 rounded-xl object-cover"
        />
      ) : (
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-xs">
          BB
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">{name}</div>
        {identity.secondary ? (
          <div className="truncate text-xs text-slate-400">{identity.secondary}</div>
        ) : null}
      </div>
      <div className="rounded-xl bg-amber-300 px-3 py-2 text-2xl font-black text-slate-950">
        {matchup
          ? computeBestBallLineup(matchup, players).total.toFixed(2)
          : "—"}
      </div>
    </div>
  );
}

function PlayerRows({ matchup, players }) {
  const points = matchup?.players_points || {};
  const { selected } = computeBestBallLineup(matchup, players);
  return Object.entries(points)
    .sort(
      (a, b) =>
        Number(selected.has(String(b[0]))) -
          Number(selected.has(String(a[0]))) ||
        num(b[1]) - num(a[1]),
    )
    .map(([id, score]) => {
      const player = players[id] || {};
      const name =
        text(player.full_name || player.search_full_name) || `Player ${id}`;
      return (
        <div
          key={id}
          className="grid grid-cols-[1fr_auto] gap-3 border-b border-subtle py-2 text-sm last:border-0"
        >
          <div className="min-w-0">
            <span className="font-medium text-primary">{name}</span>
            <span className="ml-2 text-xs text-muted">
              {player.position || ""}
              {player.team ? ` · ${player.team}` : ""}
              {selected.has(id) ? ` · Counts (${selected.get(id)})` : " · Bench"}
            </span>
          </div>
          <b className="text-primary">{num(score).toFixed(2)}</b>
        </div>
      );
    });
}

export default function BrassBallsClient({ season, scoringOnly = false }) {
  const [doc, setDoc] = useState(null);
  const [week, setWeek] = useState(1);
  const [live, setLive] = useState({
    rosters: [],
    users: [],
    matchups: [],
    players: {},
  });
  const [openId, setOpenId] = useState("");
  const [error, setError] = useState("");
  const [refreshEvery, setRefreshEvery] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetch(
      adminR2Url(`data/brass-balls/season_${season}.json?v=${Date.now()}`),
      { cache: "no-store" },
    )
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(
              new Error("The Brass Balls schedule has not been published yet."),
            ),
      )
      .then((data) => {
        setDoc(data);
        const weeks = data?.weeks || [];
        setWeek(num(data?.currentWeek) || num(weeks[0]?.week) || 1);
      })
      .catch((err) => setError(err.message));
  }, [season]);

  useEffect(() => {
    if (!scoringOnly || !doc?.leagueId || !week) return;
    setRefreshing(true);
    const id = encodeURIComponent(doc.leagueId);
    Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${id}/rosters`).then((r) =>
        r.json(),
      ),
      fetch(`https://api.sleeper.app/v1/league/${id}/users`).then((r) =>
        r.json(),
      ),
      fetch(`https://api.sleeper.app/v1/league/${id}/matchups/${week}`).then(
        (r) => r.json(),
      ),
      Object.keys(live.players || {}).length
        ? Promise.resolve(live.players)
        : fetch("https://api.sleeper.app/v1/players/nfl")
            .then((r) => r.json())
            .catch(() => ({})),
    ])
      .then(([rosters, users, matchups, players]) => {
        setLive({ rosters, users, matchups, players });
        setLastUpdated(new Date());
        setError("");
      })
      .catch(() => setError("Live Sleeper scores could not be loaded."))
      .finally(() => setRefreshing(false));
  }, [doc?.leagueId, week, refreshNonce, scoringOnly]); // player directory is reused after its first load

  useEffect(() => {
    if (!refreshEvery) return undefined;
    const timer = window.setInterval(
      () => setRefreshNonce((value) => value + 1),
      refreshEvery * 1000,
    );
    return () => window.clearInterval(timer);
  }, [refreshEvery]);

  const weekDoc = useMemo(
    () => (doc?.weeks || []).find((row) => num(row.week) === num(week)),
    [doc, week],
  );
  const matchupByRoster = useMemo(
    () =>
      new Map((live.matchups || []).map((row) => [String(row.roster_id), row])),
    [live.matchups],
  );
  const rulesImage = text(doc?.heroImageUrl) || DEFAULT_MEDIA.rules;
  const mediaImage = text(doc?.secondaryImageUrl) || DEFAULT_MEDIA.board;
  const assignmentsImage =
    text(doc?.actualBoardImageUrl) || DEFAULT_MEDIA.assignments;

  return (
    <main className="min-h-screen text-primary">
      <section className="section pt-24">
        <div className="container-site max-w-6xl">
          {!scoringOnly ? (
            <>
          <div className="overflow-hidden rounded-[32px] border border-subtle bg-card-surface">
            <div className="p-6 sm:p-9">
              <div className="text-xs font-bold uppercase tracking-[.28em] text-accent">
                Experimental game mode
              </div>
              <h1 className="mt-2 text-4xl font-black sm:text-6xl">
                {doc?.title || "The Brass Balls"}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
                {doc?.intro ||
                  "A test game mode built around custom weekly head-to-head assignments. Matchups do not have to follow the league’s standard schedule, and a team can stand alone in any week."}
              </p>
              <Link href="/brass-balls/scoring" className="btn btn-primary mt-5 inline-flex">
                Open scoring and territories
              </Link>
            </div>
            <div className="border-t border-subtle bg-black">
              <img
                src={rulesImage}
                alt="Fantasy Football Territories rules"
                className="h-auto w-full object-contain"
              />
            </div>
          </div>

          <div
            className={`mt-6 grid gap-5 ${doc?.youtubeId ? "lg:grid-cols-2" : ""}`}
          >
            <div className="overflow-hidden rounded-3xl border border-subtle bg-card-surface">
              <img
                src={mediaImage}
                alt="Fantasy Football Territories game board"
                className="h-auto w-full object-contain"
              />
            </div>
            {doc?.youtubeId ? (
              <div className="overflow-hidden rounded-3xl border border-subtle bg-card-surface">
                <LiteYouTube id={doc.youtubeId} title="The Brass Balls" />
              </div>
            ) : null}
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-subtle bg-card-surface">
            <div className="border-b border-subtle p-4">
              <div className="text-xs font-bold uppercase tracking-[.2em] text-accent">
                2026 board assignments
              </div>
            </div>
            <img
              src={assignmentsImage}
              alt="The Brass Balls 2026 North and South assignments"
              className="mx-auto h-auto w-full max-w-4xl object-contain"
            />
          </div>

            </>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[.28em] text-amber-300">The Brass Balls</div>
                  <h1 className="mt-2 text-4xl font-black sm:text-6xl">Scoring & Territories</h1>
                </div>
                <Link href="/brass-balls" className="btn btn-secondary">Back to game rules</Link>
              </div>
              <TerritoryBoard doc={doc} />
            </>
          )}

          {scoringOnly ? (
          <section className="mt-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[.2em] text-accent">
                  Custom schedule
                </div>
                <h2 className="mt-1 text-3xl font-black">
                  Week {week} matchups
                </h2>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Week
                  <select
                    value={week}
                    onChange={(event) => {
                      setWeek(num(event.target.value));
                      setOpenId("");
                    }}
                    className="mt-1 block rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
                  >
                    {(doc?.weeks || [])
                      .sort((a, b) => num(a.week) - num(b.week))
                      .map((row) => (
                        <option key={row.week} value={row.week}>
                          Week {row.week}
                          {row.label ? ` · ${row.label}` : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Score refresh
                  <select
                    value={refreshEvery}
                    onChange={(event) =>
                      setRefreshEvery(num(event.target.value))
                    }
                    className="mt-1 block rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
                  >
                    <option value="0">Manual only</option>
                    <option value="30">Every 30 seconds</option>
                    <option value="60">Every 60 seconds</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setRefreshNonce((value) => value + 1)}
                  disabled={refreshing}
                  className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-xs font-black text-amber-200 disabled:opacity-50"
                >
                  {refreshing ? "Refreshing…" : "Refresh now"}
                </button>
              </div>
            </div>
            <div className="mt-2 text-right text-[10px] text-muted">
              {lastUpdated
                ? `Scores updated ${lastUpdated.toLocaleTimeString()}`
                : "Scores have not loaded yet"}
            </div>
            {error ? (
              <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-100">
                {error}
              </div>
            ) : null}
            <div className="mt-5 space-y-4">
              {(weekDoc?.matchups || []).map((pair, index) => {
                const id = pair.id || `w${week}-${index}`;
                const a = matchupByRoster.get(String(pair.teamA?.rosterId));
                const b = pair.teamB?.rosterId
                  ? matchupByRoster.get(String(pair.teamB.rosterId))
                  : null;
                const open = openId === id;
                return (
                  <article
                    key={id}
                    className="overflow-hidden rounded-3xl border border-amber-300/25 bg-gradient-to-br from-slate-900 to-slate-950 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? "" : id)}
                      className="grid w-full gap-4 p-5 text-left sm:grid-cols-[1fr_auto_1fr] sm:items-center"
                    >
                      <TeamScore
                        slot={pair.teamA}
                        matchup={a}
                        rosters={live.rosters}
                        users={live.users}
                        players={live.players}
                      />
                      <div className="mx-auto rounded-full border border-amber-300/35 bg-amber-300/10 px-4 py-2 text-center text-xs font-black uppercase tracking-widest text-amber-200">
                        {pair.teamB?.rosterId ? (pair.battleType === "war" ? "WAR · 2" : "ATTACKS · 1") : "No opponent"}
                      </div>
                      {pair.teamB?.rosterId ? (
                        <TeamScore
                          slot={pair.teamB}
                          matchup={b}
                          rosters={live.rosters}
                          users={live.users}
                          players={live.players}
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950 p-4 text-center text-sm text-slate-300">
                          Solo assignment / bye
                        </div>
                      )}
                    </button>
                    {open ? (
                      <div
                        className={`grid gap-px border-t border-subtle bg-subtle ${pair.teamB?.rosterId ? "lg:grid-cols-2" : ""}`}
                      >
                        <div className="bg-card-surface p-5">
                          <h3 className="font-bold">
                            {text(pair.teamA?.label) ||
                              teamName(
                                pair.teamA?.rosterId,
                                live.rosters,
                                live.users,
                              )}
                          </h3>
                          <div className="mt-3">
                            <PlayerRows matchup={a} players={live.players} />
                          </div>
                        </div>
                        {pair.teamB?.rosterId ? (
                          <div className="bg-card-surface p-5">
                            <h3 className="font-bold">
                              {text(pair.teamB?.label) ||
                                teamName(
                                  pair.teamB?.rosterId,
                                  live.rosters,
                                  live.users,
                                )}
                            </h3>
                            <div className="mt-3">
                              <PlayerRows matchup={b} players={live.players} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {doc && !(weekDoc?.matchups || []).length ? (
                <div className="rounded-3xl border border-dashed border-subtle p-8 text-center text-muted">
                  No custom matchups are posted for this week.
                </div>
              ) : null}
            </div>
          </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
