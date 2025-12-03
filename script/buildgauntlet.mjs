// scripts/buildgauntlet.mjs
// Node script to:
// 1) Fetch Sleeper data for the 2025 Gauntlet leagues
// 2) Seed after Week 8 by WIN/LOSS record INCLUDING vs. median each week
// 3) Apply Guillotine eliminations Weeks 9–12 (lowest weekly score, survivors move up)
// 4) Compute Leg 3 (Weeks 13–17) Best Ball totals for survivors only
// 5) Build bracket payload and upsert into Supabase table `gauntlet_leg3`

import "dotenv/config";
import axios from "axios";
import pLimit from "p-limit";
import { createClient } from "@supabase/supabase-js";

/* ================== CONFIG ================== */

const YEAR = "2025";

// Seeding phase (standings):
const SEED_START = 1;
const SEED_END = 8;      // Weeks 1–8 → standings

// Guillotine phase:
const LEG2_START = 9;
const LEG2_END = 12;     // Weeks 9–12 → 4 eliminations

// Leg 3 (Best Ball bracket):
const LEG3_START = 13;
const LEG3_END = 17;     // Weeks 13–17 → Best Ball

const CONCURRENCY = 5;
const RETRIES = 3;

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

/**
 * ONLY the 2025 Gauntlet leagues.
 */
const GAUNTLET_2025 = {
  name: "2025 Gauntlet",
  divisions: {
    Romans: [
      "1248763372128706560",
      "1248762972466073600",
      "1231418044421521408",
      "1231417737801105408",
      "1218702306590072832",
      "1218702136909512705",
      "1212974613181513728",
      "1212974482948378624",
    ],
    Greeks: [
      "1248762436618567680",
      "1248761188276240384",
      "1231417454689779712",
      "1231417314214154240",
      "1218701899885191168",
      "1218701807333675008",
      "1212974238936350721",
      "1212974099479941120",
    ],
    Egyptians: [
      "1248760700227047424",
      "1248759939321577472",
      "1231417137134841856",
      "1231416906401984512",
      "1218701651540459520",
      "1218701332836265984",
      "1212973917774290944",
      "1212967422475112448",
    ],
  },
};

/* ================== HELPERS ================== */

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

/**
 * Best Ball lineup:
 * 1 QB, 2 RB, 3 WR, 1 TE, 2 FLEX, 1 SF
 */
function computeBestBallLineup(players_points = {}, playersDB) {
  const entries = Object.entries(players_points).map(([rawId, pts]) => {
    const id = normId(rawId);
    const pos = playerPos(playersDB, id);
    return {
      id,
      name: playersDB[id]?.full_name || id,
      pos,
      points: Number(pts ?? 0),
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
    })),
    bench,
    total,
  };
}

/* ================== LEAGUE PROCESSING ================== */

/**
 * Process a single league:
 * - Weeks 1–8: compute W/L/T standings with:
 *      • head-to-head (matchup_id)
 *      • extra W/L/T vs league median each week
 * - Weeks 9–12: Guillotine eliminations (lowest weekly score among alive)
 * - Weeks 13–17: Best Ball scoring for survivors only
 */
