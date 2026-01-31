import { Suspense } from "react";
import DraftCompareBuildHomeClient from "./DraftCompareBuildHomeClient";

// This page reads URL query params via useSearchParams().
// In Next (App Router), that must be done in a client component under Suspense.
export const dynamic = "force-dynamic";

export default function DraftCompareBuildHomePage() {
  return (
    <Suspense
      fallback={
        <section className="section">
          <div className="container-site">
            <div className="rounded-3xl border border-border bg-card-surface/80 p-6 backdrop-blur">
              <div className="text-sm text-muted">Loading…</div>
            </div>
          </div>
        </section>
      }
    >
      <DraftCompareBuildHomeClient />
    </Suspense>
  );
}
