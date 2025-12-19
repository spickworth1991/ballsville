// functions/api/admin/mini-leagues.js
// R2-backed content store for Mini-Leagues page + divisions
//
// ENV REQUIRED (Cloudflare Pages -> Settings -> Variables):
// - BALLSVILLE_R2   (R2 Bucket binding)
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - ADMIN_EMAILS (comma-separated)  OR NEXT_PUBLIC_ADMIN_EMAILS
//
// Optional:
// - R2_PUBLIC_BASE (used by your /r2 proxy for public reads)

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

function bad(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

function getAdminEmails(env) {
  const raw = (env.ADMIN_EMAILS || env.NEXT_PUBLIC_ADMIN_EMAILS || "").trim();
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(context) {
  const { request, env } = context;

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return { ok: false, status: 401, error: "Missing Authorization Bearer token." };

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return { ok: false, status: 500, error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars." };
  }

  // Validate token by calling Supabase Auth "get user"
  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnon,
      authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return { ok: false, status: 401, error: "Invalid session token." };

  const user = await res.json();
  const email = String(user?.email || "").toLowerCase();

  const admins = getAdminEmails(env);
  if (!admins.length) return { ok: false, status: 500, error: "ADMIN_EMAILS is not set in Cloudflare Pages env." };
  if (!email || !admins.includes(email)) return { ok: false, status: 403, error: "Not an admin." };

  return { ok: true, email };
}

function keyFor(type, season) {
  const s = Number(season) || DEFAULT_SEASON;
  if (type === "page") return `content/mini-leagues/page_${s}.json`;
  if (type === "divisions") return `data/mini-leagues/divisions_${s}.json`;
  return null;
}

async function readJSON(bucket, key, fallback) {
  const obj = await bucket.get(key);
  if (!obj) return fallback;
  const txt = await obj.text();
  try {
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.R2_BUCKET) return bad("Missing R2 binding: R2_BUCKET", 500);

  // Admin guard
  const gate = await requireAdmin(context);
  if (!gate.ok) return bad(gate.error, gate.status);

  const season = Number(url.searchParams.get("season") || DEFAULT_SEASON);

  if (request.method === "GET") {
    const type = (url.searchParams.get("type") || "all").toLowerCase();

    const pageKey = keyFor("page", season);
    const divKey = keyFor("divisions", season);

    const page = await readJSON(env.BALLSVILLE_R2, pageKey, null);
    const divisions = await readJSON(env.BALLSVILLE_R2, divKey, null);

    if (type === "page") return json({ ok: true, season, type, key: pageKey, data: page });
    if (type === "divisions") return json({ ok: true, season, type, key: divKey, data: divisions });

    return json({
      ok: true,
      season,
      type: "all",
      page: { key: pageKey, data: page },
      divisions: { key: divKey, data: divisions },
    });
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return bad("Invalid JSON body.");
    }

    const type = String(body?.type || "").toLowerCase();
    const data = body?.data;

    if (!type || !["page", "divisions"].includes(type)) return bad("Body must include type: 'page' or 'divisions'.");
    if (!data) return bad("Body must include data.");

    const key = keyFor(type, season);
    if (!key) return bad("Bad type.");

    await env.BALLSVILLE_R2.put(key, JSON.stringify(data, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    return json({ ok: true, saved: true, season, type, key });
  }

  return bad("Method not allowed.", 405);
}
