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
const RISK_ORDER = { Unavailable: 0, "High risk": 1, "Elevated risk": 2, Monitoring: 3 };
const PLAY_PROBABILITY_OPTIONS = ["0–24%", "25–49%", "50–74%", "75–99%", "100%", "No estimate"];

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
  if (value === "REMOVED") return "border-emerald-300/35 bg-emerald-400/15 text-emerald-100";
  if (["IR", "OUT", "PUP"].includes(value)) return "border-red-400/35 bg-red-500/15 text-red-100";
  if (value === "DOUBTFUL") return "border-orange-300/35 bg-orange-400/15 text-orange-100";
  if (value === "QUESTIONABLE") return "border-amber-300/35 bg-amber-300/15 text-amber-100";
  return "border-slate-300/20 bg-white/[0.06] text-slate-200";
}

function detailsFor(player) {
  const parts = [player.bodyPart, player.status, player.practiceDescription || player.practiceParticipation, player.notes].filter(Boolean);
  return [...new Set(parts.map((part) => String(part).trim()))].join(" · ") || "Availability status saved from the latest update";
}

function playingProbability(player) {
  const number = Number(player?.probabilityOfPlaying);
  if (player?.probabilityOfPlaying == null || player?.probabilityOfPlaying === "" || !Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}

function probabilityBucket(player) {
  const probability = playingProbability(player);
  if (probability == null) return "No estimate";
  if (probability < 25) return "0–24%";
  if (probability < 50) return "25–49%";
  if (probability < 75) return "50–74%";
  if (probability < 100) return "75–99%";
  return "100%";
}

function availabilityRisk(player) {
  const status = String(player?.status || "").toUpperCase();
  if (["IR", "OUT", "PUP", "NFI", "SUSPENDED", "COV-IR"].includes(status)) return "Unavailable";
  if (status === "DOUBTFUL") return "High risk";
  if (status === "QUESTIONABLE") return "Elevated risk";
  const latestPractice = [...(Array.isArray(player?.practice) ? player.practice : []), player?.practiceParticipation, player?.practiceDescription].filter(Boolean).at(-1);
  if (/DNP|DID NOT PARTICIPATE/i.test(String(latestPractice || ""))) return "High risk";
  if (/LIMIT/i.test(String(latestPractice || ""))) return "Elevated risk";
  return "Monitoring";
}

function trackedDays(player) {
  const start = Date.parse(player.trackedSince || "");
  const end = Date.parse(player.removedAt || "") || Date.now();
  return Number.isFinite(start) ? Math.max(0, Math.floor((end - start) / 86400000)) : null;
}

function trackingSummary(player) {
  const days = trackedDays(player);
  if (days == null) return "Tracking unavailable";
  if (player.reportState === "added") return "Added this update";
  return player.reportState === "removed" ? `Tracked ${days} day${days === 1 ? "" : "s"} before removal` : `Tracked ${days} day${days === 1 ? "" : "s"}`;
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
  const probability = playingProbability({ probabilityOfPlaying: value });
  return probability == null ? "" : `${Math.round(probability)}% chance of playing`;
}

function InfoTip({ text, label = "More information" }) {
  return <span tabIndex={0} aria-label={label} className="group/tip relative ml-1 inline-grid h-4 w-4 cursor-help place-items-center rounded-full border border-white/15 bg-white/[0.04] text-[9px] font-black normal-case tracking-normal text-white/45 outline-none focus:border-red-200/40"><span aria-hidden="true">?</span><span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+.45rem)] left-1/2 z-[80] w-64 -translate-x-1/2 rounded-xl border border-red-200/20 bg-[#090607]/[.98] p-3 text-left text-[10px] font-medium normal-case leading-4 tracking-normal text-white/70 opacity-0 shadow-2xl transition group-hover/tip:opacity-100 group-focus/tip:opacity-100">{text}</span></span>;
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function changeText(player) {
  const change = Array.isArray(player.changes) ? player.changes[0] : null;
  if (!change) return player.reportState === "removed" ? "No longer listed by the saved sources" : detailsFor(player);
  const format = (value) => change.field === "probability" && value != null ? `${Math.round(Number(value))}%` : value || "Not listed";
  return `${change.label}: ${format(change.from)} → ${format(change.to)}`;
}

function BriefingCard({ player, valueLens, onOpen }) {
  const value = player?.[`${valueLens}Value`];
  return (
    <button type="button" onClick={() => onOpen(player)} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-red-300/15 bg-black/25 p-3 text-left transition hover:border-red-300/35 hover:bg-red-500/[0.08] focus:outline-none focus:ring-2 focus:ring-red-300/60">
      <img src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(player.id)}.jpg`} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-full border border-red-200/20 bg-black object-cover object-top" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-sm text-white group-hover:text-red-100">{player.name}</strong><span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase ${statusTone(player.reportState === "removed" ? "removed" : player.status)}`}>{player.reportState === "removed" ? "Removed" : player.status || "Update"}</span></span><span className="mt-1 block truncate text-[10px] text-white/45">{changeText(player)}</span><span className="mt-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-red-200/45"><TeamLogo team={player.team} size="h-4 w-4" />{player.team} · {player.position} · {value == null ? `No ${valueLens} value` : `${valueLens} ${Number(value).toFixed(0)}`}</span></span>
    </button>
  );
}

