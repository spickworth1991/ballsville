// app/admin/page.jsx
"use client";

import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";

export default function AdminHomePage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site max-w-4xl space-y-8">
          <AdminNav
            eyebrow="Admin"
            title="Admin Dashboard"
            description="Choose a tool to manage BALLSVILLE content and games."
            showAdminHome={false}
          />

          <div className="grid gap-4 sm:grid-cols-2">

            <Link
              prefetch={false}
              href="/admin/games"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Game Modes</h2>
              <p className="mt-1 text-sm text-muted">
                Edit all game modes here.
              </p>
            </Link>
            

            <Link
              prefetch={false}
              href="/admin/constitutions"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Constitutions</h2>
              <p className="mt-1 text-sm text-muted">
                Edit constitution pages (Dynasty now; main constitution coming later).
              </p>
            </Link>
   
            <Link
              prefetch={false}
              href="/admin/draft-compare"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Draft Compare</h2>
              <p className="mt-1 text-sm text-muted">
                Upload mode draft JSON and customize the Draft Compare landing page. Users can select which leagues to compare.
              </p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/hall-of-fame"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Hall Of Fame Management</h2>
              <p className="mt-1 text-sm text-muted">Manage Hall of Fame entries.</p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/about-managers"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Meet our managers</h2>
              <p className="mt-1 text-sm text-muted">
                Update manager profiles shown on the About page. Includes photos, bullets, and a modal bio.
              </p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/wager-trackers"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">Wager Trackers</h2>
              <p className="mt-1 text-sm text-muted">Manage Big Game + Mini Leagues wager tracking.</p>
            </Link>

            <Link
              prefetch={false}
              href="/admin/posts"
              className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
            >
              <h2 className="text-lg font-semibold text-primary">News & Mini Games</h2>
              <p className="mt-1 text-sm text-muted">
                Create and edit news posts, feature updates, and mini games. Controls what appears on the News page.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </AdminGuard>
  );
}
