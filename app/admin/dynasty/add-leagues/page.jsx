// app/admin/dynasty/add-leagues/page.jsx
import { Suspense } from "react";
import AddDynastyLeaguesClient from "./AddDynastyLeaguesClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-10 text-white/70">Loading…</div>}>
      <AddDynastyLeaguesClient />
    </Suspense>
  );
}