function BriefingGroup({ title, description, players, valueLens, onOpen }) {
  if (!players.length) return null;
  return <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-3"><div className="mb-2"><h3 className="text-xs font-black uppercase tracking-[0.16em] text-red-100">{title}</h3><p className="mt-0.5 text-[9px] text-white/35">{description}</p></div><div className="grid gap-2 sm:grid-cols-2">{players.slice(0, 6).map((player) => <BriefingCard key={`${title}-${player.id}`} player={player} valueLens={valueLens} onOpen={onOpen} />)}</div></section>;
}

function HistoryBreakdown({ summary }) {
  const groups = [["Injury or body area", summary.byBodyPart], ["Position", summary.byPosition], ["Initial designation", summary.byInitialStatus]];
  if (!summary.completedEpisodes) return null;
  return <details className="relative mt-3 rounded-2xl border border-white/8 bg-black/20"><summary className="cursor-pointer list-none px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-red-100/65">Historical breakdown <span className="ml-1 text-white/30">▾</span></summary><div className="grid gap-3 border-t border-white/8 p-3 lg:grid-cols-3">{groups.map(([label, values]) => <section key={label}><h4 className="mb-2 text-[9px] font-black uppercase tracking-wider text-white/35">{label}</h4><div className="space-y-1">{Object.entries(values || {}).sort((a, b) => Number(b[1].sampleSize) - Number(a[1].sampleSize)).slice(0, 8).map(([name, value]) => <div key={name} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 text-[10px]"><span className="truncate font-bold text-white/65">{name}</span><span className="shrink-0 tabular-nums text-white/35">median {value.medianObservedDays ?? "—"}d · n={value.sampleSize}</span></div>)}</div></section>)}{summary.calibration?.available ? <section className="lg:col-span-3"><h4 className="mb-2 text-[9px] font-black uppercase tracking-wider text-white/35">Chance-to-play calibration</h4><div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-5">{summary.calibration.bands.map((band) => <div key={band.label} className="rounded-lg bg-white/[0.03] px-2.5 py-2 text-[10px]"><strong className="text-white/65">{band.label}</strong><span className="mt-1 block text-white/35">Actual played {band.actualPlayedRate ?? "—"}% · n={band.sampleSize}</span></div>)}</div></section> : null}</div></details>;
}

function StreamBriefing({ doc, valueLens, setValueLens, onOpen }) {
  const current = Array.isArray(doc.players) ? doc.players : [];
  const removed = Array.isArray(doc.recentlyRemoved) ? doc.recentlyRemoved : [];
  const all = new Map([...current, ...removed].map((player) => [String(player.id), player]));
  const valueField = `${valueLens}Value`;
  const byValue = (a, b) => Number(b?.[valueField] || 0) - Number(a?.[valueField] || 0);
  const ids = (name, fallback) => (Array.isArray(doc.briefing?.[name]) ? doc.briefing[name].map((id) => all.get(String(id))).filter(Boolean) : fallback).sort(byValue);
  const groups = [
    ["New and changed", "The strongest talking points since the previous successful snapshot.", ids("newOrChanged", current.filter((player) => ["added", "reappeared"].includes(player.reportState) || player.changes?.length))],
    ["Biggest names at risk", `Current availability concerns ranked with ${valueLens} value.`, ids("biggestRisk", current.filter((player) => availabilityRisk(player) !== "Monitoring"))],
    ["Worsening outlooks", "Practice, status, or chance-to-play movement in the wrong direction.", ids("worsening", current.filter((player) => player.trend === "worsening"))],
    ["Improving outlooks", "Players whose latest saved signal improved.", ids("improving", current.filter((player) => player.trend === "improving"))],
    ["Recently removed", "No longer listed by the sources; this does not prove medical clearance.", ids("removed", removed)],
    ["Longest tracked", "Longest Ballsville-observed report durations, not medical injury age.", ids("longest", [...current].sort((a, b) => Date.parse(a.trackedSince || 0) - Date.parse(b.trackedSince || 0)))],
    ["Source conflicts", "Sleeper and FantasyPros currently describe the injury differently.", ids("conflicts", current.filter((player) => player.sourceConflict))],
  ];
  const summary = doc.injuryHistorySummary || {};
  return (
    <section className="relative mb-5 overflow-hidden rounded-[1.6rem] border border-red-300/20 bg-[#100809]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,.35)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.15),transparent_42%)]" />
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center text-[9px] font-black uppercase tracking-[0.24em] text-red-200/50">On-air view <InfoTip text="Built only from the latest saved R2 snapshot. Opening this page does not call Sleeper or FantasyPros." label="About the stream briefing" /></div><h2 className="mt-1 text-2xl font-black text-white">Stream Briefing</h2><p className="mt-1 text-xs text-white/40">The clearest injury talking points, ready to open on stream.</p></div><div className="rounded-xl border border-white/10 bg-black/30 p-1"><div className="px-2 pb-1 text-[8px] font-black uppercase tracking-wider text-white/35">Player value lens</div><div className="grid grid-cols-2 gap-1">{["redraft", "dynasty"].map((lens) => <button key={lens} type="button" onClick={() => setValueLens(lens)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase transition ${valueLens === lens ? "bg-red-500/25 text-red-50" : "text-white/35 hover:bg-white/[0.05]"}`}>{lens}</button>)}</div></div></div>
      <div className="relative grid gap-3 xl:grid-cols-2">{groups.map(([title, description, players]) => <BriefingGroup key={title} title={title} description={description} players={players} valueLens={valueLens} onOpen={onOpen} />)}</div>
      <div className="relative mt-3 grid gap-2 rounded-2xl border border-white/8 bg-black/25 p-3 sm:grid-cols-2 xl:grid-cols-4"><div><span className="flex text-[8px] font-black uppercase tracking-wider text-white/35">Completed episodes <InfoTip text="An episode ends when a successful snapshot no longer finds the player. Removal means no longer listed, not confirmed healthy." /></span><strong className="mt-1 block text-lg text-white">{summary.completedEpisodes || 0}</strong></div><div><span className="text-[8px] font-black uppercase tracking-wider text-white/35">Median observed duration</span><strong className="mt-1 block text-lg text-white">{summary.medianObservedDays == null ? "Not available" : `${summary.medianObservedDays} days`}</strong></div><div><span className="text-[8px] font-black uppercase tracking-wider text-white/35">Average observed duration</span><strong className="mt-1 block text-lg text-white">{summary.averageObservedDays == null ? "Not available" : `${summary.averageObservedDays} days`}</strong>{summary.earlySample ? <span className="text-[9px] font-bold text-amber-200/65">Early sample · fewer than 10 episodes</span> : null}</div><div><span className="flex text-[8px] font-black uppercase tracking-wider text-white/35">Probability calibration <InfoTip text="Ballsville compares saved FantasyPros estimates with later Sleeper game-participation data. The raw FantasyPros percentage is never changed. Calibration appears after 30 settled predictions." /></span><strong className="mt-1 block text-lg text-white">{summary.calibration?.available ? `Brier ${summary.calibration.brierScore}` : `${summary.calibration?.settledPredictions || 0} / 30 settled`}</strong><span className="text-[9px] text-white/30">Raw FantasyPros estimates remain visible</span></div></div>
      <HistoryBreakdown summary={summary} />
    </section>
  );
}

function MultiSelect({ label, help, options, excluded, setExcluded, renderIcon, align = "left" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedCount = options.filter((option) => !excluded.has(option)).length;
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
        <span className="min-w-0"><span className="flex items-center text-[9px] font-black uppercase tracking-[0.2em] text-red-200/55">{label}{help ? <InfoTip text={help} label={`About ${label}`} /> : null}</span><span className="block truncate text-sm font-bold text-white">{selectedCount === options.length ? `All ${label.toLowerCase()}` : `${selectedCount} of ${options.length} selected`}</span></span>
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
  const removed = player.reportState === "removed";
  return (
    <button type="button" onClick={() => onOpen(player)} className="group grid w-full grid-cols-[minmax(128px,.9fr)_58px_minmax(150px,1.4fr)] items-center border-t border-red-500/25 bg-black/20 text-left transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-300/70">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <img src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(player.id)}.jpg`} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-full border border-red-300/20 bg-black object-cover object-top" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        <span className="min-w-0"><span className="block truncate text-sm font-black text-white group-hover:text-red-100">{player.name}</span><span className="block truncate text-[9px] font-bold uppercase tracking-wide text-red-200/45">{player.position} · {trackingSummary(player)}</span></span>
      </div>
      <div className="flex flex-col items-center gap-1 px-1 py-2"><TeamLogo team={player.team} size="h-7 w-7" /><span className="text-[9px] font-black" style={{ color: TEAM_COLORS[player.team] || "#e5e7eb" }}>{player.team}</span></div>
      <div className="px-3 py-2"><div className="mb-1 flex flex-wrap items-center justify-between gap-1"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${statusTone(removed ? "removed" : player.status)}`}>{removed ? "Removed" : player.status || "Update"}</span><span className="text-[8px] font-bold uppercase tracking-wide text-red-100/45">{removed ? `Removed ${newsDate(player.removedAt)}` : `${availabilityRisk(player)}${playingProbability(player) == null ? "" : ` · FP ${Math.round(playingProbability(player))}%`}`}</span></div><div className="line-clamp-2 text-[11px] leading-tight text-slate-300">{detailsFor(player)}</div></div>
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
          <div className="flex items-center gap-3 pr-10"><img src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(player.id)}.jpg`} alt="" className="h-14 w-14 rounded-full border border-red-200/25 bg-black object-cover object-top" onError={(event) => { event.currentTarget.style.display = "none"; }} /><div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/55">Player injury briefing</div><h2 className="truncate text-2xl font-black text-white sm:text-3xl">{player.name}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50"><TeamLogo team={player.team} size="h-5 w-5" /><span>{player.team} · {player.position}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${statusTone(player.reportState === "removed" ? "removed" : player.status)}`}>{player.reportState === "removed" ? "Removed from report" : player.status || "Unknown"}</span></div></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-xl border border-white/8 bg-black/20 p-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Injury</span><strong className="mt-1 block text-sm text-white/80">{player.bodyPart || "Not specified"}</strong><span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-white/30">{player.bodyPartSource || "Source unavailable"}</span></div><div className="rounded-xl border border-white/8 bg-black/20 p-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Ballsville tracking</span><strong className="mt-1 block text-sm text-white/80">{trackingSummary(player)}</strong><span className="mt-1 block text-[9px] text-white/30">First seen {newsDate(player.trackedSince) || "not recorded"}</span></div><div className="rounded-xl border border-white/8 bg-black/20 p-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Reported injury start</span><strong className="mt-1 block text-sm text-white/80">{player.injuryStartDate || "Not supplied"}</strong><span className="mt-1 block text-[9px] text-white/30">Sleeper field; never estimated</span></div><div className="rounded-xl border border-white/8 bg-black/20 p-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Availability risk</span><strong className="mt-1 block text-sm text-white/80">{availabilityRisk(player)}</strong><span className="mt-1 block text-[9px] text-white/30">Ballsville status/practice tier</span></div><div className="rounded-xl border border-white/8 bg-black/20 p-3"><span className="text-[9px] font-black uppercase tracking-wider text-white/35">Chance to play</span><strong className="mt-1 block text-sm text-white/80">{playingChance(player.probabilityOfPlaying) || "No estimate"}</strong><span className="mt-1 block text-[9px] text-white/30">FantasyPros machine-learning estimate</span></div></div>
          {player.notes ? <p className="mt-3 text-sm leading-6 text-slate-300">{player.notes}</p> : null}
          {player.practice?.length ? <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45"><span className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">Practice: {player.practice.join(" / ")}</span></div> : null}
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
  const [doc, setDoc] = useState({ updatedAt: null, players: [], recentlyRemoved: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [excludedTeams, setExcludedTeams] = useState(new Set());
  const [excludedStatuses, setExcludedStatuses] = useState(new Set());
  const [excludedProbabilities, setExcludedProbabilities] = useState(new Set());
  const [excludedRisks, setExcludedRisks] = useState(new Set());
  const [includeFreeAgents, setIncludeFreeAgents] = useState(false);
  const [valueLens, setValueLens] = useState("redraft");
  const [sortOrder, setSortOrder] = useState("value");
  const [reportView, setReportView] = useState("current");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const load = async () => {
    const response = await fetch(`/api/stream/injuries?v=${Date.now()}`, { cache: "no-store" });
    if (response.status === 401) return location.replace("/stream?next=/stream/injuryreport");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load injuries.");
    setDoc({ ...data, updatedAt: data.updatedAt || null, players: Array.isArray(data.players) ? data.players : [], recentlyRemoved: Array.isArray(data.recentlyRemoved) ? data.recentlyRemoved : [] });
  };

  useEffect(() => { load().catch((error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);

  async function refresh() {
    setRefreshing(true); setMessage("");
    const previousUpdatedAt = doc.updatedAt;
    const response = await fetch("/api/stream/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "injuries" }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setRefreshing(false); return setMessage(data.error || "Refresh failed."); }
    setMessage("Injury update queued. Waiting for the new saved snapshot…");
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(5000);
      try {
        const check = await fetch(`/api/stream/injuries?v=${Date.now()}`, { cache: "no-store" });
        const next = await check.json();
        if (check.ok && next.updatedAt && next.updatedAt !== previousUpdatedAt) {
          setDoc({ ...next, players: Array.isArray(next.players) ? next.players : [], recentlyRemoved: Array.isArray(next.recentlyRemoved) ? next.recentlyRemoved : [] });
          setMessage(next.warnings?.length ? `Update complete with warnings: ${next.warnings.join(" · ")}` : `Update complete: ${next.players?.length || 0} current injuries saved.`);
          setRefreshing(false); return;
        }
      } catch {}
    }
    setRefreshing(false);
    setMessage("The workflow is still running. The previous report remains available; refresh again shortly to load the completed snapshot.");
  }

  const allTrackedPlayers = useMemo(() => [...doc.players, ...doc.recentlyRemoved], [doc.players, doc.recentlyRemoved]);
  const teams = useMemo(() => [...new Set(allTrackedPlayers.map((player) => player.team).filter((team) => team && team !== "FA"))].sort(), [allTrackedPlayers]);
  const statuses = useMemo(() => [...new Set(allTrackedPlayers.map((player) => player.status).filter(Boolean))].sort(), [allTrackedPlayers]);
  const probabilityOptions = useMemo(() => {
    const available = new Set(allTrackedPlayers.map(probabilityBucket));
    return PLAY_PROBABILITY_OPTIONS.filter((option) => available.has(option));
  }, [allTrackedPlayers]);
  const riskOptions = useMemo(() => Object.keys(RISK_ORDER).filter((option) => allTrackedPlayers.some((player) => availabilityRisk(player) === option)), [allTrackedPlayers]);
  const freeAgentCount = useMemo(() => allTrackedPlayers.filter((player) => player.team === "FA").length, [allTrackedPlayers]);
  const filtered = useMemo(() => {
    const sourceRows = reportView === "removed" ? doc.recentlyRemoved : reportView === "added" ? doc.players.filter((player) => player.reportState === "added") : doc.players;
    const rows = sourceRows.filter((player) => {
      const haystack = `${player.name} ${player.team} ${player.position} ${detailsFor(player)}`.toLowerCase();
      return (!query || haystack.includes(query.toLowerCase()))
        && !excludedTeams.has(player.team)
        && !excludedStatuses.has(player.status)
        && !excludedProbabilities.has(probabilityBucket(player))
        && !excludedRisks.has(availabilityRisk(player))
        && (includeFreeAgents || player.team !== "FA");
    });
    if (sortOrder === "report") return rows;
    return [...rows].sort((a, b) => {
      if (sortOrder === "probability-desc" || sortOrder === "probability-asc") {
        const aProbability = playingProbability(a);
        const bProbability = playingProbability(b);
        if (aProbability == null && bProbability != null) return 1;
        if (aProbability != null && bProbability == null) return -1;
        if (aProbability !== bProbability) return sortOrder === "probability-desc" ? bProbability - aProbability : aProbability - bProbability;
      }
      if (sortOrder === "value") {
        const field = `${valueLens}Value`;
        const aValue = Number(a[field]);
        const bValue = Number(b[field]);
        const aHasValue = a[field] != null && Number.isFinite(aValue);
        const bHasValue = b[field] != null && Number.isFinite(bValue);
        if (!aHasValue && bHasValue) return 1;
        if (aHasValue && !bHasValue) return -1;
        if (aValue !== bValue) return bValue - aValue;
      }
      if (sortOrder === "tracked-longest" || sortOrder === "tracked-newest") {
        const aTime = Date.parse(a.trackedSince || "");
        const bTime = Date.parse(b.trackedSince || "");
        if (Number.isFinite(aTime) && !Number.isFinite(bTime)) return -1;
        if (!Number.isFinite(aTime) && Number.isFinite(bTime)) return 1;
        if (aTime !== bTime) return sortOrder === "tracked-longest" ? aTime - bTime : bTime - aTime;
      }
      if (sortOrder === "name") return a.name.localeCompare(b.name);
      if (sortOrder === "team") return a.team.localeCompare(b.team) || a.name.localeCompare(b.name);
      const riskDifference = (RISK_ORDER[availabilityRisk(a)] ?? 20) - (RISK_ORDER[availabilityRisk(b)] ?? 20);
      if (riskDifference) return riskDifference;
      const aProbability = playingProbability(a);
      const bProbability = playingProbability(b);
      if (aProbability != null && bProbability != null && aProbability !== bProbability) return aProbability - bProbability;
      return a.name.localeCompare(b.name);
    });
  }, [doc.players, doc.recentlyRemoved, reportView, query, excludedTeams, excludedStatuses, excludedProbabilities, excludedRisks, includeFreeAgents, sortOrder, valueLens]);
  const midpoint = Math.ceil(filtered.length / 2);
  const columns = [filtered.slice(0, midpoint), filtered.slice(midpoint)];
  const addedCount = doc.players.filter((player) => player.reportState === "added").length;
  const selectedTotal = reportView === "removed" ? doc.recentlyRemoved.length : reportView === "added" ? addedCount : doc.players.length;
  const activeFilters = excludedTeams.size + excludedStatuses.size + excludedProbabilities.size + excludedRisks.size + (includeFreeAgents ? 0 : 1) + (reportView === "current" ? 0 : 1);

  function resetFilters() {
    setExcludedTeams(new Set()); setExcludedStatuses(new Set()); setExcludedProbabilities(new Set()); setExcludedRisks(new Set()); setIncludeFreeAgents(false); setQuery(""); setSortOrder("value"); setReportView("current"); setValueLens("redraft");
  }

  return (
    <StreamGuard>{() => (
      <main className="mx-auto min-h-screen max-w-[1500px] px-3 py-8 sm:px-6">
        <StreamHeader eyebrow="Ballsville Stream Room" title="Injury Report" description="A saved on-air briefing from Sleeper, FantasyPros, and Ballsville tracking. Scheduled and manual updates publish to R2; viewing never calls an external data source." updatedAt={doc.updatedAt} onRefresh={refresh} refreshing={refreshing} />

        {!loading ? <StreamBriefing doc={doc} valueLens={valueLens} setValueLens={(lens) => { setValueLens(lens); setSortOrder("value"); }} onOpen={setSelectedPlayer} /> : null}
        {doc.warnings?.length ? <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100"><strong>Saved source warning:</strong> {doc.warnings.join(" · ")} Previous successful enrichment is retained where available.</div> : null}

        <section className="relative z-30 mb-4 rounded-2xl border border-red-400/20 bg-[#100809]/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
          <div className="mb-1 flex items-center px-1 text-[9px] font-black uppercase tracking-[0.2em] text-red-200/45">Report history <InfoTip text="Current is everyone found in this snapshot. New means first seen during the latest manual update. Removed means present previously but absent after a later successful update." label="About report history" /></div>
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-white/8 bg-black/25 p-1">
            {[["current", "Current report", doc.players.length], ["added", "New this update", addedCount], ["removed", "Removed", doc.recentlyRemoved.length]].map(([value, label, count]) => <button key={value} type="button" onClick={() => setReportView(value)} className={`rounded-lg px-2 py-2 text-[10px] font-black uppercase tracking-wider transition sm:text-xs ${reportView === value ? "bg-red-500/20 text-red-50 shadow-[inset_0_0_0_1px_rgba(252,165,165,.25)]" : "text-white/35 hover:bg-white/[0.04] hover:text-white/60"}`}>{label} <span className="ml-1 tabular-nums opacity-60">{count}</span></button>)}
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player, team, injury…" className="rounded-xl border border-red-400/20 bg-black/35 px-4 py-3 text-sm text-white outline-none transition focus:border-red-300/60 focus:ring-2 focus:ring-red-400/10" />
            <MultiSelect label="Teams" options={teams} excluded={excludedTeams} setExcluded={setExcludedTeams} renderIcon={(team) => <TeamLogo team={team} size="h-7 w-7" />} />
            <MultiSelect label="Statuses" help="NFL availability designations supplied by FantasyPros or Sleeper. These describe game/roster availability, not medical severity." options={statuses} excluded={excludedStatuses} setExcluded={setExcludedStatuses} />
            <MultiSelect label="Availability risk" help="Ballsville tier: IR, OUT, PUP and similar statuses are Unavailable; Doubtful is High risk; Questionable or limited practice is Elevated; other listings are Monitoring. It is not a medical diagnosis." options={riskOptions} excluded={excludedRisks} setExcluded={setExcludedRisks} />
            <MultiSelect label="Chance to play" help="FantasyPros' machine-learning estimate of whether the player will suit up this week. It uses practice reports, injury type, position trends and historical availability; it is not a guarantee." options={probabilityOptions} excluded={excludedProbabilities} setExcluded={setExcludedProbabilities} />
            <label className="relative flex min-w-0 items-center rounded-xl border border-red-400/20 bg-black/30 px-3 py-2.5 transition focus-within:border-red-300/55 focus-within:bg-red-500/10">
              <span className="min-w-0 flex-1"><span className="flex items-center text-[9px] font-black uppercase tracking-[0.2em] text-red-200/55">Sort report <InfoTip text={`Availability risk is Ballsville's transparent status/practice tier. Player value follows the active ${valueLens} lens. Tracking sorts use Ballsville's first-seen timestamp.`} label="About report sorting" /></span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent pr-6 text-sm font-bold text-white outline-none"><option value="value" className="bg-[#120809]">Highest {valueLens} value</option><option value="report" className="bg-[#120809]">Availability risk</option><option value="probability-asc" className="bg-[#120809]">Lowest chance to play</option><option value="probability-desc" className="bg-[#120809]">Highest chance to play</option><option value="tracked-longest" className="bg-[#120809]">Longest tracked</option><option value="tracked-newest" className="bg-[#120809]">Newest additions</option><option value="name" className="bg-[#120809]">Player name</option><option value="team" className="bg-[#120809]">NFL team</option></select></span>
              <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none h-4 w-4 shrink-0 fill-current text-red-200/60"><path d="m5.3 7.5 4.7 4.7 4.7-4.7 1.1 1.1-5.8 5.8-5.8-5.8 1.1-1.1Z" /></svg>
            </label>
            <button type="button" onClick={() => setIncludeFreeAgents((value) => !value)} className={`flex min-w-[154px] items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${includeFreeAgents ? "border-red-300/25 bg-red-500/10" : "border-white/10 bg-black/25 opacity-70"}`}><span><span className="flex items-center text-[9px] font-black uppercase tracking-[0.2em] text-red-200/55">Free agents <InfoTip text="Players whose NFL team is listed as FA. This does not mean they are unrostered in a Ballsville fantasy league." label="About free agents" /></span><span className="block text-sm font-bold text-white">{includeFreeAgents ? "Shown" : "Hidden"} · {freeAgentCount}</span></span><span className={`relative h-6 w-11 rounded-full transition ${includeFreeAgents ? "bg-red-500" : "bg-white/10"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${includeFreeAgents ? "left-6" : "left-1"}`} /></span></button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1"><p className="max-w-5xl text-[10px] text-white/35">Ballsville tracking begins when an update first sees a player and ends when a later successful update no longer finds them. It measures observed report time—not the medical injury date. Nothing is fetched while viewing.</p>{activeFilters || query || sortOrder !== "value" || valueLens !== "redraft" ? <button type="button" onClick={resetFilters} className="text-[10px] font-black uppercase tracking-wider text-red-200/65 hover:text-red-100">Reset filters</button> : null}</div>
        </section>
        {message ? <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs text-cyan-100">{message}</div> : null}

        <section className="relative overflow-hidden rounded-[1.6rem] border-2 border-red-500/70 bg-[#050303] p-2 shadow-[0_0_35px_rgba(239,68,68,.28),inset_0_0_28px_rgba(239,68,68,.10)] sm:p-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(239,68,68,.22),transparent_38%),linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px)] bg-[size:auto,100%_4px]" />
          <div className="relative mb-3 flex items-center justify-center gap-3 border-b border-red-500/40 py-4 sm:gap-6"><div className="grid h-12 w-12 place-items-center rounded-full border-2 border-red-300 bg-red-500/15 text-3xl font-black text-white shadow-[0_0_18px_rgba(248,113,113,.65)] sm:h-16 sm:w-16 sm:text-4xl">+</div><div><h2 className="text-3xl font-black uppercase tracking-[0.06em] text-white [text-shadow:0_0_12px_rgba(239,68,68,.9)] sm:text-6xl">Injury Report</h2><p className="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-red-200/45">{doc.source || "Saved snapshot"}{doc.week ? ` · Week ${doc.week}` : ""}</p></div></div>
          {loading ? <div className="relative p-16 text-center text-sm text-slate-400">Loading saved injury board…</div> : filtered.length ? <div className="relative grid gap-3 lg:grid-cols-2">{columns.map((column, index) => <div key={index} className="overflow-hidden rounded-xl border border-red-500/30"><div className="grid grid-cols-[minmax(128px,.9fr)_58px_minmax(150px,1.4fr)] bg-red-950/60 text-[9px] font-black uppercase tracking-[0.18em] text-red-100"><div className="px-3 py-2">Player</div><div className="px-2 py-2 text-center">Team</div><div className="px-3 py-2">Injury details</div></div>{column.map((player) => <InjuryRow key={player.id} player={player} onOpen={setSelectedPlayer} />)}</div>)}</div> : <div className="relative p-16 text-center text-sm text-slate-400">No players match the current filters.</div>}
          <div className="relative mt-3 text-center text-[9px] font-bold uppercase tracking-[0.22em] text-red-300/60">{filtered.length} of {selectedTotal} players · Select a row for saved news</div>
        </section>
        {selectedPlayer ? <PlayerNewsModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} /> : null}
      </main>
    )}</StreamGuard>
  );
}
