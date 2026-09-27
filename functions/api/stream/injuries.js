import { readStreamSession, streamJson } from "../../_lib/streamAuth.js";
import { buildInjuryData } from "../../../lib/stream/injury-data.js";

const SNAPSHOT_KEY = "data/stream/injuries.json";
const historyKey = (season) => `data/stream/injury-history/${season}.json`;
const bucketFor = (env) => env.ADMIN_BUCKET || env.admin_bucket;

async function readJson(bucket, key) {
  try {
    const object = await bucket.get(key);
    return object ? await object.json() : null;
  } catch { return null; }
}

export async function onRequestGet({ request, env }) {
  if (!await readStreamSession(request, env)) return streamJson({ error: "Unauthorized" }, 401);
  const bucket = bucketFor(env);
  if (!bucket?.get) return streamJson({ error: "Existing R2 admin bucket binding is unavailable." }, 500);
  const object = await bucket.get(SNAPSHOT_KEY);
  if (!object) return streamJson({ updatedAt: null, players: [], recentlyRemoved: [] });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "application/json", "cache-control": "no-store" } });
}

// Compatibility/local-test path. Production UI refreshes queue the GitHub builder.
export async function onRequestPost({ request, env }) {
  const user = await readStreamSession(request, env);
  if (!user) return streamJson({ error: "Unauthorized" }, 401);
  const bucket = bucketFor(env);
  if (!bucket?.get || !bucket?.put) return streamJson({ error: "Existing R2 admin bucket binding is unavailable." }, 500);
  const previous = await readJson(bucket, SNAPSHOT_KEY);
  try {
    const seasonGuess = Number(previous?.season) || new Date().getUTCFullYear();
    const priorHistory = await readJson(bucket, historyKey(seasonGuess));
    const { payload, journal } = await buildInjuryData({ previous, historyDocument: priorHistory, fantasyProsKey: env.FANTASYPROS_API_KEY, updatedBy: user.name });
    await bucket.put(historyKey(payload.season), JSON.stringify(journal), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    await bucket.put(SNAPSHOT_KEY, JSON.stringify(payload), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
    return streamJson({ ok: true, ...payload });
  } catch (error) {
    return streamJson({ error: `Injury refresh failed without replacing the saved report: ${error?.message || "Unknown error"}` }, 502);
  }
}
