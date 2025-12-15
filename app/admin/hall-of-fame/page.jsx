"use client";

import AdminGuard from "@/components/AdminGuard";
import HallOfFameAdmin from "@/components/admin/HallOfFameAdmin";

export default function AdminHallOfFamePage() {
  return (
    <AdminGuard>
      <HallOfFameAdmin />
    </AdminGuard>
  );
}
