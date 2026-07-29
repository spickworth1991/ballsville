import { siteConfig } from "@/app/config/siteConfig";
import AdminGuard from "@/components/AdminGuard";
import JoeStreetJournalAdminClient from "@/components/admin/joeStreetJournal/JoeStreetJournalAdminClient";

export const metadata = {
  title: `Joe Street Journal Admin | ${siteConfig.shortName}`,
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminGuard><JoeStreetJournalAdminClient /></AdminGuard>;
}
