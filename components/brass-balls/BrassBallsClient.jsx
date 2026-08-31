"use client";

import { useEffect, useMemo, useState } from "react";
import LiteYouTube from "@/components/LiteYouTube";
import { adminR2Url } from "@/lib/r2Client";

const num = (value) => Number(value || 0);
const text = (value) => String(value || "").trim();
const avatar = (id) => id ? `https://sleepercdn.com/avatars/thumbs/${id}` : "";
const DEFAULT_MEDIA = {
  rules: "/photos/brass-balls/main-2026.png",
  board: "/photos/brass-balls/board-no-names-2026.png",
  assignments: "/photos/brass-balls/actual-board-2026.png",
};

function teamName(rosterId, rosters, users, fallback = "Team") {
  const roster = rosters.find((row) => String(row.roster_id) === String(rosterId));
  const user = users.find((row) => String(row.user_id) === String(roster?.owner_id));
  return text(user?.metadata?.team_name || user?.display_name || user?.username || fallback);
}

function TeamScore({ slot, matchup, rosters, users }) {
  const name = text(slot?.label) || teamName(slot?.rosterId, rosters, users);
  const roster = rosters.find((row) => String(row.roster_id) === String(slot?.rosterId));
  const user = users.find((row) => String(row.user_id) === String(roster?.owner_id));
  return (
    <div className="flex min-w-0 items-center gap-3">
      {user?.avatar ? <img src={avatar(user.avatar)} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-xs">BB</div>}
      <div className="min-w-0 flex-1"><div className="truncate font-semibold text-primary">{name}</div><div className="text-xs text-muted">Roster {slot?.rosterId || "—"}</div></div>
      <div className="text-2xl font-black text-primary">{matchup ? num(matchup.points).toFixed(2) : "—"}</div>
    </div>
  );
}

function PlayerRows({ matchup, players }) {
  const points = matchup?.players_points || {};
  const starters = new Set((matchup?.starters || []).map(String));
  return Object.entries(points).sort((a, b) => num(b[1]) - num(a[1])).map(([id, score]) => {
    const player = players[id] || {};
    const name = text(player.full_name || player.search_full_name) || `Player ${id}`;
    return <div key={id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-subtle py-2 text-sm last:border-0"><div className="min-w-0"><span className="font-medium text-primary">{name}</span><span className="ml-2 text-xs text-muted">{player.position || ""}{player.team ? ` · ${player.team}` : ""}{starters.has(id) ? " · Starter" : ""}</span></div><b className="text-primary">{num(score).toFixed(2)}</b></div>;
  });
}

export default function BrassBallsClient({ season }) {
  const [doc, setDoc] = useState(null);
  const [week, setWeek] = useState(1);
  const [live, setLive] = useState({ rosters: [], users: [], matchups: [], players: {} });
  const [openId, setOpenId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(adminR2Url(`data/brass-balls/season_${season}.json?v=${Date.now()}`), { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("The Brass Balls schedule has not been published yet.")))
      .then((data) => { setDoc(data); const weeks = data?.weeks || []; setWeek(num(data?.currentWeek) || num(weeks[0]?.week) || 1); })
      .catch((err) => setError(err.message));
  }, [season]);

  useEffect(() => {
    if (!doc?.leagueId || !week) return;
    const id = encodeURIComponent(doc.leagueId);
    Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${id}/rosters`).then((r) => r.json()),
      fetch(`https://api.sleeper.app/v1/league/${id}/users`).then((r) => r.json()),
      fetch(`https://api.sleeper.app/v1/league/${id}/matchups/${week}`).then((r) => r.json()),
      Object.keys(live.players || {}).length ? Promise.resolve(live.players) : fetch("https://api.sleeper.app/v1/players/nfl").then((r) => r.json()).catch(() => ({})),
    ]).then(([rosters, users, matchups, players]) => setLive({ rosters, users, matchups, players })).catch(() => setError("Live Sleeper scores could not be loaded."));
  }, [doc?.leagueId, week]); // player directory is reused after its first load

  const weekDoc = useMemo(() => (doc?.weeks || []).find((row) => num(row.week) === num(week)), [doc, week]);
  const matchupByRoster = useMemo(() => new Map((live.matchups || []).map((row) => [String(row.roster_id), row])), [live.matchups]);
  const rulesImage = text(doc?.heroImageUrl) || DEFAULT_MEDIA.rules;
  const mediaImage = text(doc?.secondaryImageUrl) || DEFAULT_MEDIA.board;
  const assignmentsImage = text(doc?.actualBoardImageUrl) || DEFAULT_MEDIA.assignments;

  return <main className="min-h-screen text-primary">
    <section className="section pt-24"><div className="container-site max-w-6xl">
      <div className="overflow-hidden rounded-[32px] border border-subtle bg-card-surface">
        <div className="p-6 sm:p-9"><div className="text-xs font-bold uppercase tracking-[.28em] text-accent">Experimental game mode</div><h1 className="mt-2 text-4xl font-black sm:text-6xl">{doc?.title || "The Brass Balls"}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-muted">{doc?.intro || "A test game mode built around custom weekly head-to-head assignments. Matchups do not have to follow the league’s standard schedule, and a team can stand alone in any week."}</p></div>
        <div className="border-t border-subtle bg-black"><img src={rulesImage} alt="Fantasy Football Territories rules" className="h-auto w-full object-contain" /></div>
      </div>

      <div className={`mt-6 grid gap-5 ${doc?.youtubeId ? "lg:grid-cols-2" : ""}`}><div className="overflow-hidden rounded-3xl border border-subtle bg-card-surface"><img src={mediaImage} alt="Fantasy Football Territories game board" className="h-auto w-full object-contain" /></div>{doc?.youtubeId ? <div className="overflow-hidden rounded-3xl border border-subtle bg-card-surface"><LiteYouTube id={doc.youtubeId} title="The Brass Balls" /></div> : null}</div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-subtle bg-card-surface"><div className="border-b border-subtle p-4"><div className="text-xs font-bold uppercase tracking-[.2em] text-accent">2026 board assignments</div></div><img src={assignmentsImage} alt="The Brass Balls 2026 North and South assignments" className="mx-auto h-auto w-full max-w-4xl object-contain" /></div>

      <section className="mt-10"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-bold uppercase tracking-[.2em] text-accent">Custom schedule</div><h2 className="mt-1 text-3xl font-black">Week {week} matchups</h2></div><select value={week} onChange={(event) => { setWeek(num(event.target.value)); setOpenId(""); }} className="rounded-xl border border-subtle bg-card-surface px-4 py-3 text-primary">{(doc?.weeks || []).sort((a,b)=>num(a.week)-num(b.week)).map((row) => <option key={row.week} value={row.week}>Week {row.week}{row.label ? ` · ${row.label}` : ""}</option>)}</select></div>
        {error ? <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-100">{error}</div> : null}
        <div className="mt-5 space-y-4">{(weekDoc?.matchups || []).map((pair, index) => {
          const id = pair.id || `w${week}-${index}`; const a = matchupByRoster.get(String(pair.teamA?.rosterId)); const b = pair.teamB?.rosterId ? matchupByRoster.get(String(pair.teamB.rosterId)) : null; const open = openId === id;
          return <article key={id} className="overflow-hidden rounded-3xl border border-subtle bg-card-surface"><button type="button" onClick={() => setOpenId(open ? "" : id)} className="grid w-full gap-4 p-5 text-left sm:grid-cols-[1fr_auto_1fr] sm:items-center"><TeamScore slot={pair.teamA} matchup={a} rosters={live.rosters} users={live.users} /><div className="text-center text-xs font-black uppercase tracking-widest text-muted">{pair.teamB?.rosterId ? "vs" : "No opponent"}</div>{pair.teamB?.rosterId ? <TeamScore slot={pair.teamB} matchup={b} rosters={live.rosters} users={live.users} /> : <div className="rounded-2xl border border-dashed border-subtle p-4 text-center text-sm text-muted">Solo assignment / bye</div>}</button>{open ? <div className={`grid gap-px border-t border-subtle bg-subtle ${pair.teamB?.rosterId ? "lg:grid-cols-2" : ""}`}><div className="bg-card-surface p-5"><h3 className="font-bold">{text(pair.teamA?.label) || teamName(pair.teamA?.rosterId, live.rosters, live.users)}</h3><div className="mt-3"><PlayerRows matchup={a} players={live.players} /></div></div>{pair.teamB?.rosterId ? <div className="bg-card-surface p-5"><h3 className="font-bold">{text(pair.teamB?.label) || teamName(pair.teamB?.rosterId, live.rosters, live.users)}</h3><div className="mt-3"><PlayerRows matchup={b} players={live.players} /></div></div> : null}</div> : null}</article>;
        })}{doc && !(weekDoc?.matchups || []).length ? <div className="rounded-3xl border border-dashed border-subtle p-8 text-center text-muted">No custom matchups are posted for this week.</div> : null}</div>
      </section>
    </div></section>
  </main>;
}
