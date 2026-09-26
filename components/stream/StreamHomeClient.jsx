"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const TOOLS = [
  { href: "/stream/injuryreport", label: "Injury Report", kicker: "ON-AIR BOARD", description: "A broadcast-ready injury wall with live refresh, fast filters, and one-click player news.", color: "red" },
  { href: "/stream/tradetalks", label: "Trade Talks", kicker: "LEAGUE INTELLIGENCE", description: "Every published Ballsville trade in one searchable, sortable, filterable workspace.", color: "cyan" },
];

const inputClass = "w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-cyan-300/50";

export default function StreamHomeClient() {
  const [session, setSession] = useState({ loading: true, user: null });
  const [form, setForm] = useState({ username: "", password: "" });
  const [requestForm, setRequestForm] = useState({ name: "", email: "", username: "", password: "", website: "" });
  const [view, setView] = useState("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devReviewUrl, setDevReviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const checkSession = () => fetch("/api/stream/auth/session", { cache: "no-store" })
    .then(async (response) => response.ok ? response.json() : null)
    .then((data) => setSession({ loading: false, user: data?.user || null }))
    .catch(() => setSession({ loading: false, user: null }));

  useEffect(() => { checkSession(); }, []);

  function changeView(nextView) {
    setView(nextView); setError(""); setNotice(""); setDevReviewUrl("");
  }

  async function login(event) {
    event.preventDefault();
    setBusy(true); setError("");
    const response = await fetch("/api/stream/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "Unable to sign in.");
    const next = new URLSearchParams(location.search).get("next");
    if (next?.startsWith("/stream/")) location.href = next;
    else setSession({ loading: false, user: data.user });
  }

  async function requestAccess(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/stream/auth/request-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(requestForm) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "Unable to send your request.");
    setNotice(data.message || "Request sent for approval.");
    setDevReviewUrl(data.devReviewUrl || "");
    setRequestForm({ name: "", email: "", username: "", password: "", website: "" });
  }

  async function logout() {
    await fetch("/api/stream/auth/logout", { method: "POST" });
    setSession({ loading: false, user: null });
  }

  return (
    <main className="mx-auto min-h-[75vh] max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#06111a]/95 p-6 shadow-2xl shadow-black/50 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,.18),transparent_35%),radial-gradient(circle_at_95%_100%,rgba(239,68,68,.14),transparent_34%)]" />
        <div className="relative">
          <div className="text-[10px] font-black uppercase tracking-[0.38em] text-cyan-300">Ballsville Broadcast Operations</div>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">Stream Room</h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">Fast, clean information built for the show—not another overloaded fantasy dashboard.</p>
            </div>
            {session.user ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 text-sm font-black text-emerald-200">{session.user.name?.charAt(0)?.toUpperCase()}</div>
                <div><div className="text-xs text-slate-400">Signed in as</div><div className="font-black text-white">{session.user.name}</div></div>
                <button onClick={logout} className="ml-3 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Sign out</button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {!session.loading && !session.user ? (
        <section className="mx-auto mt-6 max-w-md rounded-3xl border border-white/10 bg-[#07131c]/95 p-6 shadow-xl">
          <div className="flex rounded-xl border border-white/10 bg-black/25 p-1">
            {[{ id: "login", label: "Sign in" }, { id: "request", label: "Request access" }].map((item) => (
              <button key={item.id} type="button" onClick={() => changeView(item.id)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition ${view === item.id ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:text-white"}`}>{item.label}</button>
            ))}
          </div>
          <div className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Private access</div>
          <h2 className="mt-2 text-2xl font-black text-white">{view === "login" ? "Enter the stream room" : "Create your credentials"}</h2>
          <p className="mt-2 text-sm text-slate-400">{view === "login" ? "Use your approved Ballsville streaming credentials." : "Your account stays locked until Sticky approves it by email."}</p>
          {view === "login" ? (
            <form onSubmit={login} className="mt-5 space-y-3">
              <input required autoComplete="username" value={form.username} onChange={(event) => setForm((old) => ({ ...old, username: event.target.value }))} placeholder="Username" className={inputClass} />
              <input required autoComplete="current-password" type="password" value={form.password} onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))} placeholder="Password" className={inputClass} />
              {error ? <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</div> : null}
              <button disabled={busy} className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          ) : (
            <form onSubmit={requestAccess} className="mt-5 space-y-3">
              <input tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" value={requestForm.website} onChange={(event) => setRequestForm((old) => ({ ...old, website: event.target.value }))} className="hidden" />
              <input required autoComplete="name" value={requestForm.name} onChange={(event) => setRequestForm((old) => ({ ...old, name: event.target.value }))} placeholder="Your name" maxLength={60} className={inputClass} />
              <input autoComplete="email" type="email" value={requestForm.email} onChange={(event) => setRequestForm((old) => ({ ...old, email: event.target.value }))} placeholder="Your email (optional)" className={inputClass} />
              <input required autoComplete="username" value={requestForm.username} onChange={(event) => setRequestForm((old) => ({ ...old, username: event.target.value }))} placeholder="Choose a username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" className={inputClass} />
              <input required autoComplete="new-password" type="password" value={requestForm.password} onChange={(event) => setRequestForm((old) => ({ ...old, password: event.target.value }))} placeholder="Choose a password (12+ characters)" minLength={12} maxLength={128} className={inputClass} />
              {error ? <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</div> : null}
              {notice ? <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs text-emerald-100">{notice}</div> : null}
              {devReviewUrl ? <a href={devReviewUrl} className="block rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs font-bold text-amber-100">Open local approval link</a> : null}
              <button disabled={busy || !!notice} className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50">{busy ? "Sending request…" : notice ? "Waiting for approval" : "Send approval request"}</button>
            </form>
          )}
        </section>
      ) : null}

      {session.user ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className={`group relative overflow-hidden rounded-3xl border bg-[#07131c]/95 p-6 transition hover:-translate-y-1 ${tool.color === "red" ? "border-red-400/25 hover:border-red-300/60" : "border-cyan-300/25 hover:border-cyan-200/60"}`}>
              <div className={`text-[10px] font-black uppercase tracking-[0.3em] ${tool.color === "red" ? "text-red-300" : "text-cyan-300"}`}>{tool.kicker}</div>
              <h2 className="mt-3 text-3xl font-black text-white">{tool.label}</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">{tool.description}</p>
              <div className="mt-8 text-sm font-black text-white">Open tool <span className="transition group-hover:translate-x-1">→</span></div>
            </Link>
          ))}
        </section>
      ) : null}
    </main>
  );
}
