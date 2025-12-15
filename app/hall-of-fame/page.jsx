// app/hall-of-fame/page.jsx
import { siteConfig } from "@/app/config/siteConfig";
import HallOfFameClient from "@/components/HallOfFameClient";

const pageTitle = `Hall of Fame | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/hall-of-fame`;

export const metadata = {
  title: pageTitle,
  description:
    "Ballsville Hall of Fame: championship winners across each Ballsville game mode, plus Player of the Year.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description:
      "Ballsville Hall of Fame: champions from Dragons of Dynasty, The BIG Game, Mini-Leagues, Redraft, and Player of the Year.",
    images: [{ url: "/photos/halloffame-1280.webp", width: 1280, height: 720 }],
  },
};

export default function HallOfFamePage() {
  return <HallOfFameClient />;
}