async function processLeague(leagueId, divisionName, playersDB) {
  const baseUrl = `https://api.sleeper.app/v1/league/${leagueId}`;

  const leagueInfo = await fetchWithRetry(baseUrl);
  const leagueName = leagueInfo.name;
  const leagueTag = `[${divisionName}] ${leagueName} (${leagueId})`;

  console.log(`\n🏟  ${leagueTag}`);

  const users = await fetchWithRetry(`${baseUrl}/users`);
  const rosters = await fetchWithRetry(`${baseUrl}/rosters`);

  const userMap = {};
  users.forEach((u) => {
    userMap[u.user_id] = u.display_name;
  });

  const rosterOwnerMap = {}; // roster_id -> owner_id
  rosters.forEach((r) => {
    rosterOwnerMap[r.roster_id] = r.owner_id;
  });

  // One "owner" object per roster (since standings & eliminations are roster-based)
  const ownersByRoster = new Map();
  rosters.forEach((r) => {
    const rosterId = r.roster_id;
    const ownerId = r.owner_id;
    const ownerName = userMap[ownerId] || `Owner ${ownerId}`;

    ownersByRoster.set(rosterId, {
      rosterId,
      ownerId,
      ownerName,
      leagueId,
      leagueName,
      division: divisionName,

      // Seeding (Week 1–8 standings)
      record: { wins: 0, losses: 0, ties: 0 },  // includes H2H + median
      seedPointsWeekly: {}, // tiebreaker: total points Weeks 1–8
      seedPointsTotal: 0,
      initialSeed: null,    // seed after Week 8

      // Leg 2 (Guillotine, Weeks 9–12)
      leg2Weekly: {},       // week -> points
      leg2ElimWeek: null,   // week they were cut (9–12), or null if survived

      // Leg 3 (Best Ball, Weeks 13–17)
      leg3Weekly: {},       // week -> BB points
      leg3Total: 0,
      lastWeekWithData: null,
      lastWeekRoster: null,

      // Final seeding going into Leg 3 bracket (after eliminations)
      finalSeed: null,
    });
  });

  /* ---------- Phase 1: Week 1–8 standings (with vs. median) ---------- */

  for (let week = SEED_START; week <= SEED_END; week++) {
    const matchups = await fetchWithRetry(`${baseUrl}/matchups/${week}`);
    if (!matchups || !matchups.length) {
      console.log(`  ${leagueTag} • Week ${week}: no matchups (skipping)`);
      continue;
    }

    // Map: matchup_id -> list of { rosterId, points }
    const byMatchup = new Map();

    // Map: rosterId -> weekly points (used for median)
    const weekPoints = new Map();

    matchups.forEach((m) => {
      const rosterId = m.roster_id;
      const owner = ownersByRoster.get(rosterId);
      if (!owner) return;

      const pts = Number(m.points ?? 0);

      // Seed tiebreaker: total points Weeks 1–8
      owner.seedPointsWeekly[week] =
        (owner.seedPointsWeekly[week] || 0) + pts;
      owner.seedPointsTotal += pts;

      weekPoints.set(rosterId, (weekPoints.get(rosterId) || 0) + pts);

      const matchupId = m.matchup_id;
      if (matchupId == null) return;

      const list = byMatchup.get(matchupId) || [];
      list.push({ rosterId, points: pts });
      byMatchup.set(matchupId, list);
    });

    // 1) Head-to-head W/L/T per matchup
    for (const [, teams] of byMatchup.entries()) {
      if (!teams.length) continue;

      const pointsArr = teams.map((t) => t.points);
      const maxPts = Math.max(...pointsArr);
      const minPts = Math.min(...pointsArr);

      if (maxPts === minPts) {
        // Perfect tie (same points for everyone in matchup)
        teams.forEach(({ rosterId }) => {
          const owner = ownersByRoster.get(rosterId);
          if (owner) owner.record.ties++;
        });
      } else {
        // Winners get W, others get L
        teams.forEach(({ rosterId, points }) => {
          const owner = ownersByRoster.get(rosterId);
          if (!owner) return;
          if (points === maxPts) owner.record.wins++;
          else owner.record.losses++;
        });
      }
    }

    // 2) League median W/L/T
    const allScores = Array.from(weekPoints.values()).sort(
      (a, b) => a - b
    );
    if (!allScores.length) {
      console.log(`  ${leagueTag} • Week ${week}: no scores for median`);
      continue;
    }

    let median;
    const n = allScores.length;
    if (n % 2 === 1) {
      median = allScores[(n - 1) / 2];
    } else {
      median = (allScores[n / 2 - 1] + allScores[n / 2]) / 2;
    }

    weekPoints.forEach((pts, rosterId) => {
      const owner = ownersByRoster.get(rosterId);
      if (!owner) return;

      if (pts > median) {
        owner.record.wins++;     // win vs median
      } else if (pts < median) {
        owner.record.losses++;   // loss vs median
      } else {
        owner.record.ties++;     // tie vs median
      }
    });

    console.log(
      `  ${leagueTag} • Week ${week}: median=${median.toFixed(
        2
      )}, teams=${weekPoints.size}`
    );
  }

  // Convert to array and sort by standings for INITIAL seeding
  const allOwners = Array.from(ownersByRoster.values());

  allOwners.sort((a, b) => {
    // Primary: wins (desc)
    if (b.record.wins !== a.record.wins) {
      return b.record.wins - a.record.wins;
    }
    // Secondary: losses (asc)
    if (a.record.losses !== b.record.losses) {
      return a.record.losses - b.record.losses;
    }
    // Tiebreaker: total points Weeks 1–8 (desc)
    if (b.seedPointsTotal !== a.seedPointsTotal) {
      return b.seedPointsTotal - a.seedPointsTotal;
    }
    // Final tiebreaker: ownerName (stable-ish)
    return (a.ownerName || "").localeCompare(b.ownerName || "");
  });

  allOwners.forEach((o, idx) => {
    o.initialSeed = idx + 1; // 1 = best record
  });

  console.log(
    `  ${leagueTag} 🧮 Initial seeds after Week 8 (W/L vs. opponent + median):`
  );
  allOwners.forEach((o) => {
    const { wins, losses, ties } = o.record;
    console.log(
      `   ${leagueTag}  Seed ${String(o.initialSeed).padStart(2, " ")} – ${
        o.ownerName
      }  (${wins}-${losses}-${ties}), pts=${o.seedPointsTotal.toFixed(2)}`
    );
  });

  /* ---------- Phase 2: Leg 2 Guillotine (Weeks 9–12) ---------- */

  // Start with everyone alive after Week 8 seeding
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

    // Record Leg 2 weekly scores (current week) for alive teams
    const weekPoints = new Map(); // rosterId -> pts this week (alive only)
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

    // ---------- NEW: determine elimination by looking at NEXT week ----------
    const nextWeek = week + 1;
    const nextMatchups = await fetchWithRetry(
      `${baseUrl}/matchups/${nextWeek}`
    );

    let eliminated = null;

    if (nextMatchups && nextMatchups.length) {
      // Map of alive rosterId -> pts in the *next* week
      const nextWeekPoints = new Map();

      nextMatchups.forEach((m) => {
        const rosterId = m.roster_id;
        if (!alive.has(rosterId)) return; // ignore already-dead teams

        const pts = Number(m.points ?? 0);
        // If a team is truly "gone", often they either:
        //  - don't show up at all, or
        //  - show up with 0. We'll handle both.
        nextWeekPoints.set(rosterId, pts);
      });

      // 1) Your described behavior: find alive team(s) with EXACTLY 0 in week+1
      const zeroCandidates = [];
      nextWeekPoints.forEach((pts, rosterId) => {
        if (pts === 0) {
          const owner = ownersByRoster.get(rosterId);
          if (owner) zeroCandidates.push(owner);
        }
      });

      if (zeroCandidates.length > 0) {
        // If multiple, worst initial seed goes out
        eliminated = zeroCandidates.reduce((worst, o) =>
          (o.initialSeed || 999) > (worst.initialSeed || 999) ? o : worst
        );
        console.log(
          `  ${leagueTag} 🔪 Week ${week} Guillotine via week ${nextWeek} ZERO pts: ` +
            `${eliminated.ownerName} (initial seed ${eliminated.initialSeed})`
        );
      } else {
        // 2) No exact 0s → look for rosters that disappeared between weeks
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
              `${eliminated.ownerName} (initial seed ${eliminated.initialSeed})`
          );
        }
      }
    }

    // 3) Fallback: if NEXT-week logic failed, use lowest points THIS week
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
          `${eliminated.ownerName} – ${minPts.toFixed(2)} pts (initial seed ${
            eliminated.initialSeed
          })`
      );
    }

    // Mark and remove the eliminated roster
    eliminated.leg2ElimWeek = week;
    alive.delete(eliminated.rosterId);

    console.log(
      `  ${leagueTag}    → Eliminated ${eliminated.ownerName}, ${alive.size} alive`
    );
  }


  // Survivors = rosters with no elimWeek
  const survivors = allOwners.filter((o) => o.leg2ElimWeek == null);

  // Sort survivors by their original initialSeed, then compress seeds 1–N
  survivors
    .sort((a, b) => (a.initialSeed || 999) - (b.initialSeed || 999))
    .forEach((o, idx) => {
      o.finalSeed = idx + 1; // 1–N, usually 1–8
    });

  console.log(`  ${leagueTag} 🏅 Final seeds after Guillotine (survivors only):`);
  survivors.forEach((o) => {
    console.log(
      `   ${leagueTag}  Final Seed ${String(o.finalSeed).padStart(
        2,
        " "
      )} – ${o.ownerName} (initial ${o.initialSeed}, elimWeek=${
        o.leg2ElimWeek ?? "survived"
      })`
    );
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

      // Ignore eliminated rosters in Leg 3
      if (owner.leg2ElimWeek != null) return;

      const bb = computeBestBallLineup(m.players_points || {}, playersDB);

      owner.leg3Weekly[week] = bb.total;
      owner.leg3Total += bb.total;
      owner.lastWeekWithData = week;
      owner.lastWeekRoster = {
        week,
        starters: bb.starters,
        bench: bb.bench,
      };
    });
  }

  console.log(`  ${leagueTag} 🎯 Leg 3 Best Ball totals (survivors):`);
  survivors.forEach((o) => {
    console.log(
      `   ${leagueTag}  Final Seed ${String(o.finalSeed).padStart(
        2,
        " "
      )} – ${o.ownerName}  Leg3Total=${o.leg3Total.toFixed(2)}`
    );
  });

  // We return survivors only for seeding + Leg 3, sorted by finalSeed
  const finalOwners = survivors
    .slice()
    .sort((a, b) => (a.finalSeed || 999) - (b.finalSeed || 999));

  return {
    leagueId,
    leagueName,
    division: divisionName,
    owners: finalOwners,
    eliminated: allOwners.filter((o) => o.leg2ElimWeek != null),
  };
}


