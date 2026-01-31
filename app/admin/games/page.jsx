// app/admin/games/page.jsx
"use client";

import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";

export default function AdminWagerTrackersPage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site max-w-4xl space-y-8">
          <AdminNav
            eyebrow="Admin"
            title="Game Management"
            description="Central hub for all game management tasks."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              prefetch={false}
              href="/admin/big-game"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Big Game Divisions/Leagues</h2>
              <p className="mt-1 text-sm text-muted">Manage the Big Game.</p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/mini-leagues"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Mini Divisions/Leagues</h2>
              <p className="mt-1 text-sm text-muted">Manage the mini league game.</p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/redraft"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Redraft</h2>
              <p className="mt-1 text-sm text-muted">
                Manage the Redraft page updates block and live league list.
              </p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/highlander"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Highlander</h2>
              <p className="mt-1 text-sm text-muted">
                Manage the Highlander page updates block and live league list.
              </p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/gauntlet"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Gauntlet Legions</h2>
              <p className="mt-1 text-sm text-muted">Manage the Gauntlet.</p>
            </Link>
            
            <Link
              prefetch={false}
              href="/admin/dynasty"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Dynasty Leagues</h2>
              <p className="mt-1 text-sm text-muted">
                Manage Heroes & Dragons of Dynasty league metadata, Sleeper links, and orphan status.
              </p>
            </Link>
            
            
            
            
            
          </div>

          <div>
            <Link href="/admin" className="btn btn-secondary">← Back to Admin Home</Link>
          </div>
        </div>
      </section>
    </AdminGuard>
  );
}
