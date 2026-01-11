// app/admin/gauntlet/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import GauntletAdminClient from "@/components/admin/gauntlet/GauntletAdminClient";

export default function GauntletAdminPage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site w-full max-w-none px-3 sm:px-6 lg:px-10 space-y-5 sm:space-y-6">
          <AdminNav
            eyebrow="Admin · Gauntlet"
            title="Gauntlet Legions"
            description="Create and manage Gauntlet Legions — set their status, ordering, and descriptive text. These changes feed directly into the public Gauntlet page."
            publicHref="/gauntlet"
            publicLabel="← View Public Gauntlet Page"
          />

          <GauntletAdminClient />
        </div>
      </section>
    </AdminGuard>
  );
}
