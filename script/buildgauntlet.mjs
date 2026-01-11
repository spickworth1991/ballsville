// script/buildgauntlet.mjs
//
// Node script to:
// 1) Fetch Sleeper data for the 2025 Gauntlet leagues
// 2) Use MANUAL seeds from Supabase table `gauntlet_seeds_2025` (Leg 1 is manual now)
// 3) Apply Guillotine eliminations Weeks 9–12 (lowest weekly score, survivors move up)
// 4) Compute Leg 3 (Weeks 13–17) Best Ball totals for survivors only
// 5) Build bracket payload (Weeks 13–16 playoffs) + Week 17 Grand Championship
// 6) ❌ NO Supabase upsert; instead ✅ upload JSON to Cloudflare R2
//
// IMPORTANT NOTES:
// - Supabase is still used ONLY for `gauntlet_seeds_2025` (seeds + league_name).
// - Final standings/bracket JSON goes to R2 as `gauntlet/leg3/gauntlet_leg3_2025.json`
//   (you can change the key/prefix below).

import "dotenv/config";
import axios from "axios";
import pLimit from "p-limit";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { CURRENT_SEASON } from "@/lib/season";
/* ================== LOGGING (OPTIONAL FILE + QUIET CONSOLE) ================== */

// Toggle: set GAUNTLET_DEBUG_LOG=1 to enable file logging, 0/empty to disable.
const DEBUG_LOG_ENABLED =
  String(process.env.GAUNTLET_DEBUG_LOG ?? "0").trim() === "1";

let RUN_LOG_FILE = null;
let debugStream = null;

// Counters for summary
let DEBUG_WARN_COUNT = 0;

function tsForFile(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;
}

function tsForLine(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function safeMkdir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

function initDebugLogIfEnabled() {
  if (!DEBUG_LOG_ENABLED) return;

  const LOG_DIR = path.join(process.cwd(), "logs");
  safeMkdir(LOG_DIR);

  RUN_LOG_FILE = path.join(
    LOG_DIR,
    `gauntlet_leg3_${YEAR}_${tsForFile()}.log`
  );

  debugStream = fs.createWriteStream(RUN_LOG_FILE, { flags: "a" });

  // header
  debugStream.write(`${tsForLine()} DEBUG_LOG_ENABLED=1\n`);
}

// File log writers (NO-OP when disabled)
function dbg(line = "") {
  if (!debugStream) return;
  debugStream.write(`${tsForLine()} ${line}\n`);
}

function dbgWarn(line = "") {
  DEBUG_WARN_COUNT += 1;
  if (!debugStream) return;
  debugStream.write(`${tsForLine()} ⚠️ ${line}\n`);
}

function dbgSection(title, context = "") {
  if (!debugStream) return;
  dbg("");
  dbg("============================================================");
  dbg(`SECTION: ${title}`);
  if (context) dbg(`CONTEXT: ${context}`);
  dbg("============================================================");
}

function dbgRow(label, value, context = "") {
  if (!debugStream) return;
  const ctx = context ? ` ${context}` : "";
  dbg(`${String(label).padEnd(24, " ")} ${value}${ctx}`);
}

// Console helpers (keep console clean)
function cInfo(msg) {
  console.log(msg);
}
function cWarn(msg) {
  console.warn(msg);
}
function cErr(msg) {
  console.error(msg);
}

function closeDebugStream() {
  try {
    if (debugStream) debugStream.end();
  } catch {}
}

// Hook exits (safe even if debug disabled)
process.on("exit", closeDebugStream);
process.on("SIGINT", () => {
  closeDebugStream();
  process.exit(130);
});
process.on("SIGTERM", () => {
  closeDebugStream();
  process.exit(143);
});
process.on("uncaughtException", (err) => {
  dbgWarn(`UNCAUGHT_EXCEPTION: ${err?.stack || err}`);
  closeDebugStream();
  throw err;
});
process.on("unhandledRejection", (err) => {
  dbgWarn(`UNHANDLED_REJECTION: ${err?.stack || err}`);
});


/* ================== CONFIG ================== */

const YEAR = CURRENT_SEASON();
const SEEDS_TABLE = `gauntlet_seeds_${YEAR}`;


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

// Used only for detecting scoring/finalization (includes Grand Championship week)
const LEG3_SCORE_WEEKS = [13, 14, 15, 16, 17];

const GRAND_CHAMP_WEEK = 17; // Week 17 = all God winners vs each other

const CONCURRENCY = 5;
const RETRIES = 3;

// Canonical God order (for display + consistent ordering)
const GOD_ORDER = {
  Egyptians: ["Amun-Rah", "Osiris", "Horus", "Anubis"],
  Greeks: ["Zeus", "Ares", "Apollo", "Poseidon"],
  Romans: ["Jupiter", "Mars", "Minerva", "Saturn"],
};

/* ================== SUPABASE (SEEDS ONLY) ================== */

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in env."
  );
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ================== R2 CONFIG (OUTPUT ONLY) ================== */

// You already use these in other workflows; re-use the same names if you want:
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_BUCKET_GAUNTLET =
  process.env.R2_BUCKET_GAUNTLET || process.env.ADMIN_BUCKET; // fallback

if (!R2_ACCOUNT_ID || !R2_BUCKET_GAUNTLET) {
  console.error(
    "❌ R2_ACCOUNT_ID or R2_BUCKET_GAUNTLET / ADMIN_BUCKET is not set in env."
  );
  process.exit(1);
}

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