/* ================== BRACKET (GODS PER DIVISION) ================== */

/**
 * Build Gods inside a division:
 * leagues paired [0,1], [2,3], [4,5], [6,7]
 * Seeds are survivors’ finalSeed (after Guillotine).
 * Pairing: Light seed 1–8 vs Dark seed 8–1.
 */
function buildGodsForDivision(divisionName, leagueResults) {
  const gods = [];
  const byId = {};
  leagueResults.forEach((lr) => {
    byId[lr.leagueId] = lr;
  });

  const leagueOrder = GAUNTLET_2025.divisions[divisionName] || [];

  for (let i = 0; i < leagueOrder.length; i += 2) {
    const lightId = leagueOrder[i];
    const darkId = leagueOrder[i + 1];

    const light = byId[lightId];
    const dark = byId[darkId];
    if (!light || !dark) continue;

    // Normalize seeds using finalSeed (fallback to 999 if missing)
    const lightSeeds = (light.owners || [])
      .map((o) => ({
        seed: o.finalSeed ?? o.initialSeed ?? 999,
        ...o,
      }))
      .sort((a, b) => a.seed - b.seed);

    const darkSeeds = (dark.owners || [])
      .map((o) => ({
        seed: o.finalSeed ?? o.initialSeed ?? 999,
        ...o,
      }))
      .sort((a, b) => a.seed - b.seed);

    const maxSeeds = Math.min(8, lightSeeds.length, darkSeeds.length);
    const pairings = [];

    for (let s = 1; s <= maxSeeds; s++) {
      const lightTeam = lightSeeds.find((o) => o.seed === s);
      const darkTeam = darkSeeds.find((o) => o.seed === maxSeeds - s + 1);
      if (!lightTeam || !darkTeam) continue;

      pairings.push({
        match: s,
        lightSeed: lightTeam.seed,
        darkSeed: darkTeam.seed,
        lightOwnerName: lightTeam.ownerName,
        darkOwnerName: darkTeam.ownerName,
        // Leg 3 Best Ball totals (so far)
        lightLeg3Total: Number(lightTeam.leg3Total.toFixed(2)),
        darkLeg3Total: Number(darkTeam.leg3Total.toFixed(2)),
        // Also expose last-week BB if you want current-week view on front-end
        lightLastWeek: lightTeam.lastWeekWithData ?? null,
        darkLastWeek: darkTeam.lastWeekWithData ?? null,
      });
    }

    gods.push({
      index: gods.length + 1,
      division: divisionName,
      lightLeagueId: light.leagueId,
      lightLeagueName: light.leagueName,
      darkLeagueId: dark.leagueId,
      darkLeagueName: dark.leagueName,
      lightSeeds,
      darkSeeds,
      pairings,
    });
  }

  return gods;
}

