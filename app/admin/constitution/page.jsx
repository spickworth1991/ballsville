// app/admin/constitution/page.jsx
import { siteConfig } from "@/app/config/siteConfig";
import ConstitutionAdminClient from "@/components/admin/constitution/ConstitutionAdminClient";

export const metadata = {
  title: `Constitution Admin | ${siteConfig.shortName}`,
  description: "Admin editor for the main league constitution (R2-backed).",
  alternates: { canonical: "/admin/constitution" },
};

export default function Page() {
  return <ConstitutionAdminClient />;
}
