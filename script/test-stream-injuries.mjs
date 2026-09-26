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
globalThis.fetch = async (url) => {
  const value = String(url);
  calls.push(value);
  if (value.endsWith("/v1/players/nfl")) return Response.json({
    "1": { full_name: "Test Player", team: "BUF", position: "WR", injury_status: "IR", injury_body_part: "Knee" },
  });
  if (value.endsWith("/v1/state/nfl")) return Response.json({ season: "2026", week: 3 });
  if (value.includes("/injuries?")) return Response.json({ injuries: [{ player_id: 99, name: "Test Player", team_id: "BUF", status: "Injured Reserve", injury_type: "Knee", comment: "Recovery update", injury_update_date: "2026-09-25", ir_weeks: [3, 4, 5, 6] }] });
  if (value.includes("/news?")) return Response.json({ items: [{ id: 7, player_id: 99, title: "Test Player recovery update", link: "/nfl/news/7/test-player.php", impact: "The player continues to recover.", created: "2026-09-25 12:00:00" }] });
  throw new Error(`Unexpected request: ${value}`);
};

try {
  let response = await onRequestPost({ request: new Request("http://localhost/api/stream/injuries", { method: "POST", headers: { cookie } }), env });
  if (response.status !== 200) throw new Error(`Refresh returned ${response.status}: ${await response.text()}`);
  const refreshed = await response.json();
  const player = refreshed.players?.[0];
  if (player?.status !== "IR" || player?.irWeeks?.length !== 4 || player?.news?.length !== 1) throw new Error("FantasyPros injury/news did not merge into the saved player record.");
  if (!records.has("data/stream/injuries.json")) throw new Error("The injury snapshot was not written to R2.");
  const refreshCallCount = calls.length;
  response = await onRequestGet({ request: new Request("http://localhost/api/stream/injuries", { headers: { cookie } }), env });
  if (response.status !== 200) throw new Error(`Saved read returned ${response.status}.`);
  await response.json();
  if (calls.length !== refreshCallCount) throw new Error("Reading the saved report unexpectedly called an external API.");
  console.log("Stream injury refresh merged FantasyPros data into R2; saved reads made no external requests.");
} finally {
  globalThis.fetch = originalFetch;
}
