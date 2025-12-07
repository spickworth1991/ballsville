// scripts/buildgauntlet.mjs
// Node script to:
// 1) Fetch Sleeper data for the 2025 Gauntlet leagues
// 2) Use MANUAL seeds from Supabase table `gauntlet_seeds_2025` (Leg 1 is manual now)
// 3) Apply Guillotine eliminations Weeks 9–12 (lowest weekly score, survivors move up)
// 4) Compute Leg 3 (Weeks 13–17) Best Ball totals for survivors only
// 5) Build bracket payload (Weeks 13–16 playoffs) + Week 17 Grand Championship
// 6) Upsert into Supabase table `gauntlet_leg3`
//
// IMPORTANT CHANGES:
// - No more hard-coded GAUNTLET_2025 league list: leagues + seeds come from `gauntlet_seeds_2025`.
// - Script checks ALL leagues for missing seeds and lists every problem league.
// - Script auto-fills league_name in `gauntlet_seeds_2025` from Sleeper if missing.
// - ✅ Seed completeness is based purely on Supabase: a league is "fully seeded" when
//   every owner row has a non-null seed (seededCount === ownersCount), not on a fixed 12.

import "dotenv/config";
import axios from "axios";
import pLimit from "p-limit";
import { createClient } from "@supabase/supabase-js";

/* ================== CONFIG ================== */

const YEAR = 2025;

// Guillotine phase:
const LEG2_START = 9;
const LEG2_END = 12; // Weeks 9–12 → 4 eliminations

// Leg 3 (Best Ball bracket):
const LEG3_START = 13;
const LEG3_END = 17; // Weeks 13–17 → BB; 13–16 used for bracket, 17 = Grand Champ

// Round mapping for the **God bracket** (16 teams → 4 rounds):
// Round 1 → Week 13
// Round 2 → Week 14
// Round 3 → Week 15
// Round 4 → Week 16
const LEG3_ROUND_WEEKS = [13, 14, 15, 16];

const GRAND_CHAMP_WEEK = 17; // Week 17 = all God winners vs each other

const CONCURRENCY = 5;
const RETRIES = 3;

// Canonical God order (for display + consistent ordering)
const GOD_ORDER = {
  Egyptians: ["Amun-Rah", "Osiris", "Horus", "Anubis"],
  Greeks: ["Zeus", "Ares", "Apollo", "Poseidon"],
  Romans: ["Jupiter", "Mars", "Minerva", "Saturn"],
};

// Supabase (service role, server-side only)
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in env."
  );
  process.exit(1);
}

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

const limit = pLimit(CONCURRENCY);
const axiosInstance = axios.create();

/* ================== BASIC HELPERS ================== */

const normId = (x) => (x == null ? null : String(x).trim());