/* ================== BUILD FULL PAYLOAD ================== */

async function buildGauntletLeg3Payload() {
  const playersDB = await getSleeperPlayers();

  const divisions = GAUNTLET_2025.divisions;
  const divisionPayloads = {};

  for (const [divisionName, leagueIds] of Object.entries(divisions)) {
    console.log(`\n=== Legion: ${divisionName} ===`);
    const leagueResults = [];

    await Promise.all(
      leagueIds.map((leagueId) =>
        limit(async () => {
          const res = await processLeague(leagueId, divisionName, playersDB);
          leagueResults.push(res);
        })
      )
    );

    // Maintain league order per your GAUNTLET_2025 mapping
    const orderedLeagues = leagueIds
      .map((id) => leagueResults.find((r) => r.leagueId === id))
      .filter(Boolean);

    const gods = buildGodsForDivision(divisionName, orderedLeagues);

    divisionPayloads[divisionName] = {
      division: divisionName,
      leagues: orderedLeagues,
      gods,
    };
  }

  return {
    year: YEAR,
    name: `${YEAR} Gauntlet – Leg 3 Bracket (standings+median, guillotine survivors)`,
    updatedAt: new Date().toISOString(),
    divisions: divisionPayloads,
  };
}

/* ================== MAIN ================== */

async function main() {
  try {
    console.log(
      "🚀 Building Gauntlet Leg 3 payload (Week 1–8 W/L+median, Week 9–12 Guillotine, Week 13–17 BB)…"
    );
    const payload = await buildGauntletLeg3Payload();

    console.log("💾 Upserting into Supabase gauntlet_leg3…");
    const { error } = await supabase
      .from("gauntlet_leg3")
      .upsert(
        {
          year: YEAR,
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
