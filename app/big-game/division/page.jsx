// app/big-game/division/page.jsx
import { Suspense } from "react";
import BigGameDivisionClient from "@/lib/BigGameDivisionClient";

export default function BigGameDivisionPage({ searchParams }) {
  const divisionSlug = typeof searchParams?.division === "string" ? searchParams.division : "";

  const yearRaw = typeof searchParams?.year === "string" ? searchParams.year : "";
  const yearNum = Number(String(yearRaw).trim());
  const year = Number.isFinite(yearNum) ? yearNum : undefined;
  return (
    <main className="min-h-screen">
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
            <p className="text-sm text-muted">Loading division…</p>
          </div>
        }
      >
        <BigGameDivisionClient divisionSlug={divisionSlug} year={year} />
      </Suspense>
    </main>
  );
}