async function fetchWithRetry(url, retries = RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axiosInstance.get(url);
      return res.data;
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = 500 * (i + 1);
      console.warn(`⚠️  Retry ${i + 1} for ${url} after ${delay}ms`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

async function getSleeperPlayers() {
  console.log("⬇️  Fetching Sleeper players DB…");
  const url = "https://api.sleeper.app/v1/players/nfl";
  return fetchWithRetry(url);
}

function playerPos(playersDB, id) {
  const p = playersDB[id] || {};
  return String(
    p.position || (p.fantasy_positions && p.fantasy_positions[0]) || ""
  ).toUpperCase();
}

// Determine the "current" Leg 3 playoff week across ALL leagues.
// Logic: walk weeks 13–16 in order; the first week where nobody has
// a non-zero score is considered "not started yet", so we go back one.
function detectGlobalCurrentWeek(allTeams) {
  if (!Array.isArray(allTeams) || allTeams.length === 0) return null;

  let current = null;

  for (let i = 0; i < LEG3_ROUND_WEEKS.length; i++) {
    const w = LEG3_ROUND_WEEKS[i];

    const anyNonZero = allTeams.some((t) => {
      const v = t.leg3Weekly?.[w];
      return typeof v === "number" && v !== 0;
    });

    if (!anyNonZero) {
      // First "empty" week → previous week was the last active
      return current;
    }

    current = w;
  }

  // If we got here, all 13–16 have some data → current is Week 16
  return current;
}

/**
 * Fill league_name in gauntlet_seeds_2025 when missing, using Sleeper.
 */
async function ensureLeagueNames(leaguesMap) {
  const toUpdate = [];

  for (const [leagueId, info] of leaguesMap.entries()) {
    if (info.leagueName) continue; // already have a name, skip

    try {
      const leagueInfo = await fetchWithRetry(
        `https://api.sleeper.app/v1/league/${leagueId}`
      );
      const name = leagueInfo?.name || leagueId;

      info.leagueName = name;
      toUpdate.push({ leagueId, name });
    } catch (err) {
      console.warn(
        `⚠️  Could not fetch league name from Sleeper for league ${leagueId}:`,
        err.message || err
      );
    }
  }

  // Write back to Supabase (one UPDATE per league; small n)
  for (const u of toUpdate) {
    const { error } = await supabase
      .from("gauntlet_seeds_2025")
      .update({ league_name: u.name })
      .eq("year", YEAR)
      .eq("league_id", u.leagueId);

    if (error) {
      console.warn(
        `⚠️  Failed to update league_name for league ${u.leagueId}:`,
        error
      );
    } else {
      console.log(
        `  ✅ Updated league_name for ${u.leagueId} → ${u.name} in gauntlet_seeds_2025`
      );
    }
  }
}

/* ================== BEST BALL ================== */

/**
 * Best Ball lineup:
 * 1 QB, 2 RB, 3 WR, 1 TE, 2 FLEX, 1 SF
 * Now also attaches basic metadata from playersDB:
 *   - team
 *   - status
 *   - injury_status
 */
function computeBestBallLineup(players_points = {}, playersDB) {
  const entries = Object.entries(players_points).map(([rawId, pts]) => {
    const id = normId(rawId);
    const p = playersDB[id] || {};
    const pos = String(
      p.position || (p.fantasy_positions && p.fantasy_positions[0]) || ""
    ).toUpperCase();

    return {
      id,
      name: p.full_name || id,
      pos,
      points: Number(pts ?? 0),
      team: p.team || null,
      status: p.status || null,
      injury_status: p.injury_status || null,
    };
  });

  const by = (p) =>
    entries
      .filter((e) => e.pos === p)
      .sort((a, b) => b.points - a.points);

  const QB = by("QB");
  const RB = by("RB");
  const WR = by("WR");
  const TE = by("TE");

  const picked = new Set();
  const starters = [];

  const take = (arr, n, slot) => {
    for (let i = 0; i < arr.length && n > 0; i++) {
      const e = arr[i];
      if (!e.id || picked.has(e.id)) continue;
      picked.add(e.id);
      starters.push({ ...e, slot });
      n--;
    }
  };

  // Base slots
  take(QB, 1, "QB");
  take(RB, 2, "RB");
  take(WR, 3, "WR");
  take(TE, 1, "TE");

  // FLEX x2 (RB/WR/TE)
  const flexPool = entries
    .filter(
      (e) =>
        !picked.has(e.id) &&
        (e.pos === "RB" || e.pos === "WR" || e.pos === "TE")
    )
    .sort((a, b) => b.points - a.points);
  take(flexPool, 2, "FLEX");

  // SF x1 (QB/RB/WR/TE)
  const sfPool = entries
    .filter(
      (e) =>
        !picked.has(e.id) &&
        (e.pos === "QB" || e.pos === "RB" || e.pos === "WR" || e.pos === "TE")
    )
    .sort((a, b) => b.points - a.points);
  take(sfPool, 1, "SF");

  const bench = entries
    .filter((e) => e.id && !picked.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      points: e.points,
      pos: e.pos,
      team: e.team || null,
      status: e.status || null,
      injury_status: e.injury_status || null,
    }));

  const order = { QB: 0, RB: 1, WR: 2, TE: 3, FLEX: 4, SF: 5 };
  starters.sort(
    (a, b) => order[a.slot] - order[b.slot] || b.points - a.points
  );

  const total = Number(
    starters.reduce((s, e) => s + Number(e.points || 0), 0).toFixed(2)
  );

  return {
    starters: starters.map((e) => ({
      id: e.id,
      name: e.name,
      points: e.points,
      pos: e.pos,
      slot: e.slot,
      team: e.team || null,
      status: e.status || null,
      injury_status: e.injury_status || null,
    })),
    bench,
    total,
  };
}


/* ================== LOAD LEAGUES + SEEDS FROM SUPABASE ================== */

/**
 * Structure of gauntlet_seeds_2025 (assumed):
 * - id (PK)
 * - year (int)
 * - division (text)  e.g. "Egyptians", "Greeks", "Romans"
 * - god_name (text)  e.g. "Amun-Rah"
 * - side (text)      "light" | "dark"
 * - league_id (text)
 * - league_name (text, nullable)
 * - owner_id (text)
 * - owner_name (text)
 * - seed (int, nullable)
 */

