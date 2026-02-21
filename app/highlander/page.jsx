import { siteConfig } from "@/app/config/siteConfig";
import HighlanderClient from "@/components/highlander/HighlanderClient";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

const pageTitle = `Highlander | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/highlander`;

export const metadata = {
  title: pageTitle,
  description:
    "10x Guillotine leagues for 2026. Survive Weeks 1–14, then wager in Weeks 15–17 for the $500 Highlander crown.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description:
      "10x Guillotine leagues for 2026. Survive Weeks 1–14, then wager in Weeks 15–17 for the $500 Highlander crown.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  return (
    <SectionManifestGate section="highlander" season={CURRENT_SEASON}>
      <HighlanderClient season={CURRENT_SEASON} />
    </SectionManifestGate>
  );
}
