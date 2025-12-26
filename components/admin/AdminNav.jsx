// components/admin/AdminNav.jsx
"use client";

import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";

/**
 * Reusable admin header/nav for all admin pages.
 *
 * Props:
 * - eyebrow: small label (ex: "Admin · Big Game")
 * - title: page H1
 * - description: optional helper text under title
 * - publicHref: optional link to the corresponding public page
 * - publicLabel: label for the public link button
 * - rightExtra: optional extra node(s) rendered above the sign out button
 * - showAdminHome: defaults true
 */
export default function AdminNav({
  eyebrow = "Admin",
  title = "Admin",
  description = "",
  publicHref = "",
  publicLabel = "← View Public Page",
  rightExtra = null,
  showAdminHome = true,
}) {
  async function signOut() {
    try {
      const supabase = getSupabase();
      if (supabase) await supabase.auth.signOut();
    } finally {
      location.href = "/admin/login";
    }
  }

  return (
    <header className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <span className="badge">Admins</span>
        <p className="text-xs uppercase tracking-[0.3em] text-accent mt-2">
          {eyebrow}
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold mt-1">{title}</h1>
        {description ? (
          <p className="text-sm text-muted mt-1 max-w-prose">{description}</p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-2">
        {publicHref ? (
          <Link href={publicHref} className="btn btn-primary text-sm">
            {publicLabel}
          </Link>
        ) : null}

        {showAdminHome ? (
          <Link href="/admin" className="btn btn-primary text-xs">
            ← Admin Home
          </Link>
        ) : null}

        {rightExtra}

        <button className="btn btn-primary text-xs" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
