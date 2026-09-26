"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminAccessReviewPage() {
  const [state, setState] = useState({ loading: true, request: null, error: "", done: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/admin/auth/review-access${location.search}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => setState({ loading: false, request: ok ? data.request : null, error: ok ? "" : data.error || "Invalid review link.", done: "" }))
      .catch(() => setState({ loading: false, request: null, error: "Unable to open this request.", done: "" }));
  }, []);
  async function decide(action) {
    setBusy(true);
    const response = await fetch(`/api/admin/auth/review-access${location.search}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setState((old) => ({ ...old, error: data.error || "Unable to save the decision." }));
    setState((old) => ({ ...old, request: null, error: "", done: data.message }));
  }
  return <section className="section"><div className="container-site flex min-h-[65vh] items-center justify-center"><div className="card w-full max-w-xl border border-subtle bg-card-surface p-6 sm:p-8"><span className="badge">Private approval</span><h1 className="h2 mt-3 text-primary">Admin access request</h1>
    {state.loading ? <p className="mt-5 text-muted">Opening request…</p> : null}
    {state.error ? <div className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-red-300">{state.error}</div> : null}
    {state.done ? <div className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-emerald-300">{state.done}</div> : null}
    {state.request ? <div className="mt-6"><div className="divide-y divide-subtle rounded-xl border border-subtle">{[["Username", state.request.username], ["Contact email", state.request.email || "Not provided"], ["Requested", new Date(state.request.createdAt).toLocaleString()]].map(([label, value]) => <div key={label} className="flex justify-between gap-5 p-4"><span className="text-sm text-muted">{label}</span><strong className="text-right text-primary">{value}</strong></div>)}</div><p className="mt-4 text-xs text-muted">Approve only an account you personally requested. Rejecting removes its password hash.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button disabled={busy} onClick={() => decide("reject")} className="btn btn-outline">Reject</button><button disabled={busy} onClick={() => decide("approve")} className="btn btn-primary">Approve administrator</button></div></div> : null}
    {!state.loading && !state.request ? <Link href="/admin/login" className="btn btn-outline mt-6">Go to admin login</Link> : null}
  </div></div></section>;
}
