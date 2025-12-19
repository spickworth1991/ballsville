// app/admin/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";

function parseAdmins() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminHomePage() {
  const [user, setUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);
  const ADMIN_EMAILS = useMemo(parseAdmins, []);
  const isAdmin = !!user && ADMIN_EMAILS.includes((user?.email || "").toLowerCase());

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
            Only Ballsville admins have access here. If this is a mistake, please
            contact the site developer.
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

  return (
    <section className="section">
      <div className="container-site max-w-4xl space-y-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="badge">Admins</span>
            <h1 className="h2 mt-3 text-primary">Admin Dashboard</h1>
            <p className="text-muted mt-1 text-sm">
              Choose a tool to manage BALLSVILLE content and games.
            </p>
          </div>
          <button
            className="btn btn-outline"
            onClick={async () => {
              const supabase = getSupabase();
              if (supabase) await supabase.auth.signOut();
              location.href = "/admin/login";
            }}
          >
            Sign out
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/posts"
            className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
          >
            <h2 className="text-lg font-semibold text-primary">
              News & Mini Games
            </h2>
            <p className="mt-1 text-sm text-muted">
              Create and edit news posts, feature updates, and mini games. Controls
              what appears on the News page.
            </p>
          </Link>

          <Link
            href="/admin/dynasty"
            className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
          >
            <h2 className="text-lg font-semibold text-primary">
              Dynasty Leagues
            </h2>
            <p className="mt-1 text-sm text-muted">
              Manage Heroes & Dragons of Dynasty league metadata, Sleeper links, and
              orphan status.
            </p>
          </Link>
          <Link
            href="/admin/dynasty/wagering"
            className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
          >
            <h2 className="text-lg font-semibold text-primary">
              Dynasty Wagering
            </h2>
            <p className="mt-1 text-sm text-muted">
              Manage Wagering for dynasty leagues.
            </p>
          </Link>
          <Link
            href="/admin/big-game"
            className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
          >
            <h2 className="text-lg font-semibold text-primary">
              Big Game Divisions/Leagues
            </h2>
            <p className="mt-1 text-sm text-muted">
              Manage the big game.
            </p>
          </Link>
          <Link
            href="/admin/mini-leagues"
            className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
          >
            <h2 className="text-lg font-semibold text-primary">
              Mini Divisions/Leagues
            </h2>
            <p className="mt-1 text-sm text-muted">
              Manage the mini league game.
            </p>
          </Link>
          <Link
            href="/admin/gauntlet"
            className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
          >
            <h2 className="text-lg font-semibold text-primary">
              Gauntlet Legions
            </h2>
            <p className="mt-1 text-sm text-muted">
              Manage the Gauntlet.
            </p>
          </Link>
          <Link
            href="/admin/gauntlet/leg3"
            className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
          >
            <h2 className="text-lg font-semibold text-primary">
              Gauntlet Score Compare
            </h2>
            <p className="mt-1 text-sm text-muted">
              Compare Scores
            </p>
          </Link>
          <Link
            href="/admin/hall-of-fame"
            className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
          >
            <h2 className="text-lg font-semibold text-primary">
              Hall Of Fame Management
            </h2>
            <p className="mt-1 text-sm text-muted">
              Manage Hall of Fame entries.
            </p>
          </Link>

          {/* future tools can go here */}
        </div>
      </div>
    </section>
  );
}
