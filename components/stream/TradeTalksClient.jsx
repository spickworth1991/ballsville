"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StreamGuard from "./StreamGuard";
import StreamHeader from "./StreamHeader";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const titleCase = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function PremiumSelect({ label, value, options, open, onToggle, onChange }) {
  const root = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!root.current?.contains(event.target)) onToggle(false); };
    const escape = (event) => { if (event.key === "Escape") onToggle(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open, onToggle]);
  return (
    <div ref={root} className="relative min-w-0">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => onToggle(!open)} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${open ? "border-cyan-300/55 bg-cyan-300/[.08] shadow-[0_0_24px_rgba(34,211,238,.08)]" : "border-cyan-300/15 bg-black/25 hover:border-cyan-300/35 hover:bg-white/[.035]"}`}>
        <span className="min-w-0"><span className="block text-[8px] font-black uppercase tracking-[.2em] text-cyan-200/45">{label}</span><span className="block truncate text-xs font-bold text-white">{selected?.label}</span></span>
        <span aria-hidden="true" className={`text-sm text-cyan-300 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open ? <div role="listbox" className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-cyan-300/25 bg-[#081923] p-1.5 shadow-2xl shadow-black/60 ring-1 ring-black/50">
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); onToggle(false); }} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${option.value === value ? "bg-cyan-300/15 text-cyan-100" : "text-slate-200 hover:bg-white/[.07] hover:text-white"}`}><span className="truncate">{option.label}</span>{option.value === value ? <span className="text-cyan-300">✓</span> : null}</button>)}
      </div> : null}
    </div>
  );
}

function ManagerAvatar({ side }) {
  return side.avatar ? <img src={`https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(side.avatar)}`} alt="" className="h-10 w-10 rounded-full border border-cyan-300/30 bg-black object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-xs font-black text-cyan-200">{side.manager?.charAt(0)?.toUpperCase() || "?"}</span>;
}

function Asset({ asset }) {
  const player = asset.type === "player";
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/8 bg-black/20 p-2">
      {player ? <img src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(asset.id)}.jpg`} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg bg-black object-cover object-top" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-300/10 text-base">{asset.type === "pick" ? "◆" : "$"}</span>}
      <div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-white">{asset.name}</div><div className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">{asset.meta || asset.type}</div></div>
      <div className="shrink-0 text-right">{asset.value != null ? <div className="text-[11px] font-black tabular-nums text-cyan-300">{Number(asset.value).toFixed(0)}</div> : player ? <div className="text-[8px] font-bold uppercase text-slate-600">No value</div> : null}{player && asset.projection != null ? <div className="mt-0.5 text-[8px] font-bold tabular-nums text-emerald-300/75">Safe {Number(asset.projection).toFixed(1)}</div> : null}</div>
    </div>
  );
}

