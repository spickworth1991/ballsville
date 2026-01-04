// app/robots.js
import { siteConfig } from "@/app/config/siteConfig";

export const dynamic = "force-static";
export const revalidate = false;

export default function robots() {
  const base = siteConfig.domain.replace(/\/$/, "");

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      // Keep admin + admin API out of search engines
      { userAgent: "*", disallow: ["/admin", "/admin/", "/api/admin", "/api/admin/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
