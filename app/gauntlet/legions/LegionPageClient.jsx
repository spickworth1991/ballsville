"use client";

import { Suspense } from "react";
import LegionPageInner from "./LegionPageInner";

export default function LegionPageClient() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <LegionPageInner />
    </Suspense>
  );
}
