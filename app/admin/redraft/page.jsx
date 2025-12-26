// app/admin/redraft/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import RedraftAdminClient from "@/components/admin/redraft/RedraftAdminClient";

export default function AdminRedraftPage() {
  return (
    <AdminGuard>
      <RedraftAdminClient />
    </AdminGuard>
  );
}
