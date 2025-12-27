"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import DynastyLeaguesClient from "@/components/dynasty/DynastyLeaguesClient";

/**
 * Reads `?year=` + `?division=` from the URL on the client.
 * This mirrors the Big Game + Gauntlet pattern so the site can
 * be statically exported (output: "export") without prerender errors.
 */
export default function DynastyDivisionsPageClient(props) {
  const searchParams = useSearchParams();

  const { year, division } = useMemo(() => {
    const y = searchParams?.get("year") || "";
    const d = searchParams?.get("division") || "";
    return { year: y, division: d };
  }, [searchParams]);

  // SectionManifestGate injects `version` (and manifest/error) into this component.
  // We forward everything into the actual renderer.
  return <DynastyLeaguesClient {...props} year={year} division={division} />;
}
