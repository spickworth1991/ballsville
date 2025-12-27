"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import BigGameDivisionClient from "@/components/big-game/BigGameDivisionClient";
import { CURRENT_SEASON } from "@/lib/season";

export default function DivisionPageClient() {
  const sp = useSearchParams();

  const { year, divisionSlug, backHref } = useMemo(() => {
    const y = Number(sp?.get("year") || CURRENT_SEASON) || CURRENT_SEASON;
    const d = String(sp?.get("division") || "").trim();
    return {
      year: y,
      divisionSlug: d,
      backHref: `/big-game?year=${y}`,
    };
  }, [sp]);

  return <BigGameDivisionClient year={year} divisionSlug={divisionSlug} backHref={backHref} />;
}