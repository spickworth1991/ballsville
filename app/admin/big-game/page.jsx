// app/admin/biggame/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";
import BigGameAdminClient from "@/lib/BigGameAdminClient";

function parseAdmins() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default function BigGameAdminPage() {
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
              Admin · Big Game
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold mt-1">
              Big Game Divisions &amp; Leagues
            </h1>
            <p className="text-sm text-muted mt-1">
              Manage Big Game divisions (themes) and the 8 leagues under each
              for the current season.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href="/big-game" className="btn btn-outline text-sm">
              ← View Public Big Game Page
            </Link>
            <a href="/admin" className="btn btn-outline">
            ← Admin Home
          </a>
            <button
              className="btn btn-outline text-xs"
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

        <BigGameAdminClient />
      </div>
    </section>
  );
}
