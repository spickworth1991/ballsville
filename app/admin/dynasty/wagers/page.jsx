// app/admin/dynasty/wagers/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import DynastyWagersAdminClient from "@/components/admin/dynasty/DynastyWagersAdminClient";

export default function AdminDynastyWagersPage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
          <AdminNav
            eyebrow="Admin · Dynasty"
            title="Dynasty Wager Tracker"
            description="Import Week 17 finalists, set wager/bank decisions, and resolve bonuses."
            publicHref="/dynasty/wagers"
            publicLabel="← View Public Dynasty Wager Tracker"
          />

          <DynastyWagersAdminClient />
        </div>
      </section>
    </AdminGuard>
  );
}
