import fs from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

async function getJson(key) {
  const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(await object.Body.transformToString());
}

async function sleeper(pathname) {
  const response = await fetch(`https://api.sleeper.app/v1${pathname}`, { headers: { "user-agent": "BallsvilleStreamBuilder/1.0" } });
  if (!response.ok) throw new Error(`Sleeper ${pathname} failed (${response.status})`);
  return response.json();
}

const leaderboard = await getJson(leaderboardKey);
const playerDb = await sleeper("/players/nfl");
const valueEndpoint = (rankType) => `https://fantasy-navigator-latest.onrender.com/trade_calculator?platform=sf&rank_type=${rankType}`;
const [dynastyRankings, redraftRankings] = await Promise.all(
  ["dynasty", "redraft"].map(async (rankType) => {
    try {
      const response = await fetch(valueEndpoint(rankType));
      return response.ok ? response.json() : [];
    } catch { return []; }
  }),
);
const normalizeName = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function makeValueIndex(rows) {
  const players = new Map();
  const picks = new Map();
  for (const row of rows || []) {
    const value = Number(row.sf_value ?? row.value);
    if (!Number.isFinite(value)) continue;
    if (String(row._position).toUpperCase() === "PICK") {
      const name = String(row.player_full_name || "");
      const year = name.match(/20\d{2}/)?.[0];
      const round = name.match(/(?:^|\s)([1-4])(?:st|nd|rd|th)?(?:\s|$)/i)?.[1];
      if (year && round) {
        const key = `${year}-${round}`;
        const values = picks.get(key) || [];
        values.push(value); picks.set(key, values);
      }
    } else players.set(normalizeName(row.player_full_name), value);
  }
  return { players, picks: new Map([...picks].map(([key, values]) => [key, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)])) };
}
const valueIndexes = { dynasty: makeValueIndex(dynastyRankings), redraft: makeValueIndex(redraftRankings) };
const yearBlock = leaderboard?.[season] || leaderboard;
const leagues = new Map();

for (const [mode, block] of Object.entries(yearBlock || {})) {
  if (mode.startsWith("__") || !Array.isArray(block?.owners)) continue;
  for (const owner of block.owners) {
    if (!owner.leagueId) continue;
    const leagueId = String(owner.leagueId);
    if (!leagues.has(leagueId)) leagues.set(leagueId, { leagueId, leagueName: owner.leagueName, division: owner.division, mode, modeName: block.name || mode, owners: new Map(), latestWeek: 1 });
    const league = leagues.get(leagueId);
    league.owners.set(String(owner.rosterId), owner);
    for (const [week, points] of Object.entries(owner.weekly || {})) if (Number(points || 0) !== 0) league.latestWeek = Math.max(league.latestWeek, Number(week));
  }
}
if (!leagues.size) throw new Error(`No leagueId data found in ${leaderboardKey}. Rebuild leaderboards with the current generator first.`);

const limit = pLimit(12);
const jobs = [];
for (const league of leagues.values()) {
  const throughWeek = Math.min(18, Math.max(1, league.latestWeek + 1));
  for (let week = 1; week <= throughWeek; week += 1) jobs.push(limit(async () => ({ league, week, rows: await sleeper(`/league/${league.leagueId}/transactions/${week}`) })));
}
const batches = await Promise.all(jobs);
const seen = new Set();
const trades = [];

const indexForMode = (mode) => mode === "dynasty" ? valueIndexes.dynasty : valueIndexes.redraft;
const playerAsset = (id, mode) => {
  const player = playerDb[id] || {};
  const name = player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ") || id;
  return { type: "player", id: String(id), name, meta: [player.team || "FA", player.position || player.fantasy_positions?.[0]].filter(Boolean).join(" · "), value: indexForMode(mode).players.get(normalizeName(name)) ?? null, projection: null };
};

for (const { league, week, rows } of batches) {
  for (const transaction of rows || []) {
    if (transaction.type !== "trade" || transaction.status !== "complete" || seen.has(transaction.transaction_id)) continue;
    seen.add(transaction.transaction_id);
    const rosterIds = [...new Set((transaction.roster_ids || []).map(String))];
    const sides = rosterIds.map((rosterId) => {
      const owner = league.owners.get(rosterId) || {};
      const assets = [];
      for (const [playerId, receiver] of Object.entries(transaction.adds || {})) if (String(receiver) === rosterId) assets.push(playerAsset(playerId, league.mode));
      for (const pick of transaction.draft_picks || []) {
        if (String(pick.owner_id) !== rosterId) continue;
        assets.push({ type: "pick", id: `${pick.season}-${pick.round}-${pick.roster_id}`, name: `${pick.season} Round ${pick.round} pick`, meta: `Originally roster ${pick.roster_id}`, value: indexForMode(league.mode).picks.get(`${pick.season}-${pick.round}`) ?? null, projection: null });
      }
      for (const budget of transaction.waiver_budget || []) {
        if (String(budget.receiver) !== rosterId) continue;
        assets.push({ type: "faab", id: `${transaction.transaction_id}-${rosterId}-faab`, name: `$${budget.amount} FAAB`, meta: "Waiver budget", value: null, projection: null });
      }
      const completeValues = assets.length > 0 && assets.every((asset) => asset.value != null);
      return { rosterId, ownerId: owner.ownerId || "", manager: owner.ownerName || `Roster ${rosterId}`, avatar: owner.avatar || "", assets, totalValue: completeValues ? assets.reduce((sum, asset) => sum + Number(asset.value), 0) : null };
    }).filter((side) => side.assets.length || rosterIds.length <= 2);
    const timestamp = Number(transaction.status_updated || transaction.created || 0);
    const valuedSides = sides.filter((side) => side.totalValue != null);
    trades.push({
      id: String(transaction.transaction_id), timestamp, date: timestamp ? new Date(timestamp).toISOString() : null,
      season, week, leagueId: league.leagueId, leagueName: league.leagueName, division: league.division,
      mode: league.mode, modeName: league.modeName, sides,
      assetCount: sides.reduce((sum, side) => sum + side.assets.length, 0), valueGap: valuedSides.length === sides.length && sides.length === 2 ? Math.abs(sides[0].totalValue - sides[1].totalValue) : null,
    });
  }
}

trades.sort((a, b) => b.timestamp - a.timestamp);
const payload = {
  updatedAt: new Date().toISOString(), season, source: "Sleeper",
  filters: { modes: [...new Set(trades.map((trade) => trade.mode))].sort(), leagues: [...new Set(trades.map((trade) => trade.leagueName))].sort() },
  trades,
};
const body = JSON.stringify(payload);
await fs.mkdir("auto", { recursive: true });
await fs.writeFile(path.join("auto", `stream_trades_${season}.json`), body);
await r2.send(new PutObjectCommand({ Bucket: bucket, Key: outputKey, Body: body, ContentType: "application/json", CacheControl: "no-store" }));
console.log(`Published ${trades.length} trades from ${leagues.size} leagues to s3://${bucket}/${outputKey}`);
