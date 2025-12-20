// functions/api/admin/mini-leagues.js
//
// GET  /api/admin/mini-leagues?season=2025&type=page|divisions
// PUT  /api/admin/mini-leagues?season=2025   { type, data }
// - type="page": writes to R2 key: content/mini-leagues/page_2025.json
// - type="divisions": writes to R2 key: data/mini-leagues/divisions_2025.json

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
      error: "admin_bucket binding is not an R2 bucket object (check Pages > Settings > Bindings: admin_bucket).",
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

function r2KeyFor(type, season) {
  if (type === "page") return `content/mini-leagues/page_${season}.json`;
  if (type === "divisions") return `data/mini-leagues/divisions_${season}.json`;
  return "";
}

// ✅ Updated: supports winners 1 + winners 2, and preserves back-compat
function sanitizePageInput(data) {
  const hero = data?.hero || {};
  const winners = data?.winners || {};

  // Back-compat: older payloads used a single winners image.
  // If those legacy fields are present, treat them as winners #1.
  const legacyImageKey = typeof winners.imageKey === "string" ? winners.imageKey : "";
  const legacyImageUrl = typeof winners.imageUrl === "string" ? winners.imageUrl : "";
  const legacyCaption = typeof winners.caption === "string" ? winners.caption : "";

  const imageKey1Raw =
    typeof winners.imageKey1 === "string" ? winners.imageKey1 : legacyImageKey;
  const imageUrl1Raw =
    typeof winners.imageUrl1 === "string" ? winners.imageUrl1 : legacyImageUrl;
  const caption1Raw =
    typeof winners.caption1 === "string" ? winners.caption1 : legacyCaption;

  return {
    season: Number(data?.season || DEFAULT_SEASON),

    hero: {
      promoImageKey: typeof hero.promoImageKey === "string" ? hero.promoImageKey : "",
      promoImageUrl: typeof hero.promoImageUrl === "string" ? hero.promoImageUrl : "",
      updatesHtml: typeof hero.updatesHtml === "string" ? hero.updatesHtml : "",
    },

    winners: {
      title: typeof winners.title === "string" ? winners.title : "",

      // Winners #1
      imageKey1: imageKey1Raw || "",
      imageUrl1: imageUrl1Raw || "",
      caption1: caption1Raw || "",

      // Winners #2
      imageKey2: typeof winners.imageKey2 === "string" ? winners.imageKey2 : "",
      imageUrl2: typeof winners.imageUrl2 === "string" ? winners.imageUrl2 : "",
      caption2: typeof winners.caption2 === "string" ? winners.caption2 : "",
    },
  };
}

function sanitizeDivisionsInput(data) {
  const season = Number(data?.season || DEFAULT_SEASON);
  const divisionsRaw = Array.isArray(data?.divisions) ? data.divisions : [];

  const divisions = divisionsRaw.map((d) => {
    const leaguesRaw = Array.isArray(d?.leagues) ? d.leagues : [];
    const leagues = leaguesRaw.map((l, idx) => ({
      name: typeof l?.name === "string" ? l.name : `League ${idx + 1}`,
      url: typeof l?.url === "string" ? l.url : "",
      status: ["tbd", "filling", "drafting", "full"].includes(l?.status) ? l.status : "tbd",
      active: l?.active !== false,
      order: Number.isFinite(Number(l?.order)) ? Number(l.order) : idx + 1,
      imageKey: typeof l?.imageKey === "string" ? l.imageKey : "",
      imageUrl: typeof l?.imageUrl === "string" ? l.imageUrl : "",
    }));

    return {
      divisionCode: typeof d?.divisionCode === "string" ? d.divisionCode : "100",
      title: typeof d?.title === "string" ? d.title : "Division 100",
      status: ["tbd", "filling", "drafting", "full"].includes(d?.status) ? d.status : "tbd",
      order: Number.isFinite(Number(d?.order)) ? Number(d.order) : 1,
      imageKey: typeof d?.imageKey === "string" ? d.imageKey : "",
      imageUrl: typeof d?.imageUrl === "string" ? d.imageUrl : "",
      leagues,
    };
  });

  return { season, divisions };
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
    const type = (url.searchParams.get("type") || "").trim();

    if (request.method === "GET") {
      if (!type) return json({ ok: false, error: "Missing type" }, 400);
      const key = r2KeyFor(type, season);
      if (!key) return json({ ok: false, error: "Invalid type" }, 400);

      const data = await readR2Json(r2.bucket, key);
      return json({ ok: true, key, data: data || null });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const putType = (body?.type || "").trim();
      const data = body?.data;

      const key = r2KeyFor(putType, season);
      if (!key) return json({ ok: false, error: "Invalid type" }, 400);

      let payload;
      if (putType === "page") payload = sanitizePageInput(data);
      else if (putType === "divisions") payload = sanitizeDivisionsInput(data);
      else return json({ ok: false, error: "Invalid type" }, 400);

      await r2.bucket.put(key, JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });

      return json({ ok: true, key });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: "mini-leagues.js crashed", detail: String(e?.message || e) }, 500);
  }
}