function TradeCard({ trade }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#07131c]/95 shadow-xl shadow-black/25">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-white/[.025] px-4 py-3">
        <div><div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-300">{trade.modeName || trade.mode}</div><div className="mt-0.5 text-sm font-black text-white">{trade.leagueName}</div><div className="mt-1 text-[8px] font-bold uppercase tracking-wider text-cyan-100/40">Arsenal {(trade.valueModel || (trade.mode === "dynasty" ? "dynasty" : "redraft")) === "dynasty" ? "Dynasty" : "Redraft"} {(trade.valueFormat || "1qb") === "superflex" ? "Superflex" : "1QB"} values · Safe projections</div></div>
        <div className="text-right text-[10px] text-slate-500"><div>{trade.division}</div><div>{trade.date ? new Date(trade.date).toLocaleString() : `Week ${trade.week || "—"}`}</div></div>
      </header>
      <div className={`grid ${trade.sides?.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        {(trade.sides || []).map((side, index) => (
          <section key={`${side.rosterId}-${index}`} className="border-t border-white/8 p-4 first:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0">
            <div className="mb-3 flex items-center gap-3"><ManagerAvatar side={side} /><div className="min-w-0"><div className="truncate font-black text-white">{side.manager}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Received {side.assets?.length || 0} asset{side.assets?.length === 1 ? "" : "s"}</div></div>{side.totalValue != null || side.totalProjection != null ? <div className="ml-auto text-right">{side.totalValue != null ? <><div className="text-lg font-black text-cyan-300">{Number(side.totalValue).toFixed(0)}</div><div className={`text-[8px] uppercase tracking-wider ${side.totalValueComplete === false ? "text-amber-300/70" : "text-slate-500"}`}>{side.totalValueComplete === false ? `Known value · ${side.valuedAssetCount || 0}/${side.assets?.length || 0}` : `${(trade.valueModel || (trade.mode === "dynasty" ? "dynasty" : "redraft")) === "dynasty" ? "Dynasty" : "Redraft"} value`}</div></> : <div className="text-[8px] font-bold uppercase text-slate-600">No Arsenal value</div>}{side.totalProjection != null ? <div className="mt-0.5 text-[8px] font-bold text-emerald-300/65">Safe Wk {trade.projectionWeek || "—"}: {Number(side.totalProjection).toFixed(1)}{side.totalProjectionComplete === false ? ` · ${side.projectedAssetCount || 0}/${side.projectableAssetCount || 0} players` : ""}</div> : null}</div> : null}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{(side.assets || []).map((asset, assetIndex) => <Asset key={`${asset.type}-${asset.id || asset.name}-${assetIndex}`} asset={asset} />)}</div>
          </section>
        ))}
      </div>
      {trade.notes ? <footer className="border-t border-white/8 px-4 py-3 text-xs text-slate-400">{trade.notes}</footer> : null}
    </article>
  );
}

export default function TradeTalksClient() {
  const [doc, setDoc] = useState({ updatedAt: null, trades: [], filters: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ query: "", mode: "all", league: "all", sideA: "0", sideB: "0", sort: "newest" });
  const [openFilter, setOpenFilter] = useState(null);

  const load = async () => {
    const response = await fetch(`/api/stream/trades?v=${Date.now()}`, { cache: "no-store" });
    if (response.status === 401) return location.replace("/stream?next=/stream/tradetalks");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load trades.");
    setDoc({ updatedAt: data.updatedAt || null, trades: Array.isArray(data.trades) ? data.trades : [], filters: data.filters || {}, warnings: data.warnings || [] });
  };
  useEffect(() => { load().catch((error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);

  async function refresh() {
    setRefreshing(true); setMessage("");
    const previousUpdatedAt = doc.updatedAt;
    const response = await fetch("/api/stream/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "trades" }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setRefreshing(false); return setMessage(data.error || "Refresh failed."); }
    setMessage("Trade update queued. Waiting for the new saved snapshot…");
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(5000);
      try {
        const check = await fetch(`/api/stream/trades?v=${Date.now()}`, { cache: "no-store" });
        const next = await check.json();
        if (check.ok && next.updatedAt && next.updatedAt !== previousUpdatedAt) {
          setDoc({ updatedAt: next.updatedAt, trades: Array.isArray(next.trades) ? next.trades : [], filters: next.filters || {}, warnings: next.warnings || [] });
          setMessage(next.warnings?.length ? `Update complete with warnings: ${next.warnings.join(" · ")}` : `Update complete: ${next.trades?.length || 0} trades saved.`);
          setRefreshing(false); return;
        }
      } catch {}
    }
    setRefreshing(false);
    setMessage("The workflow is still running. The previous trade feed remains available; refresh again shortly to load the completed snapshot.");
  }

  const modes = doc.filters.modes || [...new Set(doc.trades.map((trade) => trade.mode).filter(Boolean))].sort();
  const leagues = [...new Set(doc.trades.filter((trade) => filters.mode === "all" || trade.mode === filters.mode).map((trade) => trade.leagueName).filter(Boolean))].sort();
  const modeOptions = [{ value: "all", label: "All game modes" }, ...modes.map((mode) => ({ value: mode, label: titleCase(mode) }))];
  const leagueOptions = [{ value: "all", label: "All leagues" }, ...leagues.map((league) => ({ value: league, label: league }))];
  const sortOptions = [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "assets", label: "Most assets" }, { value: "value-gap", label: "Largest value gap" }];
  const visible = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const minimumA = Math.max(0, Number(filters.sideA || 0));
    const minimumB = Math.max(0, Number(filters.sideB || 0));
    const list = doc.trades.filter((trade) => {
      const text = `${trade.leagueName} ${trade.division} ${trade.modeName} ${(trade.sides || []).map((side) => `${side.manager} ${(side.assets || []).map((asset) => asset.name).join(" ")}`).join(" ")}`.toLowerCase();
      return (!query || text.includes(query)) && (filters.mode === "all" || trade.mode === filters.mode) && (filters.league === "all" || trade.leagueName === filters.league) && Number(trade.sides?.[0]?.assets?.length || 0) >= minimumA && Number(trade.sides?.[1]?.assets?.length || 0) >= minimumB;
    });
    return [...list].sort((a, b) => {
      if (filters.sort === "oldest") return Number(a.timestamp || 0) - Number(b.timestamp || 0);
      if (filters.sort === "assets") return Number(b.assetCount || 0) - Number(a.assetCount || 0);
      if (filters.sort === "value-gap") return Number(b.valueGap || 0) - Number(a.valueGap || 0);
      return Number(b.timestamp || 0) - Number(a.timestamp || 0);
    });
  }, [doc.trades, filters]);

  const field = "min-h-12 rounded-xl border border-cyan-300/15 bg-black/25 px-3 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/50";
  return (
    <StreamGuard>{() => (
      <main className="mx-auto min-h-screen max-w-[1500px] px-3 py-8 sm:px-6">
        <StreamHeader eyebrow="Ballsville Stream Room" title="Trade Talks" description="Every Ballsville league trade in one broadcast-friendly feed. Filter the conversation, then open the deal you want to discuss." updatedAt={doc.updatedAt} onRefresh={refresh} refreshing={refreshing} />
        <section className="sticky top-2 z-20 mb-5 rounded-2xl border border-cyan-300/20 bg-[#07131c]/95 p-3 shadow-xl backdrop-blur-xl">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <input value={filters.query} onChange={(event) => setFilters((old) => ({ ...old, query: event.target.value }))} placeholder="Players, picks, managers…" aria-label="Search trades" className={`${field} xl:col-span-2`} />
            <PremiumSelect label="Game mode" value={filters.mode} options={modeOptions} open={openFilter === "mode"} onToggle={(open) => setOpenFilter(open ? "mode" : null)} onChange={(mode) => setFilters((old) => ({ ...old, mode, league: "all" }))} />
            <PremiumSelect label="League" value={filters.league} options={leagueOptions} open={openFilter === "league"} onToggle={(open) => setOpenFilter(open ? "league" : null)} onChange={(league) => setFilters((old) => ({ ...old, league }))} />
            <PremiumSelect label="Sort trades" value={filters.sort} options={sortOptions} open={openFilter === "sort"} onToggle={(open) => setOpenFilter(open ? "sort" : null)} onChange={(sort) => setFilters((old) => ({ ...old, sort }))} />
            <button onClick={() => { setFilters({ query: "", mode: "all", league: "all", sideA: "0", sideB: "0", sort: "newest" }); setOpenFilter(null); }} className="min-h-12 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-black text-slate-300 transition hover:border-cyan-300/25 hover:bg-white/[.04] hover:text-white">Reset filters</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span>Minimum assets received:</span><label className="flex items-center gap-1">Side 1 <input type="number" min="0" value={filters.sideA} onChange={(event) => setFilters((old) => ({ ...old, sideA: event.target.value }))} className="w-14 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-white" /></label><label className="flex items-center gap-1">Side 2 <input type="number" min="0" value={filters.sideB} onChange={(event) => setFilters((old) => ({ ...old, sideB: event.target.value }))} className="w-14 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-white" /></label><span className="ml-auto font-black text-cyan-300">{visible.length} trade{visible.length === 1 ? "" : "s"}</span></div>
        </section>
        {message ? <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs text-cyan-100">{message}</div> : null}
        {doc.warnings?.length ? <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100"><strong>Saved source warning:</strong> {doc.warnings.join(" · ")}</div> : null}
        {loading ? <div className="p-20 text-center text-sm text-slate-400">Loading Ballsville trades…</div> : visible.length ? <div className="grid gap-4">{visible.map((trade) => <TradeCard key={trade.id} trade={trade} />)}</div> : <div className="rounded-3xl border border-white/10 bg-[#07131c]/90 p-16 text-center text-sm text-slate-400">No matching trades. Queue an update to publish the latest completed Sleeper transactions.</div>}
      </main>
    )}</StreamGuard>
  );
}
