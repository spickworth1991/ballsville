// functions/api/admin/dynasty.js
//
// Dynasty CMS stored in R2 (admin_bucket).
//
// GET  /api/admin/dynasty?season=2025&type=page|leagues
// PUT  /api/admin/dynasty?season=2025   { type, data }
//
// R2 keys:
// - content/dynasty/page_<season>.json
// - data/dynasty/leagues.json

import { CURRENT_SEASON } from "@/lib/season";

const DEFAULT_SEASON = CURRENT_SEASON;
const R2_LEAGUES_KEY = "data/dynasty/leagues.json";

function r2KeyFor(type, season) {
  if (type === "page") return `content/dynasty/page_${season}.json`;
  return R2_LEAGUES_KEY;
}

function sanitizePageInput(data, season) {
  const hero = data?.hero || {};
  return {
    season: Number(season || DEFAULT_SEASON),
    hero: {
      promoImageKey: typeof hero.promoImageKey === "string" ? hero.promoImageKey : "",
      promoImageUrl: typeof hero.promoImageUrl === "string" ? hero.promoImageUrl : "",
      updatesHtml: typeof hero.updatesHtml === "string" ? hero.updatesHtml : "",
    },
  };
}

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

async function touchManifest(env, season) {
  const b = ensureR2(env);
  if (!b.ok) return;
  const key = season ? `data/manifests/dynasty_${season}.json` : `data/manifests/dynasty.json`;
  const body = JSON.stringify({ section: "dynasty", season: season || null, updatedAt: new Date().toISOString() }, null, 2);
  await b.bucket.put(key, body, {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
      cacheControl: "no-store",
    },
  });
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
  // Be liberal in what we accept, since admin UIs (or older data) can
  // serialize booleans as strings/numbers.
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "y" || s === "on") return true;
    if (s === "false" || s === "0" || s === "no" || s === "n" || s === "off") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return d;
}

function asNum(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizeRow(r, idx) {
  // Status is the source of truth for orphan openings.
  // Accept a few legacy field names just in case older admin payloads used them.
  const status = asStr(r?.status || r?.base_status || r?.availability_status || "FULL & ACTIVE").trim() || "FULL & ACTIVE";
  const statusNorm = status.trim().toUpperCase();
  const year = asNum(r?.year, new Date().getFullYear());
  const id = asStr(r?.id || r?._localId || `r2_${year}_${idx}_${Date.now()}`).trim();

  // Support both old (image_url) and new (imageKey) shapes.
  const imageKey = asStr(r?.imageKey || r?.image_key || "").trim();
  const image_url = asStr(r?.image_url || r?.imageUrl || "").trim();

  // Optional per-theme (division) image. Stored on each row so the public
  // directory can render division cards without needing a separate file.
  const theme_imageKey = asStr(r?.theme_imageKey || r?.theme_image_key || "").trim();
  const theme_image_url = asStr(r?.theme_image_url || r?.theme_imageUrl || "").trim();

  // Orphan openings are controlled by status.
  // Keep backward compat by OR-ing any existing boolean-ish values.
  const is_orphan = statusNorm.includes("ORPHAN") || asBool(r?.is_orphan, false);

  // Preserve Sleeper IDs coming from the automation flow.
  // Used for public directory fallback links and future tooling.
  const league_id = asStr(r?.league_id || r?.leagueId || r?.sleeper_league_id || "").trim();
  const draft_id = asStr(r?.draft_id || r?.draftId || "").trim();
  const avatar = asStr(r?.avatar || "").trim();

  return {
    id,
    year,
    theme_name: asStr(r?.theme_name || r?.kind || "Dynasty").trim() || "Dynasty",
    theme_blurb: asStr(r?.theme_blurb || "").trim() || null,
    theme_imageKey: theme_imageKey || null,
    theme_image_url: theme_image_url || null,
    name: asStr(r?.name || "").trim() || `League ${idx + 1}`,
    // Sleeper metadata (persisted from automation)
    league_id: league_id || null,
    draft_id: draft_id || null,
    avatar: avatar || null,
    status,
    sleeper_url: asStr(r?.sleeper_url || r?.url || "").trim() || null,
    imageKey: imageKey || null,
    image_url: image_url || null,
    // Fill notes are no longer used in Dynasty (kept as null for older clients).
    fill_note: null,
    note: asStr(r?.note || "").trim() || null,
    display_order: asNum(r?.display_order, null),
    is_active: asBool(r?.is_active, true),
    is_orphan,

    // Sleeper identifiers (optional but highly recommended)
    league_id: league_id || null,
    draft_id: draft_id || null,
    avatar: avatar || null,
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
    const type = (url.searchParams.get("type") || "leagues").toLowerCase();
    const key = r2KeyFor(type, season);

    if (request.method === "GET") {
      const data = await readR2Json(r2.bucket, key);
      return json({ ok: true, key, type, data: data || null });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const bodyType = String(body?.type || type || "leagues").toLowerCase();

      // PAGE (owner hero block)
      if (bodyType === "page") {
        const payload = sanitizePageInput(body?.data || body, season);
        await r2.bucket.put(r2KeyFor("page", season), JSON.stringify(payload, null, 2), {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        });
    await touchManifest(context.env, season);
        return json({ ok: true, key: r2KeyFor("page", season), type: "page" });
      }

      // LEAGUES
      const rowsRaw = Array.isArray(body?.rows)
        ? body.rows
        : Array.isArray(body?.data?.rows)
          ? body.data.rows
          : Array.isArray(body?.data)
            ? body.data
            : [];

      const rows = rowsRaw.map(normalizeRow);

      const payload = {
        updatedAt: new Date().toISOString(),
        rows,
      };

      await r2.bucket.put(r2KeyFor("leagues", season), JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });
    await touchManifest(context.env, season);

      return json({ ok: true, key: r2KeyFor("leagues", season), type: "leagues", count: rows.length });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json(
      { ok: false, error: "dynasty.js crashed", detail: String(e?.message || e) },
      500
    );
  }
}
