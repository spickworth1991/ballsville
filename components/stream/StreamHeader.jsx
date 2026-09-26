"use client";

import Link from "next/link";

export default function StreamHeader({ eyebrow, title, description, updatedAt, onRefresh, refreshing }) {
  return (
    <header className="mb-6 rounded-3xl border border-cyan-300/20 bg-[#07131c]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-300">{eyebrow}</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{description}</p>
          {updatedAt ? <p className="mt-2 text-[11px] text-slate-500">Snapshot updated {new Date(updatedAt).toLocaleString()}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/stream" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 transition hover:border-cyan-300/40">Stream home</Link>
          {onRefresh ? <button type="button" onClick={onRefresh} disabled={refreshing} className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-200 transition hover:bg-cyan-300/20 disabled:opacity-50">{refreshing ? "Updating…" : "Update data"}</button> : null}
        </div>
      </div>
    </header>
  );
}

