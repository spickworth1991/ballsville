// functions/api/admin/mini-leagues-wagers.js
//
// GET  /api/admin/mini-leagues-wagers?season=2025[&variant=backup]
// PUT  /api/admin/mini-leagues-wagers?season=2025   (body = full wagers doc)
//
// Behavior:
// - Current doc always saved at:   data/mini-leagues/wagers_<season>.json
// - On Week 14 import (eligibility.week===14), snapshot the *previous* current doc to:
//     data/mini-leagues/wagers_<season>_wk14_backup.json
//   but only when the incoming eligibility.computedAt differs from the stored one.
// - Backup key is deterministic (overwrites), so no indefinite growth.

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
  if (!b || typeof b.get !== "function" || typeof b.put !== "function") {
    throw new Error("R2 bucket binding not found. Expected env.ADMIN_BUCKET (or env) to be an R2 binding.");
  }
  return b;
}

function keyForSeason(season) {
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
    const text = await obj.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function nowIso() {
  return new Date().toISOString();
}

async function touchManifest(bucket, key, season) {
  const body = JSON.stringify({ section: \"mini-leagues-wagers\", season: Number(season) || season, updatedAt: nowIso() }, null, 2);
  await bucket.put(key, body, { httpMetadata: { contentType: \"application/json; charset=utf-8\", cacheControl: \"no-store\" } });
}

async function touchManifest(bucket, key, season) {
  const body = JSON.stringify({ section: "mini-leagues-wagers", season: Number(season) || season, updatedAt: nowIso() }, null, 2);
  await bucket.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } });
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const season = url.searchParams.get("season");
    if (!season) return bad("Missing ?season=", 400);

    const variant = (url.searchParams.get("variant") || "").toLowerCase(); // optional
    const bucket = ensureR2(env);
    const keys = keyForSeason(season);

    if (request.method === "GET") {
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

      // Read current doc (so we can snapshot it if needed)
      const currentDoc = await readJsonFromR2(bucket, keys.current);

      const incomingEligWeek = Number(body?.eligibility?.week || 0);
      const incomingEligComputedAt = safeStr(body?.eligibility?.computedAt).trim();

      const storedEligComputedAt = safeStr(currentDoc?.eligibility?.computedAt).trim();

      // Snapshot rule:
      // - only when importing Week 14 eligibility
      // - only when computedAt is present AND different from what we already have
      // - only if there *is* an existing current doc to snapshot
      const shouldSnapshot =
        incomingEligWeek === 14 &&
        incomingEligComputedAt &&
        incomingEligComputedAt !== storedEligComputedAt &&
        currentDoc;

      let snapshotInfo = null;

      if (shouldSnapshot) {
        const snapshotAt = nowIso();

        // Save the previous current doc as the Week 14 backup (deterministic key overwrites)
        await bucket.put(keys.backup, JSON.stringify(currentDoc, null, 2), {
          httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
        });

        // Small meta (helps you verify which import created the backup)
        const meta = {
          season: Number(season) || season,
          snapshotAt,
          fromUpdatedAt: safeStr(currentDoc?.updatedAt).trim(),
          fromEligibilityComputedAt: storedEligComputedAt || "",
          toEligibilityComputedAt: incomingEligComputedAt || "",
          note: "Auto-snapshot taken when Week 14 eligibility was imported.",
        };

        await bucket.put(keys.backupMeta, JSON.stringify(meta, null, 2), {
          httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
        });

        snapshotInfo = meta;
      }

      // Always overwrite the current doc
      await bucket.put(keys.current, JSON.stringify(body, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
      });
      // Cache-bust public tracker
      await touchManifest(bucket, keys.manifest, season).catch(() => null);


      return json(
        {
          ok: true,
          data: body,
          savedKey: keys.current,
          snapshot: snapshotInfo,
        },
        200
      );
    }

    return bad(`Method not allowed: ${request.method}`, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
}

async function touchManifest(bucket, key, season) {
  const body = JSON.stringify({ section: "mini-leagues-wagers", season: Number(season) || season, updatedAt: new Date().toISOString() }, null, 2);
  await bucket.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } });
}
