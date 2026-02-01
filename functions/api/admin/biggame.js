import { ensureR2, json, readJson, touchManifest, writeJson } from "@/lib/api/r2";
import { requireAdmin } from "@/lib/api/auth";

// Admin API for BIG GAME
// GET  /api/admin/biggame?season=2026&type=divisions|page
// PUT  /api/admin/biggame?season=2026  { type, data }
//
// Storage (R2):
// - Divisions (primary, legacy-compatible): data/biggame/leagues_<season>.json
// - Divisions (older new-schema attempt):    data/biggame/divisions_<season>.json
// - Page config:                            data/biggame/page_<season>.json

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

    const sleeper_league_id = asStr(l?.sleeper_league_id || l?.sleeperLeagueId || l?.leagueId || "", "").trim() || null;
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

  const next = {
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

  return next;
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
    const auto_status = true;

    const leagues = list
      .filter((r) => !asBool(r?.is_division_header, false))
      .filter((r) => asStr(r?.division_slug || r?.division_code || "", "").trim() === slug)
      .sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0))
      .map((r, j) => {
        const sleeperId = asStr(r?.sleeper_league_id || "", "").trim() || null;
        return {
          id: asStr(r?.id || r?.row_id || "", "").trim() || crypto.randomUUID(),
          display_order: asNum(r?.display_order ?? j + 1, j + 1),
          league_name: asStr(r?.league_name || "League", "League"),
          league_url: asStr(r?.league_url || "", ""),
          league_status: normalizeLeagueStatus(r?.league_status || "TBD"),
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
          auto_status,
          leagues,
        },
        i
      )
    );
  }

  // If no headers exist, try to infer a single division from all league rows.
  if (!out.length) {
    const leagues = list
      .filter((r) => !asBool(r?.is_division_header, false))
      .sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0))
      .map((r, j) => {
        const sleeperId = asStr(r?.sleeper_league_id || "", "").trim() || null;
        return {
          id: asStr(r?.id || r?.row_id || "", "").trim() || crypto.randomUUID(),
          display_order: asNum(r?.display_order ?? j + 1, j + 1),
          league_name: asStr(r?.league_name || "League", "League"),
          league_url: asStr(r?.league_url || "", ""),
          league_status: normalizeLeagueStatus(r?.league_status || "TBD"),
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
  // New format
  if (Array.isArray(p.divisions)) {
    const divisions = p.divisions.map((d, i) => normalizeDivision(d, i));
    return { season, divisions };
  }
  // Old row-based format (existing Big Game admin/public)
  if (Array.isArray(p.rows)) {
    const divisions = rowsToDivisions(p.rows);
    return { season, divisions };
  }
  return { season, divisions: [] };
}

function defaultPage(season) {
  return {
    season,
    title: "The BIG Game",
    subtitle: "",
    intro: "",
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  await requireAdmin(context);
  ensureR2(env);

  const url = new URL(request.url);
  const season = asNum(url.searchParams.get("season"), DEFAULT_SEASON);
  const type = asStr(url.searchParams.get("type"), "divisions").toLowerCase();

  const divisionsKeyPrimary = `data/biggame/leagues_${season}.json`;
  const divisionsKeyFallback = `data/biggame/divisions_${season}.json`;
  const pageKey = `data/biggame/page_${season}.json`;

  if (request.method === "GET") {
    if (type === "page") {
      const data = (await readJson(env, pageKey)) || defaultPage(season);
      return json({ ok: true, type: "page", data }, 200);
    }

    // Divisions
    const rawPrimary = await readJson(env, divisionsKeyPrimary);
    const rawFallback = rawPrimary ? null : await readJson(env, divisionsKeyFallback);
    const normalized = normalizeDivisionsPayload(rawPrimary || rawFallback || {}, season);

    // If we had to read fallback, write-through to primary so public + admin stay in sync.
    if (!rawPrimary && rawFallback) {
      await writeJson(env, divisionsKeyPrimary, normalized);
      await touchManifest(env, "biggame", "divisions", season);
    }

    return json({ ok: true, type: "divisions", data: normalized }, 200);
  }

  if (request.method === "PUT") {
    const body = await request.json().catch(() => ({}));
    const bodyType = asStr(body?.type, type).toLowerCase();

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

    const normalized = normalizeDivisionsPayload(body?.data || body || {}, season);
    await writeJson(env, divisionsKeyPrimary, normalized);
    // Also maintain the "divisions_" key for any older code paths.
    await writeJson(env, divisionsKeyFallback, normalized);
    await touchManifest(env, "biggame", "divisions", season);
    return json({ ok: true }, 200);
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
}
