import fs from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mergeTradeSnapshots, summarizeTradeAssets, tradeValueFormatForRosterPositions, tradeValueModelForMode, transactionWeeks } from "../lib/stream/trade-data.js";

const startedAt = Date.now();
const now = new Date();
const season = String(process.env.STREAM_SEASON || (now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()));
const bucket = process.env.ADMIN_BUCKET || "admin";
const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const leaderboardKey = `data/leaderboards/leaderboards_${season}.json`;
const outputKey = "data/stream/trades.json";
const fullRebuild = String(process.env.STREAM_FULL_REBUILD || "false").toLowerCase() === "true";

async function getJson(key) {
  const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(await object.Body.transformToString());
}

async function getOptionalJson(key) {
  try { return await getJson(key); }
  catch (error) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function sleeper(pathname) {
  const response = await fetch(`https://api.sleeper.app/v1${pathname}`, { headers: { "user-agent": "BallsvilleStreamBuilder/1.0" } });
  if (!response.ok) throw new Error(`Sleeper ${pathname} failed (${response.status})`);
  return response.json();
}

const [leaderboard, previousSnapshot] = await Promise.all([getJson(leaderboardKey), getOptionalJson(outputKey)]);
const playerDb = await sleeper("/players/nfl");
const valueWarnings = [];
let arsenalValues = null;
let arsenalProjections = null;
let arsenalValuesError = null;
let arsenalProjectionsError = null;
try {
  const response = await fetch("https://thefantasyarsenal.com/stickypicky_cache.json");
  if (!response.ok) throw new Error(`returned ${response.status}`);
  arsenalValues = await response.json();
} catch (error) { arsenalValuesError = error?.message || "unavailable"; valueWarnings.push(`The Fantasy Arsenal values: ${arsenalValuesError}`); }
try {
  const response = await fetch(`https://thefantasyarsenal.com/projections_thefantasyarsenal_model_${season}.json`);
  if (!response.ok) throw new Error(`returned ${response.status}`);
  arsenalProjections = await response.json();
} catch (error) { arsenalProjectionsError = error?.message || "unavailable"; valueWarnings.push(`The Fantasy Arsenal Safe / Expected projections: ${arsenalProjectionsError}`); }
const normalizeName = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const pickRound = (value) => String(value || "").match(/(?:pick|round|early|mid|late)\s*([1-4])(?:st|nd|rd|th)?(?:\.|\b)/i)?.[1] || String(value || "").match(/20\d{2}\s+([1-4])(?:st|nd|rd|th)?\b/i)?.[1];
function makeValueIndex(rows) {
  const players = new Map();
  const picks = new Map();
  for (const row of rows || []) {
    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;
    if (String(row.position).toUpperCase() === "PICK") {
      const name = String(row.name || "");
      const year = name.match(/20\d{2}/)?.[0];
      const round = pickRound(name);
      if (year && round) {
        const key = `${year}-${round}`;
        const values = picks.get(key) || [];
        values.push(value); picks.set(key, values);
      }
    } else players.set(normalizeName(row.name), value);
  }
  return { players, picks: new Map([...picks].map(([key, values]) => [key, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)])) };
}
const valueIndexes = {
  dynasty: { superflex: makeValueIndex(arsenalValues?.Dynasty_SF), "1qb": makeValueIndex(arsenalValues?.Dynasty_1QB) },
  redraft: { superflex: makeValueIndex(arsenalValues?.Redraft_SF), "1qb": makeValueIndex(arsenalValues?.Redraft_1QB) },
};
const projectionIndex = new Map((arsenalProjections?.rows || []).map((row) => {
  const week = (row.weeks || []).find((entry) => Number(entry.week) === Number(arsenalProjections?.forecast_week)) || (row.weeks || []).find((entry) => !entry.completed && !entry.bye);
  const projection = Number(week?.projection_lenses?.ppr?.safe_expected ?? week?.points_ppr);
  return [String(row.player_id), Number.isFinite(projection) ? projection : null];
}));
const yearBlock = leaderboard?.[season] || leaderboard;
const leagues = new Map();

