// src/components/AdminGuard.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient"; // ⬅️ match your Gauntlet imports

function parseAdmins() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Generic admin gate for Ballsville admin pages.
 *
 * Usage:
 *   <AdminGuard>
 *     {/* your admin UI here *\/}
 *   </AdminGuard>
 */
export default function AdminGuard({ children }) {
  const [user, setUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);

  const ADMIN_EMAILS = useMemo(parseAdmins, []);
  const isAdmin =
    !!user && ADMIN_EMAILS.includes((user?.email || "").toLowerCase());

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

  // 1) Still checking
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

  // 2) Not logged in at all
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

  // 3) Logged in but not in the admin list
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

  // 4) ✅ Admin – render the actual admin UI
  return <>{children}</>;
}
