// app/robots.js
import { siteConfig } from "@/app/config/siteConfig";

export const dynamic = "force-static";
export const revalidate = false;

export default function robots() {
  const base = siteConfig.domain;

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
