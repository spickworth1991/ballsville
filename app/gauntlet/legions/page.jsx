// app/gauntlet/legions/page.jsx
// Static export friendly: no searchParams + no useSearchParams.

import GauntletLegionsClient from "@/components/gauntlet/GauntletLegionsClient";
import { CURRENT_SEASON } from "@/lib/season";

export const dynamic = "force-static";

export default function GauntletLegionsPage() {
  return <GauntletLegionsClient year={CURRENT_SEASON} />;
}
