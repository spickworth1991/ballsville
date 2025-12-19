// app/mini-leagues/page.jsx
import { siteConfig } from "@/app/config/siteConfig";
import MiniLeaguesClient from "./MiniLeaguesClient";

const pageTitle = `Mini-Leagues | ${siteConfig.shortName}`;
const pageDesc =
  "Way-too-early, rookie-inclusive, budget Best Ball redraft mini-leagues. Most points wins, optional wagering, and stacked bonuses.";

export const metadata = {
  title: pageTitle,
  description: pageDesc,
  alternates: { canonical: "/mini-leagues" },
  openGraph: {
    url: "/mini-leagues",
    title: pageTitle,
    description: pageDesc,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <MiniLeaguesClient />;
}
