// app/admin/wager-trackers/page.jsx
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
            title="Wager Trackers"
            description="Central hub for all wager trackers."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              prefetch={false}
              href="/admin/big-game/wagers"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">💰 Big Game Wager Tracker</h2>
              <p className="mt-1 text-sm text-muted">Import eligibility, set wagers, and resolve pots.</p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/mini-leagues/wagers"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">🪙 Mini Leagues Wager Tracker</h2>
              <p className="mt-1 text-sm text-muted">Week 14 league-winner coins + Week 15 wagers/bonuses.</p>
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
