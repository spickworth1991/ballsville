// functions/api/admin/dynasty-wagers.js
//
// Back-compat endpoint for Dynasty wagering admin doc in R2.
//
// IMPORTANT:
// - This endpoint intentionally does NOT require a Bearer token.
// - Admin access is enforced at the page level via <AdminGuard />.
//   Keep this endpoint working even if newer pages use `/api/admin/dynasty-wagers`.

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
  // Prefer the established binding name used across the project.
  const b = env.admin_bucket || env.ADMIN_BUCKET || env.bucket || env.BUCKET || env;
  if (
    !b ||
    typeof b.get !== "function" ||
    typeof b.put !== "function" ||
    typeof b.delete !== "function"
  ) {
    throw new Error(
      "Missing R2 binding. Expected env.admin_bucket (or equivalent) to be bound to the admin bucket."
    );
  }
  return b;
}

function parseSeason(url) {
  const { searchParams } = new URL(url);
  const raw = String(searchParams.get("season") || "").trim();
  const season = Number(raw);
  // Keep it flexible so you don't have to update code each year.
  if (!Number.isFinite(season) || season < 2000 || season > 2100) return null;
  return season;
}

function keyForSeason(season) {
  // ✅ Standard location used by the rest of the gamemode admin/public pages.
  // Stored in the ADMIN_BUCKET (via binding), but namespaced under /data.
  return `data/dynasty/wagers_${season}.json`;
}

// Legacy key used briefly during the bucket wiring work.
// Keep read-compat so existing data doesn't "disappear".
function legacyKeyForSeason(season) {
  return `admin/dynasty-wagers_${season}.json`;
}

function normalizeRows(payload) {
  // Support both shapes:
  // - legacy: { rows: [...] }
  // - raw array: [...]
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray(payload.rows)) return payload.rows;
  return [];
}

export async function onRequest({ request, env }) {
  try {
    const season = parseSeason(request.url);
    if (!season) return json({ ok: false, error: "Invalid season." }, 400);

    const bucket = ensureR2(env);
    const key = keyForSeason(season);
    const legacyKey = legacyKeyForSeason(season);

    if (request.method === "GET") {
      // Prefer the standard key; fall back to the legacy key if needed.
      let obj = await bucket.get(key);
      let usedKey = key;

      if (!obj) {
        const legacyObj = await bucket.get(legacyKey);
        if (!legacyObj) {
          return json({ ok: true, season, key, rows: [], data: null });
        }
        obj = legacyObj;
        usedKey = legacyKey;
      }

      const text = await obj.text();
      const parsed = text ? JSON.parse(text) : null;
      const rows = normalizeRows(parsed);

      // If we had to read legacy data, migrate it forward so the UI stops "resetting".
      if (usedKey === legacyKey) {
        try {
          const doc = {
            season,
            updatedAt: String(parsed?.updatedAt || parsed?.updated_at || new Date().toISOString()),
            rows,
          };
          await bucket.put(key, JSON.stringify(doc, null, 2), {
            httpMetadata: { contentType: "application/json" },
          });
        } catch {
          // ignore migration errors; still return the data we found
        }
      }

      return json({ ok: true, season, key: usedKey, rows, data: parsed });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return json({ ok: false, error: "Invalid JSON body." }, 400);
      }

      const rows = normalizeRows(body);
      const doc = {
        season,
        updatedAt: new Date().toISOString(),
        rows,
      };

      // Always write to the standard location.
      await bucket.put(key, JSON.stringify(doc, null, 2), {
        httpMetadata: { contentType: "application/json" },
      });

      return json({ ok: true, season, key, rows });
    }

    if (request.method === "DELETE") {
      // Delete both the standard + legacy keys, so "Delete and start over" is reliable.
      try {
        await bucket.delete(key);
      } catch {
        // ignore
      }
      try {
        await bucket.delete(legacyKey);
      } catch {
        // ignore
      }
      return json({ ok: true, season, key, legacyKey, deleted: true });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
