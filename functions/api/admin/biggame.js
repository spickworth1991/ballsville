// functions/api/admin/biggame.js
// BIG GAME admin API (Cloudflare Pages Functions)
//
// NOTE:
// - This endpoint intentionally does NOT enforce auth.
//   The /admin UI is already gated; this API just reads/writes R2 JSON.
// - We keep BOTH schemas in sync:
//    1) NEW: data/biggame/divisions_<season>.json   (admin UI)
//    2) LEGACY: data/biggame/leagues_<season>.json  (public page expects rows[])

import { CURRENT_SEASON } from "@/lib/season";

const DEFAULT_SEASON = CURRENT_SEASON;

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

function computeDivisionAutoStatus(div) {
  const leagues = Array.isArray(div?.leagues) ? div.leagues : [];
  const active = leagues.filter((l) => asBool(l?.is_active, true) && !asBool(l?.not_ready, false));
  if (!active.length) return "TBD";
  if (active.some((l) => normalizeLeagueStatus(l?.league_status) === "DRAFTING")) return "DRAFTING";
  const allFull = active.every((l) => normalizeLeagueStatus(l?.league_status) === "FULL");
  return allFull ? "FULL" : "TBD";
}

function normalizeLeague(l, idx = 0) {
  const sleeperId = asStr(l?.sleeper_league_id || "", "").trim() || null;
  return {
    id: asStr(l?.id || "", "").trim() || crypto.randomUUID(),
    display_order: asNum(l?.display_order ?? idx + 1, idx + 1),
    league_name: asStr(l?.league_name || l?.name || "League", "League"),
    league_url: asStr(l?.league_url || l?.url || "", ""),
    league_status: normalizeLeagueStatus(l?.league_status || l?.status || "TBD"),

    sleeper_league_id: sleeperId,
    sleeper_url:
      asStr(l?.sleeper_url || "", "").trim() || (sleeperId ? `https://sleeper.com/leagues/${sleeperId}` : null),
    sleeper_status: asStr(l?.sleeper_status || "", "").trim() || null,
    avatar_id: asStr(l?.avatar_id || "", "").trim() || null,

    // Optional cached league avatar stored in R2 (preferred for public pages)
    league_image_key: asStr(l?.league_image_key || "", "").trim() || null,
    league_image_path: asStr(l?.league_image_path || "", "").trim() || null,

    total_teams: l?.total_teams != null ? asNum(l.total_teams, null) : null,
    filled_teams: l?.filled_teams != null ? asNum(l.filled_teams, null) : null,
    open_teams: l?.open_teams != null ? asNum(l.open_teams, null) : null,

    not_ready: asBool(l?.not_ready, false),
    is_active: asBool(l?.is_active, true),
  };
}

function normalizeDivision(d, idx = 0) {
  const division_id = asStr(d?.division_id || d?.id || "", "").trim() || crypto.randomUUID();
  const division_code = asStr(d?.division_code || d?.code || `DIV${idx + 1}`, `DIV${idx + 1}`).trim() || `DIV${idx + 1}`;
  const division_slug = asStr(d?.division_slug || d?.slug || division_code, division_code).trim() || division_code;
  const division = asStr(d?.division || d?.title || "Division", "Division");
  const display_order = asNum(d?.display_order ?? d?.order ?? idx + 1, idx + 1);

  const modeRaw = asStr(d?.division_status_mode || d?.status_mode || "AUTO", "AUTO").toUpperCase();
  const division_status_mode = modeRaw === "MANUAL" ? "MANUAL" : "AUTO";
  const manualStatus = normalizeDivisionStatus(d?.division_status || d?.status || "TBD");

  const leaguesIn = Array.isArray(d?.leagues) ? d.leagues : [];
  const leagues = leaguesIn.map((l, j) => normalizeLeague(l, j));

  const autoStatus = computeDivisionAutoStatus({ leagues });
  const division_status = division_status_mode === "AUTO" ? autoStatus : manualStatus;

  return {
    division_id,
    division_code,
    division_slug,
    division,
    division_status_mode,
    division_status,
    division_image_key: asStr(d?.division_image_key || d?.image_key || "", "").trim() || null,
    division_image_path: asStr(d?.division_image_path || d?.image_url || "", "").trim() || null,
    display_order,
    leagues,
  };
}

