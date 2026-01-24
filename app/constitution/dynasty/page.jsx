import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import DynastyConstitutionClient from "@/components/constitution/DynastyConstitutionClient";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: "Dynasty Constitution | BALLSVILLE",
  description: "The Dynasty rules, bylaws, and code of conduct for BALLSVILLE.",
  alternates: { canonical: "/constitution/dynasty" },
};

export default function DynastyConstitutionPage() {
  const season = CURRENT_SEASON;

  return (
    <SectionManifestGate section="dynasty-constitution" season={season}>
      <DynastyConstitutionClient season={season} />
    </SectionManifestGate>
  );
}
