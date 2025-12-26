"use client";

import AdminGuard from "@/components/AdminGuard";
import HallOfFameAdmin from "@/components/admin/HallOfFameAdmin";
import AdminNav from "@/components/admin/AdminNav";

export default function AdminHallOfFamePage() {
  return (
    <AdminGuard>
     <section className="section">
        <div className="container-site max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
      <AdminNav
                  eyebrow="Admin · Hall Of Fame"
                  title="Hall of Fame"
                  description="Create and manage Hall of Fame entries — set their status, ordering, and descriptive text. These changes feed directly into the public Hall of Fame page."
                  publicHref="/hall-of-fame"
                  publicLabel="← View Public Hall of Fame Page"
                />
      <HallOfFameAdmin />
        </div>
      </section>
    </AdminGuard>
  );
}
