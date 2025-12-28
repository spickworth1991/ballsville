// app/dynasty/page.jsx
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import DynastyPageClient from "@/components/dynasty/DynastyPageClient";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: "The Dynasty Game | Ballsville",
  description:
    "The Heroes & Dragons of Dynasty – BALLSVILLE's Dynasty Empire leagues, rules, payouts, and league list.",
};

export default function DynastyPage() {
  return (
    <SectionManifestGate section="dynasty" season={CURRENT_SEASON}>
      <DynastyPageClient season={CURRENT_SEASON} />
    </SectionManifestGate>
  );
}
