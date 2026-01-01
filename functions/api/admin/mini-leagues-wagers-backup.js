
// functions/api/admin/mini-leagues-wagers-backup.js
//
// GET  /api/admin/mini-leagues-wagers-backup?season=2025
// POST /api/admin/mini-leagues-wagers-backup?season=2025   (restore backup -> current)
//
// Mirrors the Big Game backup/restore endpoint pattern.

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
    throw new Error("R2 bucket binding not found. Expected env.ADMIN_BUCKET (or env.admin_bucket) to be an R2 binding.");
  }
  return b;
}


function nowIso() {
  return new Date().toISOString();
}

function keysForSeason(season) {
  const s = String(season).trim();
  return {
    current: `data/mini-leagues/wagers_${s}.json`,
    backup: `data/mini-leagues/wagers_${s}_wk14_backup.json`,
    backupMeta: `data/mini-leagues/wagers_${s}_wk14_backup_meta.json`,
    manifest: `data/manifests/mini-leagues-wagers_${s}.json`,
  };
}

async function readJsonFromR2(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  try {
    return JSON.parse(await obj.text());
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
    const keys = keysForSeason(season);

    if (request.method === "GET") {
      const data = await readJsonFromR2(bucket, keys.backup);
      const meta = await readJsonFromR2(bucket, keys.backupMeta);
      return json({ ok: true, data: data || null, meta: meta || null, key: keys.backup }, 200);
    }

    if (request.method === "POST") {
      const backup = await readJsonFromR2(bucket, keys.backup);
      if (!backup) return bad("No backup found to restore", 404);

      // Restore backup into current
      await bucket.put(keys.current, JSON.stringify(backup, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
      });

      // Touch manifest so the public page can cache-bust deterministically
      const manifest = { updatedAt: nowIso(), season: Number(season) || season };
      await bucket.put(keys.manifest, JSON.stringify(manifest, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
      });

      return json({ ok: true, restored: true, savedKey: keys.current, manifestKey: keys.manifest }, 200);
    }

    return bad(`Method not allowed: ${request.method}`, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
}