// app/admin/big-game/wagers/page.jsx
"use client";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import BigGameWagersAdminClient from "@/components/admin/big-game/BigGameWagersAdminClient";
import { CURRENT_SEASON } from "@/lib/season";

export default function BigGameWagersAdminPage() {
  return (
  <AdminGuard>
    <main className="min-h-screen text-fg">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <AdminNav title="Big Game — Wager Tracker" />
        <BigGameWagersAdminClient season={CURRENT_SEASON} />
      </div>
    </main>
  </AdminGuard>
  );
}
