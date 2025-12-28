// app/hall-of-fame/page.jsx
import { siteConfig } from "@/app/config/siteConfig";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import HallOfFameClient from "@/components/HallOfFameClient";

const pageTitle = `Hall of Fame | ${siteConfig.shortName}`;

export const metadata = {
  title: pageTitle,
  description:
    "Ballsville Hall of Fame: championship winners across each Ballsville game mode, plus Player of the Year.",
  alternates: { canonical: "/hall-of-fame" },
  openGraph: {
    url: "/hall-of-fame",
    title: pageTitle,
    description:
      "Ballsville Hall of Fame: champions from Dragons of Dynasty, The BIG Game, Mini-Leagues, Redraft, and Player of the Year.",
    images: [{ url: "/photos/halloffame-1280.webp", width: 1280, height: 720 }],
  },
};

export default function HallOfFamePage() {
  return (
    <SectionManifestGate section="hall-of-fame">
      <HallOfFameClient />
    </SectionManifestGate>
  );
}
