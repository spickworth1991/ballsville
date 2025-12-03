// scripts/buildgauntlet.mjs
// Node script to:
// 1) Fetch Sleeper data for the 2025 Gauntlet leagues
// 2) Seed after Week 8 by WIN/LOSS record INCLUDING vs. median each week
// 3) Apply Guillotine eliminations Weeks 9–12 (lowest weekly score, survivors move up)
// 4) Compute Leg 3 (Weeks 13–17) Best Ball totals for survivors only
// 5) Build bracket payload (Weeks 13–16 playoffs) + Week 17 Grand Championship
// 6) Upsert into Supabase table `gauntlet_leg3`

import "dotenv/config";
import axios from "axios";
import pLimit from "p-limit";
import { createClient } from "@supabase/supabase-js";

/* ================== CONFIG ================== */

const YEAR = "2025";

// Seeding phase (standings):
const SEED_START = 1;
const SEED_END = 8; // Weeks 1–8 → standings

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
 * - Weeks 1–8: W/L/T standings (H2H + median)
 * - Weeks 9–12: Guillotine eliminations (lowest weekly score / next-week 0 / disappear)
 * - Weeks 13–17: Best Ball scoring for survivors only
 *
 * Leg 3 scoring is per-week BB; bracket logic is built separately.
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

  const rosterOwnerMap = {};
  rosters.forEach((r) => {
    rosterOwnerMap[r.roster_id] = r.owner_id;
  });

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
      record: { wins: 0, losses: 0, ties: 0 },
      seedPointsWeekly: {},
      seedPointsTotal: 0,
      initialSeed: null,
      leg2Weekly: {},
      leg2ElimWeek: null,
      leg3Weekly: {},
      leg3Total: 0,
      lastWeekWithData: null,
      lastWeekRoster: null,
      finalSeed: null,
    });
  });

  /* ---------- Phase 1: Week 1–8 standings ---------- */

  for (let week = SEED_START; week <= SEED_END; week++) {
    const matchups = await fetchWithRetry(`${baseUrl}/matchups/${week}`);
    if (!matchups || !matchups.length) {
      console.log(`  ${leagueTag} • Week ${week}: no matchups (skipping)`);
      continue;
    }

    const byMatchup = new Map();
    const weekPoints = new Map();

    matchups.forEach((m) => {
      const rosterId = m.roster_id;
      const owner = ownersByRoster.get(rosterId);
      if (!owner) return;

      const pts = Number(m.points ?? 0);

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

    // H2H
    for (const [, teams] of byMatchup.entries()) {
      if (!teams.length) continue;
      const pointsArr = teams.map((t) => t.points);
      const maxPts = Math.max(...pointsArr);
      const minPts = Math.min(...pointsArr);

      if (maxPts === minPts) {
        teams.forEach(({ rosterId }) => {
          const owner = ownersByRoster.get(rosterId);
          if (owner) owner.record.ties++;
        });
      } else {
        teams.forEach(({ rosterId, points }) => {
          const owner = ownersByRoster.get(rosterId);
          if (!owner) return;
          if (points === maxPts) owner.record.wins++;
          else owner.record.losses++;
        });
      }
    }

    // Median
    const allScores = Array.from(weekPoints.values()).sort((a, b) => a - b);
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

      if (pts > median) owner.record.wins++;
      else if (pts < median) owner.record.losses++;
      else owner.record.ties++;
    });

    console.log(
      `  ${leagueTag} • Week ${week}: median=${median.toFixed(
        2
      )}, teams=${weekPoints.size}`
    );
  }

  const allOwners = Array.from(ownersByRoster.values());

  allOwners.sort((a, b) => {
    if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
    if (a.record.losses !== b.record.losses)
      return a.record.losses - b.record.losses;
    if (b.seedPointsTotal !== a.seedPointsTotal)
      return b.seedPointsTotal - a.seedPointsTotal;
    return (a.ownerName || "").localeCompare(b.ownerName || "");
  });

  allOwners.forEach((o, idx) => {
    o.initialSeed = idx + 1;
  });

  console.log(
    `  ${leagueTag} 🧮 Initial seeds after Week 8 (W/L vs. opponent + median):`
  );
  allOwners.forEach((o) => {
    const { wins, losses, ties } = o.record;
    console.log(
      `   ${leagueTag}  Seed ${String(o.initialSeed).padStart(
        2,
        " "
      )} – ${o.ownerName}  (${wins}-${losses}-${ties}), pts=${o.seedPointsTotal.toFixed(
        2
      )}`
    );
  });

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
            `${eliminated.ownerName} (initial seed ${eliminated.initialSeed})`
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
              `${eliminated.ownerName} (initial seed ${eliminated.initialSeed})`
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
          `${eliminated.ownerName} – ${minPts.toFixed(2)} pts (initial seed ${
            eliminated.initialSeed
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

  survivors
    .sort((a, b) => (a.initialSeed || 999) - (b.initialSeed || 999))
    .forEach((o, idx) => {
      o.finalSeed = idx + 1;
    });

  console.log(
    `  ${leagueTag} 🏅 Final seeds after Guillotine (survivors only):`
  );
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
 * Build Gods inside a division as a true 16-team playoff bracket:
 *  - Round 1 → Week 13 (16 → 8)
 *  - Round 2 → Week 14 (8 → 4)
 *  - Round 3 → Week 15 (4 → 2)
 *  - Round 4 → Week 16 (2 → 1)  => God Champion
 *
 * Returns for each God:
 *  - pairings: Round 1 seeded summary (like before, using Leg3 totals)
 *  - bracketRounds: per-round matches (weeks 13–16 as far as played)
 *  - champion: final God champion (once Week 16 is complete)
 */
function buildGodsForDivisionAndChampions(divisionName, leagueResults) {
  const gods = [];
  const champions = [];
  const byId = {};
  leagueResults.forEach((lr) => {
    byId[lr.leagueId] = lr;
  });

  const leagueOrder = GAUNTLET_2025.divisions[divisionName] || [];
  if (!leagueOrder.length) return { gods, champions };

  const getWeekScore = (team, week) => {
    const v = team.leg3Weekly?.[week];
    return typeof v === "number" ? v : 0;
  };

  const getTotalScore = (team) =>
    Number((team.leg3Total || 0).toFixed(2));

  for (let i = 0; i < leagueOrder.length; i += 2) {
    const lightId = leagueOrder[i];
    const darkId = leagueOrder[i + 1];

    const light = byId[lightId];
    const dark = byId[darkId];

    if (!light || !dark) continue;

    const lightTeams = (light.owners || [])
      .map((o) => ({
        ...o,
        side: "light",
        leagueId: light.leagueId,
        leagueName: light.leagueName,
        division: divisionName,
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
        seed: o.finalSeed ?? o.initialSeed ?? 999,
      }))
      .sort((a, b) => a.seed - b.seed);

    const maxSeeds = Math.min(8, lightTeams.length, darkTeams.length);
    const godIndex = gods.length + 1;

    if (maxSeeds === 0) {
      gods.push({
        index: godIndex,
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

    // 🔍 Determine which Leg 3 week we are currently in:
    // "current week = latest week that has scores, AND the next mapped week is empty"
    let currentWeek = null;

    for (let idx = 0; idx < LEG3_ROUND_WEEKS.length; idx++) {
      const w = LEG3_ROUND_WEEKS[idx];
      const anyThis = allTeams.some(
        (t) => typeof t.leg3Weekly?.[w] === "number"
      );
      if (!anyThis) continue;

      const nextW = LEG3_ROUND_WEEKS[idx + 1];
      if (!nextW) {
        currentWeek = w; // last mapped week
      } else {
        const anyNext = allTeams.some(
          (t) => typeof t.leg3Weekly?.[nextW] === "number"
        );
        if (!anyNext) {
          currentWeek = w;
          break;
        } else {
          currentWeek = w; // keep moving forward
        }
      }
    }

    // Round 1 seed pairings (this is what UI always shows, with rolling totals)
    const round1Pairings = [];
    for (let s = 1; s <= maxSeeds; s++) {
      const lightTeam = lightTeams.find((t) => t.seed === s);
      const darkSeed = maxSeeds - s + 1;
      const darkTeam = darkTeams.find((t) => t.seed === darkSeed);
      if (!lightTeam || !darkTeam) continue;

      round1Pairings.push({
        matchIndex: s,
        teamA: lightTeam,
        teamB: darkTeam,
      });
    }

    // If no Leg 3 data at all, just show seeded matchups with 0s
    if (!currentWeek) {
      const uiPairings = round1Pairings.map((p) => ({
        match: p.matchIndex,
        round: 1,
        week: LEG3_ROUND_WEEKS[0],
        lightSeed: p.teamA.seed,
        darkSeed: p.teamB.seed,
        lightOwnerName: p.teamA.ownerName,
        darkOwnerName: p.teamB.ownerName,
        lightLeg3Total: 0,
        darkLeg3Total: 0,
      }));

      gods.push({
        index: godIndex,
        division: divisionName,
        lightLeagueId: light.leagueId,
        lightLeagueName: light.leagueName,
        darkLeagueId: dark.leagueId,
        darkLeagueName: dark.leagueName,
        lightSeeds: lightTeams,
        darkSeeds: darkTeams,
        pairings: uiPairings,
        bracketRounds: [],
        champion: null,
      });

      continue;
    }

    const currentRoundIndex = LEG3_ROUND_WEEKS.indexOf(currentWeek);
    const roundsToSimulate = currentRoundIndex + 1; // 1..4

    function decideWinner(pair, week) {
      const scoreA = getWeekScore(pair.teamA, week);
      const scoreB = getWeekScore(pair.teamB, week);

      if (scoreA > scoreB) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB };
      }
      if (scoreB > scoreA) {
        return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB };
      }

      const seedA = pair.teamA.seed ?? 999;
      const seedB = pair.teamB.seed ?? 999;
      if (seedA < seedB) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB };
      }
      if (seedB < seedA) {
        return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB };
      }

      const nameA = pair.teamA.ownerName || "";
      const nameB = pair.teamB.ownerName || "";
      if (nameA.localeCompare(nameB) <= 0) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB };
      }
      return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB };
    }

    let currentPairings = round1Pairings;
    const bracketRounds = [];

    for (let r = 0; r < roundsToSimulate; r++) {
      const week = LEG3_ROUND_WEEKS[r];
      const roundNumber = r + 1;

      const results = [];
      const winners = [];

      for (let idx = 0; idx < currentPairings.length; idx++) {
        const pair = currentPairings[idx];
        const { winner, loser, scoreA, scoreB } = decideWinner(pair, week);

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
        });
        winners.push(winner);
      }

      bracketRounds.push({
        roundNumber,
        week,
        results,
        winners,
      });

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

    // 🏆 Champion ONLY when:
    //  - all 4 rounds are simulated (through Week 16), AND
    //  - the last round has exactly 1 winner, AND
    //  - we actually have data for **all** bracket weeks for this God
    let championSummary = null;
    const totalRounds = LEG3_ROUND_WEEKS.length; // 4
    const lastRound = bracketRounds[bracketRounds.length - 1];

    const allWeeksFilledForThisGod = LEG3_ROUND_WEEKS.every((w) =>
      allTeams.some((t) => typeof t.leg3Weekly?.[w] === "number")
    );

    if (
      lastRound &&
      roundsToSimulate === totalRounds &&
      lastRound.week === LEG3_ROUND_WEEKS[totalRounds - 1] && // must be week 16
      lastRound.winners.length === 1 &&
      allWeeksFilledForThisGod
    ) {
      const champ = lastRound.winners[0];
      championSummary = {
        division: divisionName,
        godIndex,
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

    // UI pairings: "seeded" view + rolling totals (what you had before),
    // but we can now ALSO show the full bracketRounds if we want later.
    const uiPairings = round1Pairings.map((p) => ({
      match: p.matchIndex,
      round: 1,
      week: LEG3_ROUND_WEEKS[0],
      lightSeed: p.teamA.seed,
      darkSeed: p.teamB.seed,
      lightOwnerName: p.teamA.ownerName,
      darkOwnerName: p.teamB.ownerName,
      lightLeg3Total: getTotalScore(p.teamA),
      darkLeg3Total: getTotalScore(p.teamB),
    }));

    gods.push({
      index: godIndex,
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

  const divisions = GAUNTLET_2025.divisions;
  const divisionPayloads = {};
  const allChampions = [];

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

    const orderedLeagues = leagueIds
      .map((id) => leagueResults.find((r) => r.leagueId === id))
      .filter(Boolean);

    const { gods, champions } = buildGodsForDivisionAndChampions(
      divisionName,
      orderedLeagues
    );

    divisionPayloads[divisionName] = {
      division: divisionName,
      leagues: orderedLeagues,
      gods,
    };

    allChampions.push(...champions);
  }

  const grandChampionship = buildGrandChampionship(allChampions);

  return {
    year: YEAR,
    name: `${YEAR} Gauntlet – Leg 3 Bracket (W1–8 standings+median, W9–12 Guillotine, W13–16 playoff, W17 Grand Championship)`,
    updatedAt: new Date().toISOString(),
    divisions: divisionPayloads,
    grandChampionship,
  };
}

/* ================== MAIN ================== */

async function main() {
  try {
    console.log(
      "🚀 Building Gauntlet Leg 3 payload (W1–8 W/L+median, W9–12 Guillotine, W13–16 bracket, W17 Grand Championship)…"
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