async function uploadJsonToR2(key, payload) {
  const body = JSON.stringify(payload, null, 2);
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET_GAUNTLET,
    Key: key,
    Body: body,
    ContentType: "application/json",
  });

  await r2Client.send(cmd);

  // Console = important
  cInfo(`✅ Uploaded to R2: s3://${R2_BUCKET_GAUNTLET}/${key}`);

  // File = full
  dbg(`R2_UPLOAD bucket=${R2_BUCKET_GAUNTLET} key=${key} bytes=${Buffer.byteLength(body)}`);
}


/* ================== BASIC HELPERS ================== */

const limit = pLimit(CONCURRENCY);
const axiosInstance = axios.create();

/** Only seeds 1–12 are considered "real"/controllable */
function clampSeed12(seed) {
  const n = Number(seed);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 12) return null;
  return n;
}

function isTrulyEmptyRoster(r) {
  const playersLen = Array.isArray(r?.players) ? r.players.length : 0;
  const startersLen = Array.isArray(r?.starters) ? r.starters.length : 0;
  // some leagues keep starters populated; treat either as "has team"
  return playersLen === 0 && startersLen === 0;
}
/** League-scoped logger: writes details to file (no console spam) */
function makeLeagueLogger(leagueTag) {
  return {
    section(title) {
      dbgSection(title, leagueTag);
    },
    info(msg) {
      dbg(`${leagueTag} ${msg}`);
    },
    warn(msg) {
      dbgWarn(`${leagueTag} ${msg}`);
    },
    row(label, value) {
      dbgRow(label, value, leagueTag);
    },
  };
}



const normId = (x) => (x == null ? null : String(x).trim());

async function fetchWithRetry(url, retries = RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axiosInstance.get(url);
      return res.data;
    } catch (err) {
      const msg = err?.response?.status
        ? `${err.response.status} ${err.response.statusText || ""}`.trim()
        : (err?.message || String(err));

      if (i < retries - 1) {
        const delay = 500 * (i + 1);
        dbgWarn(`Retry ${i + 1}/${retries} for ${url} after ${delay}ms — ${msg}`);
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }

      // final failure
      dbgWarn(`FAILED after ${retries} tries: ${url} — ${msg}`);
      throw err;
    }
  }
}


async function getSleeperPlayers() {
  cInfo("⬇️ Fetching Sleeper players DB…");
  const url = "https://api.sleeper.app/v1/players/nfl";
  return fetchWithRetry(url);
}

function playerPos(playersDB, id) {
  const p = playersDB[id] || {};
  return String(
    p.position || (p.fantasy_positions && p.fantasy_positions[0]) || ""
  ).toUpperCase();
}

// Determine Leg 3 bracket weeks:
// - latestScoreWeek = highest week (13–16) where ANY team has non-zero Leg 3 BB points
// - currentBracketWeek = what the UI should treat as "this week":
/*
  • Thu–Mon: current = latestScoreWeek  (games in that week are live)
  • Tue–Wed: current = latestScoreWeek + 1 (next week starts; show 0–0 matchups)
  • If no scores at all yet: current = 13 (first Leg 3 week)
*/
function detectBracketWeek(allTeams) {
  if (!Array.isArray(allTeams) || allTeams.length === 0) {
    return {
      latestScoreWeek: null,
      currentBracketWeek: LEG3_ROUND_WEEKS[0], // 13
    };
  }

  const weeksWithScores = LEG3_SCORE_WEEKS.filter((w) =>
    allTeams.some((t) => {
      const v = t.leg3Weekly?.[w];
      return typeof v === "number" && v !== 0;
    })
  );

  if (!weeksWithScores.length) {
    return {
      latestScoreWeek: null,
      currentBracketWeek: LEG3_ROUND_WEEKS[0], // 13
    };
  }

  const latestScoreWeek = weeksWithScores[weeksWithScores.length - 1];

  // Figure out day-of-week in Detroit time
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;

  let currentBracketWeek = latestScoreWeek;

  // On Tuesday and Wednesday, treat the *next* week as "current"
  // (as long as there is a next Leg 3 week).
  if (weekday === "Tue" || weekday === "Wed") {
    const idx = LEG3_SCORE_WEEKS.indexOf(latestScoreWeek);
if (idx !== -1 && idx < LEG3_SCORE_WEEKS.length - 1) {
  currentBracketWeek = LEG3_SCORE_WEEKS[idx + 1];
}
  }

  return { latestScoreWeek, currentBracketWeek };
}
function getDetroitWeekday(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  return parts.find((p) => p.type === "weekday")?.value || "";
}

function computeFinalizedThroughWeek(latestScoreWeek) {
  // If nothing has scored yet, nothing is finalized.
  if (!latestScoreWeek) return null;

  const w = Number(latestScoreWeek);
  if (!Number.isFinite(w)) return null;

  // ✅ Only finalize on Tue/Wed (after games are truly done and corrections usually apply)
  const weekday = getDetroitWeekday();
  const isFinalizationDay = weekday === "Tue" || weekday === "Wed";

  if (isFinalizationDay) {
    return w;
  }

  // Otherwise, we are still in the "current week in progress" period.
  // Never allow finalization to go below LEG3_START-1 (so you don’t finalize Week 12 accidentally).
  return Math.max(LEG3_START - 1, w - 1);
}




/* ================== BEST BALL ================== */

