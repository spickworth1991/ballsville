// app/admin/big-game/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import BigGameAdminClient from "@/components/admin/big-game/BigGameAdminClient";
import Link from "next/link";

export default function BigGameAdminPage() {
  return (
    <AdminGuard>
      <section className="section">
        <div className="container-site w-full max-w-none px-3 sm:px-6 lg:px-10 space-y-5 sm:space-y-8">
          <AdminNav
            eyebrow="Admin · Big Game"
            title="Big Game Divisions & Leagues"
            description="Manage Big Game divisions (themes) and the 8 leagues under each for the current season."
            publicHref="/big-game"
            publicLabel="← View Public Big Game Page"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/admin/big-game/wagers"
              className="btn btn-primary w-full justify-center sm:w-auto">
              💰 Big Game Wager Tracker
            </Link>
          </div>

          <BigGameAdminClient />
        </div>
      </section>
    </AdminGuard>
  );
}
