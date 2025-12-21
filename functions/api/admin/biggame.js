// functions/api/admin/biggame.js
//
// Big Game divisions/leagues CMS stored in R2 (admin_bucket).
//
// GET  /api/admin/biggame?season=2025
// PUT  /api/admin/biggame?season=2025   { rows: [...] }
//
// R2 key:
// - data/biggame/leagues_<season>.json

const DEFAULT_SEASON = 2025;

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
  if (!b) return { ok: false, status: 500, error: "Missing R2 binding: admin_bucket" };
  if (typeof b.get !== "function" || typeof b.put !== "function") {
    return {
      ok: false,
      status: 500,
      error: 'admin_bucket binding is not an R2 bucket object (Pages > Settings > Bindings: "admin_bucket").',
    };
  }
  return { ok: true, bucket: b };
}

async function requireAdmin(context) {
  const { request, env } = context;

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Missing Authorization Bearer token." };

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const adminsRaw = (env.ADMIN_EMAILS || env.NEXT_PUBLIC_ADMIN_EMAILS || "").trim();
  const admins = adminsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!supabaseUrl || !supabaseAnon) {
    return { ok: false, status: 500, error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY." };
  }
  if (!admins.length) return { ok: false, status: 500, error: "ADMIN_EMAILS is not set." };

  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { ok: false, status: 401, error: "Invalid session token." };

  const user = await res.json();
  const email = String(user?.email || "").toLowerCase();
  if (!admins.includes(email)) return { ok: false, status: 403, error: "Not an admin." };

  return { ok: true };
}

function asStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asBool(v, d = false) {
  if (v === true) return true;
  if (v === false) return false;
  return d;
}

function asNum(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function slugify(input) {
  return asStr(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeRow(r, idx, season) {
  const year = asNum(r?.year, asNum(season, DEFAULT_SEASON)) || DEFAULT_SEASON;
  const division_name = asStr(r?.division_name || r?.theme_name || "Division").trim() || "Division";
  const division_slug = asStr(r?.division_slug || r?.divisionSlug || slugify(division_name)).trim() || slugify(division_name);

  const status = asStr(r?.status || "TBD").trim() || "TBD";

  // Image fields: support both old "*_image_path" and new "*_image_key" shapes.
  const division_image_key = asStr(r?.division_image_key || r?.divisionImageKey || "").trim();
  const division_image_path = asStr(r?.division_image_path || r?.divisionImagePath || "").trim();
  const league_image_key = asStr(r?.league_image_key || r?.leagueImageKey || "").trim();
  const league_image_path = asStr(r?.league_image_path || r?.leagueImagePath || "").trim();

  return {
    id: asStr(r?.id || `bg_${year}_${division_slug}_${idx}`).trim() || `bg_${year}_${division_slug}_${idx}`,
    year,
    division_name,
    division_slug,
    theme: asStr(r?.theme || "").trim() || null,
    division_status: asStr(r?.division_status || r?.divisionStatus || "").trim() || null,
    division_image_key: division_image_key || null,
    division_image_path: division_image_path || null,

    display_order: asNum(r?.display_order, idx + 1),
    league_name: asStr(r?.league_name || r?.name || "").trim() || `League ${idx + 1}`,
    sleeper_league_id: asStr(r?.sleeper_league_id || "").trim() || null,
    sleeper_url: asStr(r?.sleeper_url || r?.sleeperUrl || "").trim() || null,

    status,
    fill_note: asStr(r?.fill_note || "").trim() || null,

    league_image_key: league_image_key || null,
    league_image_path: league_image_path || null,

    is_active: asBool(r?.is_active, true),
  };
}

async function readR2Json(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const text = await obj.text();
  return JSON.parse(text);
}

export async function onRequest(context) {
  try {
    const { request } = context;

    const r2 = ensureR2(context.env);
    if (!r2.ok) return json({ ok: false, error: r2.error }, r2.status);

    const gate = await requireAdmin(context);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);

    const url = new URL(request.url);
    const season = Number(url.searchParams.get("season") || DEFAULT_SEASON);
    const key = `data/biggame/leagues_${season}.json`;

    if (request.method === "GET") {
      const data = await readR2Json(r2.bucket, key);
      return json({ ok: true, key, data: data || null });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const rowsRaw = Array.isArray(body?.rows) ? body.rows : [];
      const rows = rowsRaw.map((r, idx) => normalizeRow(r, idx, season));

      // stable sort
      rows.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.division_name !== b.division_name) return a.division_name.localeCompare(b.division_name);
        return (a.display_order ?? 9999) - (b.display_order ?? 9999);
      });

      const payload = {
        updatedAt: new Date().toISOString(),
        season,
        rows,
      };

      await r2.bucket.put(key, JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });

      return json({ ok: true, key, count: rows.length });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: "biggame.js crashed", detail: String(e?.message || e) }, 500);
  }
}