async function loadLeaguesAndSeeds(year) {
  console.log("⬇️  Loading gauntlet seeds from Supabase…");

  const { data, error } = await supabase
    .from("gauntlet_seeds_2025")
    .select(
      "id, year, division, god_name, god, side, league_id, league_name, owner_id, owner_name, seed"
    )
    .eq("year", String(year));

  if (error) {
    console.error("❌ Error loading gauntlet_seeds_2025:", error);
    throw error;
  }

  if (!data || !data.length) {
    throw new Error(
      "No rows found in gauntlet_seeds_2025 for this year. Populate seeds via /admin/gauntlet/seeds first."
    );
  }

  // leagueId -> config
  const leaguesMap = new Map();

  for (const row of data) {
    const leagueId = String(row.league_id);
    if (!leaguesMap.has(leagueId)) {
      const godName =
        row.god_name ||
        row.god || // fallback if an older column was used
        "Unknown God";

      leaguesMap.set(leagueId, {
        leagueId,
        leagueName: row.league_name || null,
        division: row.division || "Unknown",
        godName,
        side: row.side || "light",
        seedsByOwnerId: {}, // owner_id -> seed|null
        ownerNamesById: {}, // owner_id -> owner_name
        seededCount: 0,
        ownersCount: 0,
        missingOwners: [], // filled below
      });
    }

    const league = leaguesMap.get(leagueId);
    const ownerId = row.owner_id ? String(row.owner_id) : null;

    if (ownerId) {
      league.seedsByOwnerId[ownerId] =
        row.seed != null ? Number(row.seed) : null;
      league.ownerNamesById[ownerId] = row.owner_name || ownerId;
    }
  }

  // Auto-fill missing league_name by hitting Sleeper once per league
  await ensureLeagueNames(leaguesMap);

  // Calculate seededCount / ownersCount / missingOwners
  const missingSeedLeagues = [];

  leaguesMap.forEach((league) => {
    const ownerIds = Object.keys(league.ownerNamesById);
    league.ownersCount = ownerIds.length;

    const missingOwners = [];
    let seededCount = 0;

    ownerIds.forEach((ownerId) => {
      const s = league.seedsByOwnerId[ownerId];
      if (s != null) {
        seededCount += 1;
      } else {
        missingOwners.push({
          ownerId,
          ownerName: league.ownerNamesById[ownerId],
        });
      }
    });

    league.seededCount = seededCount;
    league.missingOwners = missingOwners;

    // ❗ A league is "missing seeds" if any owner row has a null seed
    if (seededCount < league.ownersCount) {
      missingSeedLeagues.push({
        leagueId: league.leagueId,
        leagueName: league.leagueName,
        division: league.division,
        godName: league.godName,
        side: league.side,
        seededCount,
        ownersCount: league.ownersCount,
        missingOwners,
      });
    }
  });

  // Build division → gods → {lightLeagueId, darkLeagueId}
  const godsByDivision = {};
  leaguesMap.forEach((league) => {
    const { division, godName, side, leagueId } = league;
    if (!division || !godName || !side || !leagueId) return;
    if (!godsByDivision[division]) godsByDivision[division] = {};
    if (!godsByDivision[division][godName]) {
      godsByDivision[division][godName] = {
        division,
        godName,
        lightLeagueId: null,
        darkLeagueId: null,
      };
    }
    if (side === "light") {
      godsByDivision[division][godName].lightLeagueId = leagueId;
    } else if (side === "dark") {
      godsByDivision[division][godName].darkLeagueId = leagueId;
    }
  });

  // Turn godsByDivision into an ordered array per division
  const divisionGodConfig = {};
  Object.entries(godsByDivision).forEach(([division, godsObj]) => {
    const arr = [];
    const inDbNames = Object.keys(godsObj);
    const order = GOD_ORDER[division] || [];

    // Respect canonical God order first
    order.forEach((name) => {
      if (godsObj[name]) arr.push(godsObj[name]);
    });
    // Then add any extra gods not in the canonical list
    inDbNames.forEach((name) => {
      if (!order.includes(name)) arr.push(godsObj[name]);
    });

    divisionGodConfig[division] = arr;
  });

  console.log("\n🧭 Discovered divisions & gods from gauntlet_seeds_2025:");
  Object.entries(divisionGodConfig).forEach(([division, godsArr]) => {
    console.log(`  • ${division}:`);
    godsArr.forEach((g) => {
      console.log(
        `     - ${g.godName} (light: ${g.lightLeagueId || "NONE"}, dark: ${
          g.darkLeagueId || "NONE"
        })`
      );
    });
  });

  // ⬅️ NO THROW HERE – we return missingSeedLeagues so the caller can handle it.
  return {
    divisionGodConfig,
    leaguesConfig: Object.fromEntries(leaguesMap.entries()),
    missingSeedLeagues,
  };
}

/* ================== LEAGUE PROCESSING ================== */

/**
 * Process a single league:
 * - Uses MANUAL seeds from gauntlet_seeds_2025 as the Leg 1 seeding.
 * - Weeks 9–12: Guillotine eliminations (lowest weekly score / next-week 0 / disappear)
 * - Weeks 13–17: Best Ball scoring for survivors only
 *
 * Leg 3 scoring is per-week BB; bracket logic is built separately.
 */
