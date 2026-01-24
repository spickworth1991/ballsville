import AdminGuard from "@/components/AdminGuard";
import DynastyConstitutionAdminClient from "@/components/admin/constitution/DynastyConstitutionAdminClient";

export const metadata = {
  title: "Admin · Dynasty Constitution | BALLSVILLE",
  description: "Edit the Dynasty constitution sections.",
};

export default function AdminDynastyConstitutionPage() {
  return (
    <AdminGuard>
      <DynastyConstitutionAdminClient />
    </AdminGuard>
  );
}
