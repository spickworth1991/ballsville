// app/admin/highlander/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import HighlanderAdminClient from "@/components/admin/highlander/HighlanderAdminClient";

export default function AdminHighlanderPage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site w-full max-w-none px-3 sm:px-6 lg:px-10 space-y-5 sm:space-y-8">
          <AdminNav
            eyebrow="Admin · Highlander"
            title="Highlander Leagues"
            description="Create and manage Highlander leagues and page content."
          />
          <HighlanderAdminClient />
        </div>
      </section>
    </AdminGuard>
  );
}
