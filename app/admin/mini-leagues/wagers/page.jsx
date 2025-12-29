// app/admin/mini-leagues/wagers/page.jsx
"use client";

import AdminNav from "@/components/admin/AdminNav";
import MiniLeaguesWagersAdminClient from "@/components/admin/mini-leagues/MiniLeaguesWagersAdminClient";
import { CURRENT_SEASON } from "@/lib/season";

export default function MiniLeaguesWagersAdminPage() {
  return (
    <main className="min-h-screen text-fg">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <AdminNav title="Mini Leagues — Wager Tracker" />
        <MiniLeaguesWagersAdminClient season={CURRENT_SEASON} />
      </div>
    </main>
  );
}
