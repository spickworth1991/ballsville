// functions/api/admin/gauntlet.js
//
// JSON storage for GAUNTLET legions + leagues (R2-backed, deterministic key)
//
// GET  /api/admin/gauntlet?season=2025  -> { season, rows }
// POST /api/admin/gauntlet            -> body { season, rows } (writes to R2)
//
// Schema (similar to biggame):
// - Header row per legion: is_legion_header=true
//   { year, legion_name, legion_slug, legion_status, legion_order, legion_image_key, legion_image_path, is_active }
// - League rows per legion: is_legion_header=false
//   { year, legion_slug, league_name, league_url, league_status, display_order, league_image_key, league_image_path, spots_available, fill_note, is_active }

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
  const b = env.admin_bucket || env.ADMIN_BUCKET;
  if (!b) throw new Error("Missing R2 binding: env.admin_bucket (or ADMIN_BUCKET)");
  return b;
}

function keyForSeason(season) {
  const s = String(season || "").trim() || "2025";
  return `data/gauntlet/leagues_${s}.json`;
}

async function readJSON(env, key) {
  const r2 = ensureR2(env);
  const obj = await r2.get(key);
  if (!obj) return null;
  const text = await obj.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeJSON(env, key, payload) {
  const r2 = ensureR2(env);
  const body = JSON.stringify(payload, null, 2);
  await r2.put(key, body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const season = url.searchParams.get("season") || url.searchParams.get("year") || "2025";
  const key = keyForSeason(season);

  try {
    if (request.method === "GET") {
      const existing = await readJSON(env, key);
      if (!existing) return json({ season: Number(season) || season, rows: [] });
      const rows = Array.isArray(existing?.rows) ? existing.rows : Array.isArray(existing) ? existing : [];
      return json({ season: Number(season) || season, rows });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const s = body?.season || season;
      const rows = Array.isArray(body?.rows) ? body.rows : [];

      const now = new Date().toISOString();
      const payload = {
        season: Number(s) || s,
        updated_at: now,
        rows,
      };
      await writeJSON(env, keyForSeason(s), payload);
      return json({ ok: true, season: Number(s) || s, key: keyForSeason(s), updated_at: now });
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}
