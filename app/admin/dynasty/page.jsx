// app/admin/dynasty/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import DynastyAdminClient from "@/components/admin/dynasty/DynastyAdminClient";

export default function AdminDynastyPage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
          <AdminNav
            eyebrow="Admin · Dynasty"
            title="Dynasty Themes & Leagues"
            description="Manage Dynasty Empire themes (per year) and all leagues under each theme. Each theme gets an expandable section with editable league rows and a per-theme save button."
            publicHref="/dynasty"
            publicLabel="← View Public Dynasty Page"
          />

          <DynastyAdminClient />
        </div>
      </section>
    </AdminGuard>
  );
}
