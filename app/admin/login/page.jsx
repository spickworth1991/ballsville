"use client";

import { useEffect, useState } from "react";

const inputCls = "w-full rounded-xl border border-subtle bg-black/10 px-4 py-3 pr-12 text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25";

function PasswordField({ value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input required type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={autoComplete === "new-password" ? 12 : undefined} maxLength={128} value={value} onChange={onChange} placeholder={placeholder} className={inputCls} />
      <button type="button" onClick={() => setVisible((old) => !old)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted transition hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
        {visible ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5 stroke-current" strokeWidth="1.8"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.2 9 5.2a15.7 15.7 0 0 1-2.1 2.7M6.6 6.6A16.4 16.4 0 0 0 3 9.2s3.5 5.2 9 5.2c1 0 2-.2 2.9-.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5 stroke-current" strokeWidth="1.8"><path d="M3 12s3.5-5.2 9-5.2 9 5.2 9 5.2-3.5 5.2-9 5.2S3 12 3 12Z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.4" /></svg>}
      </button>
    </div>
  );
}

export default function AdminLogin() {
  const [view, setView] = useState("login");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [request, setRequest] = useState({ username: "", email: "", password: "", confirmPassword: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devReviewUrl, setDevReviewUrl] = useState("");

  useEffect(() => {
    fetch("/api/admin/auth/session", { cache: "no-store" }).then((response) => {
      if (response.ok) location.replace("/admin");
    }).catch(() => {});
  }, []);

  function switchView(next) { setView(next); setError(""); setNotice(""); setDevReviewUrl(""); }

  async function submitLogin(event) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(login) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(data.error || "Unable to sign in.");
    const next = new URLSearchParams(location.search).get("next");
    location.href = next?.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";
  }

  async function submitRequest(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/auth/request-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
    const data = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(data.error || "Unable to send the admin request.");
    setNotice(data.message); setDevReviewUrl(data.devReviewUrl || "");
    setRequest({ username: "", email: "", password: "", confirmPassword: "", website: "" });
  }

  return (
    <section className="section">
      <div className="container-site flex min-h-[65vh] flex-col items-center justify-center">
        <div className="mb-8 text-center"><span className="badge">Administrators</span><h1 className="h1 mt-3 text-primary">Ballsville Admin</h1><p className="lead mt-3 text-muted">A separate, private login for Ballsville management.</p></div>
        <section className="card w-full max-w-md border border-subtle bg-card-surface p-6 sm:p-8">
          <div className="flex rounded-xl border border-subtle bg-black/10 p-1">
            {[{ id: "login", label: "Sign in" }, { id: "request", label: "Create account" }].map((item) => <button key={item.id} type="button" onClick={() => switchView(item.id)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${view === item.id ? "bg-accent text-white" : "text-muted hover:text-primary"}`}>{item.label}</button>)}
          </div>
          <h2 className="mt-6 text-xl font-semibold text-primary">{view === "login" ? "Admin sign in" : "Request an admin account"}</h2>
          <p className="mt-2 text-sm text-muted">{view === "login" ? "Use your approved admin username and password." : "The account remains locked until approved through the private email link."}</p>
          {view === "login" ? (
            <form onSubmit={submitLogin} className="mt-5 space-y-3">
              <input required autoComplete="username" value={login.username} onChange={(event) => setLogin((old) => ({ ...old, username: event.target.value }))} placeholder="Username" className={inputCls.replace(" pr-12", "")} />
              <PasswordField value={login.password} onChange={(event) => setLogin((old) => ({ ...old, password: event.target.value }))} placeholder="Password" autoComplete="current-password" />
              {error ? <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
              <button disabled={busy} className="btn btn-primary w-full" type="submit">{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          ) : (
            <form onSubmit={submitRequest} className="mt-5 space-y-3">
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={request.website} onChange={(event) => setRequest((old) => ({ ...old, website: event.target.value }))} className="hidden" />
              <input required autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" value={request.username} onChange={(event) => setRequest((old) => ({ ...old, username: event.target.value }))} placeholder="Choose a username" className={inputCls.replace(" pr-12", "")} />
              <input type="email" autoComplete="email" value={request.email} onChange={(event) => setRequest((old) => ({ ...old, email: event.target.value }))} placeholder="Email (optional)" className={inputCls.replace(" pr-12", "")} />
              <PasswordField value={request.password} onChange={(event) => setRequest((old) => ({ ...old, password: event.target.value }))} placeholder="Choose a password (12+ characters)" autoComplete="new-password" />
              <PasswordField value={request.confirmPassword} onChange={(event) => setRequest((old) => ({ ...old, confirmPassword: event.target.value }))} placeholder="Confirm password" autoComplete="new-password" />
              {error ? <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
              {notice ? <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div> : null}
              {devReviewUrl ? <a href={devReviewUrl} className="block rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm font-semibold text-amber-200">Open local approval link</a> : null}
              <button disabled={busy || !!notice} className="btn btn-primary w-full" type="submit">{busy ? "Sending…" : notice ? "Waiting for approval" : "Send approval request"}</button>
            </form>
          )}
        </section>
      </div>
    </section>
  );
}
