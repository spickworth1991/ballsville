import { createStreamSession, streamSessionCookie } from "../functions/_lib/streamAuth.js";
import { onRequestGet, onRequestPost } from "../functions/api/stream/injuries.js";

const records = new Map();
const bucket = {
  async get(key) {
    const value = records.get(key);
    if (value === undefined) return null;
    return { body: value, httpMetadata: { contentType: "application/json" }, async json() { return JSON.parse(value); }, async text() { return value; } };
  },
  async put(key, value) { records.set(key, String(value)); },
};
const env = {
  ADMIN_BUCKET: bucket,
  STREAM_AUTH_SECRET: "local-stream-injury-test-secret-that-is-not-production",
  FANTASYPROS_API_KEY: "test-key",
};
const session = await createStreamSession(env, { username: "stream_test", name: "stream_test" });
const cookie = streamSessionCookie(session, undefined, false).split(";")[0];
const originalFetch = globalThis.fetch;
const calls = [];
let includePlayer = true;
let fantasyProsAvailable = true;
let valuesAvailable = true;
let fantasyProsStatus = "Injured Reserve";
let fantasyProsProbability = 0.4;
globalThis.fetch = async (url) => {
  const value = String(url);
  calls.push(value);
  if (value.endsWith("/v1/players/nfl")) return Response.json(includePlayer ? {
    "1": { full_name: "Test Player", team: "BUF", position: "WR", injury_status: "IR", injury_body_part: "Knee", injury_start_date: "2026-09-22" },
  } : {});
  if (value.endsWith("/v1/state/nfl")) return Response.json({ season: "2026", week: 3 });
  if (value.includes("/injuries?")) return fantasyProsAvailable ? Response.json({ injuries: [{ player_id: 99, name: "Test Player", team_id: "BUF", status: fantasyProsStatus, probability_of_playing: fantasyProsProbability, injury_type: "Undisclosed", comment: "Recovery update", injury_update_date: "2026-09-25", ir_weeks: [3, 4, 5, 6] }] }) : new Response("unavailable", { status: 503 });
  if (value.includes("/news?")) return fantasyProsAvailable ? Response.json({ items: [{ id: 7, player_id: 99, title: "Test Player recovery update", link: "/nfl/news/7/test-player.php", impact: "The player continues to recover.", created: "2026-09-25 12:00:00" }] }) : new Response("unavailable", { status: 503 });
  if (value.includes("/trade_calculator?") && value.includes("rank_type=dynasty")) return valuesAvailable ? Response.json([{ player_full_name: "Test Player", _position: "WR", sf_value: 9000 }]) : new Response("unavailable", { status: 503 });
  if (value.includes("/trade_calculator?") && value.includes("rank_type=redraft")) return valuesAvailable ? Response.json([{ player_full_name: "Test Player", _position: "WR", sf_value: 5000 }]) : new Response("unavailable", { status: 503 });
  throw new Error(`Unexpected request: ${value}`);
};

try {
  let response = await onRequestPost({ request: new Request("http://localhost/api/stream/injuries", { method: "POST", headers: { cookie } }), env });
  if (response.status !== 200) throw new Error(`Refresh returned ${response.status}: ${await response.text()}`);
  const refreshed = await response.json();
  const player = refreshed.players?.[0];
  if (player?.status !== "IR" || player?.bodyPart !== "Knee" || player?.bodyPartSource !== "Sleeper" || player?.injuryStartDate !== "2026-09-22" || player?.news?.length !== 1 || player?.dynastyValue !== 9000 || player?.redraftValue !== 5000) throw new Error("FantasyPros, Sleeper, and player value data did not merge into the saved player record.");
  if (player?.reportState !== "added" || !player?.trackedSince || player?.trackedRefreshes !== 1) throw new Error("First-seen injury tracking was not initialized.");
  if (Object.hasOwn(player, "irWeeks")) throw new Error("Irrelevant IR week data is still stored in the player record.");
  if (!records.has("data/stream/injuries.json")) throw new Error("The injury snapshot was not written to R2.");
  if (!records.has("data/stream/injury-history/2026.json")) throw new Error("The yearly injury journal was not written to R2.");

  response = await onRequestPost({ request: new Request("http://localhost/api/stream/injuries", { method: "POST", headers: { cookie } }), env });
  const continued = await response.json();
  if (continued.players?.[0]?.reportState !== "existing" || continued.players?.[0]?.trackedSince !== player.trackedSince || continued.players?.[0]?.trackedRefreshes !== 2) throw new Error("Continuing injury tracking was not preserved across refreshes.");

  fantasyProsStatus = "Questionable";
  fantasyProsProbability = 0.7;
  response = await onRequestPost({ request: new Request("http://localhost/api/stream/injuries", { method: "POST", headers: { cookie } }), env });
  const changed = await response.json();
  if (changed.players?.[0]?.trend !== "improving" || !changed.players?.[0]?.changes?.some((change) => change.field === "status") || !changed.players?.[0]?.changes?.some((change) => change.field === "probability")) throw new Error("Material status and probability changes were not recorded.");

  includePlayer = false;
  response = await onRequestPost({ request: new Request("http://localhost/api/stream/injuries", { method: "POST", headers: { cookie } }), env });
  const removed = await response.json();
  if (removed.players?.length !== 0 || removed.recentlyRemoved?.[0]?.id !== "1" || removed.recentlyRemoved?.[0]?.reportState !== "removed" || !removed.recentlyRemoved?.[0]?.removedAt) throw new Error("Removed injury tracking was not saved.");
  if (removed.injuryHistorySummary?.completedEpisodes !== 1 || removed.injuryHistorySummary?.averageObservedDays !== 0 || removed.injuryHistorySummary?.earlySample !== true) throw new Error("Long-term completed injury history was not summarized.");
  const journal = JSON.parse(records.get("data/stream/injury-history/2026.json"));
  if (journal.episodes?.[0]?.playerId !== "1" || !journal.events?.some((event) => event.type === "removed")) throw new Error("Yearly injury events and episodes were not saved.");

  includePlayer = true;
  response = await onRequestPost({ request: new Request("http://localhost/api/stream/injuries", { method: "POST", headers: { cookie } }), env });
  const reappeared = await response.json();
  if (reappeared.players?.[0]?.reportState !== "reappeared" || reappeared.players?.[0]?.trackedSince !== player.trackedSince) throw new Error("A player returning within 48 hours did not continue the same episode.");
  fantasyProsAvailable = false;
  valuesAvailable = false;
  response = await onRequestPost({ request: new Request("http://localhost/api/stream/injuries", { method: "POST", headers: { cookie } }), env });
  const stale = await response.json();
  if (!stale.fantasyProsError || !stale.playerValueError || stale.players?.[0]?.probabilityOfPlaying !== 70 || stale.players?.[0]?.dynastyValue !== 9000 || stale.players?.[0]?.redraftValue !== 5000) throw new Error("Optional-source failures did not retain the last successful enrichment.");
  const refreshCallCount = calls.length;
  response = await onRequestGet({ request: new Request("http://localhost/api/stream/injuries", { headers: { cookie } }), env });
  if (response.status !== 200) throw new Error(`Saved read returned ${response.status}.`);
  await response.json();
  if (calls.length !== refreshCallCount) throw new Error("Reading the saved report unexpectedly called an external API.");
  console.log("Stream injury refresh, yearly history, reappearance continuity, and API-free saved reads passed.");
} finally {
  globalThis.fetch = originalFetch;
}
