// functions/api/admin/mini-leagues-wagers-backup.js
//
// GET  /api/admin/mini-leagues-wagers-backup?season=2025
//   -> { ok: true, data: <backupDoc|null>, meta: <metaDoc|null> }
// POST /api/admin/mini-leagues-wagers-backup?season=2025
//   -> Restores the backup to be the current wagers doc (overwrites wagers_<season>.json)

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
  const b = env.ADMIN_BUCKET || env;
  if (!b || typeof b.get !== "function" || typeof b.put !== "function") {
    throw new Error("R2 bucket binding not found (env.ADMIN_BUCKET).");
  }
  return b;
}

function getSeason(url) {
  const seasonRaw = url.searchParams.get("season");
  const season = Number(seasonRaw);
  if (!Number.isFinite(season) || season < 2000 || season > 3000) {
    return { ok: false, error: "Missing or invalid season." };
  }
  return { ok: true, season };
}

function keyFor(season) {
  return `data/mini-leagues/wagers_${season}.json`;
}

function backupKeyFor(season) {
  return `data/mini-leagues/wagers_${season}_wk14_backup.json`;
}

function backupMetaKeyFor(season) {
  return `data/mini-leagues/wagers_${season}_wk14_backup_meta.json`;
}

async function readJson(bucket, key) {
  const obj = await bucket.get(key, { cacheControl: "no-store" });
  if (!obj) return null;
  const text = await obj.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function touchManifest(env, season) {
  // Keep in sync with the main wagers endpoint manifest key.
  try {
    const bucket = ensureR2(env);
    const manifestKey = `data/manifests/mini-leagues-wagers_${season}.json`;
    const payload = { updatedAt: new Date().toISOString() };
    await bucket.put(manifestKey, JSON.stringify(payload, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
    });
  } catch {
    // best-effort
  }
}

export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    const s = getSeason(url);
    if (!s.ok) return json({ ok: false, error: s.error }, 400);

    const bucket = ensureR2(env);
    const season = s.season;

    if (request.method === "GET") {
      const data = await readJson(bucket, backupKeyFor(season));
      const meta = await readJson(bucket, backupMetaKeyFor(season));
      return json({ ok: true, data, meta });
    }

    if (request.method === "POST") {
      const backup = await bucket.get(backupKeyFor(season), { cacheControl: "no-store" });
      if (!backup) return json({ ok: false, error: "No backup exists for this season yet." }, 404);

      const body = await backup.text();
      await bucket.put(keyFor(season), body, {
        httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
      });

      await touchManifest(env, season);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Method not allowed." }, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || "Server error" }, 500);
  }
}
