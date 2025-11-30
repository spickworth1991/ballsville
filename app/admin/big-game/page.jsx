// app/admin/biggame/page.jsx
"use client";

import Link from "next/link";
import BigGameAdminClient from "@/lib/BigGameAdminClient";

export default function BigGameAdminPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">
              Admin · Big Game
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold">
              Big Game Divisions &amp; Leagues
            </h1>
            <p className="text-sm text-muted">
              Manage Big Game divisions (themes) and the 8 leagues under each
              for the current season.
            </p>
          </div>
          <Link href="/big-game" className="btn btn-outline text-sm">
            ← View Public Big Game Page
          </Link>
        </header>

        <BigGameAdminClient />
      </div>
    </main>
  );
}
