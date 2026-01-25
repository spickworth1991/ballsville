// /lib/season.js
// Single source of truth for the site's "current season".
//
// ✅ CURRENT RULE (Ballsville-specific):
// - The season "rolls over" on **January 22**.
// - That means **Jan 1–21** are still treated as the **previous** season year.
//   Example:
//     - 2026-01-21  => 2025 season
//     - 2026-01-22  => 2026 season
//
// ------------------------------------------------------------
// HOW TO CHANGE THE ROLLOVER DATE (the "Season starts on ___")
// ------------------------------------------------------------
//
// 1) Pick a month/day cutoff that represents "new season content is live".
//    Common choices:
//    - Jan 1      (calendar-year season)
//    - Jan 22     (your current rule)
//    - Mar 1      (after Super Bowl / offseason content reset)
//    - Sep 1      (season-year aligns to NFL season start)
//
// 2) Update the check below to match your cutoff.
//
// OPTION A (Recommended): Keep it configurable via constants
//   - Change ROLLOVER_MONTH and ROLLOVER_DAY and you're done.
//   - Rule: dates BEFORE (month/day) return y-1, otherwise y.
//
// OPTION B: Custom per-month logic
//   - If you ever want "Jan/Feb are previous season, Mar+ is current",
//     use a month-only check (like your older version).
//
// Notes:
// - Months are 1–12 here (we add +1 because JS Date months are 0–11).
// - "Before rollover" includes the days up to (ROLLOVER_DAY - 1).
// - Rollover day itself is considered the NEW season.
//
// ------------------------------------------------------------

const ROLLOVER_MONTH = 10; // 1=Jan, 2=Feb, ... 12=Dec
const ROLLOVER_DAY = 1;  // 1–31

export function getCurrentSeason(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);

  const y = dt.getFullYear();
  const m = dt.getMonth() + 1; // 1-12
  const day = dt.getDate();    // 1-31

  // "Before rollover" means:
  // - Any earlier month than the rollover month
  // - OR same month, but day is before the rollover day
  //
  // With the current constants (Jan 22):
  // - Jan 1–21 => previous season (y-1)
  // - Jan 22+  => current season (y)
  if (m < ROLLOVER_MONTH || (m === ROLLOVER_MONTH && day < ROLLOVER_DAY)) {
    return y - 1;
  }

  return y;
}

// Convenience constant for client components.
export const CURRENT_SEASON = getCurrentSeason();
