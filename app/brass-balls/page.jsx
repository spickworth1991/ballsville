import { siteConfig } from "@/app/config/siteConfig";
import BrassBallsClient from "@/components/brass-balls/BrassBallsClient";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: `The Brass Balls | ${siteConfig.shortName}`,
  description: "The Brass Balls test game mode: custom weekly matchups, live scores, and team scoring breakdowns.",
  alternates: { canonical: `${siteConfig.domain}/brass-balls` },
};

export default function BrassBallsPage() {
  return <BrassBallsClient season={CURRENT_SEASON} />;
}
