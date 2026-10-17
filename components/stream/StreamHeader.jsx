"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function StreamHeader({ eyebrow, title, description, updatedAt, onRefresh, refreshing }) {
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updatePhase, setUpdatePhase] = useState("confirm");
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef(null);

  const closeUpdate = () => {
    if (updatePhase === "updating") return;
    setUpdateOpen(false);
    setUpdatePhase("confirm");
    setProgress(0);
  };

  useEffect(() => {
    if (!updateOpen) return undefined;
    const escape = (event) => { if (event.key === "Escape") closeUpdate(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [updateOpen, updatePhase]);

  useEffect(() => () => clearInterval(progressTimer.current), []);

  async function confirmUpdate() {
    setUpdatePhase("updating");
    setProgress(6);
    clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgress((value) => Math.min(92, value + Math.max(1, Math.round((94 - value) / 12))));
    }, 1200);
    try {
      const completed = await onRefresh();
      clearInterval(progressTimer.current);
      if (completed === false) {
        setProgress((value) => Math.max(value, 20));
        setUpdatePhase("error");
        return;
      }
      setProgress(100);
      setUpdatePhase("complete");
      setTimeout(() => {
        setUpdateOpen(false);
        setUpdatePhase("confirm");
        setProgress(0);
      }, 850);
    } catch {
      clearInterval(progressTimer.current);
      setUpdatePhase("error");
    }
  }

  const updatedLabel = updatedAt && !Number.isNaN(new Date(updatedAt).getTime())
    ? new Date(updatedAt).toLocaleString()
    : "No completed update is available yet";

  return (
    <>
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
            {onRefresh ? <button type="button" onClick={() => { setUpdatePhase("confirm"); setProgress(0); setUpdateOpen(true); }} disabled={refreshing} className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-200 transition hover:bg-cyan-300/20 disabled:opacity-50">{refreshing ? "Updating…" : "Update data"}</button> : null}
          </div>
        </div>
      </header>
      {updateOpen ? (
        <div className="fixed inset-0 z-[160] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeUpdate(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="stream-update-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-cyan-300/30 bg-[#07131c] shadow-[0_30px_100px_rgba(0,0,0,.75)]">
            <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.14),transparent_45%)] p-5 sm:p-6">
              <div className="text-[9px] font-black uppercase tracking-[.25em] text-cyan-300/65">Saved Stream data</div>
              <h2 id="stream-update-title" className="mt-1 text-2xl font-black text-white">{updatePhase === "confirm" ? `Update ${title}?` : updatePhase === "complete" ? "Update complete" : updatePhase === "error" ? "Update still pending" : `Updating ${title}`}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-400">Last completed update: <strong className="text-slate-200">{updatedLabel}</strong></p>
            </div>
            <div className="p-5 sm:p-6">
              {updatePhase === "confirm" ? <p className="text-sm leading-6 text-slate-300">This queues a fresh saved snapshot. The existing report stays available while the update runs. Are you sure you want to continue?</p> : null}
              {updatePhase !== "confirm" ? <div><div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-wider"><span className={updatePhase === "error" ? "text-amber-200" : "text-cyan-200"}>{updatePhase === "complete" ? "New snapshot saved" : updatePhase === "error" ? "Taking longer than expected" : "Waiting for the new snapshot"}</span><span className="tabular-nums text-white/45">{progress}%</span></div><div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/40" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><div className={`h-full rounded-full transition-[width] duration-700 ${updatePhase === "error" ? "bg-amber-400" : "bg-gradient-to-r from-cyan-500 to-cyan-200 shadow-[0_0_18px_rgba(34,211,238,.65)]"}`} style={{ width: `${progress}%` }} /></div><p className="mt-3 text-xs leading-5 text-slate-500">{updatePhase === "error" ? "The workflow may still finish in the background. The previous saved data has not been replaced." : updatePhase === "complete" ? "The page now has the newly saved data." : "GitHub is building the data and the page is checking R2 for completion."}</p></div> : null}
              <div className="mt-6 flex justify-end gap-2">
                {updatePhase === "confirm" ? <><button type="button" onClick={closeUpdate} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-white/5">Cancel</button><button type="button" onClick={confirmUpdate} className="rounded-xl border border-cyan-200/40 bg-cyan-300/15 px-4 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/25">Confirm update</button></> : null}
                {updatePhase === "error" ? <button type="button" onClick={closeUpdate} className="rounded-xl border border-amber-200/30 bg-amber-300/10 px-4 py-2.5 text-xs font-black text-amber-100 transition hover:bg-amber-300/20">Close</button> : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
