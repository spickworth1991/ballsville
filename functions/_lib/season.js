// functions/_lib/season.js
// Keep this file tiny and dependency-free so it works in Cloudflare Pages Functions.
// NFL season is named by the year it starts; Jan/Feb still belong to the previous season.

export function getCurrentNflSeason(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0=Jan
  return month <= 1 ? year - 1 : year;
}

export const CURRENT_SEASON = getCurrentNflSeason();
