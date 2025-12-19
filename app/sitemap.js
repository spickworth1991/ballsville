// app/sitemap.js
import { siteConfig } from "@/app/config/siteConfig";

export const dynamic = "force-static";
export const revalidate = false;

export default function sitemap() {
  const base = siteConfig.domain.replace(/\/$/, "");

  const paths = [
    "/",
    "/about",
    "/big-game",
    "/constitution",
    "/dynasty",
    "/faq",
    "/gauntlet",
    "/hall-of-fame",
    "/joe-street-journal",
    "/leaderboards",
    "/news",
    "/redraft",
    "/scores",
  ];

  const today = new Date().toISOString().slice(0, 10);

  return paths.map((p) => ({
    url: `${base}${p === "/" ? "" : p}`,
    lastModified: today,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1.0 : 0.7,
  }));
}
