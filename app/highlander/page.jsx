import { siteConfig } from "@/app/config/siteConfig";
import HighlanderClient from "@/components/highlander/HighlanderClient";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

const pageTitle = `Highlander | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/highlander`;

export const metadata = {
  title: pageTitle,
  description:
    "18-team survival Best Ball: lowest score each week is eliminated. Survive the blade — there can only be one.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description:
      "18-team survival Best Ball: lowest score each week is eliminated. Survive the blade — there can only be one.",
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