async function processLeague(
  leagueId,
  divisionName,
  godName,
  side,
  seedsForLeague,
  playersDB
) {
  const baseUrl = `https://api.sleeper.app/v1/league/${leagueId}`;

  const leagueInfo = await fetchWithRetry(baseUrl);
  const leagueName = leagueInfo.name;
  const leagueTag = `[${divisionName} – ${godName} – ${side}] ${leagueName} (${leagueId})`;

  console.log(`\n🏟  ${leagueTag}`);

  const users = await fetchWithRetry(`${baseUrl}/users`);
  const rosters = await fetchWithRetry(`${baseUrl}/rosters`);

  const userMap = {};
  users.forEach((u) => {
    userMap[u.user_id] = u.display_name;
  });

  const ownersByRoster = new Map();
  rosters.forEach((r) => {
    const rosterId = r.roster_id;
    const ownerId = r.owner_id;
    const ownerName = userMap[ownerId] || `Owner ${ownerId}`;
    const manualSeed =
      seedsForLeague && seedsForLeague[ownerId] != null
        ? Number(seedsForLeague[ownerId])
        : null;

    ownersByRoster.set(rosterId, {
      rosterId,
      ownerId,
      ownerName,
      leagueId,
      leagueName,
      division: divisionName,
      godName,
      side,
      record: { wins: 0, losses: 0, ties: 0 },
      seedPointsWeekly: {},
      seedPointsTotal: 0,
      initialSeed: manualSeed,
      leg2Weekly: {},
      leg2ElimWeek: null,
      leg3Weekly: {},
      leg3Total: 0,
      leg3BestBall: {},       // 👈 add this
      lastWeekWithData: null,
      lastWeekRoster: null,
      finalSeed: null,
    });

  });

  // ====== Phase 1: MANUAL SEEDS ONLY (no Week 1–8 computation) ======

  console.log(`  ${leagueTag} 🧮 Manual seeds from gauntlet_seeds_2025:`);
  Array.from(ownersByRoster.values())
    .sort((a, b) => {
      const sa = a.initialSeed ?? 999;
      const sb = b.initialSeed ?? 999;
      if (sa !== sb) return sa - sb;
      return (a.ownerName || "").localeCompare(b.ownerName || "");
    })
    .forEach((o) => {
      console.log(
        `   ${leagueTag}  Seed ${
          o.initialSeed != null ? String(o.initialSeed).padStart(2, " ") : "??"
        } – ${o.ownerName} (owner_id=${o.ownerId})`
      );
    });

  const allOwners = Array.from(ownersByRoster.values());

  /* ---------- Phase 2: Leg 2 Guillotine (Weeks 9–12) ---------- */

  const alive = new Set(allOwners.map((o) => o.rosterId));

  for (let week = LEG2_START; week <= LEG2_END; week++) {
    if (alive.size <= 8) {
      console.log(
        `  ${leagueTag} ✅ Alive rosters already <= 8 (${alive.size}) before Week ${week}, no more eliminations.`
      );
      break;
    }

    const matchups = await fetchWithRetry(`${baseUrl}/matchups/${week}`);
    if (!matchups || !matchups.length) {
      console.log(
        `  ${leagueTag} • Week ${week}: no matchups → stop Guillotine early`
      );
      break;
    }

    const weekPoints = new Map();
    matchups.forEach((m) => {
      const rosterId = m.roster_id;
      if (!alive.has(rosterId)) return;
      const pts = Number(m.points ?? 0);
      weekPoints.set(rosterId, (weekPoints.get(rosterId) || 0) + pts);
    });

    weekPoints.forEach((pts, rosterId) => {
      const owner = ownersByRoster.get(rosterId);
      if (!owner) return;
      owner.leg2Weekly[week] = pts;
    });

    const nextWeek = week + 1;
    const nextMatchups = await fetchWithRetry(
      `${baseUrl}/matchups/${nextWeek}`
    );

    let eliminated = null;

    if (nextMatchups && nextMatchups.length) {
      const nextWeekPoints = new Map();

      nextMatchups.forEach((m) => {
        const rosterId = m.roster_id;
        if (!alive.has(rosterId)) return;
        const pts = Number(m.points ?? 0);
        nextWeekPoints.set(rosterId, pts);
      });

      const zeroCandidates = [];
      nextWeekPoints.forEach((pts, rosterId) => {
        if (pts === 0) {
          const owner = ownersByRoster.get(rosterId);
          if (owner) zeroCandidates.push(owner);
        }
      });

      if (zeroCandidates.length > 0) {
        eliminated = zeroCandidates.reduce((worst, o) =>
          (o.initialSeed || 999) > (worst.initialSeed || 999) ? o : worst
        );
        console.log(
          `  ${leagueTag} 🔪 Week ${week} Guillotine via week ${nextWeek} ZERO pts: ` +
            `${eliminated.ownerName} (seed ${eliminated.initialSeed ?? "??"})`
        );
      } else {
        const nextWeekRosterIds = new Set(
          nextMatchups
            .map((m) => m.roster_id)
            .filter((rid) => alive.has(rid))
        );

        const disappeared = [];
        alive.forEach((rid) => {
          if (!nextWeekRosterIds.has(rid)) {
            const owner = ownersByRoster.get(rid);
            if (owner) disappeared.push(owner);
          }
        });

        if (disappeared.length > 0) {
          eliminated = disappeared.reduce((worst, o) =>
            (o.initialSeed || 999) > (worst.initialSeed || 999) ? o : worst
          );
          console.log(
            `  ${leagueTag} 🔪 Week ${week} Guillotine via week ${nextWeek} DISAPPEARED roster: ` +
              `${eliminated.ownerName} (seed ${eliminated.initialSeed ?? "??"})`
          );
        }
      }
    }

    if (!eliminated) {
      if (!weekPoints.size) {
        console.log(
          `  ${leagueTag} • Week ${week}: no weekPoints for alive rosters; cannot eliminate`
        );
        break;
      }

      let minPts = Infinity;
      weekPoints.forEach((pts) => {
        if (pts < minPts) minPts = pts;
      });

      const candidates = [];
      weekPoints.forEach((pts, rosterId) => {
        if (pts === minPts) {
          const owner = ownersByRoster.get(rosterId);
          if (owner) candidates.push(owner);
        }
      });

      if (!candidates.length) {
        console.log(
          `  ${leagueTag} • Week ${week}: could not determine elimination candidate (fallback)`
        );
        break;
      }

      eliminated = candidates.reduce((worst, o) =>
        (o.initialSeed || 999) > (worst.initialSeed || 999) ? o : worst
      );

      console.log(
        `  ${leagueTag} 🔪 Week ${week} Guillotine FALLBACK (lowest pts this week): ` +
          `${eliminated.ownerName} – ${minPts.toFixed(2)} pts (seed ${
            eliminated.initialSeed ?? "??"
          })`
      );
    }

    eliminated.leg2ElimWeek = week;
    alive.delete(eliminated.rosterId);

    console.log(
      `  ${leagueTag}    → Eliminated ${eliminated.ownerName}, ${alive.size} alive`
    );
  }

  const survivors = allOwners.filter((o) => o.leg2ElimWeek == null);

  // Final seeds for bracket: preserve relative ordering of manual seeds
  survivors
    .slice()
    .sort((a, b) => {
      const sa = a.initialSeed ?? 999;
      const sb = b.initialSeed ?? 999;
      if (sa !== sb) return sa - sb;
      return (a.ownerName || "").localeCompare(b.ownerName || "");
    })
    .forEach((o, idx) => {
      o.finalSeed = idx + 1; // 1..8 inside each league
    });

  survivors
    .slice()
    .sort((a, b) => (a.finalSeed || 999) - (b.finalSeed || 999))
    .forEach((o) => {
      // logging suppressed
    });

  /* ---------- Phase 3: Leg 3 Best Ball (Weeks 13–17, survivors only) ---------- */

  for (let week = LEG3_START; week <= LEG3_END; week++) {
    const matchups = await fetchWithRetry(`${baseUrl}/matchups/${week}`);
    if (!matchups || !matchups.length) {
      console.log(
        `  ${leagueTag} • Week ${week}: no matchups (Leg 3 Best Ball)`
      );
      continue;
    }

    matchups.forEach((m) => {
      const rosterId = m.roster_id;
      const owner = ownersByRoster.get(rosterId);
      if (!owner) return;

      if (owner.leg2ElimWeek != null) return;

      const bb = computeBestBallLineup(m.players_points || {}, playersDB);

      owner.leg3Weekly[week] = bb.total;
      owner.leg3Total += bb.total;

      // Save full best-ball lineup for this week
      owner.leg3BestBall[week] = bb;

      owner.lastWeekWithData = week;
      owner.lastWeekRoster = {
        week,
        starters: bb.starters,
        bench: bb.bench,
      };

    });
  }

  console.log(`  ${leagueTag} 🎯 Leg 3 Best Ball totals (survivors):`);
  survivors
    .slice()
    .sort((a, b) => (a.finalSeed || 999) - (b.finalSeed || 999))
    .forEach((o) => {
      // logging suppressed
    });

  const finalOwners = survivors
    .slice()
    .sort((a, b) => (a.finalSeed || 999) - (b.finalSeed || 999));

  return {
    leagueId,
    leagueName,
    division: divisionName,
    godName,
    side,
    owners: finalOwners,
    eliminated: allOwners.filter((o) => o.leg2ElimWeek != null),
  };
}

