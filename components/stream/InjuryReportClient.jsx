"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StreamGuard from "./StreamGuard";
import StreamHeader from "./StreamHeader";

const TEAM_COLORS = {
  ARI: "#e11d48", ATL: "#ef4444", BAL: "#a78bfa", BUF: "#38bdf8", CAR: "#60a5fa", CHI: "#f97316", CIN: "#fb923c", CLE: "#fb923c",
  DAL: "#93c5fd", DEN: "#fb923c", DET: "#60a5fa", GB: "#facc15", HOU: "#ef4444", IND: "#38bdf8", JAX: "#22d3ee", KC: "#ef4444",
  LAC: "#38bdf8", LAR: "#60a5fa", LV: "#e5e7eb", MIA: "#2dd4bf", MIN: "#a78bfa", NE: "#60a5fa", NO: "#facc15", NYG: "#60a5fa",
  NYJ: "#34d399", PHI: "#2dd4bf", PIT: "#facc15", SEA: "#38bdf8", SF: "#ef4444", TB: "#f87171", TEN: "#60a5fa", WAS: "#f87171",
};
const ESPN_TEAM = { WAS: "wsh" };
const STATUS_SEVERITY = { IR: 0, OUT: 1, PUP: 2, DOUBTFUL: 3, QUESTIONABLE: 4 };

function teamLogoUrl(team) {
  const key = ESPN_TEAM[team] || String(team || "").toLowerCase();
  return team && team !== "FA" ? `https://a.espncdn.com/i/teamlogos/nfl/500/${key}.png` : "";
}

function TeamLogo({ team, size = "h-7 w-7" }) {
  const url = teamLogoUrl(team);
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-[8px] font-black text-white/50 ${size}`}>
      {team === "FA" ? "FA" : team?.slice(0, 1)}
      {url ? <img src={url} alt={`${team} logo`} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-0.5" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
    </span>
  );
}

function statusTone(status) {
  const value = String(status || "").toUpperCase();
  if (["IR", "OUT", "PUP"].includes(value)) return "border-red-400/35 bg-red-500/15 text-red-100";
  if (value === "DOUBTFUL") return "border-orange-300/35 bg-orange-400/15 text-orange-100";
  if (value === "QUESTIONABLE") return "border-amber-300/35 bg-amber-300/15 text-amber-100";
  return "border-slate-300/20 bg-white/[0.06] text-slate-200";
}

function detailsFor(player) {
  const parts = [player.bodyPart, player.status, player.practiceDescription || player.practiceParticipation, player.notes].filter(Boolean);
  return [...new Set(parts.map((part) => String(part).trim()))].join(" · ") || "Availability status saved from the latest update";
}

const INJURY_RECENCY_OPTIONS = ["Updated today", "Updated 1–2 days ago", "Updated 3–7 days ago", "Updated 8–14 days ago", "Updated 15–30 days ago", "Updated 31+ days ago", "Update date unavailable"];

function injuryUpdateTimestamp(player) {
  const value = String(player.injuryUpdatedAt || "").trim();
  if (!value) return null;
  const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function injuryRecencyLabel(player, now = Date.now()) {
  const timestamp = injuryUpdateTimestamp(player);
  if (timestamp == null) return "Update date unavailable";
  const today = new Date(now);
  const currentDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const updated = new Date(timestamp);
  const updateDay = Date.UTC(updated.getUTCFullYear(), updated.getUTCMonth(), updated.getUTCDate());
  const days = Math.max(0, Math.floor((currentDay - updateDay) / 86400000));
  if (days === 0) return "Updated today";
  if (days <= 2) return "Updated 1–2 days ago";
  if (days <= 7) return "Updated 3–7 days ago";
  if (days <= 14) return "Updated 8–14 days ago";
  if (days <= 30) return "Updated 15–30 days ago";
  return "Updated 31+ days ago";
}

function googleNewsUrl(player) {
  return `https://news.google.com/search?q=${encodeURIComponent(`${player.name} ${player.team === "FA" ? "NFL" : player.team} injury`)}`;
}

function newsDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString();
}

function playingChance(value) {
  if (value == null || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${Math.round(number <= 1 ? number * 100 : number)}% chance of playing`;
}

function MultiSelect({ label, options, excluded, setExcluded, renderIcon, align = "left" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedCount = options.length - excluded.size;
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  function toggle(value) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${open ? "border-red-300/55 bg-red-500/10 shadow-[0_0_18px_rgba(239,68,68,.12)]" : "border-red-400/20 bg-black/30 hover:border-red-300/35"}`}>
        <span className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-[0.2em] text-red-200/55">{label}</span><span className="block truncate text-sm font-bold text-white">{selectedCount === options.length ? `All ${label.toLowerCase()}` : `${selectedCount} of ${options.length} selected`}</span></span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 shrink-0 fill-current text-red-200/60 transition ${open ? "rotate-180" : ""}`}><path d="m5.3 7.5 4.7 4.7 4.7-4.7 1.1 1.1-5.8 5.8-5.8-5.8 1.1-1.1Z" /></svg>
      </button>
      {open ? (
        <div className={`absolute top-[calc(100%+.55rem)] z-50 w-[min(92vw,27rem)] overflow-hidden rounded-2xl border border-red-300/25 bg-[#120809]/[.98] shadow-[0_24px_70px_rgba(0,0,0,.7),0_0_35px_rgba(239,68,68,.14)] backdrop-blur-xl ${align === "right" ? "right-0" : "left-0"}`}>
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-100/60">Choose multiple</span><div className="flex gap-1"><button type="button" onClick={() => setExcluded(new Set())} className="rounded-lg px-2 py-1 text-[10px] font-bold text-red-100 hover:bg-white/[0.06]">All</button><button type="button" onClick={() => setExcluded(new Set(options))} className="rounded-lg px-2 py-1 text-[10px] font-bold text-red-100 hover:bg-white/[0.06]">None</button></div></div>
          <div className={`max-h-80 overflow-y-auto p-2 ${renderIcon ? "grid grid-cols-2 gap-1" : "space-y-1"}`}>
            {options.map((option) => {
              const selected = !excluded.has(option);
              return <button key={option} type="button" onClick={() => toggle(option)} className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${selected ? "border-red-300/20 bg-red-400/[0.09] text-white" : "border-transparent bg-black/15 text-white/35 hover:text-white/65"}`}>{renderIcon ? renderIcon(option) : <span className={`h-2.5 w-2.5 rounded-full ${statusTone(option).split(" ").slice(1).join(" ")}`} />}<span className="min-w-0 flex-1 truncate text-xs font-bold">{option}</span><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${selected ? "border-red-300 bg-red-500 text-white" : "border-white/15"}`}>{selected ? "✓" : ""}</span></button>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InjuryRow({ player, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(player)} className="group grid w-full grid-cols-[minmax(128px,.9fr)_58px_minmax(150px,1.4fr)] items-center border-t border-red-500/25 bg-black/20 text-left transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-300/70">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <img src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(player.id)}.jpg`} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-full border border-red-300/20 bg-black object-cover object-top" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        <span className="min-w-0"><span className="block truncate text-sm font-black text-white group-hover:text-red-100">{player.name}</span><span className="block truncate text-[9px] font-bold uppercase tracking-wide text-red-200/45">{player.position}{player.bodyPartSource ? ` · ${player.bodyPartSource}` : ""}</span></span>
      </div>
      <div className="flex flex-col items-center gap-1 px-1 py-2"><TeamLogo team={player.team} size="h-7 w-7" /><span className="text-[9px] font-black" style={{ color: TEAM_COLORS[player.team] || "#e5e7eb" }}>{player.team}</span></div>
      <div className="px-3 py-2"><div className="mb-1 flex flex-wrap items-center justify-between gap-1"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${statusTone(player.status)}`}>{player.status || "Update"}</span>{player.injuryUpdatedAt ? <span className="text-[8px] font-bold uppercase tracking-wide text-red-100/45">Updated {newsDate(player.injuryUpdatedAt)}</span> : null}</div><div className="line-clamp-2 text-[11px] leading-tight text-slate-300">{detailsFor(player)}</div></div>
    </button>
  );
}

function PlayerNewsModal({ player, onClose }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape); };
  }, [onClose]);
  if (!player) return null;
  const articles = Array.isArray(player.news) ? player.news : [];
  return (
    <div role="dialog" aria-modal="true" aria-label={`${player.name} injury news`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
      <section className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.8rem] border border-red-300/30 bg-[#090607] shadow-[0_35px_100px_rgba(0,0,0,.85),0_0_45px_rgba(239,68,68,.2)]">
        <div className="border-b border-red-400/20 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.2),transparent_45%)] p-5 sm:p-6">
          <button type="button" onClick={onClose} aria-label="Close player news" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/30 text-xl text-white/60 transition hover:border-red-300/40 hover:text-white">×</button>
          <div className="flex items-center gap-3 pr-10"><img src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(player.id)}.jpg`} alt="" className="h-14 w-14 rounded-full border border-red-200/25 bg-black object-cover object-top" onError={(event) => { event.currentTarget.style.display = "none"; }} /><div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/55">Player injury briefing</div><h2 className="truncate text-2xl font-black text-white sm:text-3xl">{player.name}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50"><TeamLogo team={player.team} size="h-5 w-5" /><span>{player.team} · {player.position}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${statusTone(player.status)}`}>{player.status || "Unknown"}</span></div></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-white/8 bg-black/20 p-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Injury</span><strong className="mt-1 block text-sm text-white/80">{player.bodyPart || "Not specified"}</strong><span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-white/30">{player.bodyPartSource || "Source unavailable"}</span></div><div className="rounded-xl border border-white/8 bg-black/20 p-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Reported injury start</span><strong className="mt-1 block text-sm text-white/80">{player.injuryStartDate || "Not supplied"}</strong><span className="mt-1 block text-[9px] text-white/30">Sleeper field; never estimated</span></div><div className="rounded-xl border border-white/8 bg-black/20 p-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Last injury update</span><strong className="mt-1 block text-sm text-white/80">{player.injuryUpdatedAt || "Not provided"}</strong><span className="mt-1 block text-[9px] text-white/30">FantasyPros report update</span></div></div>
          {player.notes ? <p className="mt-3 text-sm leading-6 text-slate-300">{player.notes}</p> : null}
          {player.practice?.length || playingChance(player.probabilityOfPlaying) ? <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">{player.practice?.length ? <span className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">Practice: {player.practice.join(" / ")}</span> : null}{playingChance(player.probabilityOfPlaying) ? <span className="rounded-lg border border-emerald-300/15 bg-emerald-400/[0.07] px-2.5 py-1.5 text-emerald-100/65">{playingChance(player.probabilityOfPlaying)}</span> : null}</div> : null}
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200/55">Saved FantasyPros news</div><h3 className="mt-1 text-lg font-black text-white">Latest player updates</h3></div><a href={googleNewsUrl(player)} target="_blank" rel="noreferrer" className="rounded-xl border border-blue-300/20 bg-blue-400/10 px-3 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-400/15">Search Google News ↗</a></div>
          {articles.length ? <div className="space-y-3">{articles.map((article, index) => <a key={article.id || `${article.link}-${index}`} href={article.link} target="_blank" rel="noreferrer" className="block rounded-2xl border border-red-300/12 bg-white/[0.025] p-4 transition hover:border-red-300/25 hover:bg-red-400/[0.06]"><div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-wider"><span className="text-red-200/55">{article.category || "FantasyPros"}</span><span className="text-white/25">{newsDate(article.published)}</span></div><h4 className="mt-2 text-sm font-black leading-5 text-white/90">{article.title}</h4>{article.summary ? <p className="mt-2 text-xs leading-5 text-white/50">{article.summary}</p> : null}<div className="mt-2 text-[10px] font-bold text-red-100/45">FantasyPros · Read full update ↗</div></a>)}</div> : <div className="rounded-2xl border border-blue-300/15 bg-blue-400/[0.06] p-5"><h4 className="font-black text-white">No saved FantasyPros update for this player</h4><p className="mt-2 text-xs leading-5 text-white/50">The last manual data update did not return player-specific FantasyPros news. Use the Google News search above for current coverage; this popup remains your player briefing.</p></div>}
        </div>
      </section>
    </div>
  );
}

export default function InjuryReportClient() {
  const [doc, setDoc] = useState({ updatedAt: null, players: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [excludedTeams, setExcludedTeams] = useState(new Set());
  const [excludedStatuses, setExcludedStatuses] = useState(new Set());
  const [excludedRecencies, setExcludedRecencies] = useState(new Set());
  const [includeFreeAgents, setIncludeFreeAgents] = useState(true);
  const [sortOrder, setSortOrder] = useState("report");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const load = async () => {
    const response = await fetch(`/api/stream/injuries?v=${Date.now()}`, { cache: "no-store" });
    if (response.status === 401) return location.replace("/stream?next=/stream/injuryreport");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load injuries.");
    setDoc({ ...data, updatedAt: data.updatedAt || null, players: Array.isArray(data.players) ? data.players : [] });
  };

  useEffect(() => { load().catch((error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);

  async function refresh() {
    setRefreshing(true); setMessage("");
    const response = await fetch("/api/stream/injuries", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setRefreshing(false);
    if (!response.ok) return setMessage(data.error || "Refresh failed.");
    setDoc(data);
    const warnings = [data.fantasyProsError ? `FantasyPros: ${data.fantasyProsError}` : "", data.playerValueError ? `Player values: ${data.playerValueError}` : ""].filter(Boolean);
    setMessage(warnings.length ? `Saved ${data.players?.length || 0} injury records with warnings: ${warnings.join(" · ")}` : `Saved ${data.players?.length || 0} combined injury records, ${data.fantasyProsNewsCount || 0} FantasyPros news updates, and dynasty/redraft player values to R2.`);
  }

  const teams = useMemo(() => [...new Set(doc.players.map((player) => player.team).filter((team) => team && team !== "FA"))].sort(), [doc.players]);
  const statuses = useMemo(() => [...new Set(doc.players.map((player) => player.status).filter(Boolean))].sort(), [doc.players]);
  const injuryRecencies = useMemo(() => {
    const available = new Set(doc.players.map((player) => injuryRecencyLabel(player)));
    return INJURY_RECENCY_OPTIONS.filter((option) => available.has(option));
  }, [doc.players]);
  const freeAgentCount = useMemo(() => doc.players.filter((player) => player.team === "FA").length, [doc.players]);
  const filtered = useMemo(() => {
    const rows = doc.players.filter((player) => {
      const haystack = `${player.name} ${player.team} ${player.position} ${detailsFor(player)}`.toLowerCase();
      return (!query || haystack.includes(query.toLowerCase()))
        && !excludedTeams.has(player.team)
        && !excludedStatuses.has(player.status)
        && !excludedRecencies.has(injuryRecencyLabel(player))
        && (includeFreeAgents || player.team !== "FA");
    });
    if (sortOrder === "report") return rows;
    return [...rows].sort((a, b) => {
      if (sortOrder === "update-desc" || sortOrder === "update-asc") {
        const aTime = injuryUpdateTimestamp(a);
        const bTime = injuryUpdateTimestamp(b);
        if (aTime == null && bTime != null) return 1;
        if (aTime != null && bTime == null) return -1;
        if (aTime !== bTime) return sortOrder === "update-desc" ? bTime - aTime : aTime - bTime;
      }
      if (sortOrder === "dynasty-value" || sortOrder === "redraft-value") {
        const field = sortOrder === "dynasty-value" ? "dynastyValue" : "redraftValue";
        const aValue = Number(a[field]);
        const bValue = Number(b[field]);
        const aHasValue = a[field] != null && Number.isFinite(aValue);
        const bHasValue = b[field] != null && Number.isFinite(bValue);
        if (!aHasValue && bHasValue) return 1;
        if (aHasValue && !bHasValue) return -1;
        if (aValue !== bValue) return bValue - aValue;
      }
      if (sortOrder === "name") return a.name.localeCompare(b.name);
      if (sortOrder === "team") return a.team.localeCompare(b.team) || a.name.localeCompare(b.name);
      return (STATUS_SEVERITY[String(a.status).toUpperCase()] ?? 20) - (STATUS_SEVERITY[String(b.status).toUpperCase()] ?? 20) || a.name.localeCompare(b.name);
    });
  }, [doc.players, query, excludedTeams, excludedStatuses, excludedRecencies, includeFreeAgents, sortOrder]);
  const midpoint = Math.ceil(filtered.length / 2);
  const columns = [filtered.slice(0, midpoint), filtered.slice(midpoint)];
  const activeFilters = excludedTeams.size + excludedStatuses.size + excludedRecencies.size + (includeFreeAgents ? 0 : 1);

  function resetFilters() {
    setExcludedTeams(new Set()); setExcludedStatuses(new Set()); setExcludedRecencies(new Set()); setIncludeFreeAgents(true); setQuery(""); setSortOrder("report");
  }

  return (
    <StreamGuard>{() => (
      <main className="mx-auto min-h-screen max-w-[1500px] px-3 py-8 sm:px-6">
        <StreamHeader eyebrow="Ballsville Stream Room" title="Injury Report" description="Saved Sleeper availability, FantasyPros injury context, and player news. Data changes only when Update Data is selected." updatedAt={doc.updatedAt} onRefresh={refresh} refreshing={refreshing} />

        <section className="relative z-30 mb-4 rounded-2xl border border-red-400/20 bg-[#100809]/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player, team, injury…" className="rounded-xl border border-red-400/20 bg-black/35 px-4 py-3 text-sm text-white outline-none transition focus:border-red-300/60 focus:ring-2 focus:ring-red-400/10" />
            <MultiSelect label="Teams" options={teams} excluded={excludedTeams} setExcluded={setExcludedTeams} renderIcon={(team) => <TeamLogo team={team} size="h-7 w-7" />} />
            <MultiSelect label="Statuses" options={statuses} excluded={excludedStatuses} setExcluded={setExcludedStatuses} />
            <MultiSelect label="Injury recency" options={injuryRecencies} excluded={excludedRecencies} setExcluded={setExcludedRecencies} />
            <label className="relative flex min-w-0 items-center rounded-xl border border-red-400/20 bg-black/30 px-3 py-2.5 transition focus-within:border-red-300/55 focus-within:bg-red-500/10">
              <span className="min-w-0 flex-1"><span className="block text-[9px] font-black uppercase tracking-[0.2em] text-red-200/55">Sort report</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent pr-6 text-sm font-bold text-white outline-none"><option value="report" className="bg-[#120809]">Injury severity</option><option value="update-desc" className="bg-[#120809]">Newest injury updates</option><option value="update-asc" className="bg-[#120809]">Oldest injury updates</option><option value="dynasty-value" className="bg-[#120809]">Highest dynasty value</option><option value="redraft-value" className="bg-[#120809]">Highest redraft value</option><option value="name" className="bg-[#120809]">Player name</option><option value="team" className="bg-[#120809]">NFL team</option></select></span>
              <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none h-4 w-4 shrink-0 fill-current text-red-200/60"><path d="m5.3 7.5 4.7 4.7 4.7-4.7 1.1 1.1-5.8 5.8-5.8-5.8 1.1-1.1Z" /></svg>
            </label>
            <button type="button" onClick={() => setIncludeFreeAgents((value) => !value)} className={`flex min-w-[154px] items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${includeFreeAgents ? "border-red-300/25 bg-red-500/10" : "border-white/10 bg-black/25 opacity-70"}`}><span><span className="block text-[9px] font-black uppercase tracking-[0.2em] text-red-200/55">Free agents</span><span className="block text-sm font-bold text-white">{includeFreeAgents ? "Shown" : "Hidden"} · {freeAgentCount}</span></span><span className={`relative h-6 w-11 rounded-full transition ${includeFreeAgents ? "bg-red-500" : "bg-white/10"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${includeFreeAgents ? "left-6" : "left-1"}`} /></span></button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1"><p className="max-w-5xl text-[10px] text-white/35">Injury recency uses FantasyPros’ last update date. A true start date is shown only when Sleeper supplies one. Value sorting uses dynasty or redraft Superflex values saved during Update Data; nothing is estimated or fetched while viewing.</p>{activeFilters || query || sortOrder !== "report" ? <button type="button" onClick={resetFilters} className="text-[10px] font-black uppercase tracking-wider text-red-200/65 hover:text-red-100">Reset filters</button> : null}</div>
        </section>
        {message ? <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs text-cyan-100">{message}</div> : null}

        <section className="relative overflow-hidden rounded-[1.6rem] border-2 border-red-500/70 bg-[#050303] p-2 shadow-[0_0_35px_rgba(239,68,68,.28),inset_0_0_28px_rgba(239,68,68,.10)] sm:p-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(239,68,68,.22),transparent_38%),linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:auto,100%_4px]" />
          <div className="relative mb-3 flex items-center justify-center gap-3 border-b border-red-500/40 py-4 sm:gap-6"><div className="grid h-12 w-12 place-items-center rounded-full border-2 border-red-300 bg-red-500/15 text-3xl font-black text-white shadow-[0_0_18px_rgba(248,113,113,.65)] sm:h-16 sm:w-16 sm:text-4xl">+</div><div><h2 className="text-3xl font-black uppercase tracking-[0.06em] text-white [text-shadow:0_0_12px_rgba(239,68,68,.9)] sm:text-6xl">Injury Report</h2><p className="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-red-200/45">{doc.source || "Saved snapshot"}{doc.week ? ` · Week ${doc.week}` : ""}</p></div></div>
          {loading ? <div className="relative p-16 text-center text-sm text-slate-400">Loading saved injury board…</div> : filtered.length ? <div className="relative grid gap-3 lg:grid-cols-2">{columns.map((column, index) => <div key={index} className="overflow-hidden rounded-xl border border-red-500/30"><div className="grid grid-cols-[minmax(128px,.9fr)_58px_minmax(150px,1.4fr)] bg-red-950/60 text-[9px] font-black uppercase tracking-[0.18em] text-red-100"><div className="px-3 py-2">Player</div><div className="px-2 py-2 text-center">Team</div><div className="px-3 py-2">Injury details</div></div>{column.map((player) => <InjuryRow key={player.id} player={player} onOpen={setSelectedPlayer} />)}</div>)}</div> : <div className="relative p-16 text-center text-sm text-slate-400">No players match the current filters.</div>}
          <div className="relative mt-3 text-center text-[9px] font-bold uppercase tracking-[0.22em] text-red-300/60">{filtered.length} of {doc.players.length} players · Select a row for saved news</div>
        </section>
        {selectedPlayer ? <PlayerNewsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} /> : null}
      </main>
    )}</StreamGuard>
  );
}