function normalizeDivisionsPayload(raw, season) {
  const p = raw && typeof raw === "object" ? raw : {};

  // Preferred admin format
  if (Array.isArray(p.divisions)) {
    const divisions = p.divisions.map((d, i) => normalizeDivision(d, i));
    return { season, divisions };
  }

  // Legacy BigGame format used by public page
  if (Array.isArray(p.rows)) {
    const divisions = rowsToDivisions(p.rows);
    return { season, divisions };
  }

  return { season, divisions: [] };
}

function rowsToDivisions(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const headers = list.filter((r) => asBool(r?.is_division_header, false));
  const out = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const division_slug = asStr(h?.division_slug || h?.division_code || "", "").trim() || `DIV${i + 1}`;
    const division_code = asStr(h?.division_code || division_slug, division_slug).trim() || division_slug;
    const division = asStr(h?.division || "Division", "Division");
    const display_order = asNum(h?.display_order ?? i + 1, i + 1);

    const leagues = list
      .filter((r) => !asBool(r?.is_division_header, false))
      .filter((r) => asStr(r?.division_slug || r?.division_code || "", "").trim() === division_slug)
      .sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0))
      .map((r, j) =>
        normalizeLeague(
          {
            id: r?.id || r?.row_id,
            display_order: r?.display_order,
            league_name: r?.league_name,
            league_url: r?.league_url,
            league_status: r?.league_status,
            sleeper_league_id: r?.sleeper_league_id,
            sleeper_status: r?.sleeper_status,
            avatar_id: r?.avatar_id,
            league_image_key: r?.league_image_key,
            league_image_path: r?.league_image_path,
            total_teams: r?.total_teams,
            filled_teams: r?.filled_teams,
            open_teams: r?.open_teams,
            not_ready: r?.not_ready,
            is_active: r?.is_active,
          },
          j
        )
      );

    out.push(
      normalizeDivision(
        {
          division_id: asStr(h?.id || h?.division_id || "", "").trim() || crypto.randomUUID(),
          division_code,
          division_slug,
          division,
          division_status_mode: "AUTO",
          division_image_key: asStr(h?.division_image_key || "", "").trim() || null,
          division_image_path: asStr(h?.division_image_path || "", "").trim() || null,
          display_order,
          leagues,
        },
        i
      )
    );
  }

  // If there are no headers, infer a single division from all rows.
  if (!out.length) {
    const leagues = list
      .filter((r) => !asBool(r?.is_division_header, false))
      .sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0))
      .map((r, j) =>
        normalizeLeague(
          {
            id: r?.id || r?.row_id,
            display_order: r?.display_order,
            league_name: r?.league_name,
            league_url: r?.league_url,
            league_status: r?.league_status,
            sleeper_league_id: r?.sleeper_league_id,
            sleeper_status: r?.sleeper_status,
            avatar_id: r?.avatar_id,
            league_image_key: r?.league_image_key,
            league_image_path: r?.league_image_path,
            total_teams: r?.total_teams,
            filled_teams: r?.filled_teams,
            open_teams: r?.open_teams,
            not_ready: r?.not_ready,
            is_active: r?.is_active,
          },
          j
        )
      );

    out.push(
      normalizeDivision(
        {
          division: "BIG Game",
          division_code: "BIG",
          division_slug: "big",
          display_order: 1,
          division_status_mode: "AUTO",
          leagues,
        },
        0
      )
    );
  }

  return out;
}