/* ================== BRACKET (GODS PER DIVISION) ================== */

/**
 * Build Gods inside a division as a true 16-team playoff bracket:
 *  - Round 1 → Week 13 (16 → 8)
 *  - Round 2 → Week 14 (8 → 4)
 *  - Round 3 → Week 15 (4 → 2)
 *  - Round 4 → Week 16 (2 → 1)  => God Champion
 *
 * NOTE (UPDATED):
 *  - `pairings` is now a **static** view of the Round 1 bracket (Week 13),
 *    seeded 1–8 vs 8–1 and NEVER changes on later runs.
 *  - `bracketRounds` holds all the week-by-week results and winners,
 *    so the frontend can show only the “alive” teams each week.
 */
function buildGodsForDivisionAndChampions(
  divisionName,
  leagueResults,
  godConfigs,
  currentBracketWeek
) {
  const gods = [];
  const champions = [];

  const byId = {};
  leagueResults.forEach((lr) => {
    byId[lr.leagueId] = lr;
  });

  const getWeekScore = (team, week) => {
    const v = team.leg3Weekly?.[week];
    return typeof v === "number" ? v : 0;
  };

  for (let g = 0; g < godConfigs.length; g++) {
    const godCfg = godConfigs[g];
    const { godName, lightLeagueId, darkLeagueId } = godCfg;

    const light = lightLeagueId ? byId[lightLeagueId] : null;
    const dark = darkLeagueId ? byId[darkLeagueId] : null;

    if (!light || !dark) {
      gods.push({
        index: g + 1,
        godName,
        division: divisionName,
        lightLeagueId: lightLeagueId || null,
        lightLeagueName: light?.leagueName || null,
        darkLeagueId: darkLeagueId || null,
        darkLeagueName: dark?.leagueName || null,
        lightSeeds: [],
        darkSeeds: [],
        pairings: [],
        bracketRounds: [],
        champion: null,
      });
      continue;
    }

    const lightTeams = (light.owners || [])
      .map((o) => ({
        ...o,
        side: "light",
        leagueId: light.leagueId,
        leagueName: light.leagueName,
        division: divisionName,
        godName,
        seed: o.finalSeed ?? o.initialSeed ?? 999,
      }))
      .sort((a, b) => a.seed - b.seed);

    const darkTeams = (dark.owners || [])
      .map((o) => ({
        ...o,
        side: "dark",
        leagueId: dark.leagueId,
        leagueName: dark.leagueName,
        division: divisionName,
        godName,
        seed: o.finalSeed ?? o.initialSeed ?? 999,
      }))
      .sort((a, b) => a.seed - b.seed);

    const maxSeeds = Math.min(8, lightTeams.length, darkTeams.length);
    const godIndex = g + 1;

    if (maxSeeds === 0) {
      gods.push({
        index: godIndex,
        godName,
        division: divisionName,
        lightLeagueId: light.leagueId,
        lightLeagueName: light.leagueName,
        darkLeagueId: dark.leagueId,
        darkLeagueName: dark.leagueName,
        lightSeeds: lightTeams,
        darkSeeds: darkTeams,
        pairings: [],
        bracketRounds: [],
        champion: null,
      });
      continue;
    }

    const allTeams = [...lightTeams, ...darkTeams];

    // ---------- Round 1 seed pairings (Week 13): 1–8, 2–7, 3–6, 4–5 ----------
    const round1Pairings = [];
    for (let s = 1; s <= maxSeeds; s++) {
      const lightTeam = lightTeams.find((t) => t.seed === s);
      const darkSeed = maxSeeds - s + 1; // 8→1, 7→2, ...
      const darkTeam = darkTeams.find((t) => t.seed === darkSeed);
      if (!lightTeam || !darkTeam) continue;

      round1Pairings.push({
        matchIndex: s,
        teamA: lightTeam,
        teamB: darkTeam,
      });
    }

    // ---------- Helper: decide winner ONLY if there are real points ----------
    function decideWinner(pair, week) {
      const scoreA = getWeekScore(pair.teamA, week);
      const scoreB = getWeekScore(pair.teamB, week);

      // Full best ball lineups from processLeague
      const lineupA = pair.teamA.leg3BestBall?.[week] || null;
      const lineupB = pair.teamB.leg3BestBall?.[week] || null;

      const hasAnyScore = scoreA !== 0 || scoreB !== 0;

      // If absolutely no scoring yet → no winner, don't advance anyone
      if (!hasAnyScore) {
        return {
          winner: null,
          loser: null,
          scoreA,
          scoreB,
          lineupA,
          lineupB,
        };
      }

      if (scoreA > scoreB) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB, lineupA, lineupB };
      }
      if (scoreB > scoreA) {
        return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB, lineupA, lineupB };
      }

      // Tie-breaker: better seed (lower number)
      const seedA = pair.teamA.seed ?? 999;
      const seedB = pair.teamB.seed ?? 999;
      if (seedA < seedB) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB, lineupA, lineupB };
      }
      if (seedB < seedA) {
        return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB, lineupA, lineupB };
      }

      // Final tie-break: name
      const nameA = pair.teamA.ownerName || "";
      const nameB = pair.teamB.ownerName || "";
      if (nameA.localeCompare(nameB) <= 0) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB, lineupA, lineupB };
      }
      return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB, lineupA, lineupB };
    }


    // ---------- Simulate rounds based on currentBracketWeek ----------
    let bracketRounds = [];
    let championSummary = null;

    if (currentBracketWeek) {
      const currentRoundIndex = LEG3_ROUND_WEEKS.indexOf(currentBracketWeek);
      const roundsToSimulate =
        currentRoundIndex === -1 ? 0 : currentRoundIndex + 1; // 1..4

      let currentPairings = round1Pairings;
      bracketRounds = [];

      for (let r = 0; r < roundsToSimulate; r++) {
        const week = LEG3_ROUND_WEEKS[r];
        const roundNumber = r + 1;

        const results = [];
        const winners = [];

        let allMatchesHaveWinner = true;
        let anyMatchHasScore = false;

        for (let idx = 0; idx < currentPairings.length; idx++) {
          const pair = currentPairings[idx];
          const { winner, loser, scoreA, scoreB, lineupA, lineupB } = decideWinner(
            pair,
            week
          );

          if (scoreA !== 0 || scoreB !== 0) {
            anyMatchHasScore = true;
          } else {
            allMatchesHaveWinner = false;
          }

          results.push({
            roundNumber,
            week,
            matchIndex: idx + 1,
            teamA: pair.teamA,
            teamB: pair.teamB,
            scoreA,
            scoreB,
            winner,
            loser,
            lineupA,
            lineupB,   // 👈 per-side best-ball lineups for this match
          });

          if (winner) {
            winners.push(winner);
          }
        }

        // If literally no one in this round has any score yet,
        // don't add this round at all.
        if (!anyMatchHasScore) {
          break;
        }

        bracketRounds.push({
          roundNumber,
          week,
          results,
          winners,
        });

        // If *any* match has no winner yet (0–0), stop here:
        // we won't build future rounds until this round fully resolves.
        if (!allMatchesHaveWinner) {
          break;
        }

        // Winners feed into the next round (fixed bracket, no reseed)
        const nextPairings = [];
        for (let j = 0; j < winners.length; j += 2) {
          if (j + 1 >= winners.length) break;
          nextPairings.push({
            matchIndex: j / 2 + 1,
            teamA: winners[j],
            teamB: winners[j + 1],
          });
        }
        currentPairings = nextPairings;

        if (!winners.length) break;
      }

      // 🏆 Champion only once ALL bracket weeks are complete (through Week 16)
      const totalRounds = LEG3_ROUND_WEEKS.length; // 4
      const lastRound = bracketRounds[bracketRounds.length - 1];

      const allWeeksFilledForThisGod = LEG3_ROUND_WEEKS.every((w) =>
        allTeams.some(
          (t) =>
            typeof t.leg3Weekly?.[w] === "number" && t.leg3Weekly[w] !== 0
        )
      );

      if (
        lastRound &&
        bracketRounds.length === totalRounds &&
        lastRound.week === LEG3_ROUND_WEEKS[totalRounds - 1] && // week 16
        lastRound.winners.length === 1 &&
        allWeeksFilledForThisGod
      ) {
        const champ = lastRound.winners[0];
        championSummary = {
          division: divisionName,
          godIndex,
          godName,
          leagueId: champ.leagueId,
          leagueName: champ.leagueName,
          rosterId: champ.rosterId,
          ownerId: champ.ownerId,
          ownerName: champ.ownerName,
          finalSeed: champ.finalSeed ?? champ.seed,
          leg3Weekly: { ...(champ.leg3Weekly || {}) },
        };
        champions.push(championSummary);
      }
    }

    // ---------- Static Week 13 bracket pairings (for seed preview) ----------
    const uiPairings = round1Pairings.map((p) => {
      let lightTeam =
        p.teamA.side === "light"
          ? p.teamA
          : p.teamB.side === "light"
          ? p.teamB
          : p.teamA;

      let darkTeam =
        p.teamA.side === "dark"
          ? p.teamA
          : p.teamB.side === "dark"
          ? p.teamB
          : p.teamB;

      const lightScoreW13 = getWeekScore(lightTeam, LEG3_ROUND_WEEKS[0]);
      const darkScoreW13 = getWeekScore(darkTeam, LEG3_ROUND_WEEKS[0]);

      return {
        match: p.matchIndex,
        round: 1,
        week: LEG3_ROUND_WEEKS[0], // always Week 13
        godName,
        lightSeed: lightTeam.seed,
        darkSeed: darkTeam.seed,
        lightOwnerName: lightTeam.ownerName,
        darkOwnerName: darkTeam.ownerName,
        lightLeg3Total: Number((lightScoreW13 || 0).toFixed(2)),
        darkLeg3Total: Number((darkScoreW13 || 0).toFixed(2)),
      };
    });

    gods.push({
      index: godIndex,
      godName,
      division: divisionName,
      lightLeagueId: light.leagueId,
      lightLeagueName: light.leagueName,
      darkLeagueId: dark.leagueId,
      darkLeagueName: dark.leagueName,
      lightSeeds: lightTeams,
      darkSeeds: darkTeams,
      pairings: uiPairings,
      bracketRounds,
      champion: championSummary,
    });
  }

  return { gods, champions };
}

