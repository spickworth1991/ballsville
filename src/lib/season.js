// src/lib/season.js
// Single source of truth for the current NFL season year.
// NFL season is named by the year it starts (e.g., 2025 season runs Sep 2025 → Feb 2026).
// During Jan/Feb, we still consider the season to be the previous year.

export function getCurrentNflSeason(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0=Jan
  // Jan/Feb -> previous season year
  return month <= 1 ? year - 1 : year;
}

export const CURRENT_SEASON = getCurrentNflSeason();
