// app/admin/dynasty/wagering/page.jsx
"use client";

import AdminGuard from "@/components/AdminGuard";
import DynastyWageringAdminClient from "../../../../components/dynasty/DynastyWageringAdminClient";

export default function Page() {
  return (
    <AdminGuard>
      <DynastyWageringAdminClient />
    </AdminGuard>
  );
}
