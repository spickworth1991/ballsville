// functions/api/admin/redraft.js
//
// GET  /api/admin/redraft?season=2025&type=page|leagues
// PUT  /api/admin/redraft?season=2025   { type, data }
//
// R2 keys:
// - content/redraft/page_<season>.json
// - data/redraft/leagues_<season>.json

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
  const key = season ? `data/manifests/redraft_${season}.json` : `data/manifests/redraft.json`;
  const body = JSON.stringify(
    { section: "redraft", season: season || null, updatedAt: new Date().toISOString() },
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
    headers: { apikey: supabaseAnon, authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { ok: false, status: 401, error: "Invalid session token." };

  const user = await res.json();
  const email = String(user?.email || "").toLowerCase();
  if (!admins.includes(email)) return { ok: false, status: 403, error: "Not an admin." };

  return { ok: true };
}

function r2KeyFor(type, season) {
  if (type === "page") return `content/redraft/page_${season}.json`;
  if (type === "leagues") return `data/redraft/leagues_${season}.json`;
  return "";
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

function sanitizeLeaguesInput(data, season) {
  const leaguesRaw = Array.isArray(data?.leagues) ? data.leagues : Array.isArray(data) ? data : [];

  // New status model (Sleeper-driven): predraft | drafting | inseason | complete
  // Legacy/admin model: tbd | filling | full
  // We normalize everything into: tbd | predraft | drafting | inseason | complete
  function normalizeStatus(raw) {
    const s = String(raw || "").toLowerCase().trim();
    if (s === "predraft" || s === "pre_draft" || s === "pre-draft") return "predraft";
    if (s === "drafting") return "drafting";
    if (s === "inseason" || s === "in_season" || s === "in-season") return "inseason";
    if (s === "complete") return "complete";
    // legacy mappings
    if (s === "filling") return "predraft";
    if (s === "full") return "predraft";
    if (s === "tbd") return "tbd";
    return "tbd";
  }

  const leagues = leaguesRaw.map((l, idx) => ({
    // Sleeper-backed fields (kept if present)
    leagueId: typeof l?.leagueId === "string" ? l.leagueId : "",
    sleeperUrl: typeof l?.sleeperUrl === "string" ? l.sleeperUrl : "",
    avatarId: typeof l?.avatarId === "string" ? l.avatarId : "",

    // Admin-controlled / display fields
    name: typeof l?.name === "string" ? l.name : `League ${idx + 1}`,
    url: typeof l?.url === "string" ? l.url : "", // invite link (manual)
    notReady: Boolean(l?.notReady),
    status: Boolean(l?.notReady) ? "tbd" : normalizeStatus(l?.status),
    active: l?.active !== false,
    order: Number.isFinite(Number(l?.order)) ? Number(l.order) : idx + 1,
    imageKey: typeof l?.imageKey === "string" ? l.imageKey : "",
    imageUrl: typeof l?.imageUrl === "string" ? l.imageUrl : "",
  }));

  // keep order stable
  leagues.sort((a, b) => a.order - b.order);

  // Normalize order to 1..N (avoids weird gaps/duplicates breaking the UI sort).
  for (let i = 0; i < leagues.length; i++) {
    leagues[i].order = i + 1;
  }

  return { season: Number(season || DEFAULT_SEASON), leagues };
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
      if (putType === "page") payload = sanitizePageInput(data, season);
      else if (putType === "leagues") payload = sanitizeLeaguesInput(data, season);
      else return json({ ok: false, error: "Invalid type" }, 400);

      await r2.bucket.put(key, JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });
    await touchManifest(context.env, season);

      return json({ ok: true, key });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: "redraft.js crashed", detail: String(e?.message || e) }, 500);
  }
}
