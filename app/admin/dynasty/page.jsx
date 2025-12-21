// app/admin/dynasty/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";
import DynastyAdminClient from "@/lib/DynastyAdminClient";

function parseAdmins() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminDynastyPage() {
  const [user, setUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);

  const ADMIN_EMAILS = useMemo(parseAdmins, []);
  const isAdmin =
    !!user && ADMIN_EMAILS.includes((user?.email || "").toLowerCase());

  // Auth check (same pattern as other admin pages)
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setUserChecked(true);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      setUserChecked(true);
    });
  }, []);

  // ---------- gated renders ----------

  if (!userChecked) {
    return (
      <section className="section">
        <div className="container-site max-w-xl">
          <div className="card bg-card-surface border border-subtle p-6 text-center">
            <p className="text-muted">Checking access…</p>
          </div>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="container-site max-w-xl text-center space-y-3">
          <h1 className="h2 mb-2 text-primary">Access required</h1>
          <p className="text-muted">
            Only Ballsville admins have access here. If this is a mistake,
            please contact the site developer.
          </p>
          <a href="/admin/login" className="btn btn-primary mt-4">
            Go to Login
          </a>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="section">
        <div className="container-site max-w-xl text-center space-y-3">
          <h1 className="h2 mb-2 text-primary">No access</h1>
          <p className="text-muted">
            Sorry, you do not have access to this page.
          </p>
          <button
            className="btn btn-outline mt-4"
            onClick={async () => {
              const supabase = getSupabase();
              if (supabase) await supabase.auth.signOut();
              location.href = "/admin/login";
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    );
  }

  // ---------- admin UI (only for real admins) ----------

  return (
    <section className="section">
      <div className="container-site max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="badge">Admins</span>
            <p className="text-xs uppercase tracking-[0.3em] text-accent mt-2">
              Admin · Dynasty
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold mt-1">
              Dynasty Themes &amp; Leagues
            </h1>
            <p className="text-sm text-muted mt-1 max-w-prose">
              Manage Dynasty Empire themes (per year) and all leagues under each
              theme. Each theme gets an expandable section with editable league
              rows and a per-theme save button.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href="/dynasty" className="btn btn-primary text-sm">
              ← View Public Dynasty Page
            </Link>
            <Link href="/admin" className="btn btn-primary text-xs">
              Admin Home
            </Link>
            <button
              className="btn btn-primary text-xs"
              onClick={async () => {
                const supabase = getSupabase();
                if (supabase) await supabase.auth.signOut();
                location.href = "/admin/login";
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <DynastyAdminClient />
      </div>
    </section>
  );
}