/**
 * Best Ball lineup:
 * 1 QB, 2 RB, 3 WR, 1 TE, 2 FLEX, 1 SF
 * Also attaches:
 * - team
 * - status
 * - injury_status
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
 * - division (text) e.g. "Egyptians", "Greeks", "Romans"
 * - god_name (text) e.g. "Amun-Rah"
 * - side (text) "light" | "dark"
 * - league_id (text)
 * - league_name (text, nullable)
 * - owner_id (text)
 * - owner_name (text)
 * - seed (int, nullable)
 */
async function ensureLeagueNames(leaguesMap) {
  const toUpdate = [];

  for (const [leagueId, info] of leaguesMap.entries()) {
    if (info.leagueName) continue;
    try {
      const leagueInfo = await fetchWithRetry(
        `https://api.sleeper.app/v1/league/${leagueId}`
      );
      const name = leagueInfo?.name || leagueId;
      info.leagueName = name;
      toUpdate.push({ leagueId, name });
    } catch (err) {
      console.warn(
        `⚠️ Could not fetch league name from Sleeper for league ${leagueId}:`,
        err.message || err
      );
    }
  }

  // Write back to Supabase (one UPDATE per league; small n)
  for (const u of toUpdate) {
    const { error } = await supabase
      .from(SEEDS_TABLE)
      .update({ league_name: u.name })
      .eq("year", YEAR)
      .eq("league_id", u.leagueId);
    if (error) {
      console.warn(
        `⚠️ Failed to update league_name for league ${u.leagueId}:`,
        error
      );
    } else {
      console.log(
        ` ✅ Updated league_name for ${u.leagueId} → ${u.name} in ${SEEDS_TABLE}`
      );
    }
  }
}

