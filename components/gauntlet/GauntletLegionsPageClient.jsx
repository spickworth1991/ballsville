"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { CURRENT_SEASON } from "@/lib/season";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import GauntletLegionClient from "@/components/gauntlet/GauntletLegionClient";

export default function GauntletLegionsPageClient() {
  const searchParams = useSearchParams();

  const { legion, year } = useMemo(() => {
    const legionParam = (searchParams?.get("legion") || "").trim();
    const yearParam = (searchParams?.get("year") || "").trim();

    // Keep it deterministic for export builds.
    const y = Number.parseInt(yearParam || String(CURRENT_SEASON), 10);
    const safeYear = Number.isFinite(y) ? y : CURRENT_SEASON;

    return {
      legion: legionParam,
      year: safeYear,
    };
  }, [searchParams]);

  // No legion selected => show a lightweight hint.
  if (!legion) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Gauntlet Legions</h1>
        <p style={{ opacity: 0.8, margin: 0 }}>
          Pick a legion from the Gauntlet page to view its leagues.
        </p>
      </div>
    );
  }

  return <GauntletLegionClient legionKey={legion} year={year} />;
}
