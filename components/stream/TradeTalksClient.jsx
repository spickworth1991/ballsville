"use client";

import { useEffect, useMemo, useState } from "react";
import StreamGuard from "./StreamGuard";
import StreamHeader from "./StreamHeader";

function ManagerAvatar({ side }) {
  return side.avatar ? <img src={`https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(side.avatar)}`} alt="" className="h-10 w-10 rounded-full border border-cyan-300/30 bg-black object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-xs font-black text-cyan-200">{side.manager?.charAt(0)?.toUpperCase() || "?"}</span>;
}

function Asset({ asset }) {
  const player = asset.type === "player";
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/8 bg-black/20 p-2">
      {player ? <img src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(asset.id)}.jpg`} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg bg-black object-cover object-top" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-300/10 text-base">{asset.type === "pick" ? "◆" : "$"}</span>}
      <div className="min-w-0"><div className="truncate text-xs font-black text-white">{asset.name}</div><div className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">{asset.meta || asset.type}</div></div>
      {asset.value != null ? <span className="ml-auto text-[10px] font-black tabular-nums text-cyan-300">{Number(asset.value).toFixed(0)}</span> : null}
    </div>
  );
}

function TradeCard({ trade }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#07131c]/95 shadow-xl shadow-black/25">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-white/[.025] px-4 py-3">
        <div><div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-300">{trade.modeName || trade.mode}</div><div className="mt-0.5 text-sm font-black text-white">{trade.leagueName}</div></div>
        <div className="text-right text-[10px] text-slate-500"><div>{trade.division}</div><div>{trade.date ? new Date(trade.date).toLocaleString() : `Week ${trade.week || "—"}`}</div></div>
      </header>
      <div className={`grid ${trade.sides?.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        {(trade.sides || []).map((side, index) => (
          <section key={`${side.rosterId}-${index}`} className="border-t border-white/8 p-4 first:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0">
            <div className="mb-3 flex items-center gap-3"><ManagerAvatar side={side} /><div className="min-w-0"><div className="truncate font-black text-white">{side.manager}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Received {side.assets?.length || 0} asset{side.assets?.length === 1 ? "" : "s"}</div></div>{side.totalValue != null ? <div className="ml-auto text-right"><div className="text-lg font-black text-cyan-300">{Number(side.totalValue).toFixed(0)}</div><div className="text-[8px] uppercase tracking-wider text-slate-500">Value</div></div> : null}</div>
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

  const load = async () => {
    const response = await fetch(`/api/stream/trades?v=${Date.now()}`, { cache: "no-store" });
    if (response.status === 401) return location.replace("/stream?next=/stream/tradetalks");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load trades.");
    setDoc({ updatedAt: data.updatedAt || null, trades: Array.isArray(data.trades) ? data.trades : [], filters: data.filters || {} });
  };
  useEffect(() => { load().catch((error) => setMessage(error.message)).finally(() => setLoading(false)); }, []);

  async function refresh() {
    setRefreshing(true); setMessage("");
    const response = await fetch("/api/stream/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "trades" }) });
    const data = await response.json().catch(() => ({}));
    setRefreshing(false);
    setMessage(response.ok ? "Trade refresh queued. The R2 snapshot will update when the workflow finishes." : data.error || "Refresh failed.");
  }

  const modes = doc.filters.modes || [...new Set(doc.trades.map((trade) => trade.mode).filter(Boolean))].sort();
  const leagues = doc.filters.leagues || [...new Set(doc.trades.map((trade) => trade.leagueName).filter(Boolean))].sort();
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

  const field = "rounded-xl border border-cyan-300/15 bg-black/25 px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-300/50";
  return (
    <StreamGuard>{() => (
      <main className="mx-auto min-h-screen max-w-[1500px] px-3 py-8 sm:px-6">
        <StreamHeader eyebrow="Ballsville Stream Room" title="Trade Talks" description="Every Ballsville league trade in one broadcast-friendly feed. Filter the conversation, then open the deal you want to discuss." updatedAt={doc.updatedAt} onRefresh={refresh} refreshing={refreshing} />
        <section className="sticky top-2 z-20 mb-5 rounded-2xl border border-cyan-300/20 bg-[#07131c]/95 p-3 shadow-xl backdrop-blur-xl">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <input value={filters.query} onChange={(event) => setFilters((old) => ({ ...old, query: event.target.value }))} placeholder="Players, picks, managers…" className={`${field} xl:col-span-2`} />
            <select value={filters.mode} onChange={(event) => setFilters((old) => ({ ...old, mode: event.target.value, league: "all" }))} className={field}><option value="all">All game modes</option>{modes.map((mode) => <option key={mode} value={mode}>{mode.replaceAll("_", " ")}</option>)}</select>
            <select value={filters.league} onChange={(event) => setFilters((old) => ({ ...old, league: event.target.value }))} className={field}><option value="all">All leagues</option>{leagues.map((league) => <option key={league}>{league}</option>)}</select>
            <select value={filters.sort} onChange={(event) => setFilters((old) => ({ ...old, sort: event.target.value }))} className={field}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="assets">Most assets</option><option value="value-gap">Largest value gap</option></select>
            <button onClick={() => setFilters({ query: "", mode: "all", league: "all", sideA: "0", sideB: "0", sort: "newest" })} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-black text-slate-300">Reset filters</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span>Minimum assets received:</span><label className="flex items-center gap-1">Side 1 <input type="number" min="0" value={filters.sideA} onChange={(event) => setFilters((old) => ({ ...old, sideA: event.target.value }))} className="w-14 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-white" /></label><label className="flex items-center gap-1">Side 2 <input type="number" min="0" value={filters.sideB} onChange={(event) => setFilters((old) => ({ ...old, sideB: event.target.value }))} className="w-14 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-white" /></label><span className="ml-auto font-black text-cyan-300">{visible.length} trade{visible.length === 1 ? "" : "s"}</span></div>
        </section>
        {message ? <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs text-cyan-100">{message}</div> : null}
        {loading ? <div className="p-20 text-center text-sm text-slate-400">Loading Ballsville trades…</div> : visible.length ? <div className="grid gap-4">{visible.map((trade) => <TradeCard key={trade.id} trade={trade} />)}</div> : <div className="rounded-3xl border border-white/10 bg-[#07131c]/90 p-16 text-center text-sm text-slate-400">No matching trades. Queue an update to publish the latest completed Sleeper transactions.</div>}
      </main>
    )}</StreamGuard>
  );
}