async function loadLeaguesAndSeeds(year) {
  console.log("⬇️ Loading gauntlet seeds from Supabase…");

  const { data, error } = await supabase
    .from(SEEDS_TABLE)
    .select(
      "id, year, division, god_name, god, side, league_id, league_name, owner_id, owner_name, seed"
    )
    .eq("year", String(year));

  if (error) {
    console.error(`❌ Error loading ${SEEDS_TABLE}:`, error);
    throw error;
  }

  if (!data || !data.length) {
    throw new Error(
      `No rows found in ${SEEDS_TABLE} for this year. Populate seeds via /admin/gauntlet/seeds first.`
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
        manualSlots: [], // rows with NULL owner_id (used to seed open / ownerless Sleeper rosters)
      });
    }
    const league = leaguesMap.get(leagueId);
    const ownerId = row.owner_id ? String(row.owner_id) : null;

    if (ownerId) {
      league.seedsByOwnerId[ownerId] =
        row.seed != null ? Number(row.seed) : null;
      league.ownerNamesById[ownerId] = row.owner_name || ownerId;
    } else {
      // Manual placeholder slot (created in /admin/gauntlet/seeds)
      league.manualSlots.push({
        rowId: row.id,
        ownerName: row.owner_name || "TBD",
        seed: row.seed != null ? Number(row.seed) : null,
      });
    }

  }

  // Auto-fill missing league_name by hitting Sleeper once per league
  await ensureLeagueNames(leaguesMap);

  // Calculate seededCount / ownersCount / missingOwners
  const missingSeedLeagues = [];

  leaguesMap.forEach((league) => {
   const ownerIds = Object.keys(league.ownerNamesById);
    const manualSlots = Array.isArray(league.manualSlots) ? league.manualSlots : [];

    // Owners = real Sleeper owners + manual placeholder slots (owner_id NULL)
    league.ownersCount = ownerIds.length + manualSlots.length;

    const missingOwners = [];
    let seededCount = 0;

    // Real owners
    ownerIds.forEach((ownerId) => {
      const s = league.seedsByOwnerId[ownerId];
      if (s != null) seededCount += 1;
      else missingOwners.push({ ownerId, ownerName: league.ownerNamesById[ownerId] });
    });

    // Manual placeholder slots
    manualSlots.forEach((slot) => {
      if (slot?.seed != null) seededCount += 1;
      else missingOwners.push({ ownerId: null, ownerName: slot?.ownerName || "TBD" });
    });

    league.seededCount = seededCount;
    league.missingOwners = missingOwners;


    // A league is "missing seeds" if any owner row has a null seed
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

  console.log(`\nDiscovered divisions & gods from ${SEEDS_TABLE}:`);
  cInfo(`\nDiscovered divisions & gods from ${SEEDS_TABLE}:`);

  Object.entries(divisionGodConfig).forEach(([division, godsArr]) => {
    // console.log(` • ${division}:`);
    cInfo(` • ${division}:`);
    godsArr.forEach((g) => {
      cInfo(`   - ${g.godName} (light: ${g.lightLeagueId || "NONE"}, dark: ${
          g.darkLeagueId || "NONE"
        })`);

      // console.log(
      //   `   - ${g.godName} (light: ${g.lightLeagueId || "NONE"}, dark: ${
      //     g.darkLeagueId || "NONE"
      //   })`
      // );
    });
  });

  // NO THROW for missing seeds – caller can decide whether to bail or not
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
  // console.log(`\n${leagueTag}`);
  cInfo(`\n${leagueTag}`);


  const users = await fetchWithRetry(`${baseUrl}/users`);
  const rosters = await fetchWithRetry(`${baseUrl}/rosters`);

  const userMap = {};
  users.forEach((u) => {
    userMap[u.user_id] = u.display_name;
  });

    const ownersByRoster = new Map();

  const seedConfig = seedsForLeague; // ✅ unify naming
  const rawSeedsByOwnerId = seedConfig?.seedsByOwnerId || seedConfig || {};
  const manualSlots = Array.isArray(seedConfig?.manualSlots) ? seedConfig.manualSlots : [];
  const ownerNamesByIdFromSeeds = seedConfig?.ownerNamesById || {};

  const log = makeLeagueLogger(leagueTag);

  // If Sleeper has open rosters (owner_id null) OR "empty" rosters, we assign them manual slots
  // from /admin/gauntlet/seeds in ascending seed order to keep bracket positions stable.
    // ✅ STABLE manual slot ordering:
  // Do NOT sort by seed — changing seed would reshuffle slot identity.
  // Use rowId (Supabase PK) so manual slots remain anchored run-to-run.
  const manualSlotsStable = manualSlots
    .slice()
    .sort((a, b) => {
      const ar = Number(a?.rowId ?? 0);
      const br = Number(b?.rowId ?? 0);
      return ar - br;
    });

  // Build a stable mapping: rosterId -> manual slot
  // (roster ordering is stable, and manual slot ordering is stable)
  const sortedRosters = rosters
    .slice()
    .sort((a, b) => (a.roster_id || 0) - (b.roster_id || 0));

  const rostersNeedingManual = sortedRosters.filter((r) => {
    const emptyRoster = isTrulyEmptyRoster(r);
    const rawOwnerId = r?.owner_id ? String(r.owner_id) : null;
    return !rawOwnerId || emptyRoster;
  });

  const manualSlotByRosterId = new Map();
  for (let i = 0; i < rostersNeedingManual.length; i++) {
    const r = rostersNeedingManual[i];
    const slot = manualSlotsStable[i] || null;
    manualSlotByRosterId.set(r.roster_id, slot);
  }

    log.section("MANUAL SLOT ANCHOR MAP (STABLE)");
    rostersNeedingManual.forEach((r) => {
      const slot = manualSlotByRosterId.get(r.roster_id);
      log.info(
        `roster_id=${r.roster_id} -> manualRow=${slot?.rowId ?? "NONE"} (${slot?.ownerName ?? "NONE"}, seed=${slot?.seed ?? "null"})`
      );
    });


  // Build a set of "real roster owners" (owners actually attached to rosters)
  const rosterOwnerIds = new Set();
  rosters.forEach((r) => {
    if (r?.owner_id) rosterOwnerIds.add(String(r.owner_id));
    if (Array.isArray(r?.co_owners)) {
      r.co_owners.forEach((id) => {
        if (id) rosterOwnerIds.add(String(id));
      });
    }
  });

  // Filter seeds so:
  //  - ONLY seeds 1–12 matter
  //  - ONLY owners who are actually on a roster can influence anything
  // (Owners in the league/users list but NOT on a roster cannot hijack an empty team.)
  const seedsByOwnerId = {};
  const ignoredSeeds = []; // for logging
  Object.entries(rawSeedsByOwnerId || {}).forEach(([oid, s]) => {
    const ownerId = oid ? String(oid) : null;
    const seed = clampSeed12(s);
    if (!ownerId) return;

    if (!rosterOwnerIds.has(ownerId)) {
      ignoredSeeds.push({ ownerId, seed: s, reason: "owner_not_on_any_roster" });
      return;
    }
    if (seed == null) {
      ignoredSeeds.push({ ownerId, seed: s, reason: "seed_outside_1_12_or_invalid" });
      return;
    }
    seedsByOwnerId[ownerId] = seed;
  });

  // Stable roster ordering (owners first, then ownerless), so manual slot assignment is deterministic
  rosters
    .slice()
    .sort((a, b) => {
      const ao = a.owner_id ? 0 : 1;
      const bo = b.owner_id ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.roster_id || 0) - (b.roster_id || 0);
    })
    .forEach((r) => {
      const rosterId = r.roster_id;

      // IMPORTANT FIX:
      // If a roster is "empty" (no players/starters), treat it like an open slot and use a manual slot.
      const emptyRoster = isTrulyEmptyRoster(r);

      const rawOwnerId = r.owner_id ? String(r.owner_id) : null;
      const forceManual = !rawOwnerId || emptyRoster;

      // Default mapping for real owners
      let ownerId = rawOwnerId;
      let ownerName = rawOwnerId
        ? (userMap[rawOwnerId] || ownerNamesByIdFromSeeds[rawOwnerId] || `Owner ${rawOwnerId}`)
        : null;

      let manualSeed =
        rawOwnerId && seedsByOwnerId[rawOwnerId] != null
          ? Number(seedsByOwnerId[rawOwnerId])
          : null;

      let mappingNote = "";

      // If roster has NO owner OR is EMPTY, use the corresponding manual placeholder slot
      if (forceManual) {
        const slot = manualSlotByRosterId.get(rosterId) || null;

        ownerId = slot?.rowId != null ? `manual:${slot.rowId}` : `manual_roster:${rosterId}`;
        ownerName = (slot?.ownerName || (emptyRoster ? "EMPTY" : "TBD")).trim() || "TBD";
        manualSeed = slot?.seed != null ? clampSeed12(slot.seed) : null;

        mappingNote = !rawOwnerId
          ? "manual_slot(ownerless_roster)"
          : "manual_slot(empty_roster_override)";
      } else {
        mappingNote = "sleeper_owner";
      }

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
        initialSeed: manualSeed, // already clamped to 1–12 (or null)
        leg2Weekly: {},
        leg2ElimWeek: null,
        leg3Weekly: {},
        leg3Total: 0,
        leg3BestBall: {},
        lastWeekWithData: null,
        lastWeekRoster: null,
        finalSeed: null,
        _mappingNote: mappingNote,
        _emptyRoster: emptyRoster ? true : false,
        _rawOwnerId: rawOwnerId,
      });
    });

  // ====== LOGGING (clear + actionable) ======
  log.section("SEEDING + ROSTER MAPPING");

  if (ignoredSeeds.length) {
    log.warn(
      `Ignored ${ignoredSeeds.length} seed rows for seeding (invalid seed or owner not on a roster). ` +
      `Those owners may still exist as rosters, but will be UNSEEDED (seed ??).`
    );

    ignoredSeeds.slice(0, 50).forEach((x) => {
      log.row(
        "ignored_seed",
        `${x.ownerId} seed=${x.seed} (${x.reason})`
      );
    });
    if (ignoredSeeds.length > 50) {
      log.row("ignored_seed", `... +${ignoredSeeds.length - 50} more`);
    }
  } else {
    log.info("No ignored seed rows.");
  }

  const mapped = Array.from(ownersByRoster.values());
  const manualMapped = mapped.filter((o) => String(o.ownerId || "").startsWith("manual:") || String(o.ownerId || "").startsWith("manual_roster:"));
  const emptyOverrides = mapped.filter((o) => o._mappingNote === "manual_slot(empty_roster_override)");

  log.row("rosters_total", String(mapped.length));
  log.row("manual_slots_used", String(manualMapped.length));
  log.row("empty_roster_overrides", String(emptyOverrides.length));

    // ====== Phase 1: MANUAL SEEDS ONLY (no Week 1–8 computation) ======
  log.section("MANUAL SEEDS (1–12 ONLY)");

  const seeded = mapped
    .filter((o) => Number.isFinite(o.initialSeed) && o.initialSeed >= 1 && o.initialSeed <= 12)
    .slice()
    .sort((a, b) => (a.initialSeed - b.initialSeed));

  const unseeded = mapped
    .filter((o) => !(Number.isFinite(o.initialSeed) && o.initialSeed >= 1 && o.initialSeed <= 12))
    .slice()
    .sort((a, b) => (a.ownerName || "").localeCompare(b.ownerName || ""));

  // 1) Only show true seeded 1–12 here
  if (!seeded.length) {
    log.warn("No valid seeds 1–12 found in Supabase for this league.");
  } else {
    seeded.forEach((o) => {
      const seedStr = String(o.initialSeed).padStart(2, " ");
      const note = o._mappingNote || "";
      const extra = o._emptyRoster ? " [EMPTY]" : "";
      log.info(`Seed ${seedStr} – ${o.ownerName} (owner_id=${o.ownerId}) ${note}${extra}`);
    });
  }

  // 2) Put unseeded owners in their own clearly labeled section
  if (unseeded.length) {
    log.section("UNSEEDED OWNERS (NO VALID 1–12 SEED)");
    unseeded.forEach((o) => {
      const note = o._mappingNote || "";
      const extra = o._emptyRoster ? " [EMPTY]" : "";
      const rawSeed = rawSeedsByOwnerId?.[String(o._rawOwnerId || "")];
      const rawSeedNote =
        rawSeed != null ? ` (raw_seed=${rawSeed})` : "";
      log.info(`UNSEEDED – ${o.ownerName} (owner_id=${o.ownerId})${rawSeedNote} ${note}${extra}`);
    });
  }


  const allOwners = Array.from(ownersByRoster.values());


    /* ---------- Phase 2: Leg 2 Guillotine (Weeks 9–12) ---------- */

  log.section("GUILLOTINE ELIMINATIONS (WEEKS 9–12)");

  const alive = new Set(allOwners.map((o) => o.rosterId));

  for (let week = LEG2_START; week <= LEG2_END; week++) {
    if (alive.size <= 8) {
      log.info(`Week ${week}: alive<=8 (${alive.size}) — stop Guillotine early.`);
      break;
    }

    const matchups = await fetchWithRetry(`${baseUrl}/matchups/${week}`);
    if (!matchups || !matchups.length) {
      log.info(`Week ${week}: no matchups — stop Guillotine early.`);
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
        log.info(
          `Week ${week}: eliminated via Week ${nextWeek} ZERO pts — ${eliminated.ownerName} ` +
          `(seed ${eliminated.initialSeed ?? "??"}, roster_id=${eliminated.rosterId})`
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
          log.info(
            `Week ${week}: eliminated via Week ${nextWeek} DISAPPEARED roster — ${eliminated.ownerName} ` +
            `(seed ${eliminated.initialSeed ?? "??"}, roster_id=${eliminated.rosterId})`
          );

        }
      }
    }

    if (!eliminated) {
      if (!weekPoints.size) {
        log.info(`${leagueTag} • Week ${week}: no weekPoints for alive rosters; cannot eliminate`);
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
        log.info(`${leagueTag} • Week ${week}: could not determine elimination candidate (fallback)`);
        break;
      }

      eliminated = candidates.reduce((worst, o) =>
        (o.initialSeed || 999) > (worst.initialSeed || 999) ? o : worst
      );
      log.info(
        `Week ${week}: eliminated FALLBACK lowest pts — ${eliminated.ownerName} ` +
        `(${minPts.toFixed(2)} pts, seed ${eliminated.initialSeed ?? "??"}, roster_id=${eliminated.rosterId})`
      );

    }

    eliminated.leg2ElimWeek = week;
    alive.delete(eliminated.rosterId);
    log.info(`Week ${week}: eliminated ${eliminated.ownerName} → alive=${alive.size}`);

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

  /* ---------- Phase 3: Leg 3 Best Ball (Weeks 13–17, survivors only) ---------- */

  for (let week = LEG3_START; week <= LEG3_END; week++) {
    const matchups = await fetchWithRetry(`${baseUrl}/matchups/${week}`);
    if (!matchups || !matchups.length) {
      console.log(`${leagueTag} • Week ${week}: no matchups (Leg 3 Best Ball)`);
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

      owner.leg3BestBall[week] = bb;
      owner.lastWeekWithData = week;
      owner.lastWeekRoster = {
        week,
        starters: bb.starters,
        bench: bb.bench,
      };
    });
  }

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
 * - Round 1 → Week 13 (16 → 8)
 * - Round 2 → Week 14 (8 → 4)
 * - Round 3 → Week 15 (4 → 2)
 * - Round 4 → Week 16 (2 → 1) => God Champion
 *
 * NOTE:
 * - `pairings` is a static view of the Round 1 bracket (Week 13),
 *   seeded 1–8 vs 8–1.
 * - `bracketRounds` holds all the week-by-week results and winners.
 */
