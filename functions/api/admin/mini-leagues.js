// functions/api/admin/mini-leagues.js
//
// GET:
//   /api/admin/mini-leagues?season=2025&type=page|divisions|all
// PUT:
//   /api/admin/mini-leagues?season=2025
//   body: { type: "page"|"divisions", data: any }
//
// ENV REQUIRED (Cloudflare Pages -> Settings -> Bindings / Variables):
// - admin_bucket   (R2 Bucket binding name)
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - ADMIN_EMAILS (comma-separated)  OR NEXT_PUBLIC_ADMIN_EMAILS
//
// OPTIONAL (recommended so the public site sees updates immediately):
// - public_bucket (or PUBLIC_BUCKET / r2_bucket / R2_BUCKET) => the bucket backing /r2

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

function getBuckets(env) {
  const admin = env.admin_bucket || env.ADMIN_BUCKET;

  if (!admin) {
    return { ok: false, status: 500, error: "Missing R2 binding: admin_bucket" };
  }

  if (typeof admin.get !== "function" || typeof admin.put !== "function") {
    return {
      ok: false,
      status: 500,
      error: "admin_bucket binding is not an R2 bucket object (check Pages > Settings > Bindings: admin_bucket).",
    };
  }

  const pub = env.public_bucket || env.PUBLIC_BUCKET || env.r2_bucket || env.R2_BUCKET || null;
  const publicBucket =
    pub && typeof pub.get === "function" && typeof pub.put === "function" ? pub : null;

  return { ok: true, adminBucket: admin, publicBucket };
}

function sanitizePageInput(data) {
  const hero = data?.hero || {};
  const winners = data?.winners || {};

  return {
    season: Number(data?.season || DEFAULT_SEASON),

    hero: {
      promoImageKey: typeof hero.promoImageKey === "string" ? hero.promoImageKey : "",
      promoImageUrl: typeof hero.promoImageUrl === "string" ? hero.promoImageUrl : "",
      updatesHtml: typeof hero.updatesHtml === "string" ? hero.updatesHtml : "",
    },

    winners: {
      title: typeof winners.title === "string" ? winners.title : "",
      caption: typeof winners.caption === "string" ? winners.caption : "",
      imageKey: typeof winners.imageKey === "string" ? winners.imageKey : "",
      imageUrl: typeof winners.imageUrl === "string" ? winners.imageUrl : "",
    },
  };
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

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    return { ok: false, status: 500, error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY." };
  }

  const admins = getAdminEmails(env);
  if (!admins.length) {
    return { ok: false, status: 500, error: "ADMIN_EMAILS is not set." };
  }

  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { ok: false, status: 401, error: "Invalid session token." };

  const user = await res.json();
  const email = String(user?.email || "").toLowerCase();
  if (!admins.includes(email)) return { ok: false, status: 403, error: "Not an admin." };

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

async function writeJSON(buckets, key, payload) {
  const body = JSON.stringify(payload, null, 2);

  // Always write admin
  await buckets.adminBucket.put(key, body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  // Also write public if available
  if (buckets.publicBucket) {
    await buckets.publicBucket.put(key, body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const buckets = getBuckets(env);
    if (!buckets.ok) return json({ ok: false, error: buckets.error }, buckets.status);

    const gate = await requireAdmin(context);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);

    const season = Number(url.searchParams.get("season") || DEFAULT_SEASON);

    if (request.method === "GET") {
      const type = (url.searchParams.get("type") || "all").toLowerCase();

      const pageKey = keyFor("page", season);
      const divKey = keyFor("divisions", season);

      const page = await readJSON(buckets.adminBucket, pageKey, null);
      const divisions = await readJSON(buckets.adminBucket, divKey, null);

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
        return json({ ok: false, error: "Invalid JSON body." }, 400);
      }

      const type = String(body?.type || "").toLowerCase();
      const data = body?.data;

      if (!type || !["page", "divisions"].includes(type)) {
        return json({ ok: false, error: "Body must include type: 'page' or 'divisions'." }, 400);
      }
      if (data == null) return json({ ok: false, error: "Body must include data." }, 400);

      const key = keyFor(type, season);
      if (!key) return json({ ok: false, error: "Bad type." }, 400);

      const dataToSave = type === "page" ? sanitizePageInput(data) : data;

      await writeJSON(buckets, key, dataToSave);

      return json({
        ok: true,
        saved: true,
        season,
        type,
        key,
        wrotePublic: !!buckets.publicBucket,
      });
    }

    return json({ ok: false, error: "Method not allowed." }, 405);
  } catch (e) {
    return json(
      {
        ok: false,
        error: "mini-leagues.js crashed",
        detail: String(e?.message || e),
      },
      500
    );
  }
}
