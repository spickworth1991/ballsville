// functions/_lib/season.js
// Re-export the site's season logic for Pages Functions.
// Keep this dependency-free and in sync by routing everything through /lib/season.js.

export { getCurrentSeason, CURRENT_SEASON } from "../../lib/season.js";

// Back-compat: older functions import getCurrentNflSeason().
export { getCurrentSeason as getCurrentNflSeason } from "../../lib/season.js";
