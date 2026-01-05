// app/sitemap.js
import { siteConfig } from "@/app/config/siteConfig";

export const dynamic = "force-static";
export const revalidate = false;

export default function sitemap() {
  const base = siteConfig.domain.replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);

  const staticPaths = [
    "/", // home
    "/about",
    "/news",
    "/faq",

    // Core game hubs
    "/big-game",
    "/big-game/divisions",
    "/big-game/wagers",
    "/biggame-wagers",

    "/dynasty",
    "/dynasty/intro",
    "/dynasty/divisions",
    "/dynasty/wagers",
    "/dynasty-wagers",
    "/dynasty/wagering-demo",
    "/dynasty/rosters",

    "/redraft",

    "/gauntlet",
    "/gauntlet/intro",
    "/gauntlet/leaderboard",
    "/gauntlet/legions",

    "/leaderboards",
    "/scores",
    "/hall-of-fame",
    "/joe-street-journal",

    // Mini leagues
    "/mini-leagues",
    "/mini-leagues/wagers",
    "/minileagues-wagers",

    // Governance
    "/constitution",
    "/constitution/dynasty",
  ];

  // If your gauntlet legions are fixed, include them here
  const gauntletLegions = ["greeks", "romans", "egyptians"];
  const dynamicButKnownPaths = gauntletLegions.map((l) => `/gauntlet/${l}`);

  const paths = [...staticPaths, ...dynamicButKnownPaths];

  return paths.map((p) => ({
    url: `${base}${p === "/" ? "" : p}`,
    lastModified: today,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1.0 : 0.7,
  }));
}
