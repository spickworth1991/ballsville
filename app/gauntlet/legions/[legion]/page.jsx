// app/gauntlet/legions/[legion]/page.jsx
// Shows all leagues in a given Gauntlet Legion (Greeks / Romans / Egyptians).
// Must be static-export friendly, so we hardcode known legion slugs.

import GauntletLegionClient from "@/components/gauntlet/GauntletLegionClient";
import { CURRENT_SEASON } from "@/lib/season";
import { notFound } from "next/navigation";

export const dynamic = "force-static";

const LEGION_SLUGS = ["greeks", "romans", "egyptians"];

export function generateStaticParams() {
  return LEGION_SLUGS.map((legion) => ({ legion }));
}

export default function GauntletLegionPage({ params }) {
  const slug = String(params?.legion || "").toLowerCase();
  if (!LEGION_SLUGS.includes(slug)) notFound();

  return (
    <GauntletLegionClient
      year={CURRENT_SEASON}
      legionSlug={slug}
    />
  );
}
