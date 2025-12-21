// functions/api/admin/dynasty.js
//
// Dynasty leagues CMS stored in R2 (admin_bucket).
//
// GET  /api/admin/dynasty
// PUT  /api/admin/dynasty   { rows: [...] }
//
// R2 key:
// - data/dynasty/leagues.json

const R2_KEY = "data/dynasty/leagues.json";

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

function normalizeRow(r, idx) {
  const status = asStr(r?.status || "FULL & ACTIVE").trim() || "FULL & ACTIVE";
  const year = asNum(r?.year, new Date().getFullYear());
  const id = asStr(r?.id || r?._localId || `r2_${year}_${idx}_${Date.now()}`).trim();

  // Support both old (image_url) and new (imageKey) shapes.
  const imageKey = asStr(r?.imageKey || r?.image_key || "").trim();
  const image_url = asStr(r?.image_url || r?.imageUrl || "").trim();

  return {
    id,
    year,
    theme_name: asStr(r?.theme_name || r?.kind || "Dynasty").trim() || "Dynasty",
    theme_blurb: asStr(r?.theme_blurb || "").trim() || null,
    name: asStr(r?.name || "").trim() || `League ${idx + 1}`,
    status,
    sleeper_url: asStr(r?.sleeper_url || r?.url || "").trim() || null,
    imageKey: imageKey || null,
    image_url: image_url || null,
    fill_note: asStr(r?.fill_note || "").trim() || null,
    note: asStr(r?.note || "").trim() || null,
    display_order: asNum(r?.display_order, null),
    is_active: asBool(r?.is_active, true),
    is_orphan: asBool(r?.is_orphan, status === "ORPHAN OPEN"),
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

    if (request.method === "GET") {
      const data = await readR2Json(r2.bucket, R2_KEY);
      return json({ ok: true, key: R2_KEY, data: data || null });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const rowsRaw = Array.isArray(body?.rows) ? body.rows : [];
      const rows = rowsRaw.map(normalizeRow);

      const payload = {
        updatedAt: new Date().toISOString(),
        rows,
      };

      await r2.bucket.put(R2_KEY, JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });

      return json({ ok: true, key: R2_KEY, count: rows.length });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json(
      { ok: false, error: "dynasty.js crashed", detail: String(e?.message || e) },
      500
    );
  }
}
