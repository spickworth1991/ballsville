// /lib/season.js
// Single source of truth for the site's "current season".
// Season rolls over on January 22.
// Jan 1–21 are still considered the previous season year.

export function getCurrentSeason(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1; // 1-12
  const day = dt.getDate();   // 1-31

  // Before Jan 22 → previous season
  if (m === 1 && day <= 21) {
    return y - 1;
  }

  return y;
}

// Convenience constant for client components.
export const CURRENT_SEASON = getCurrentSeason();
