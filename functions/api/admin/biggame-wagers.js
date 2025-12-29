// functions/api/admin/biggame-wagers.js
// Stores wager tracker state for The Big Game.
//
// GET  /api/admin/biggame-wagers?season=2025
// PUT  /api/admin/biggame-wagers?season=2025  (JSON body)
//
// Public read happens via R2 proxy:
//   /r2/data/biggame/wagers_<season>.json

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function ensureR2(env) {
  // IMPORTANT: this project uses ADMIN_BUCKET (all caps) for the Pages R2 binding.
  // We still allow env.admin_bucket for backwards-compat, but prefer ADMIN_BUCKET.
  const b = env.ADMIN_BUCKET || env.admin_bucket;
  if (!b?.get || !b?.put) throw new Error("Missing R2 binding: ADMIN_BUCKET");
  return b;
}

function getSeason(url) {
  const u = new URL(url);
  const season = u.searchParams.get("season") || "";
  return String(season || "").trim();
}

function r2KeyFor(season) {
  return `data/biggame/wagers_${season}.json`;
}

async function touchManifest(env, season) {
  const bucket = ensureR2(env);
  const key = `data/manifests/biggame-wagers_${season}.json`;
  await bucket.put(key, JSON.stringify({ updatedAt: new Date().toISOString() }, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
}

function validatePayload(season, body) {
  const o = body && typeof body === "object" ? body : null;
  if (!o) return { ok: false, msg: "Body must be JSON." };

  // Keep validation light on purpose (admin UI is the source of truth)
  const s = Number(o.season ?? season);
  if (!Number.isFinite(s)) return { ok: false, msg: "Invalid season." };

  return { ok: true, season: String(s) };
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const season = getSeason(request.url);
    if (!season) return json({ ok: false, error: "Missing season." }, 400);

    const bucket = ensureR2(env);
    const key = r2KeyFor(season);

    if (request.method === "GET") {
      const obj = await bucket.get(key);
      if (!obj) return json({ ok: true, data: null });
      const text = await obj.text();
      try {
        return json({ ok: true, data: JSON.parse(text) });
      } catch {
        // If file is malformed, still return raw so admin can overwrite.
        return json({ ok: true, data: { _raw: text } });
      }
    }

    if (request.method === "PUT") {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body." }, 400);
      }

      const v = validatePayload(season, body);
      if (!v.ok) return json({ ok: false, error: v.msg }, 400);

      const toWrite = {
        ...body,
        season: Number(v.season),
        updatedAt: new Date().toISOString(),
      };

      await bucket.put(key, JSON.stringify(toWrite, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
      });

      await touchManifest(env, season);
      return json({ ok: true, data: toWrite });
    }

    return json({ ok: false, error: "Method not allowed." }, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || "Server error" }, 500);
  }
}
