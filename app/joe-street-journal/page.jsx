import { siteConfig } from "@/app/config/siteConfig";
import JoeStreetJournalClient from "@/components/joeStreetJournal/JoeStreetJournalClient";

export const metadata = {
  title: `The Joe Street Journal | ${siteConfig.shortName}`,
  description: "Join the Ballsville DFS League, review its format and payouts, and read the weekly Joe Street Journal.",
  alternates: { canonical: "/joe-street-journal" },
};

export default function JoeStreetJournalPage() {
  return <JoeStreetJournalClient />;
}
