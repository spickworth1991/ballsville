// app/sitemap.js
import { siteConfig } from "@/app/config/siteConfig";

export const dynamic = "force-static";
export const revalidate = false;

export default function sitemap() {
  const base = siteConfig.domain.replace(/\/$/, "");

  const paths = [
    "/", // home
    "/about",
    "/news",
    "/faq",

    // Core game hubs
    "/big-game",
    "/dynasty",
    "/dynasty/intro",
    "/dynasty/wagers",
    "/dynasty/wagering-demo",
    "/dynasty/rosters",
    "/redraft",
    "/gauntlet",
    "/leaderboards",
    "/scores",
    "/hall-of-fame",
    "/joe-street-journal",

    // Governance
    "/constitution",
    "/constitution/dynasty",
  ];

  const today = new Date().toISOString().slice(0, 10);

  return paths.map((p) => ({
    url: `${base}${p === "/" ? "" : p}`,
    lastModified: today,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1.0 : 0.7,
  }));
}
