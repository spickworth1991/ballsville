// app/sitemap.js
import { siteConfig } from "@/app/config/siteConfig";


export const dynamic = 'force-static';
export const revalidate = false;


export default function sitemap() {
  const base = siteConfig.domain;

  const paths = [
    "/",            // home
    "/about",
    "/services",
    "/services/physical-therapy",
    "/services/dry-needling",
    "/services/manual-therapy",
    "/services/strength-training",
    "/services/education-injury-prevention",
    "/insurance",
    "/faq",
    "/resources",
    "/careers",
    "/contact",
    "/location",
    "/news",   
  ];

  const today = new Date().toISOString().slice(0, 10);

  return paths.map((p, i) => ({
    url: `${base}${p === "/" ? "" : p}`,
    lastModified: today,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1.0 : 0.7 - i * 0.01, // mild variance is fine, not required
  }));
}
