// app/gauntlet/legions/page.jsx

import { Suspense } from "react";
import GauntletLegionsPageClient from "@/components/gauntlet/GauntletLegionsPageClient";

// Keep this statically exportable (same pattern as Big Game divisions)
export const dynamic = "force-static";

export default function GauntletLegionsPage() {
  return (
    <Suspense
      fallback={
        <section className="section">
          <div className="container-site max-w-6xl">
            <div className="bg-card-surface border border-subtle rounded-2xl p-6 text-center shadow-sm">
              <p className="text-muted">Loading Gauntlet Legions…</p>
            </div>
          </div>
        </section>
      }
    >
      <GauntletLegionsPageClient />
    </Suspense>
  );
}