for (const [mode, block] of Object.entries(yearBlock || {})) {
  if (mode.startsWith("__") || !Array.isArray(block?.owners)) continue;
  for (const owner of block.owners) {
    if (!owner.leagueId) continue;
    const leagueId = String(owner.leagueId);
    if (!leagues.has(leagueId)) leagues.set(leagueId, { leagueId, leagueName: owner.leagueName, division: owner.division, mode, modeName: block.name || mode, valueFormat: owner.valueFormat || "", owners: new Map(), latestWeek: 1 });
    const league = leagues.get(leagueId);
    if (!league.valueFormat && owner.valueFormat) league.valueFormat = owner.valueFormat;
    league.owners.set(String(owner.rosterId), owner);
    for (const [week, points] of Object.entries(owner.weekly || {})) if (Number(points || 0) !== 0) league.latestWeek = Math.max(league.latestWeek, Number(week));
  }
}
const limit = pLimit(12);
if (!leagues.size) throw new Error(`No leagueId data found in ${leaderboardKey}. Rebuild leaderboards with the current generator first.`);
await Promise.all([...leagues.values()].filter((league) => !league.valueFormat).map((league) => limit(async () => {
  const info = await sleeper(`/league/${league.leagueId}`);
  league.valueFormat = tradeValueFormatForRosterPositions(info?.roster_positions);
})));

const jobs = [];
for (const league of leagues.values()) {
  const throughWeek = Math.min(18, Math.max(1, league.latestWeek + 1));
  for (const week of transactionWeeks(throughWeek, { fullRebuild, hasPrevious: Boolean(previousSnapshot?.trades?.length) })) jobs.push(limit(async () => ({ league, week, rows: await sleeper(`/league/${league.leagueId}/transactions/${week}`) })));
}
const batches = await Promise.all(jobs);
const seen = new Set();
const trades = [];

const valueModelForMode = tradeValueModelForMode;
const indexForMode = (mode, valueFormat) => valueIndexes[valueModelForMode(mode)]?.[valueFormat === "superflex" ? "superflex" : "1qb"];
const playerAsset = (id, mode, valueFormat, previous = {}) => {
  const player = playerDb[id] || {};
  const name = player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ") || previous.name || id;
  const playerMeta = player.full_name || player.first_name || player.last_name ? [player.team || "FA", player.position || player.fantasy_positions?.[0]].filter(Boolean).join(" · ") : "";
  const meta = playerMeta || previous.meta || "Player";
  return { ...previous, type: "player", id: String(id), name, meta, value: arsenalValues ? indexForMode(mode, valueFormat).players.get(normalizeName(name)) ?? null : previous.value ?? null, projection: arsenalProjections ? projectionIndex.get(String(id)) ?? null : previous.projection ?? null };
};

function enrichAsset(asset, mode, valueFormat) {
  if (asset?.type === "player") return playerAsset(asset.id, mode, valueFormat, asset);
  if (asset?.type === "pick") {
    const label = String(asset.name || asset.id || "");
    const year = label.match(/20\d{2}/)?.[0];
    const round = pickRound(label);
    return { ...asset, value: arsenalValues ? year && round ? indexForMode(mode, valueFormat).picks.get(`${year}-${round}`) ?? null : null : asset.value ?? null, projection: null };
  }
  return { ...asset, value: arsenalValues ? null : asset.value ?? null, projection: null };
}

function enrichTrade(trade) {
  const valueFormat = leagues.get(String(trade.leagueId))?.valueFormat || trade.valueFormat || "1qb";
  const sides = (trade.sides || []).map((side) => {
    const assets = (side.assets || []).map((asset) => enrichAsset(asset, trade.mode, valueFormat));
    return { ...side, assets, ...summarizeTradeAssets(assets) };
  });
  const totalsAvailable = sides.length === 2 && sides.every((side) => side.totalValue != null);
  return {
    ...trade,
    valueModel: valueModelForMode(trade.mode),
    valueFormat,
    valueSource: "The Fantasy Arsenal",
    projectionSource: "The Fantasy Arsenal Safe / Expected",
    projectionWeek: arsenalProjections?.forecast_week || null,
    sides,
    valueGap: totalsAvailable ? Math.abs(sides[0].totalValue - sides[1].totalValue) : null,
    valueGapComplete: totalsAvailable && sides.every((side) => side.totalValueComplete),
  };
}