function buildGodsForDivisionAndChampions(
  divisionName,
  leagueResults,
  godConfigs,
  currentBracketWeek, // kept for compatibility (UI uses it), not used for deciding winners
  latestScoreWeek,
  finalizedThroughWeek // ✅ NEW
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

  const lastScoreWeek = latestScoreWeek || null;
  const finalizedWeek = finalizedThroughWeek || null;

  for (let g = 0; g < godConfigs.length; g++) {
    const godCfg = godConfigs[g];
    const { godName, lightLeagueId, darkLeagueId } = godCfg;

    const light = lightLeagueId ? byId[lightLeagueId] : null;
    const dark = darkLeagueId ? byId[darkLeagueId] : null;

    const godIndex = g + 1;

    if (!light || !dark) {
      gods.push({
        index: godIndex,
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

    const decideWinnerFinalizedOnly = (pair, week) => {
      const scoreA = getWeekScore(pair.teamA, week);
      const scoreB = getWeekScore(pair.teamB, week);

      const lineupA = pair.teamA.leg3BestBall?.[week] || null;
      const lineupB = pair.teamB.leg3BestBall?.[week] || null;

      // If the week is NOT finalized yet, we never declare a winner.
      const weekFinalized =
        finalizedWeek != null && Number(week) <= Number(finalizedWeek);

      if (!weekFinalized) {
        return { winner: null, loser: null, scoreA, scoreB, lineupA, lineupB };
      }

      // Week is finalized → decide winner (including tie-break)
      const hasAnyScore = scoreA !== 0 || scoreB !== 0;
      if (!hasAnyScore) {
        return { winner: null, loser: null, scoreA, scoreB, lineupA, lineupB };
      }

      if (scoreA > scoreB) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB, lineupA, lineupB };
      }
      if (scoreB > scoreA) {
        return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB, lineupA, lineupB };
      }

      const seedA = pair.teamA.seed ?? 999;
      const seedB = pair.teamB.seed ?? 999;
      if (seedA < seedB) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB, lineupA, lineupB };
      }
      if (seedB < seedA) {
        return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB, lineupA, lineupB };
      }

      const nameA = pair.teamA.ownerName || "";
      const nameB = pair.teamB.ownerName || "";
      if (nameA.localeCompare(nameB) <= 0) {
        return { winner: pair.teamA, loser: pair.teamB, scoreA, scoreB, lineupA, lineupB };
      }
      return { winner: pair.teamB, loser: pair.teamA, scoreA, scoreB, lineupA, lineupB };
    };

    let bracketRounds = [];
    let championSummary = null;

    let currentPairings = round1Pairings.slice();

    const noScoresAnywhere = !lastScoreWeek;

    if (currentPairings.length) {
      for (let r = 0; r < LEG3_ROUND_WEEKS.length; r++) {
        const week = LEG3_ROUND_WEEKS[r];
        const roundNumber = r + 1;

        if (!currentPairings.length) break;

        // If we have no scores anywhere OR this week is beyond the last scored week,
        // show as a future round (0–0, no winner).
        const isFutureBecauseNoScores = noScoresAnywhere;
        const isFutureBecauseBeyondLastScore =
          lastScoreWeek && Number(week) > Number(lastScoreWeek);

        if (isFutureBecauseNoScores || isFutureBecauseBeyondLastScore) {
          const results = currentPairings.map((pair, idx) => ({
            roundNumber,
            week,
            matchIndex: idx + 1,
            teamA: pair.teamA,
            teamB: pair.teamB,
            scoreA: 0,
            scoreB: 0,
            winner: null,
            loser: null,
            lineupA: null,
            lineupB: null,
          }));

          bracketRounds.push({ roundNumber, week, results, winners: [] });
          break;
        }

        // This week has scores available (at least for some teams),
        // but we still only declare winners if the week is finalized.
        const results = [];
        const winners = [];
        let anyMatchHasScore = false;

        for (let idx = 0; idx < currentPairings.length; idx++) {
          const pair = currentPairings[idx];

          const { winner, loser, scoreA, scoreB, lineupA, lineupB } =
            decideWinnerFinalizedOnly(pair, week);

          if (scoreA !== 0 || scoreB !== 0) anyMatchHasScore = true;

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
            lineupB,
          });

          if (winner) winners.push(winner);
        }

        // If there are literally no scores at all yet for this week, stop here.
        if (!anyMatchHasScore) break;

        bracketRounds.push({ roundNumber, week, results, winners });

        // Only crown a God champion if the week is finalized.
        const weekFinalized =
          finalizedWeek != null && Number(week) <= Number(finalizedWeek);

        if (weekFinalized && winners.length === 1) {
          championSummary = {
            godName,
            division: divisionName,
            winnerTeam: winners[0],
            winningRound: roundNumber,
            winningWeek: week,
          };
        }

        // If winners aren't decided (midweek), we cannot advance bracket yet.
        if (winners.length !== currentPairings.length) {
          break;
        }

        const nextPairings = [];
        for (let i = 0; i < winners.length; i += 2) {
          if (!winners[i + 1]) break;
          nextPairings.push({
            matchIndex: i / 2 + 1,
            teamA: winners[i],
            teamB: winners[i + 1],
          });
        }

        currentPairings = nextPairings;
        if (!currentPairings.length) break;
      }
    }

    if (championSummary && championSummary.winnerTeam) {
      champions.push(championSummary);
    }

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
      pairings: round1Pairings,
      bracketRounds,
      champion: championSummary,
    });
  }

  return { gods, champions };
}




