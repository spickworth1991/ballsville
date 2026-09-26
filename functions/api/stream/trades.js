import { readStreamSession, streamJson } from "../../_lib/streamAuth.js";

const KEY = "data/stream/trades.json";

export async function onRequestGet({ request, env }) {
  if (!await readStreamSession(request, env)) return streamJson({ error: "Unauthorized" }, 401);
  const bucket = env.ADMIN_BUCKET || env.admin_bucket;
  if (!bucket?.get) return streamJson({ error: "Existing R2 admin bucket binding is unavailable." }, 500);
  const object = await bucket.get(KEY);
  if (!object) return streamJson({ updatedAt: null, trades: [], filters: { modes: [], leagues: [] } });
  return new Response(object.body, {
    headers: { "content-type": object.httpMetadata?.contentType || "application/json", "cache-control": "no-store" },
  });
}

