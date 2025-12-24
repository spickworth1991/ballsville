"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CURRENT_SEASON } from "@/lib/season";
import GauntletLegionsClient from "@/components/gauntlet/GauntletLegionsClient";
import GauntletLegionClient from "@/components/gauntlet/GauntletLegionClient";

export default function GauntletLegionsPageClient() {
  const searchParams = useSearchParams();

  const legionSlug = useMemo(() => {
    const raw = searchParams?.get("legion") || "";
    return raw.trim().toLowerCase();
  }, [searchParams]);

  // No selection: show the legion tabs/cards
  if (!legionSlug) {
    return <GauntletLegionsClient />;
  }

  // Selected: show the "division-style" page of leagues within the legion
  return (
    <section className="section">
      <div className="container-site max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/gauntlet/legions" className="btn btn-outline">
            ← Back to Legions
          </Link>

          <div className="text-xs text-muted">
            Season: <span className="font-mono text-primary">{CURRENT_SEASON}</span>
          </div>
        </div>

        <GauntletLegionClient legionSlug={legionSlug} season={CURRENT_SEASON} />
      </div>
    </section>
  );
}
