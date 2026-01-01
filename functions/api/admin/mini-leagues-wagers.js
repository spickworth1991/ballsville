// functions/api/admin/mini-leagues-wagers.js
//
// GET    /api/admin/mini-leagues-wagers?season=2025[&variant=backup]
// PUT    /api/admin/mini-leagues-wagers?season=2025   (body = full wagers doc)
// DELETE /api/admin/mini-leagues-wagers?season=2025   (deletes current JSON + manifest + any legacy backup keys)
//
// Storage keys:
// - Current doc:  data/mini-leagues/wagers_<season>.json
// - Manifest:     data/manifests/mini-leagues-wagers_<season>.json
//
// (Legacy keys that may exist from older versions; DELETE will remove these too)
// - Backup doc:   data/mini-leagues/wagers_<season>_wk14_backup.json
// - Backup meta:  data/mini-leagues/wagers_<season>_wk14_backup_meta.json

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

function keyForSeason(season) {
  const s = String(season).trim();
  return {
    current: `data/mini-leagues/wagers_${s}.json`,
    manifest: `data/manifests/mini-leagues-wagers_${s}.json`,

    // legacy keys (safe to leave; DELETE cleans them up if present)
    backup: `data/mini-leagues/wagers_${s}_wk14_backup.json`,
    backupMeta: `data/mini-leagues/wagers_${s}_wk14_backup_meta.json`,
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

async function deleteIfExists(bucket, key) {
  // R2 delete is idempotent; deleting a missing key is fine
  await bucket.delete(key);
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const season = url.searchParams.get("season");
    if (!season) return bad("Missing ?season=", 400);

    const variant = (url.searchParams.get("variant") || "").toLowerCase();
    const bucket = ensureR2(env);
    const keys = keyForSeason(season);

    if (request.method === "GET") {
      // Keep supporting legacy backup reads if you ever want it
      const which = variant === "backup" ? keys.backup : keys.current;
      const data = await readJsonFromR2(bucket, which);
      if (!data) return json({ ok: true, data: null, key: which }, 200);
      return json({ ok: true, data, key: which }, 200);
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

      // Bump manifest so the public page can cache-bust reliably
      await touchManifest(bucket, keys.manifest, season);

      return json(
        {
          ok: true,
          data: body,
          savedKey: keys.current,
        },
        200
      );
    }

    if (request.method === "DELETE") {
      // Delete current + manifest + any legacy backup artifacts
      await deleteIfExists(bucket, keys.current);
      await deleteIfExists(bucket, keys.manifest);
      await deleteIfExists(bucket, keys.backup);
      await deleteIfExists(bucket, keys.backupMeta);

      return json(
        {
          ok: true,
          deleted: [keys.current, keys.manifest, keys.backup, keys.backupMeta],
        },
        200
      );
    }

    return bad(`Method not allowed: ${request.method}`, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
}
