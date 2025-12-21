"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import BigGameDivisionClient from "@/lib/BigGameDivisionClient";

export default function DivisionPageClient() {
  const sp = useSearchParams();

  const { year, divisionSlug, backHref } = useMemo(() => {
    const y = Number(sp?.get("year") || 2025) || 2025;
    const d = String(sp?.get("division") || "").trim();
    return {
      year: y,
      divisionSlug: d,
      backHref: `/big-game?year=${y}`,
    };
  }, [sp]);

  return <BigGameDivisionClient year={year} divisionSlug={divisionSlug} backHref={backHref} />;
}
