// app/gauntlet/legions/page.jsx
// Public: list all leagues within a Gauntlet "Legion" (Romans / Greeks / Egyptians), like Big Game divisions.

import { Suspense } from "react";
import GauntletLegionClient from "@/components/gauntlet/GauntletLegionClient";

export const metadata = {
  title: "Gauntlet — Legion Leagues",
  description: "View all leagues within a Gauntlet legion.",
};

export default function GauntletLegionPage({ searchParams }) {
  // Next can provide searchParams as a Promise in some setups; GauntletLegionClient already handles both shapes.
  return (
    <Suspense fallback={<div className="container-site py-10 text-muted">Loading legion…</div>}>
      <GauntletLegionClient searchParams={searchParams} />
    </Suspense>
  );
}
