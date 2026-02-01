// functions/api/admin/biggame.js
// Admin API for BIG GAME (Cloudflare Pages Functions)
//
// NOTE: This endpoint is intentionally *not* auth-gated.
// Your AdminGuard already gates the UI; uploads still use their own auth.
//
// GET  /api/admin/biggame?season=2026
//   -> legacy payload shape: { season, config, rows }
//
// GET  /api/admin/biggame?season=2026&type=page
//   -> { ok:true, type:"page", data:{ season,title,subtitle,intro } }
//
// GET  /api/admin/biggame?season=2026&type=divisions
//   -> { ok:true, type:"divisions", data:{ season, divisions:[...] } }
//
// PUT  /api/admin/biggame?season=2026
//   -> accepts either legacy ({season,config,rows}) or typed payload ({type,data})
//
// Storage (R2):
// - Legacy rows payload: data/biggame/leagues_<season>.json   (this is the canonical key)
// - Page content:        data/biggame/page_<season>.json
// - Optional divisions:  data/biggame/divisions_<season>.json (write-through for newer UIs)

const DEFAULT_SEASON = new Date().getFullYear();

function ensureR2(env) {
  if (!env || !env.BALLSVILLE_R2) throw new Error("BALLSVILLE_R2 binding missing");
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

function normalizeLeagueStatus(s) {
  const raw = asStr(s, "").trim();
  if (!raw) return "TBD";
  const up = raw.toUpperCase();
  if (up === "TBD") return "TBD";
  if (up === "DRAFTING") return "DRAFTING";
  if (up === "FILLING") return "FILLING";
  if (up === "FULL") return "FULL";
  return "TBD";
}

function normalizeDivisionStatus(s) {
  const raw = asStr(s, "").trim();
  if (!raw) return "TBD";
  const up = raw.toUpperCase();
  if (up === "TBD") return "TBD";
  if (up === "DRAFTING") return "DRAFTING";
  if (up === "FULL") return "FULL";
  return "TBD";
}

// Division auto-status rule (your spec):
// - If there is even one league drafting -> DRAFTING
// - If ALL active+ready leagues are FULL -> FULL
// - Else -> TBD
function computeDivisionAutoStatus(division) {
  const leagues = Array.isArray(division?.leagues) ? division.leagues : [];
  const active = leagues.filter((l) => asBool(l?.is_active, true) && !asBool(l?.not_ready, false));
  if (!active.length) return "TBD";
  if (active.some((l) => normalizeLeagueStatus(l?.league_status) === "DRAFTING")) return "DRAFTING";
  const allFull = active.every((l) => normalizeLeagueStatus(l?.league_status) === "FULL");
  return allFull ? "FULL" : "TBD";
}

function normalizeDivision(d, idx) {
  const id = asStr(d?.id || d?.division_id || d?.divisionId || "", "").trim() || crypto.randomUUID();
  const title = asStr(d?.title || d?.division || "Division", "Division");
  const code = asStr(d?.code || d?.division_code || d?.divisionCode || "", "").trim() || `DIV${idx + 1}`;
  const slug = asStr(d?.slug || d?.division_slug || d?.divisionSlug || code, code).trim() || code;
  const order = asNum(d?.order ?? d?.display_order ?? idx + 1, idx + 1);
  const image_key = asStr(d?.image_key || d?.division_image_key || "", "").trim() || null;
  const image_url = asStr(d?.image_url || d?.division_image_url || d?.division_image_path || "", "").trim() || null;
  const auto_status = asBool(d?.auto_status ?? d?.autoStatus, true);
  const status = normalizeDivisionStatus(d?.status ?? d?.division_status ?? "TBD");

  const leagues = (Array.isArray(d?.leagues) ? d.leagues : []).map((l, j) => {
    const lid = asStr(l?.id || l?.league_id || l?.row_id || "", "").trim() || crypto.randomUUID();
    const name = asStr(l?.name || l?.league_name || "League", "League");
    const url = asStr(l?.url || l?.league_url || "", "");

    const sleeper_league_id = asStr(l?.sleeper_league_id || l?.sleeperLeagueId || l?.leagueId || l?.league_id || "", "").trim() || null;
    const sleeper_status = asStr(l?.sleeper_status || l?.sleeperStatus || "", "").trim() || null;
    const sleeper_url = asStr(l?.sleeper_url || l?.sleeperUrl || "", "").trim() || (sleeper_league_id ? `https://sleeper.com/leagues/${sleeper_league_id}` : null);
    const avatar_id = asStr(l?.avatar_id || l?.avatarId || "", "").trim() || null;

    const total_teams = l?.total_teams != null ? asNum(l.total_teams, null) : null;
    const filled_teams = l?.filled_teams != null ? asNum(l.filled_teams, null) : null;
    const open_teams = l?.open_teams != null ? asNum(l.open_teams, null) : null;

    const not_ready = asBool(l?.not_ready, false);
    const is_active = asBool(l?.is_active, true);

    const display_order = asNum(l?.display_order ?? j + 1, j + 1);
    const league_status = normalizeLeagueStatus(l?.league_status || l?.status || "TBD");

    return {
      id: lid,
      display_order,
      league_name: name,
      league_url: url,
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
  });

  return {
    id,
    title,
    code,
    slug,
    order,
    image_key,
    image_url,
    auto_status,
    status: auto_status ? computeDivisionAutoStatus({ leagues }) : status,
    leagues,
  };
}

function rowsToDivisions(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const headers = list.filter((r) => asBool(r?.is_division_header, false));
  const out = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const slug = asStr(h?.division_slug || h?.division_code || h?.division || "", "").trim() || `DIV${i + 1}`;
    const code = asStr(h?.division_code || slug, slug).trim() || slug;
    const title = asStr(h?.division || "Division", "Division");
    const order = asNum(h?.display_order ?? i + 1, i + 1);
    const image_key = asStr(h?.division_image_key || "", "").trim() || null;
    const image_url = asStr(h?.division_image_path || "", "").trim() || null;

    const leagues = list
      .filter((r) => !asBool(r?.is_division_header, false))
      .filter((r) => asStr(r?.division_slug || r?.division_code || "", "").trim() === slug)
      .sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0))
      .map((r, j) => {
        const sleeperId = asStr(r?.sleeper_league_id || r?.leagueId || r?.league_id || "", "").trim() || null;
        return {
          id: asStr(r?.id || r?.row_id || "", "").trim() || crypto.randomUUID(),
          display_order: asNum(r?.display_order ?? j + 1, j + 1),
          league_name: asStr(r?.league_name || "League", "League"),
          league_url: asStr(r?.league_url || "", ""),
          league_status: normalizeLeagueStatus(r?.league_status || r?.status || "TBD"),
          sleeper_league_id: sleeperId,
          sleeper_url: sleeperId ? `https://sleeper.com/leagues/${sleeperId}` : null,
          sleeper_status: asStr(r?.sleeper_status || "", "").trim() || null,
          avatar_id: asStr(r?.avatar_id || "", "").trim() || null,
          total_teams: r?.total_teams != null ? asNum(r.total_teams, null) : null,
          filled_teams: r?.filled_teams != null ? asNum(r.filled_teams, null) : null,
          open_teams: r?.open_teams != null ? asNum(r.open_teams, null) : null,
          not_ready: asBool(r?.not_ready, false),
          is_active: asBool(r?.is_active, true),
        };
      });

    out.push(
      normalizeDivision(
        {
          id: asStr(h?.id || "", "").trim() || crypto.randomUUID(),
          title,
          code,
          slug,
          order,
          image_key,
          image_url,
          auto_status: true,
          leagues,
        },
        i
      )
    );
  }

  if (!out.length) {
    const leagues = list
      .filter((r) => !asBool(r?.is_division_header, false))
      .sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0))
      .map((r, j) => {
        const sleeperId = asStr(r?.sleeper_league_id || r?.leagueId || r?.league_id || "", "").trim() || null;
        return {
          id: asStr(r?.id || r?.row_id || "", "").trim() || crypto.randomUUID(),
          display_order: asNum(r?.display_order ?? j + 1, j + 1),
          league_name: asStr(r?.league_name || "League", "League"),
          league_url: asStr(r?.league_url || "", ""),
          league_status: normalizeLeagueStatus(r?.league_status || r?.status || "TBD"),
          sleeper_league_id: sleeperId,
          sleeper_url: sleeperId ? `https://sleeper.com/leagues/${sleeperId}` : null,
          sleeper_status: asStr(r?.sleeper_status || "", "").trim() || null,
          avatar_id: asStr(r?.avatar_id || "", "").trim() || null,
          total_teams: r?.total_teams != null ? asNum(r.total_teams, null) : null,
          filled_teams: r?.filled_teams != null ? asNum(r.filled_teams, null) : null,
          open_teams: r?.open_teams != null ? asNum(r.open_teams, null) : null,
          not_ready: asBool(r?.not_ready, false),
          is_active: asBool(r?.is_active, true),
        };
      });

    out.push(
      normalizeDivision(
        {
          title: "BIG Game",
          code: "BIG",
          slug: "big",
          order: 1,
          auto_status: true,
          leagues,
        },
        0
      )
    );
  }

  return out;
}