for (const { league, week, rows } of batches) {
  for (const transaction of rows || []) {
    if (transaction.type !== "trade" || transaction.status !== "complete" || seen.has(transaction.transaction_id)) continue;
    seen.add(transaction.transaction_id);
    const rosterIds = [...new Set((transaction.roster_ids || []).map(String))];
    const sides = rosterIds.map((rosterId) => {
      const owner = league.owners.get(rosterId) || {};
      const assets = [];
      for (const [playerId, receiver] of Object.entries(transaction.adds || {})) if (String(receiver) === rosterId) assets.push(playerAsset(playerId, league.mode, league.valueFormat));
      for (const pick of transaction.draft_picks || []) {
        if (String(pick.owner_id) !== rosterId) continue;
        assets.push({ type: "pick", id: `${pick.season}-${pick.round}-${pick.roster_id}`, name: `${pick.season} Round ${pick.round} pick`, meta: `Originally roster ${pick.roster_id}`, value: indexForMode(league.mode, league.valueFormat).picks.get(`${pick.season}-${pick.round}`) ?? null, projection: null });
      }
      for (const budget of transaction.waiver_budget || []) {
        if (String(budget.receiver) !== rosterId) continue;
        assets.push({ type: "faab", id: `${transaction.transaction_id}-${rosterId}-faab`, name: `$${budget.amount} FAAB`, meta: "Waiver budget", value: null, projection: null });
      }
      return { rosterId, ownerId: owner.ownerId || "", manager: owner.ownerName || `Roster ${rosterId}`, avatar: owner.avatar || "", assets, ...summarizeTradeAssets(assets) };
    }).filter((side) => side.assets.length || rosterIds.length <= 2);
    const timestamp = Number(transaction.status_updated || transaction.created || 0);
    const valuedSides = sides.filter((side) => side.totalValue != null);
    trades.push({
      id: String(transaction.transaction_id), timestamp, date: timestamp ? new Date(timestamp).toISOString() : null,
      season, week, leagueId: league.leagueId, leagueName: league.leagueName, division: league.division,
      mode: league.mode, modeName: league.modeName, valueModel: valueModelForMode(league.mode), valueFormat: league.valueFormat, sides,
      assetCount: sides.reduce((sum, side) => sum + side.assets.length, 0), valueGap: valuedSides.length === sides.length && sides.length === 2 ? Math.abs(sides[0].totalValue - sides[1].totalValue) : null,
    });
  }
}

const merged = mergeTradeSnapshots(previousSnapshot?.trades, trades, { fullRebuild, preserveExisting: Boolean(valueWarnings.length), season });
const mergedTrades = arsenalValues || arsenalProjections ? merged.map(enrichTrade) : merged;
const payload = {
  schemaVersion: 3, updatedAt: new Date().toISOString(), updatedBy: process.env.STREAM_REQUESTED_BY || "manual", season,
  source: valueWarnings.length ? "Sleeper + saved/partial The Fantasy Arsenal metrics" : "Sleeper + The Fantasy Arsenal values and Safe / Expected projections",
  sourceStatus: { sleeper: { fresh: true }, playerValues: { fresh: Boolean(arsenalValues), warning: arsenalValuesError }, projections: { fresh: Boolean(arsenalProjections), week: arsenalProjections?.forecast_week || null, warning: arsenalProjectionsError } },
  warnings: valueWarnings, updateMode: fullRebuild || !previousSnapshot?.trades?.length ? "full" : "incremental",
  valuePolicy: "Dynasty modes use The Fantasy Arsenal Dynasty values and seasonal modes use Redraft values. Each league uses its actual 1QB or Superflex/2QB board. Player projections use The Fantasy Arsenal Safe / Expected PPR model.",
  filters: { modes: [...new Set(mergedTrades.map((trade) => trade.mode))].sort(), leagues: [...new Set(mergedTrades.map((trade) => trade.leagueName))].sort() },
  trades: mergedTrades,
};
const body = JSON.stringify(payload);
await fs.mkdir("auto", { recursive: true });
await fs.writeFile(path.join("auto", `stream_trades_${season}.json`), body);
await r2.send(new PutObjectCommand({ Bucket: bucket, Key: outputKey, Body: body, ContentType: "application/json", CacheControl: "no-store" }));
console.log(JSON.stringify({ tool: "trades", ok: true, updateMode: payload.updateMode, fetchedTrades: trades.length, publishedTrades: mergedTrades.length, leagues: leagues.size, sleeperTransactionRequests: jobs.length, warnings: valueWarnings, r2: { reads: 2, writes: 1, bytes: Buffer.byteLength(body) }, durationMs: Date.now() - startedAt }));
