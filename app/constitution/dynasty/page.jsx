import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import DynastyConstitutionClient from "@/components/constitution/DynastyConstitutionClient";

export const metadata = {
  title: "Dynasty Constitution | BALLSVILLE",
  description: "The Dynasty rules, bylaws, and code of conduct for BALLSVILLE.",
  alternates: { canonical: "/constitution/dynasty" },
};

export default function DynastyConstitutionPage() {
  return (
    <SectionManifestGate section="dynasty-constitution">
      <DynastyConstitutionClient />
    </SectionManifestGate>
  );
}