function normalizeDivisionsPayload(raw, season) {
  const p = raw && typeof raw === "object" ? raw : {};

  // New divisions format
  if (Array.isArray(p.divisions)) {
    return { season, divisions: p.divisions.map((d, i) => normalizeDivision(d, i)) };
  }
  // Old row-based format
  if (Array.isArray(p.rows)) {
    return { season, divisions: rowsToDivisions(p.rows) };
  }
  // Some older content stored the divisions array directly
  if (Array.isArray(p)) {
    return { season, divisions: p.map((d, i) => normalizeDivision(d, i)) };
  }

  return { season, divisions: [] };
}

function divisionsToRows(divisions = [], season) {
  const divs = Array.isArray(divisions) ? divisions : [];
  const rows = [];

  // Build header rows first
  for (let i = 0; i < divs.length; i++) {
    const d = normalizeDivision(divs[i], i);
    rows.push({
      year: season,
      id: d.id,
      division: d.title,
      division_code: d.code,
      division_slug: d.slug,
      is_division_header: true,
      division_status: d.status,
      division_image_key: d.image_key,
      division_image_path: d.image_url,
      display_order: d.order,
    });

    const leagues = Array.isArray(d.leagues) ? d.leagues : [];
    for (let j = 0; j < leagues.length; j++) {
      const l = leagues[j];
      rows.push({
        year: season,
        id: l.id,
        division: d.title,
        division_code: d.code,
        division_slug: d.slug,
        is_division_header: false,
        display_order: asNum(l.display_order ?? j + 1, j + 1),
        league_name: asStr(l.league_name || "League", "League"),
        league_url: asStr(l.league_url || "", ""),
        league_status: normalizeLeagueStatus(l.league_status || "TBD"),
        sleeper_league_id: l.sleeper_league_id || null,
        sleeper_url: l.sleeper_url || (l.sleeper_league_id ? `https://sleeper.com/leagues/${l.sleeper_league_id}` : null),
        sleeper_status: l.sleeper_status || null,
        avatar_id: l.avatar_id || null,
        total_teams: l.total_teams ?? null,
        filled_teams: l.filled_teams ?? null,
        open_teams: l.open_teams ?? null,
        not_ready: asBool(l.not_ready, false),
        is_active: asBool(l.is_active, true),
      });
    }
  }

  return rows;
}

