import { Suspense } from "react";
import AdminGuard from "@/components/AdminGuard";
import AddHighlanderLeaguesClient from "./AddHighlanderLeaguesClient";

export default function Page() {
  return (
    <AdminGuard>
      <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-10 text-white/70">Loading…</div>}>
        <AddHighlanderLeaguesClient />
      </Suspense>
    </AdminGuard>
  );
}
