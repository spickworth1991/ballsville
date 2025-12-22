// functions/api/admin/dynasty-wagering.js
//
// Admin CRUD for Dynasty Wagering tracker (stored in R2).
//
// GET  /api/admin/dynasty-wagering?season=2025
// PUT  /api/admin/dynasty-wagering?season=2025   (JSON body { rows: [...] })
//
// Notes
// - Uses the SAME R2 binding as the other admin endpoints: env.admin_bucket
//   (ensureR2 falls back to env.admin_bucket or env if bound directly).
// - Supabase is ONLY used to verify the admin JWT (Bearer token).

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
  const b = env?.ADMIN_BUCKET || env;
  if (!b || typeof b.get !== "function") {
    throw new Error(
      "Missing R2 binding: expected env.admin_bucket (same binding used by other admin endpoints)."
    );
  }
  return b;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return { ok: false, status: 401, error: "Missing Bearer token" };

  // Same envs used elsewhere for admin auth
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, status: 500, error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY" };

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anon,
      authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return { ok: false, status: 401, error: "Unauthorized" };
  const user = await res.json().catch(() => null);

  // Allow-list based on email
  const allow = (env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = String(user?.email || "").toLowerCase();

  if (!email || (allow.length && !allow.includes(email))) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, email };
}

function normalizeRow(r, idx) {
  const id = String(r?.id || `${r?.group_name || r?.group || "group"}:${r?.league_name || r?.league || idx}`);
  return {
    id,
    season: Number.isFinite(Number(r?.season)) ? Number(r.season) : undefined,
    group_name: String(r?.group_name || r?.group || "").trim(),
    league_name: String(r?.league_name || r?.league || "").trim(),

    finalist1_name: String(r?.finalist1_name || "").trim(),
    finalist1_choice: String(r?.finalist1_choice || "bank").trim(),
    finalist1_score: r?.finalist1_score === "" ? "" : r?.finalist1_score,

    finalist2_name: String(r?.finalist2_name || "").trim(),
    finalist2_choice: String(r?.finalist2_choice || "bank").trim(),
    finalist2_score: r?.finalist2_score === "" ? "" : r?.finalist2_score,

    league_winner: String(r?.league_winner || "").trim(),
  };
}

function keyForSeason(season) {
  return `data/dynasty/wagering_${season}.json`;
}

export async function onRequest({ request, env }) {
  try {
    const auth = await requireAdmin(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

    const r2 = ensureR2(env);
    const url = new URL(request.url);
    const season = Number(url.searchParams.get("season") || "");
    if (!Number.isFinite(season) || season < 2000) {
      return json({ ok: false, error: "Missing/invalid season" }, 400);
    }

    const key = keyForSeason(season);

    if (request.method === "GET") {
      const obj = await r2.get(key);
      if (!obj) {
        // Return empty payload (admin client can seed UI defaults).
        return json({ ok: true, season, rows: [] }, 200);
      }
      const text = await obj.text();
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed?.rows)
        ? parsed.rows
        : Array.isArray(parsed)
          ? parsed
          : [];
      return json({ ok: true, season, rows }, 200);
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const rowsIn = Array.isArray(body?.rows) ? body.rows : [];
      const normalized = rowsIn.map((r, idx) => {
        const row = normalizeRow(r, idx);
        row.season = season;
        return row;
      });

      const payload = {
        season,
        updatedAt: new Date().toISOString(),
        rows: normalized,
      };

      await r2.put(key, JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });

      return json({ ok: true, season, key, count: normalized.length }, 200);
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || "Server error" }, 500);
  }
}
