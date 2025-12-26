// app/admin/mini-leagues/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import MiniLeaguesAdminClient from "@/components/admin/mini-leagues/MiniLeaguesAdminClient";

export default function AdminMiniLeaguesPage() {
  return (
    <AdminGuard>
      <MiniLeaguesAdminClient />
    </AdminGuard>
  );
}
