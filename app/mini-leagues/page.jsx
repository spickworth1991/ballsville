import { siteConfig } from "@/app/config/siteConfig";
import MiniLeaguesClient from "../../components/mini-leagues/MiniLeaguesClient";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

const pageTitle = `Mini-Leagues | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/mini-leagues`;

export const metadata = {
  title: pageTitle,
  description:
    "Budget best ball redraft mini-leagues with optional wagering, division bonuses, and championship bonuses.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description:
      "Budget best ball redraft mini-leagues with optional wagering, division bonuses, and championship bonuses.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  return (
    <SectionManifestGate section="mini-leagues" season={CURRENT_SEASON}>
      <MiniLeaguesClient season={CURRENT_SEASON} />
    </SectionManifestGate>
  );
}
