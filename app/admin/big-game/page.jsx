// app/admin/big-game/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import BigGameAdminClient from "@/components/admin/big-game/BigGameAdminClient";

export default function BigGameAdminPage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
          <AdminNav
            eyebrow="Admin · Big Game"
            title="Big Game Divisions & Leagues"
            description="Manage Big Game divisions (themes) and the 8 leagues under each for the current season."
            publicHref="/big-game"
            publicLabel="← View Public Big Game Page"
          />

          <BigGameAdminClient />
        </div>
      </section>
    </AdminGuard>
  );
}
