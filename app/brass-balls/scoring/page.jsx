import { siteConfig } from "@/app/config/siteConfig";
import BrassBallsClient from "@/components/brass-balls/BrassBallsClient";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: `Brass Balls Scoring | ${siteConfig.shortName}`,
  description: "Live Brass Balls matchups and the North and South territory boards.",
  alternates: { canonical: `${siteConfig.domain}/brass-balls/scoring` },
};

export default function BrassBallsScoringPage() {
  return <BrassBallsClient season={CURRENT_SEASON} scoringOnly />;
}
