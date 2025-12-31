// functions/api/admin/dynasty-wagers.js
//
// Stores/reads the Dynasty Week 15 wagering admin doc in R2.
//
// IMPORTANT:
// - This endpoint intentionally does NOT require a Bearer token.
// - Admin access is enforced at the page level via <AdminGuard />.
// - This mirrors the auth-free behavior used by Big Game + Mini Leagues
//   wagering admin endpoints.

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
  if (!b || typeof b.get !== "function" || typeof b.put !== "function") {
    throw new Error(
      "Missing R2 binding. Expected env.admin_bucket (or equivalent) to be bound to the admin bucket."
    );
  }
  return b;
}

const ALLOWED_SEASONS = [2024, 2025, 2026];

function parseSeason(url) {
  const { searchParams } = new URL(url);
  const raw = String(searchParams.get("season") || "").trim();
  const season = Number(raw);
  if (!Number.isFinite(season) || !ALLOWED_SEASONS.includes(season)) return null;
  return season;
}

function keyForSeason(season) {
  return `admin/dynasty-wagers_${season}.json`;
}

export async function onRequest({ request, env }) {
  try {
    const season = parseSeason(request.url);
    if (!season) return json({ ok: false, error: "Invalid season." }, 400);

    const bucket = ensureR2(env);
    const key = keyForSeason(season);

    if (request.method === "GET") {
      const obj = await bucket.get(key);
      if (!obj) return json({ ok: true, key, data: null });
      const text = await obj.text();
      const data = text ? JSON.parse(text) : null;
      return json({ ok: true, key, data });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return json({ ok: false, error: "Invalid JSON body." }, 400);
      }

      await bucket.put(key, JSON.stringify(body, null, 2), {
        httpMetadata: { contentType: "application/json" },
      });

      return json({ ok: true, key, data: body });
    }

    if (request.method === "DELETE") {
      // Delete the doc entirely so the admin can "start over".
      await bucket.delete(key);
      return json({ ok: true, key, deleted: true });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
