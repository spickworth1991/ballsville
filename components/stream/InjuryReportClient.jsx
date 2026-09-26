"use client";

import { useEffect, useMemo, useState } from "react";
import StreamGuard from "./StreamGuard";
import StreamHeader from "./StreamHeader";

const TEAM_COLORS = {
  ARI: "#e11d48", ATL: "#ef4444", BAL: "#a78bfa", BUF: "#38bdf8", CAR: "#60a5fa", CHI: "#f97316", CIN: "#fb923c", CLE: "#fb923c",
  DAL: "#93c5fd", DEN: "#fb923c", DET: "#60a5fa", GB: "#facc15", HOU: "#ef4444", IND: "#38bdf8", JAX: "#22d3ee", KC: "#ef4444",
  LAC: "#38bdf8", LAR: "#60a5fa", LV: "#e5e7eb", MIA: "#2dd4bf", MIN: "#a78bfa", NE: "#60a5fa", NO: "#facc15", NYG: "#60a5fa",
  NYJ: "#34d399", PHI: "#2dd4bf", PIT: "#facc15", SEA: "#38bdf8", SF: "#ef4444", TB: "#f87171", TEN: "#60a5fa", WAS: "#f87171",
};

function detailsFor(player) {
  const parts = [player.bodyPart, player.status, player.practiceDescription || player.practiceParticipation, player.notes].filter(Boolean);
  return [...new Set(parts.map((part) => String(part).trim()))].join(" · ") || "Status reported by Sleeper";
}

function newsUrl(player) {
  return `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(`${player.name} ${player.team} injury news`)}`;
}

function InjuryRow({ player }) {
  return (
    <a href={newsUrl(player)} target="_blank" rel="noreferrer" className="group grid grid-cols-[minmax(128px,.9fr)_52px_minmax(150px,1.4fr)] items-center border-t border-red-500/25 bg-black/20 transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-300/70">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <img src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(player.id)}.jpg`} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-full border border-red-300/20 bg-black object-cover object-top" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        <span className="truncate text-sm font-black text-white group-hover:text-red-100">{player.name}</span>
      </div>
      <div className="px-2 py-2 text-center text-xs font-black" style={{ color: TEAM_COLORS[player.team] || "#e5e7eb" }}>{player.team}</div>
      <div className="line-clamp-2 px-3 py-2 text-[11px] leading-tight text-slate-300">{detailsFor(player)}</div>
    </a>
  );
}

export default function InjuryReportClient() {
  const [doc, setDoc] = useState({ updatedAt: null, players: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");

  const load = async () => {
    const response = await fetch(`/api/stream/injuries?v=${Date.now()}`, { cache: "no-store" });
    if (response.status === 401) return location.replace("/stream?next=/stream/injuryreport");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load injuries.");
    setDoc({ updatedAt: data.updatedAt || null, players: Array.isArray(data.players) ? data.players : [] });
  };

  useEffect(() => { load().catch((error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);

  async function refresh() {
    setRefreshing(true); setMessage("");
    const response = await fetch("/api/stream/injuries", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setRefreshing(false);
    if (!response.ok) return setMessage(data.error || "Refresh failed.");
    setDoc(data); setMessage(`Updated ${data.players?.length || 0} injury records from Sleeper.`);
  }

  const teams = useMemo(() => [...new Set(doc.players.map((player) => player.team).filter(Boolean))].sort(), [doc.players]);
  const statuses = useMemo(() => [...new Set(doc.players.map((player) => player.status).filter(Boolean))].sort(), [doc.players]);
  const filtered = useMemo(() => doc.players.filter((player) => {
    const haystack = `${player.name} ${player.team} ${player.position} ${detailsFor(player)}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (team === "all" || player.team === team) && (status === "all" || player.status === status);
  }), [doc.players, query, team, status]);
  const midpoint = Math.ceil(filtered.length / 2);
  const columns = [filtered.slice(0, midpoint), filtered.slice(midpoint)];

  return (
    <StreamGuard>{() => (
      <main className="mx-auto min-h-screen max-w-[1500px] px-3 py-8 sm:px-6">
        <StreamHeader eyebrow="Ballsville Stream Room" title="Injury Report" description="Broadcast-ready NFL availability. Click any player row to open the latest news coverage." updatedAt={doc.updatedAt} onRefresh={refresh} refreshing={refreshing} />

        <section className="mb-4 grid gap-2 rounded-2xl border border-red-400/20 bg-[#100809]/90 p-3 sm:grid-cols-3">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player, team, injury…" className="rounded-xl border border-red-400/20 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-red-300/60" />
          <select value={team} onChange={(event) => setTeam(event.target.value)} className="rounded-xl border border-red-400/20 bg-[#12090a] px-4 py-3 text-sm text-white"><option value="all">All teams</option>{teams.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-red-400/20 bg-[#12090a] px-4 py-3 text-sm text-white"><option value="all">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        </section>
        {message ? <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs text-cyan-100">{message}</div> : null}

        <section className="relative overflow-hidden rounded-[1.6rem] border-2 border-red-500/70 bg-[#050303] p-2 shadow-[0_0_35px_rgba(239,68,68,.28),inset_0_0_28px_rgba(239,68,68,.10)] sm:p-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(239,68,68,.22),transparent_38%),linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:auto,100%_4px]" />
          <div className="relative mb-3 flex items-center justify-center gap-3 border-b border-red-500/40 py-4 sm:gap-6">
            <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-red-300 bg-red-500/15 text-3xl font-black text-white shadow-[0_0_18px_rgba(248,113,113,.65)] sm:h-16 sm:w-16 sm:text-4xl">+</div>
            <h2 className="text-3xl font-black uppercase tracking-[0.06em] text-white [text-shadow:0_0_12px_rgba(239,68,68,.9)] sm:text-6xl">Injury Report</h2>
          </div>
          {loading ? <div className="relative p-16 text-center text-sm text-slate-400">Loading injury board…</div> : filtered.length ? (
            <div className="relative grid gap-3 lg:grid-cols-2">
              {columns.map((column, index) => <div key={index} className="overflow-hidden rounded-xl border border-red-500/30"><div className="grid grid-cols-[minmax(128px,.9fr)_52px_minmax(150px,1.4fr)] bg-red-950/60 text-[9px] font-black uppercase tracking-[0.18em] text-red-100"><div className="px-3 py-2">Player</div><div className="px-2 py-2 text-center">Team</div><div className="px-3 py-2">Injury details</div></div>{column.map((player) => <InjuryRow key={player.id} player={player} />)}</div>)}
            </div>
          ) : <div className="relative p-16 text-center text-sm text-slate-400">No matching injuries. Use Update Data to publish the latest Sleeper report.</div>}
          <div className="relative mt-3 text-center text-[9px] font-bold uppercase tracking-[0.22em] text-red-300/60">{filtered.length} players · Select a row for news</div>
        </section>
      </main>
    )}</StreamGuard>
  );
}

