"use client";

import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";

export default function AdminConstitutionsHubPage() {
  return (
    <AdminGuard>
      <main className="min-h-screen text-fg relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-glow" />
        </div>

        <section className="section">
          <div className="container-site space-y-8">
            <AdminNav activeId="constitutions" title="Constitutions" />

            <header className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-xl">
              <p className="text-xs uppercase tracking-[0.35em] text-muted">Admin</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-primary">Constitution Editor</h1>
              <p className="mt-2 text-sm text-muted max-w-3xl">
                Dynasty is editable now. The main constitution editor will be added later.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                prefetch={false}
                href="/admin/constitution"
                className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
              >
                <h2 className="text-lg font-semibold text-primary">Main Constitution</h2>
                <p className="mt-1 text-sm text-muted">Edit sections, reorder, and publish updates.</p>
              </Link>
              <Link
                prefetch={false}
                href="/admin/constitution/dynasty"
                className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
              >
                <h2 className="text-lg font-semibold text-primary">Dynasty Constitution</h2>
                <p className="mt-1 text-sm text-muted">Edit sections, reorder, and publish updates.</p>
              </Link>
              
            </div>
          </div>
        </section>
      </main>
    </AdminGuard>
  );
}