/* ================== GRAND CHAMPIONSHIP (WEEK 17) ================== */

function buildGrandChampionship(champions) {
  if (!champions || !champions.length) {
    return {
      week: GRAND_CHAMP_WEEK,
      results: [],
      champion: null,
    };
  }

  const results = champions.map((c) => {
    const team = c.winnerTeam;
    const week = GRAND_CHAMP_WEEK;
    const score = team.leg3Weekly?.[week] || 0;
    const lineup = team.leg3BestBall?.[week] || null;
    return {
      division: c.division,
      godName: c.godName,
      godIndex: null, // can fill later if you want
      leagueId: team.leagueId,
      leagueName: team.leagueName,
      rosterId: team.rosterId,
      ownerId: team.ownerId,
      ownerName: team.ownerName,
      seed: team.finalSeed ?? team.initialSeed ?? null,
      leg3Total: team.leg3Total ?? 0,
      week17Score: score,
      lineup,
    };
  });

  // Sort by Week 17 score desc, then Leg 3 total desc
  results.sort((a, b) => {
    const s = (b.week17Score || 0) - (a.week17Score || 0);
    if (s !== 0) return s;
    return (b.leg3Total || 0) - (a.leg3Total || 0);
  });

    // Attach rank
  const standings = results.map((p, idx) => ({
    ...p,
    rank: idx + 1,
  }));

  // ✅ Only declare a champion once Week 17 has ANY real points
  const hasAnyWeek17Score = standings.some((p) => Number(p.week17Score || 0) !== 0);

  return {
    week: GRAND_CHAMP_WEEK,
    standings,
    participants: standings, // backwards-compatible name
    champion: hasAnyWeek17Score ? (standings[0] || null) : null,
  };
}

