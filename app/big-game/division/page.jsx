// app/big-game/division/page.jsx
import { Suspense } from "react";
import BigGameDivisionClient from "@/lib/BigGameDivisionClient";

export default function BigGameDivisionPage() {
  return (
    <main className="min-h-screen">
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
            <p className="text-sm text-muted">Loading division…</p>
          </div>
        }
      >
        <BigGameDivisionClient />
      </Suspense>
    </main>
  );
}
