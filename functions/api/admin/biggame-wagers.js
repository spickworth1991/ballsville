// functions/api/admin/biggame-wagers.js
//
// GET     /api/admin/biggame-wagers?season=2025
// PUT     /api/admin/biggame-wagers?season=2025   (body = full wagers doc)
// DELETE  /api/admin/biggame-wagers?season=2025   (deletes the current doc in R2)
//
// Behavior:
// - Current doc stored at: data/biggame/wagers_<season>.json
// - No backups/snapshots. DELETE truly removes the JSON so you can start over.

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function bad(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

function ensureR2(env) {
  const b = env.ADMIN_BUCKET || env;
  if (!b || typeof b.get !== "function" || typeof b.put !== "function" || typeof b.delete !== "function") {
    throw new Error(
      "R2 bucket binding not found. Expected env.ADMIN_BUCKET (or env) to be an R2 binding with get/put/delete."
    );
  }
  return b;
}

function keyForSeason(season) {
  const s = String(season).trim();
  return `data/biggame/wagers_${s}.json`;
}

async function readJsonFromR2(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  try {
    const text = await obj.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const season = url.searchParams.get("season");
    if (!season) return bad("Missing ?season=", 400);

    const bucket = ensureR2(env);
    const key = keyForSeason(season);

    if (request.method === "GET") {
      const data = await readJsonFromR2(bucket, key);
      if (!data) return json({ ok: true, data: null, key }, 200);
      return json({ ok: true, data, key }, 200);
    }

    if (request.method === "PUT") {
      let body;
      try {
        body = await request.json();
      } catch {
        return bad("Invalid JSON body", 400);
      }
      if (!body || typeof body !== "object") return bad("Body must be a JSON object", 400);

      await bucket.put(key, JSON.stringify(body, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
      });

      return json({ ok: true, data: body, savedKey: key }, 200);
    }

    if (request.method === "DELETE") {
      // R2 delete is idempotent — deleting a missing key is fine.
      await bucket.delete(key);
      return json({ ok: true, deletedKey: key }, 200);
    }

    return bad(`Method not allowed: ${request.method}`, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
}