/* ================== HELPERS FOR SPLITTING OUTPUT ================== */

function slugifyDivisionName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/**
 * Uploads:
 *  - one JSON per division (Romans/Greeks/Egyptians, etc.)
 *  - one JSON for the Grand Championship
 *  - one small manifest JSON listing what’s where
 *
 * Layout in R2:
 *  gauntlet/leg3/gauntlet_leg3_2025.manifest.json
 *  gauntlet/leg3/2025/romans.json
 *  gauntlet/leg3/2025/greeks.json
 *  gauntlet/leg3/2025/egyptians.json
 *  gauntlet/leg3/2025/grand.json
 */
async function writeSplitOutputsToR2({
  year,
  updatedAt,
  currentBracketWeek,
  finalizedThroughWeek,
  divisionsPayload,
  grandChampionship,
  missingSeedLeagues,
}) {
  const manifest = {
    name: `Ballsville Gauntlet – Leg 3 (${year})`,
    year,
    updatedAt,
    currentBracketWeek,
    // divisionName -> { key, slug, godsCount, championsCount }
    finalizedThroughWeek,
    divisions: {},
    // where to find the grand championship JSON
    grand: {
      key: `gauntlet/leg3/${year}/grand.json`,
    },
    // small summary for admin warnings
    missingSeedLeaguesSummary: (missingSeedLeagues || []).map((l) => ({
      leagueId: l.leagueId,
      leagueName: l.leagueName,
      division: l.division,
      godName: l.godName,
      side: l.side,
      seededCount: l.seededCount,
      ownersCount: l.ownersCount,
    })),
  };

  // 1) Upload each division JSON
  const divisionEntries = Object.entries(divisionsPayload || {});
  for (const [divisionName, divisionData] of divisionEntries) {
    const slug = slugifyDivisionName(divisionName);
    const key = `gauntlet/leg3/${year}/${slug}.json`;

    const gods = Array.isArray(divisionData.gods) ? divisionData.gods : [];
    const champions = Array.isArray(divisionData.champions)
      ? divisionData.champions
      : [];

    // Per-division JSON is self-contained
    const divisionPayload = {
      year,
      updatedAt,
      currentBracketWeek,
      finalizedThroughWeek, 
      division: divisionName,
      gods,
      champions,
    };

    await uploadJsonToR2(key, divisionPayload);

    manifest.divisions[divisionName] = {
      key, // full key relative to bucket
      slug,
      godsCount: gods.length,
      championsCount: champions.length,
    };

    console.log(
      `✅ Uploaded Gauntlet Leg 3 division JSON: ${divisionName} → s3://${R2_BUCKET_GAUNTLET}/${key}`
    );
  }

  // 2) Upload Grand Championship JSON
  const grandKey = `gauntlet/leg3/${year}/grand.json`;
  const grandPayload = {
    year,
    updatedAt,
    currentBracketWeek,
    finalizedThroughWeek,
    ...grandChampionship,
  };

  await uploadJsonToR2(grandKey, grandPayload);
  manifest.grand.key = grandKey;

  console.log(
    `✅ Uploaded Gauntlet Leg 3 Grand Championship JSON → s3://${R2_BUCKET_GAUNTLET}/${grandKey}`
  );

  // 3) Upload manifest JSON (small + fast to load)
  const manifestKey = `gauntlet/leg3/gauntlet_leg3_${year}.manifest.json`;
  await uploadJsonToR2(manifestKey, manifest);

  console.log(
    `✅ Uploaded Gauntlet Leg 3 manifest JSON → s3://${R2_BUCKET_GAUNTLET}/${manifestKey}`
  );
}

