// functions/api/admin/biggame.js
// Admin API for BIG GAME
// GET  /api/admin/biggame?season=2026
// PUT  /api/admin/biggame?season=2026  { season, config?, rows[] }
//
// Storage (R2):
// - data/biggame/leagues_<season>.json
//
// Compatibility:
// - Primary persisted shape remains { season, config, rows } (row-based, like original Big Game).
// - If an older/new-schema { season, divisions } file exists, we convert it to rows on read.

const DEFAULT_SEASON = new Date().getFullYear();

function asStr(v, fallback = "") {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}
function asNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function asBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function ensureR2(env) {
  // Keep consistent with your other admin endpoints.
  if (!env || !env.BALLSVILLE_R2) {
    throw new Error("Missing BALLSVILLE_R2 binding");
  }
}

async function requireAdmin(context) {
  // Keep consistent with your other admin endpoints.
  // Uses Supabase JWT cookie via NEXT_PUBLIC_SUPABASE_URL/ANON_KEY in edge, and ADMIN_EMAIL allowlist.
  // If you already have a shared helper, you can replace this with that implementation.

  const { request, env } = context;
  const admins = (env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // If no allowlist is configured, deny.
  if (!admins.length) throw new Error("Admin list not configured");

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) throw new Error("Supabase env not configured");

  // Grab the access token from cookies. Your AdminGuard logs in via Supabase client, which sets sb-* cookies.
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/sb-([^=]+)-auth-token=([^;]+)/);
  if (!m) throw new Error("Not authenticated");

  // Cookie value is URL encoded JSON array [access_token, refresh_token] for supabase-js v2.
  let accessToken = null;
  try {
    const decoded = decodeURIComponent(m[2]);
    const arr = JSON.parse(decoded);
    accessToken = Array.isArray(arr) ? arr[0] : null;
  } catch {
    accessToken = null;
  }
  if (!accessToken) throw new Error("Not authenticated");

  // Validate token and get user.
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error("Not authenticated");
  const user = await res.json();
  const email = (user?.email || "").toLowerCase();
  if (!email || !admins.includes(email)) throw new Error("Not authorized");

  return user;
}

async function readJson(env, key) {
  const obj = await env.BALLSVILLE_R2.get(key);
  if (!obj) return null;
  try {
    return await obj.json();
  } catch {
    return null;
  }
}

