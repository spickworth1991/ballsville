// functions/api/admin/highlander.js
//
// GET  /api/admin/highlander?season=2026&type=page|leagues
// PUT  /api/admin/highlander?season=2026   { type, data }
// - type="page": writes to R2 key: content/highlander/page_2026.json
// - type="leagues": writes to R2 key: data/highlander/leagues_2026.json
//
// Also touches manifest: data/manifests/highlander_2026.json

import { CURRENT_SEASON } from "@/lib/season";

const DEFAULT_SEASON = CURRENT_SEASON;

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

async function touchManifest(env, season) {
  const b = ensureR2(env);
  if (!b.ok) return;
  const key = season ? `data/manifests/highlander_${season}.json` : `data/manifests/highlander.json`;
  const body = JSON.stringify(
    { section: "highlander", season: season || null, updatedAt: new Date().toISOString() },
    null,
    2
  );
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
    headers: {
      apikey: supabaseAnon,
      authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return { ok: false, status: 401, error: "Invalid token." };

  const user = await res.json();
  const email = String(user?.email || "").toLowerCase();
  if (!email || !admins.includes(email)) return { ok: false, status: 403, error: "Not an admin." };

  return { ok: true, user };
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export async function onRequest(context) {
  const { request, env } = context;

  // Admin-only.
  const gate = await requireAdmin(context);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const r2 = ensureR2(env);
  if (!r2.ok) return json({ error: r2.error }, r2.status);

  const url = new URL(request.url);
  const season = safeStr(url.searchParams.get("season") || DEFAULT_SEASON).trim();
  const type = safeStr(url.searchParams.get("type") || "").trim().toLowerCase();

  if (request.method === "GET") {
    if (!type) return json({ error: "Missing type=page|leagues" }, 400);

    const key =
      type === "page"
        ? `content/highlander/page_${season}.json`
        : type === "leagues"
        ? `data/highlander/leagues_${season}.json`
        : null;

    if (!key) return json({ error: "Invalid type. Use page|leagues." }, 400);

    const obj = await r2.bucket.get(key);
    if (!obj) return json({ error: "Not found." }, 404);

    const text = await obj.text();
    try {
      return json(JSON.parse(text), 200);
    } catch {
      // If somehow corrupted, return raw.
      return new Response(text, {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const putType = safeStr(body?.type || "").trim().toLowerCase();
    const data = body?.data;

    const key =
      putType === "page"
        ? `content/highlander/page_${season}.json`
        : putType === "leagues"
        ? `data/highlander/leagues_${season}.json`
        : null;

    if (!key) return json({ error: "Invalid type. Use page|leagues." }, 400);

    const payload = JSON.stringify(data ?? {}, null, 2);
    await r2.bucket.put(key, payload, {
      httpMetadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "no-store",
      },
    });

    await touchManifest(env, season);
    return json({ ok: true, key }, 200);
  }

  return json({ error: "Method not allowed." }, 405);
}
