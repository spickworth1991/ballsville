// src/app/admin/gauntlet/page.jsx
import Link from "next/link";
import GauntletAdminClient from "@/lib/GauntletAdminClient";

export const metadata = {
  title: "Gauntlet Admin | Ballsville",
};

export default function GauntletAdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold">Gauntlet Admin</h1>
        <p className="text-sm text-muted max-w-2xl">
          Create and manage Gauntlet <strong>Legions</strong> — set their
          status, ordering, and descriptive text. These changes feed directly
          into the public Gauntlet page.
        </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href="/gauntlet" className="btn btn-primary text-sm">
            ← View Public Gauntlet Page
          </Link>
          <Link href="/admin" className="btn btn-primary text-sm">
            Admin Home
          </Link>
        </div>
      </header>

      <GauntletAdminClient />
    </main>
  );
}