function divisionsToRows(divisions = []) {
  const list = Array.isArray(divisions) ? divisions : [];
  const rows = [];

  const sortedDivs = [...list].sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0));

  for (let i = 0; i < sortedDivs.length; i++) {
    const d = sortedDivs[i];
    const division_slug = asStr(d?.division_slug || d?.division_code || "", "").trim() || `DIV${i + 1}`;
    const division_code = asStr(d?.division_code || division_slug, division_slug).trim() || division_slug;

    // Header row
    rows.push({
      id: asStr(d?.division_id || "", "").trim() || crypto.randomUUID(),
      is_division_header: true,
      division: asStr(d?.division || "Division", "Division"),
      division_code,
      division_slug,
      division_image_key: asStr(d?.division_image_key || "", "").trim() || null,
      division_image_path: asStr(d?.division_image_path || "", "").trim() || null,
      display_order: asNum(d?.display_order ?? i + 1, i + 1),
    });

    const leagues = Array.isArray(d?.leagues) ? d.leagues : [];
    const sortedLeagues = [...leagues].sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0));

    for (let j = 0; j < sortedLeagues.length; j++) {
      const l = sortedLeagues[j];
      rows.push({
        id: asStr(l?.id || "", "").trim() || crypto.randomUUID(),
        is_division_header: false,
        division_code,
        division_slug,
        league_name: asStr(l?.league_name || "League", "League"),
        league_url: asStr(l?.league_url || "", ""),
        league_status: normalizeLeagueStatus(l?.league_status || "TBD"),
        sleeper_league_id: asStr(l?.sleeper_league_id || "", "").trim() || null,
        sleeper_status: asStr(l?.sleeper_status || "", "").trim() || null,
        avatar_id: asStr(l?.avatar_id || "", "").trim() || null,
        league_image_key: asStr(l?.league_image_key || "", "").trim() || null,
        league_image_path: asStr(l?.league_image_path || "", "").trim() || null,
        total_teams: l?.total_teams != null ? asNum(l.total_teams, null) : null,
        filled_teams: l?.filled_teams != null ? asNum(l.filled_teams, null) : null,
        open_teams: l?.open_teams != null ? asNum(l.open_teams, null) : null,
        not_ready: asBool(l?.not_ready, false),
        is_active: asBool(l?.is_active, true),
        display_order: asNum(l?.display_order ?? j + 1, j + 1),
      });
    }
  }

  return rows;
}

function defaultPage(season) {
  return {
    season,
    title: "The BIG Game",
    subtitle: "",
    intro: "",
  };
}

function ensureR2(env) {
  // Match the other admin APIs (dynasty/redraft/etc.)
  if (!env || !env.ADMIN_BUCKET || typeof env.ADMIN_BUCKET.get !== "function") {
    throw new Error("Missing R2 binding 'ADMIN_BUCKET'");
  }
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

async function readJson(env, key) {
  const obj = await env.ADMIN_BUCKET.get(key);
  if (!obj) return null;
  const text = await obj.text();
  return JSON.parse(text);
}

async function writeJson(env, key, data) {
  await env.ADMIN_BUCKET.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function touchManifest(env, season) {
  const key = `data/manifests/biggame_${season}.json`;
  await writeJson(env, key, { updatedAt: Date.now() });
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    ensureR2(env);

    const url = new URL(request.url);
    const season = asNum(url.searchParams.get("season"), DEFAULT_SEASON);
    const type = asStr(url.searchParams.get("type"), "divisions").toLowerCase();

    const legacyKey = `data/biggame/leagues_${season}.json`;
    const divisionsKey = `data/biggame/divisions_${season}.json`;
    const pageKey = `data/biggame/page_${season}.json`;

    if (request.method === "GET") {
      if (type === "page") {
        const page = (await readJson(env, pageKey)) || defaultPage(season);
        return json({ ok: true, type: "page", data: page }, 200);
      }

      // divisions
      const rawDiv = await readJson(env, divisionsKey);
      if (rawDiv && Array.isArray(rawDiv.divisions)) {
        const data = normalizeDivisionsPayload(rawDiv, season);
        return json({ ok: true, type: "divisions", data }, 200);
      }

      // Fallback: legacy rows
      const rawLegacy = await readJson(env, legacyKey);
      const data = normalizeDivisionsPayload(rawLegacy || {}, season);

      // Write-through divisions so admin stays consistent going forward.
      if (rawLegacy && data.divisions.length) {
        await writeJson(env, divisionsKey, { ...data, updatedAt: Date.now() });
        await touchManifest(env, season);
      }

      return json({ ok: true, type: "divisions", data }, 200);
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const bodyType = asStr(body?.type, type).toLowerCase();

      if (bodyType === "page") {
        const p = body?.data && typeof body.data === "object" ? body.data : {};
        const page = {
          season,
          title: asStr(p.title, "The BIG Game"),
          subtitle: asStr(p.subtitle, ""),
          intro: asStr(p.intro, ""),
        };
        await writeJson(env, pageKey, { ...page, updatedAt: Date.now() });
        await touchManifest(env, season);
        return json({ ok: true }, 200);
      }

      // divisions
      const data = normalizeDivisionsPayload(body?.data || body || {}, season);

      // NEW schema for admin UI
      await writeJson(env, divisionsKey, { ...data, updatedAt: Date.now() });

      // LEGACY schema for public page
      const rows = divisionsToRows(data.divisions);
      await writeJson(env, legacyKey, { season, rows, updatedAt: Date.now() });

      await touchManifest(env, season);
      return json({ ok: true }, 200);
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}
