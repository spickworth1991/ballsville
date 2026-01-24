import AdminGuard from "@/components/AdminGuard";
import DynastyConstitutionAdminClient from "@/components/admin/constitution/DynastyConstitutionAdminClient";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: "Admin · Dynasty Constitution | BALLSVILLE",
  description: "Edit the Dynasty constitution sections for the current season.",
};

export default function AdminDynastyConstitutionPage() {
  const season = CURRENT_SEASON;
  return (
    <AdminGuard>
      <DynastyConstitutionAdminClient initialSeason={season} />
    </AdminGuard>
  );
}