/* ================== GRAND CHAMPIONSHIP (WEEK 17) ================== */

function buildGrandChampionship(champions) {
  const week = GRAND_CHAMP_WEEK;

  if (!champions || !champions.length) {
    return {
      week,
      participants: [],
      standings: [],
    };
  }

  const participants = champions.map((ch) => {
    const weekly = ch.leg3Weekly || {};
    const rawWeek = weekly[week];
    const weekScore = typeof rawWeek === "number" ? rawWeek : 0;

    const leg3Total = Object.values(weekly).reduce((sum, v) => {
      if (typeof v === "number") return sum + v;
      return sum;
    }, 0);

    return {
      division: ch.division,
      godIndex: ch.godIndex,
      godName: ch.godName,
      leagueId: ch.leagueId,
      leagueName: ch.leagueName,
      rosterId: ch.rosterId,
      ownerId: ch.ownerId,
      ownerName: ch.ownerName,
      finalSeed: ch.finalSeed,
      week17Score: Number(weekScore.toFixed(2)),
      leg3Total: Number(leg3Total.toFixed(2)),
    };
  });

  const standings = [...participants]
    .sort((a, b) => {
      if (b.week17Score !== a.week17Score) {
        return b.week17Score - a.week17Score;
      }
      if (b.leg3Total !== a.leg3Total) {
        return b.leg3Total - a.leg3Total;
      }
      return (a.finalSeed ?? 999) - (b.finalSeed ?? 999);
    })
    .map((p, idx) => ({
      rank: idx + 1,
      ...p,
    }));

  return {
    week,
    participants,
    standings,
  };
}

