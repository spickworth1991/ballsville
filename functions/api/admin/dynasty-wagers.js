// functions/api/admin/dynasty-wagers.js
//
// Dynasty Wager Tracker (automated-style, like Big Game / Mini Leagues)
//
// GET  /api/admin/dynasty-wagers?season=2025
// PUT  /api/admin/dynasty-wagers?season=2025   (body = full wagers doc)
//
// Storage keys:
// - Current doc:  data/dynasty/wagers_<season>.json
// - Manifest:     data/manifests/dynasty-wagers_<season>.json

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
  const b = env.ADMIN_BUCKET || env.admin_bucket || env;
  if (!b || typeof b.get !== "function" || typeof b.put !== "function") {
    throw new Error(
      "R2 bucket binding not found. Expected env.ADMIN_BUCKET (or env.admin_bucket) to be an R2 binding."
    );
  }
  return b;
}

function nowIso() {
  return new Date().toISOString();
}

function keyForSeason(season) {
  const s = String(season).trim();
  return {
    current: `data/dynasty/wagers_${s}.json`,
    manifest: `data/manifests/dynasty-wagers_${s}.json`,
  };
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

async function touchManifest(bucket, manifestKey, season) {
  const payload = {
    season: Number(season) || season,
    updatedAt: nowIso(),
  };
  await bucket.put(manifestKey, JSON.stringify(payload, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const season = url.searchParams.get("season");
    if (!season) return bad("Missing ?season=", 400);

    const bucket = ensureR2(env);
    const keys = keyForSeason(season);

    if (request.method === "GET") {
      const data = await readJsonFromR2(bucket, keys.current);
      if (!data) return json({ ok: true, data: null, key: keys.current }, 200);
      return json({ ok: true, data, key: keys.current }, 200);
    }

    if (request.method === "PUT") {
      let body;
      try {
        body = await request.json();
      } catch {
        return bad("Invalid JSON body", 400);
      }
      if (!body || typeof body !== "object") return bad("Body must be a JSON object", 400);

      await bucket.put(keys.current, JSON.stringify(body, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
      });

      await touchManifest(bucket, keys.manifest, season);

      return json({ ok: true, data: body, savedKey: keys.current }, 200);
    }

    return bad(`Method not allowed: ${request.method}`, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
}
