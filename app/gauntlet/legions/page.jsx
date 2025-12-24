// app/gauntlet/legions/page.jsx
// Static page (works with output: export). Uses a client component + Suspense
// to safely read query params (legion/year) via useSearchParams.

import { Suspense } from "react";
import GauntletLegionsPageClient from "@/components/gauntlet/GauntletLegionsPageClient";

export const dynamic = "force-static";

export default function GauntletLegionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <GauntletLegionsPageClient />
    </Suspense>
  );
}