/* ================== BUILD FULL PAYLOAD ================== */

async function buildGauntletLeg3Payload() {
  const playersDB = await getSleeperPlayers();

  const { divisionGodConfig, leaguesConfig, missingSeedLeagues } =
    await loadLeaguesAndSeeds(YEAR);

  // Leagues that are fully seeded = every owner row has a seed set
  const seededLeagueIds = new Set(
    Object.values(leaguesConfig)
      .filter(
        (lg) => lg.ownersCount > 0 && lg.seededCount === lg.ownersCount
      )
      .map((lg) => lg.leagueId)
  );

  if (missingSeedLeagues.length > 0) {
    console.log(
      "\n⚠️ Some leagues are missing manual seeds in gauntlet_seeds_2025:"
    );
    missingSeedLeagues.forEach((info) => {
      console.log(
        `  - [${info.division}] ${info.godName} (${info.side}) – ${
          info.leagueName || "No league name"
        } (${info.leagueId}) has ${info.seededCount}/${info.ownersCount} seeds set.`
      );
      if (info.missingOwners?.length) {
        info.missingOwners.forEach((o) => {
          console.log(
            `       · missing seed for ${o.ownerName} (${o.ownerId})`
          );
        });
      }
    });
    console.log(
      "\nWe will still build Leg 3 for fully seeded leagues, " +
        "and mark partial leagues in payload.missingSeeds for the admin UI."
    );
  }

  const divisionPayloads = {};
  const allChampions = [];

  // We'll store league results per division so we can build Gods AFTER
  // we know the global current week.
  const divisionLeagueResults = {};
  const allTeamsForWeekDetection = [];

  // First pass: process only leagues that are fully seeded
  for (const [divisionName, gods] of Object.entries(divisionGodConfig)) {
    console.log(`\n=== Legion: ${divisionName} ===`);
    const leagueResults = [];

    // Flat list of leagueIds for this division from god configs
    const leagueIds = [];
    gods.forEach((g) => {
      if (g.lightLeagueId) leagueIds.push(g.lightLeagueId);
      if (g.darkLeagueId) leagueIds.push(g.darkLeagueId);
    });

    await Promise.all(
      leagueIds.map((leagueId) =>
        limit(async () => {
          const cfg = leaguesConfig[leagueId];
          if (!cfg) {
            console.warn(
              `⚠️  No seeds config for league ${leagueId} in division ${divisionName}`
            );
            return;
          }

          if (!seededLeagueIds.has(leagueId)) {
            console.log(
              `  ⏭️  Skipping bracket processing for unseeded league ${leagueId} (${cfg.leagueName || "no name"}) – ${cfg.seededCount}/${cfg.ownersCount} seeds`
            );
            return;
          }

          const res = await processLeague(
            leagueId,
            cfg.division,
            cfg.godName,
            cfg.side,
            cfg.seedsByOwnerId,
            playersDB
          );
          leagueResults.push(res);
        })
      )
    );

    // Preserve league order as they appear in god configs
    const orderedLeagues = leagueIds
      .map((id) => leagueResults.find((r) => r.leagueId === id))
      .filter(Boolean);

    divisionLeagueResults[divisionName] = orderedLeagues;

    // Collect ALL teams (survivors) from fully seeded leagues for global week detection
    orderedLeagues.forEach((lr) => {
      (lr.owners || []).forEach((o) => {
        allTeamsForWeekDetection.push(o);
      });
    });
  }

  // If no fully-seeded leagues yet, we can still return a payload that
  // only lists missingSeeds; bracket / grandChamp will just be empty.
  let globalCurrentWeek = null;
  if (allTeamsForWeekDetection.length > 0) {
    globalCurrentWeek = detectGlobalCurrentWeek(allTeamsForWeekDetection);
    console.log(
      `\n🎯 Global current Leg 3 playoff week = ${
        globalCurrentWeek ?? "none (no Leg 3 scores yet)"
      }`
    );
  } else {
    console.log(
      "\n🎯 No fully seeded leagues yet – skipping Leg 3 bracket scoring."
    );
  }

  // Second pass: build Gods + champions using the global current week
  for (const [divisionName, godsConfig] of Object.entries(divisionGodConfig)) {
    const orderedLeagues = divisionLeagueResults[divisionName] || [];

    const { gods, champions } = buildGodsForDivisionAndChampions(
      divisionName,
      orderedLeagues,
      godsConfig,
      globalCurrentWeek
    );

    divisionPayloads[divisionName] = {
      division: divisionName,
      gods,
    };

    allChampions.push(...champions);
  }

  const grandChampionship =
    allChampions.length > 0 ? buildGrandChampionship(allChampions) : null;

  const status =
    missingSeedLeagues.length > 0
      ? seededLeagueIds.size > 0
        ? "partial" // some leagues ready, some not
        : "missing_seeds" // nothing ready yet
      : "ok";

  return {
    year: String(YEAR),
    name: `${YEAR} Gauntlet – Leg 3 Bracket (Manual seeds, W9–12 Guillotine, W13–16 playoff, W17 Grand Championship)`,
    updatedAt: new Date().toISOString(),
    status,
    missingSeeds: missingSeedLeagues, // includes missingOwners per league
    divisions: divisionPayloads,
    grandChampionship,
  };
}

/* ================== MAIN ================== */

async function main() {
  try {
    console.log(
      "🚀 Building Gauntlet Leg 3 payload (manual seeds, W9–12 Guillotine, W13–16 bracket, W17 Grand Championship)…"
    );
    const payload = await buildGauntletLeg3Payload();

    console.log("💾 Upserting into Supabase gauntlet_leg3…");
    const { error } = await supabase
      .from("gauntlet_leg3")
      .upsert(
        {
          year: String(YEAR),
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "year" }
      );

    if (error) {
      console.error("❌ Supabase upsert error:", error);
      process.exit(1);
    }

    console.log("✅ Done. Gauntlet Leg 3 for 2025 saved to Supabase.");
  } catch (err) {
    console.error("❌ Script error:", err);
    console.error(err?.response?.data || err.message || err);
    process.exit(1);
  }
}

main();
