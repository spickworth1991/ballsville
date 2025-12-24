// app/gauntlet/[legions]/page.jsx
//
// Compatibility route (older links):
// /gauntlet/greeks -> redirects to /gauntlet/legions/greeks
// Works with output: export by pre-building the known legion slugs.

import { redirect } from "next/navigation";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ legions: "greeks" }, { legions: "romans" }, { legions: "egyptians" }];
}

export default function GauntletLegionCompatPage({ params }) {
  const slug = String(params?.legions || "").toLowerCase();
  redirect(`/gauntlet/legions/${encodeURIComponent(slug)}`);
}
