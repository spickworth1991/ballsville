// app/admin/dynasty/wagers/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import DynastyWagersAdminClient from "@/components/admin/dynasty/DynastyWagersAdminClient";
import { CURRENT_SEASON } from "@/lib/season";

export default function AdminDynastyWagersPage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site max-w-6xl space-y-8">
          <AdminNav
            eyebrow="Admin · Dynasty"
            title="Dynasty Wager Tracker"
            description="Step 1: pick finalists. Step 2: set bank/wager. Step 3: resolve Week 17 payouts."
          />
          <DynastyWagersAdminClient season={CURRENT_SEASON} />
        </div>
      </section>
    </AdminGuard>
  );
}
