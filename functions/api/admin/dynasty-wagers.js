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
  // NOTE: This is intentionally separate from `dynasty-wagers`.
  // It preserves the legacy doc shape `{ season, updatedAt, rows }`.
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

    if (request.method === "GET") {
      const obj = await bucket.get(key);
      if (!obj) {
        return json({ ok: true, season, key, rows: [], data: null });
      }

      const text = await obj.text();
      const parsed = text ? JSON.parse(text) : null;
      const rows = normalizeRows(parsed);

      return json({ ok: true, season, key, rows, data: parsed });
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

      await bucket.put(key, JSON.stringify(doc, null, 2), {
        httpMetadata: { contentType: "application/json" },
      });

      return json({ ok: true, season, key, rows });
    }

    if (request.method === "DELETE") {
      await bucket.delete(key);
      return json({ ok: true, season, key, deleted: true });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
