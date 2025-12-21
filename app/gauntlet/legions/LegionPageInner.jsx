"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import GauntletLegionClient from "@/src/lib/GauntletLegionClient";

export default function LegionPageInner() {
  const sp = useSearchParams();
  const year = Number(sp.get("year") || "2025") || 2025;
  const legionSlug = (sp.get("legion") || "").trim();

  const backHref = useMemo(() => `/gauntlet?year=${encodeURIComponent(String(year))}`, [year]);

  return <GauntletLegionClient year={year} legionSlug={legionSlug} backHref={backHref} />;
}
