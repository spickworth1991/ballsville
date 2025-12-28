// functions/api/admin/about-managers.js
//
// Admin CRUD for the About -> "Meet our managers" section.
//
// GET  /api/admin/about-managers?season=2025
// PUT  /api/admin/about-managers?season=2025   (JSON body { managers: [...] })
//
// R2 keys:
// - content/about/managers_<season>.json
// - data/manifests/about-managers_<season>.json (updated on every PUT)

import { getCurrentNflSeason } from "../../_lib/season";


const DEFAULT_SEASON = getCurrentNflSeason();

async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Missing Authorization Bearer token." };

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return { ok: false, status: 500, error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY." };
  }

  const admins = String(env.ADMIN_EMAILS || env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!admins.length) return { ok: false, status: 403, error: "No ADMIN_EMAILS configured." };

  const r = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, authorization: `Bearer ${token}` },
  });

  if (!r.ok) return { ok: false, status: 401, error: "Invalid session token." };

  const user = await r.json();
  const email = String(user?.email || "").toLowerCase();
  if (!admins.includes(email)) return { ok: false, status: 403, error: "Not an admin." };

  return { ok: true, email };
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
      error:
        "admin_bucket binding is not an R2 bucket object (check Pages > Settings > Bindings: admin_bucket).",
    };
  }
  return { ok: true, bucket: b };
}

function keyForSeason(season) {
  return `content/about/managers_${season}.json`;
}

async function touchManifest(env, season) {
  try {
    const r2 = ensureR2(env);
    if (!r2.ok) return;
    const key = `data/manifests/about-managers_${season}.json`;
    const body = JSON.stringify(
      {
        section: "about-managers",
        season,
        updatedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      },
      null,
      2
    );
    await r2.bucket.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  } catch {
    // non-fatal
  }
}

function cleanString(v, max = 4000) {
  return String(v || "").replace(/\u0000/g, "").trim().slice(0, max);
}

function normalizeManager(m, idx) {
  const id = cleanString(m?.id || idx, 96) || String(idx);
  const order = Number.isFinite(Number(m?.order)) ? Number(m.order) : idx + 1;

  const bulletsRaw = Array.isArray(m?.bullets)
    ? m.bullets
    : typeof m?.bullets === "string"
      ? m.bullets.split("\n")
      : [];

  const bullets = bulletsRaw
    .map((s) => cleanString(s, 160))
    .map((s) => s.replace(/^[-•\s]+/, ""))
    .filter(Boolean)
    .slice(0, 8);

  return {
    id,
    order,
    name: cleanString(m?.name, 120),
    role: cleanString(m?.role, 160),
    bullets,
    bio: cleanString(m?.bio, 6000),
    imageKey: cleanString(m?.imageKey, 240),
    imageUrl: cleanString(m?.imageUrl || m?.image_url, 800),
    // Optional links (safe strings only)
    twitter: cleanString(m?.twitter, 240),
    discord: cleanString(m?.discord, 240),
    sleeper: cleanString(m?.sleeper, 240),
  };
}

async function readR2Json(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const txt = await obj.text();
  return JSON.parse(txt);
}

export async function onRequest(context) {
  try {
    const { request, env } = context;

    const r2 = ensureR2(env);
    if (!r2.ok) return json({ ok: false, error: r2.error }, r2.status);

    const gate = await requireAdmin(request, env);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);


    const url = new URL(request.url);
    const seasonParam = url.searchParams.get("season");
    const season = Number(seasonParam ? seasonParam : DEFAULT_SEASON);
    if (!Number.isFinite(season) || season < 2000) {
      return json({ ok: false, error: "Missing/invalid season" }, 400);
    }

    const key = keyForSeason(season);

    if (request.method === "GET") {
      const data = await readR2Json(r2.bucket, key);
      const managers = Array.isArray(data?.managers) ? data.managers : Array.isArray(data) ? data : [];
      return json({ ok: true, key, season, updatedAt: data?.updatedAt || data?.updated_at || "", managers }, 200);
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const list = Array.isArray(body?.managers) ? body.managers : [];

      const normalized = list.map(normalizeManager);
      // Stable ordering
      normalized.sort((a, b) => (a.order || 0) - (b.order || 0));

      const payload = {
        season,
        updatedAt: new Date().toISOString(),
        managers: normalized,
      };

      await r2.bucket.put(key, JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });
      await touchManifest(env, season);

      return json({ ok: true, key }, 200);
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json(
      { ok: false, error: "about-managers.js crashed", detail: String(e?.message || e) },
      500
    );
  }
}
