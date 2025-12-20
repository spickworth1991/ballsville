// app/admin/login/page.jsx
"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

function getSiteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000" ||
    "https://ballsville.pages.dev/"||
    "http://localhost:8788"
  );
}

const cardCls =
  "card bg-card-surface border border-subtle p-8 w-full max-w-md";
const inputCls =
  "mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2 " +
  "focus:outline-none focus:ring-primary focus:ring-2 transition";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("Sending magic link…");

    const supabase = getSupabase();
    if (!supabase) {
      setMsg("Please open this page in a browser.");
      return;
    }

    const site = getSiteOrigin();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${site}/admin` }, // ⬅️ main admin hub
    });

    setMsg(error ? error.message : "Check your email for the magic link.");
  }

  return (
    <section className="section">
      <div className="container-site flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center mb-8">
          <span className="badge">Admins</span>
          <h1 className="h1 mt-3 text-primary">Admin Login</h1>
          <p className="lead mt-3 text-muted">
            Sign in with a one-time magic link sent to your email.
          </p>
        </div>

        <section className={cardCls}>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-left">
              <span className="text-sm text-muted">Email address</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@yourdomain.com"
                autoComplete="email"
              />
            </label>

            <button className="btn btn-primary w-full" type="submit">
              Send Magic Link
            </button>

            {msg && (
              <p className="text-sm mt-2 text-center text-muted">{msg}</p>
            )}
          </form>

          <p className="mt-4 text-xs text-muted text-center">
            Trouble? Check your spam folder or contact the site developer.
          </p>
        </section>
      </div>
    </section>
  );
}
