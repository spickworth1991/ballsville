// functions/api/admin/mini-leagues.js
// Admin read/write endpoint for Mini-Leagues CMS JSON stored in R2.
//
// - GET: returns saved JSON (or defaults)
// - PUT: overwrites JSON (admin only)
//
// Required Cloudflare Pages bindings/env:
// - R2_BUCKET: R2 bucket binding
// - SUPABASE_URL: e.g. https://xxxx.supabase.co
// - SUPABASE_ANON_KEY: public anon key
// Optional:
// - ADMIN_EMAILS: comma-separated list (recommended), e.g. "you@gmail.com,other@gmail.com"

import { miniLeaguesDefault, normalizeMiniLeaguesPayload } from "../../../app/mini-leagues/content";

const KEY = "cms/mini-leagues.json";

export async function onRequestGet({ env, request }) {
  try {
    await requireAdmin(env, request);

    const bucket = env.R2_BUCKET;
    if (!bucket) return json({ ok: false, error: "Missing R2_BUCKET binding" }, 500);

    const obj = await bucket.get(KEY);
    if (!obj) return json({ ok: true, data: normalizeMiniLeaguesPayload(miniLeaguesDefault) }, 200);

    const parsed = JSON.parse(await obj.text());
    return json({ ok: true, data: normalizeMiniLeaguesPayload(parsed) }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || "Unauthorized" }, e?.statusCode || 401);
  }
}

export async function onRequestPut({ env, request }) {
  try {
    await requireAdmin(env, request);

    const bucket = env.R2_BUCKET;
    if (!bucket) return json({ ok: false, error: "Missing R2_BUCKET binding" }, 500);

    const body = await request.json().catch(() => null);
    const incoming = body?.data ?? body;
    const merged = normalizeMiniLeaguesPayload(incoming);

    await bucket.put(KEY, JSON.stringify(merged, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || "Save failed" }, e?.statusCode || 400);
  }
}

async function requireAdmin(env, request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw err("Missing Authorization Bearer token", 401);

  const url = env.SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw err("Missing SUPABASE_URL or SUPABASE_ANON_KEY", 500);

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
  });

  if (!res.ok) throw err("Invalid session", 401);
  const user = await res.json();
  const email = (user?.email || "").toLowerCase();

  const allowList = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowList.length && !allowList.includes(email)) {
    throw err("Not an admin", 403);
  }

  return { email };
}

function err(message, statusCode) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