async function writeJson(env, key, data) {
  await env.BALLSVILLE_R2.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function touchManifest(env, game, section, season) {
  // Match pattern used in your other endpoints (best effort).
  // If manifest logic differs in your repo, you can safely remove this.
  try {
    const k = `data/manifest/${game}_${section}_${season}.json`;
    await env.BALLSVILLE_R2.put(k, JSON.stringify({ t: Date.now() }), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  } catch {
    // ignore
  }
}

function normalizeSleeperStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "pre_draft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "inseason") return "in_season";
  if (s === "complete") return "complete";
  return s || null;
}

function normalizeRow(r, idx, season) {
  const year = asNum(r?.year ?? season, season);

  const id = asStr(r?.id || r?.row_id || "", "").trim() || crypto.randomUUID();

  const division = asStr(r?.division || "", "");
  const division_code = asStr(r?.division_code || "", "");
  const division_slug = asStr(r?.division_slug || division_code || "", "");
  const is_division_header = asBool(r?.is_division_header, false);
  const division_status = asStr(r?.division_status || r?.status || "TBD").trim() || "TBD";
  const division_image_key = asStr(r?.division_image_key || "", "");
  const division_image_path = asStr(r?.division_image_path || "", "");

  const display_order = asNum(r?.display_order, idx + 1);
  const league_name = asStr(r?.league_name || "", "");
  const league_url = asStr(r?.league_url || "", "");
  const league_status = asStr(r?.league_status || r?.status || "TBD").trim() || "TBD";

  const sleeper_league_id = asStr(r?.sleeper_league_id || r?.leagueId || r?.league_id || "", "").trim() || null;
  const sleeper_status = normalizeSleeperStatus(r?.sleeper_status || r?.sleeperStatus || null);
  const avatar_id = asStr(r?.avatar_id || r?.avatarId || "", "").trim() || null;
  const sleeper_url =
    asStr(r?.sleeper_url || r?.sleeperUrl || "", "").trim() ||
    (sleeper_league_id ? `https://sleeper.com/leagues/${sleeper_league_id}` : null);

  const total_teams = r?.total_teams != null ? asNum(r.total_teams, null) : null;
  const filled_teams = r?.filled_teams != null ? asNum(r.filled_teams, null) : null;
  const open_teams = r?.open_teams != null ? asNum(r.open_teams, null) : null;

  const not_ready = asBool(r?.not_ready, false);
  const is_active = asBool(r?.is_active, true);

  return {
    year,
    id,
    division,
    division_code,
    division_slug,
    is_division_header,
    division_status,
    division_image_key,
    division_image_path,

    display_order,

    league_name,
    league_url,
    league_status,

    sleeper_league_id,
    sleeper_url,
    sleeper_status,
    avatar_id,

    total_teams,
    filled_teams,
    open_teams,

    not_ready,
    is_active,
  };
}

function divisionsToRows(divisions, season) {
  const divs = Array.isArray(divisions) ? divisions : [];
  const rows = [];

  for (let i = 0; i < divs.length; i++) {
    const d = divs[i] || {};
    const slug = asStr(d.slug || d.division_slug || d.code || d.division_code || "", "").trim() || `DIV${i + 1}`;
    const code = asStr(d.code || d.division_code || slug, slug).trim() || slug;
    const name = asStr(d.title || d.division || "Division", "Division");

    rows.push(
      normalizeRow(
        {
          year: season,
          id: d.id,
          division: name,
          division_code: code,
          division_slug: slug,
          is_division_header: true,
          division_status: asStr(d.status || d.division_status || "TBD", "TBD"),
          division_image_key: d.image_key || d.division_image_key || "",
          division_image_path: d.image_url || d.division_image_path || "",
          display_order: asNum(d.order ?? i + 1, i + 1),
        },
        rows.length,
        season
      )
    );

    const leagues = Array.isArray(d.leagues) ? d.leagues : [];
    leagues
      .slice()
      .sort((a, b) => asNum(a.display_order, 0) - asNum(b.display_order, 0))
      .forEach((l, j) => {
        rows.push(
          normalizeRow(
            {
              year: season,
              id: l.id,
              division: name,
              division_code: code,
              division_slug: slug,
              is_division_header: false,
              display_order: asNum(l.display_order ?? j + 1, j + 1),
              league_name: l.league_name || l.name,
              league_url: l.league_url || l.url,
              league_status: l.league_status || l.status,
              sleeper_league_id: l.sleeper_league_id,
              sleeper_status: l.sleeper_status,
              sleeper_url: l.sleeper_url,
              avatar_id: l.avatar_id,
              total_teams: l.total_teams,
              filled_teams: l.filled_teams,
              open_teams: l.open_teams,
              not_ready: l.not_ready,
              is_active: l.is_active,
            },
            rows.length,
            season
          )
        );
      });
  }

  return rows;
}

function normalizePayload(payload, season) {
  const p = payload && typeof payload === "object" ? payload : {};

  // If someone saved the divisions schema, convert back to rows so old admin/public keeps working.
  if (Array.isArray(p.divisions) && !Array.isArray(p.rows)) {
    const rows = divisionsToRows(p.divisions, season);
    const normalizedRows = rows.map((r, idx) => normalizeRow(r, idx, season)).filter((r) => Number(r.year) === Number(season));
    return {
      season: Number(season),
      config: {
        heroSeason: Number(season),
        pageTitle: "The BIG Game",
        subtitle: "",
        intro: "",
        ctaText: "",
        ctaUrl: "",
      },
      rows: normalizedRows,
    };
  }

  const rows = Array.isArray(p.rows) ? p.rows : [];
  const normalizedRows = rows
    .map((r, idx) => normalizeRow(r, idx, season))
    .filter((r) => Number(r.year) === Number(season));

  const config = p.config && typeof p.config === "object" ? p.config : {};

  return {
    season: Number(season),
    config: {
      heroSeason: asNum(config.heroSeason, Number(season)),
      pageTitle: asStr(config.pageTitle, "The BIG Game"),
      subtitle: asStr(config.subtitle, ""),
      intro: asStr(config.intro, ""),
      ctaText: asStr(config.ctaText, ""),
      ctaUrl: asStr(config.ctaUrl, ""),
    },
    rows: normalizedRows,
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    await requireAdmin(context);
    ensureR2(env);

    const url = new URL(request.url);
    const season = asNum(url.searchParams.get("season"), DEFAULT_SEASON);
    const key = `data/biggame/leagues_${season}.json`;

    if (request.method === "GET") {
      const data = await readJson(env, key);
      if (!data) {
        return json(
          {
            season,
            config: {
              heroSeason: season,
              pageTitle: "The BIG Game",
              subtitle: "",
              intro: "",
              ctaText: "",
              ctaUrl: "",
            },
            rows: [],
          },
          200
        );
      }
      return json(normalizePayload(data, season), 200);
    }

    if (request.method === "PUT") {
      const raw = await request.json();
      const data = normalizePayload(raw, season);
      await writeJson(env, key, data);
      await touchManifest(env, "biggame", "leagues", season);
      return json({ ok: true, season }, 200);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: err?.message || "Unknown error" }, 500);
  }
}