/* ================== MAIN ================== */

async function main() {
  // Init debug log file (only if GAUNTLET_DEBUG_LOG=1)
  initDebugLogIfEnabled();

  cInfo("🏟️ Building Gauntlet Leg 3 payload…");
  if (DEBUG_LOG_ENABLED && RUN_LOG_FILE) {
    cInfo(`📝 Debug log file: ${RUN_LOG_FILE}`);
  }

  dbgSection("RUN START", `YEAR=${YEAR}`);



  // 1) Sleeper players DB
  const playersDB = await getSleeperPlayers();

  // 2) Seeds + league config from Supabase
  const {
    divisionGodConfig,
    leaguesConfig,
    missingSeedLeagues,
  } = await loadLeaguesAndSeeds(YEAR);

  if (missingSeedLeagues.length) {
    console.warn(
      `⚠️ There are ${missingSeedLeagues.length} leagues with missing seeds:`
    );
    missingSeedLeagues.forEach((l) => {
      console.warn(
        ` - [${l.division} – ${l.godName} – ${l.side}] ${l.leagueName} (${l.leagueId}): ` +
          `${l.seededCount}/${l.ownersCount} owners seeded`
      );
    });
  }

  // 3) Process each league (Guillotine + Leg 3 BB) with concurrency limit
  const leagueIds = Object.keys(leaguesConfig);
  cInfo(`\nProcessing ${leagueIds.length} Gauntlet leagues…`);
  dbgRow("leagues_count", String(leagueIds.length));

  const leagueResults = await Promise.all(
    leagueIds.map((leagueId) =>
      limit(() => {
        const cfg = leaguesConfig[leagueId];
        return processLeague(
          leagueId,
          cfg.division,
          cfg.godName,
          cfg.side,
          cfg,
          playersDB
        );
      })
    )
  );

  // For global currentBracketWeek detection and GC ranks
  const resultsByLeagueId = {};
  const allTeams = [];

  leagueResults.forEach((lr) => {
    resultsByLeagueId[lr.leagueId] = lr;
    lr.owners.forEach((o) => allTeams.push(o));
  });

    const { latestScoreWeek, currentBracketWeek } = detectBracketWeek(allTeams);
    const finalizedThroughWeek = computeFinalizedThroughWeek(latestScoreWeek);

    cInfo(
      `\n📅 Bracket weeks → latest score week: ${
        latestScoreWeek ?? "none"
      }, current bracket week: ${currentBracketWeek ?? "none"}, finalizedThroughWeek: ${
        finalizedThroughWeek ?? "none"
      }`
    );

    dbgRow("latestScoreWeek", String(latestScoreWeek ?? "none"));
    dbgRow("currentBracketWeek", String(currentBracketWeek ?? "none"));
    dbgRow("finalizedThroughWeek", String(finalizedThroughWeek ?? "none"));


  // 4) Build per-division God brackets + champions
  const divisionsPayload = {};
  let allGodChampions = [];

  Object.entries(divisionGodConfig).forEach(([division, godConfigs]) => {
    const leaguesForDivision = leagueResults.filter(
      (lr) => lr.division === division
    );

    const { gods, champions } = buildGodsForDivisionAndChampions(
      division,
      leaguesForDivision,
      godConfigs,
      currentBracketWeek,
      latestScoreWeek,
      finalizedThroughWeek // ✅ NEW
    );



    divisionsPayload[division] = {
      gods,
      champions,
    };

    allGodChampions = allGodChampions.concat(champions || []);
  });

  // 5) Grand Championship (Week 17) among all God champions
  const grandChampionship = buildGrandChampionship(allGodChampions);
  cInfo(`🏆 God champions count: ${allGodChampions.length}`);

  // 6) Timestamp + write split outputs (manifest + per-division + grand) to R2
  const updatedAt = new Date().toISOString();

  await writeSplitOutputsToR2({
    year: YEAR,
    updatedAt,
    currentBracketWeek,
    finalizedThroughWeek,
    divisionsPayload,
    grandChampionship,
    missingSeedLeagues,
  });
cInfo("🎉 Gauntlet Leg 3 build complete (split JSONs + manifest).");

if (DEBUG_LOG_ENABLED && RUN_LOG_FILE) {
  cInfo(`🧾 Debug warnings written: ${DEBUG_WARN_COUNT}`);
  cInfo(`📝 Debug log saved: ${RUN_LOG_FILE}`);
}

dbgSection("RUN COMPLETE");
dbgRow("debugWarnings", String(DEBUG_WARN_COUNT));


}

main().catch((err) => {
  console.error("❌ Fatal error in buildgauntlet.mjs:", err);
  process.exit(1);
});