"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function StreamAccessReviewClient() {
  const [state, setState] = useState({ loading: true, request: null, error: "", done: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/stream/auth/review-access${location.search}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => setState({ loading: false, request: ok ? data.request : null, error: ok ? "" : data.error || "Invalid review link.", done: "" }))
      .catch(() => setState({ loading: false, request: null, error: "Unable to open this review request.", done: "" }));
  }, []);

  async function decide(action) {
    setBusy(true);
    const response = await fetch(`/api/stream/auth/review-access${location.search}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setState((old) => ({ ...old, error: data.error || "Unable to save that decision." }));
    setState((old) => ({ ...old, request: null, error: "", done: data.message || "Decision saved." }));
  }

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-2xl items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-[2rem] border border-cyan-300/20 bg-[#06111a]/95 p-6 shadow-2xl shadow-black/50 sm:p-10">
        <div className="text-[10px] font-black uppercase tracking-[0.36em] text-cyan-300">Private approval</div>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">Stream Room access</h1>
        {state.loading ? <p className="mt-6 text-sm text-slate-400">Opening the request…</p> : null}
        {state.error ? <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">{state.error}</div> : null}
        {state.done ? <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">{state.done}</div> : null}
        {state.request ? (
          <div className="mt-6">
            <dl className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/20 px-5">
              {[["Username", state.request.username], ["Contact email", state.request.email || "Not provided"], ["Requested", new Date(state.request.createdAt).toLocaleString()]].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-6 py-4"><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="text-right font-bold text-white">{value}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">Approving activates these credentials. Rejecting permanently removes the stored password hash.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button disabled={busy} onClick={() => decide("reject")} className="rounded-xl border border-red-400/30 px-4 py-3 text-sm font-black text-red-200 hover:bg-red-500/10 disabled:opacity-50">Reject request</button>
              <button disabled={busy} onClick={() => decide("approve")} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-50">Approve access</button>
            </div>
          </div>
        ) : null}
        {!state.request && !state.loading ? <Link href="/stream" className="mt-6 inline-flex rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white hover:border-cyan-300/30">Go to Stream Room</Link> : null}
      </section>
    </main>
  );
}
