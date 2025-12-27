// app/dynasty/divisions/page.jsx
// Static export safe (output: "export"). We must read ?year=&division= on the client.

import { Suspense } from "react";
import SectionManifestGate from "@/components/data/SectionManifestGate";
import DynastyDivisionsPageClient from "@/components/dynasty/DynastyDivisionsPageClient";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: "Dynasty Divisions | BALLSVILLE",
  description: "Browse dynasty expansion divisions and leagues.",
};

export const dynamic = "force-static";

export default function DynastyDivisionsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SectionManifestGate section="dynasty" season={CURRENT_SEASON}>
          <DynastyDivisionsPageClient />
        </SectionManifestGate>
      </Suspense>
    </main>
  );
}
