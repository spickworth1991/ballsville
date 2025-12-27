import SectionManifestGate from "@/components/data/SectionManifestGate";
import DynastyLeaguesClient from "@/components/dynasty/DynastyLeaguesClient";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: "Dynasty Divisions | BALLSVILLE",
  description: "Browse dynasty expansion divisions and leagues.",
};

export default function DynastyDivisionsPage({ searchParams }) {
  const year = searchParams?.year;
  const division = searchParams?.division;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <SectionManifestGate section="dynasty" season={CURRENT_SEASON}>
        <DynastyLeaguesClient year={year} division={division} mode="leagues" />
      </SectionManifestGate>
    </main>
  );
}