function defaultLegacyPayload(season) {
  return {
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
  };
}

function defaultPage(season) {
  return { season, title: "The BIG Game", subtitle: "", intro: "" };
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

// Keep the manifest fresh (same convention as other gamemodes).
// We intentionally keep this no-op if the helper doesn't exist yet.
async function touchManifest(env, section, key, season) {
  // If your project has a manifest system, it typically lives at:
  // data/manifest/<section>_<season>.json or similar.
  // BIG GAME is currently using direct R2 reads in the admin UI,
  // so we don't hard-require a manifest here.
  void env;
  void section;
  void key;
  void season;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    ensureR2(env);
    const url = new URL(request.url);
    const season = asNum(url.searchParams.get("season"), DEFAULT_SEASON);
    const type = asStr(url.searchParams.get("type"), "").toLowerCase();

    const leaguesKey = `data/biggame/leagues_${season}.json`;
    const divisionsKey = `data/biggame/divisions_${season}.json`;
    const pageKey = `data/biggame/page_${season}.json`;

    if (request.method === "GET") {
      if (type === "page") {
        const data = (await readJson(env, pageKey)) || defaultPage(season);
        return json({ ok: true, type: "page", data }, 200);
      }

      if (type === "divisions") {
        const rawLegacy = await readJson(env, leaguesKey);
        const rawDivisions = rawLegacy ? null : await readJson(env, divisionsKey);
        const normalized = normalizeDivisionsPayload(rawLegacy || rawDivisions || {}, season);

        // write-through so both keys exist
        if (!rawDivisions) {
          await writeJson(env, divisionsKey, normalized);
          await touchManifest(env, "biggame", "divisions", season);
        }
        return json({ ok: true, type: "divisions", data: normalized }, 200);
      }

      // Legacy default
      const raw = await readJson(env, leaguesKey);
      if (!raw) return json(defaultLegacyPayload(season), 200);

      // If stored in divisions format, convert to legacy rows
      if (Array.isArray(raw?.divisions) || Array.isArray(raw)) {
        const norm = normalizeDivisionsPayload(raw, season);
        const legacy = defaultLegacyPayload(season);
        legacy.rows = divisionsToRows(norm.divisions, season);
        await writeJson(env, leaguesKey, legacy); // heal the canonical key
        await writeJson(env, divisionsKey, norm);
        return json(legacy, 200);
      }

      // Otherwise assume legacy already
      const seasonNum = asNum(raw?.season, season);
      return json({ ...defaultLegacyPayload(season), ...(raw || {}), season: seasonNum }, 200);
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const bodyType = asStr(body?.type || type, "").toLowerCase();

      if (bodyType === "page") {
        const p = body?.data && typeof body.data === "object" ? body.data : {};
        const data = {
          season,
          title: asStr(p.title, "The BIG Game"),
          subtitle: asStr(p.subtitle, ""),
          intro: asStr(p.intro, ""),
        };
        await writeJson(env, pageKey, data);
        await touchManifest(env, "biggame", "page", season);
        return json({ ok: true }, 200);
      }

      if (bodyType === "divisions") {
        const normalized = normalizeDivisionsPayload(body?.data || body || {}, season);
        // persist divisions key
        await writeJson(env, divisionsKey, normalized);
        // also persist canonical legacy key in row format so existing pages keep working
        const legacy = defaultLegacyPayload(season);
        legacy.rows = divisionsToRows(normalized.divisions, season);
        await writeJson(env, leaguesKey, legacy);
        await touchManifest(env, "biggame", "divisions", season);
        return json({ ok: true }, 200);
      }

      // Legacy PUT (your existing admin UI)
      const legacy = body && typeof body === "object" ? body : {};
      const payload = {
        ...defaultLegacyPayload(season),
        season,
        config: { ...(defaultLegacyPayload(season).config || {}), ...(legacy.config || {}) },
        rows: Array.isArray(legacy.rows) ? legacy.rows : [],
      };

      await writeJson(env, leaguesKey, payload);

      // keep a divisions mirror around for any newer pages
      const divMirror = normalizeDivisionsPayload(payload, season);
      await writeJson(env, divisionsKey, divMirror);
      await touchManifest(env, "biggame", "leagues", season);

      return json({ ok: true }, 200);
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ ok: false, error: err?.message || "Unknown error" }, 500);
  }
}
