import { handleStreamRebuild, streamSchedule } from "../functions/api/stream/rebuild.js";

const dates = [
  ["2026-01-14T22:00:00Z", true, "daily"], ["2026-02-14T22:00:00Z", true, "daily"],
  ["2026-03-02T22:00:00Z", true, "weekly"], ["2026-03-03T22:00:00Z", false, "weekly"],
  ["2026-07-06T22:00:00Z", true, "weekly"], ["2026-07-07T22:00:00Z", false, "weekly"],
  ["2026-08-14T22:00:00Z", true, "daily"], ["2026-12-14T22:00:00Z", true, "daily"],
];
for (const [date, due, cadence] of dates) {
  const actual = streamSchedule(new Date(date));
  if (actual.due !== due || actual.cadence !== cadence) throw new Error(`Schedule mismatch for ${date}: ${JSON.stringify(actual)}`);
}

const records = new Map();
const bucket = { async get(key) { return records.has(key) ? { async text() { return records.get(key); } } : null; }, async put(key, value) { records.set(key, String(value)); } };
const env = { STREAM_CRON_SECRET: "scheduler-test-secret", ADMIN_BUCKET: bucket, GITHUB_REPO: "owner/repo", GH_WORKFLOW_TOKEN: "github-test", STREAM_WORKFLOW_FILE: "update-stream-data.yml", STREAM_WORKFLOW_REF: "main" };
const originalFetch = globalThis.fetch;
let dispatches = 0;
globalThis.fetch = async (_url, init) => { dispatches += 1; const body = JSON.parse(init.body); if (body.inputs.kind !== "scheduled") throw new Error("Wrong workflow kind"); return new Response(null, { status: 204 }); };
try {
  const dueNow = new Date("2026-09-26T20:00:00-04:00");
  let response = await handleStreamRebuild({ request: new Request("https://example.com/api/stream/rebuild"), env, now: dueNow });
  if (response.status !== 401) throw new Error("Scheduler accepted a missing secret.");
  const authorized = new Request("https://example.com/api/stream/rebuild", { headers: { authorization: "Bearer scheduler-test-secret" } });
  response = await handleStreamRebuild({ request: authorized, env, now: dueNow });
  const first = await response.json();
  if (!response.ok || !first.triggered || dispatches !== 1) throw new Error(`Scheduler did not dispatch: ${JSON.stringify(first)}`);
  response = await handleStreamRebuild({ request: authorized, env, now: dueNow });
  const duplicate = await response.json();
  if (!response.ok || duplicate.reason !== "already_dispatched" || dispatches !== 1) throw new Error("Scheduler duplicate lock failed.");
  const skipped = await handleStreamRebuild({ request: authorized, env, now: new Date("2026-03-03T20:00:00-05:00") }).then((result) => result.json());
  if (!skipped.skipped || skipped.reason !== "offseason_updates_run_mondays" || skipped.nextUpdate !== "2026-03-09") throw new Error(`Offseason skip response failed: ${JSON.stringify(skipped)}`);
  console.log("Stream scheduler cadence, authorization, skip response, dispatch, and duplicate lock passed.");
} finally { globalThis.fetch = originalFetch; }
