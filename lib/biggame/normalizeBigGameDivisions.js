// Normalize BIG GAME data from either legacy "rows" format or the
// newer "divisions" format into the shape used by the public pages.

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

function makeDivisionHeaderRow(div) {
  return {
    is_division_header: true,
    division: asStr(div?.title || div?.division || "Division"),
    division_code: asStr(div?.code || div?.division_code || ""),
    division_slug: asStr(div?.slug || div?.division_slug || div?.code || ""),
    division_status: asStr(div?.status || div?.division_status || "TBD"),
    division_image_key: asStr(div?.image_key || div?.division_image_key || ""),
    division_image_path: asStr(div?.image_url || div?.division_image_path || ""),
  };
}

function makeLeagueRow(lg) {
  return {
    is_division_header: false,
    display_order: asNum(lg?.display_order, 0),
    league_name: asStr(lg?.league_name || lg?.name || "League"),
    league_url: asStr(lg?.league_url || lg?.url || ""),
    league_status: asStr(lg?.league_status || lg?.status || "TBD"),

    sleeper_league_id: asStr(lg?.sleeper_league_id || lg?.sleeperLeagueId || ""),
    sleeper_url: asStr(lg?.sleeper_url || lg?.sleeperUrl || ""),
    sleeper_status: asStr(lg?.sleeper_status || lg?.sleeperStatus || ""),
    avatar_id: asStr(lg?.avatar_id || lg?.avatarId || ""),

    total_teams: lg?.total_teams ?? null,
    filled_teams: lg?.filled_teams ?? null,
    open_teams: lg?.open_teams ?? null,

    not_ready: asBool(lg?.not_ready, false),
    is_active: asBool(lg?.is_active, true),
  };
}

function fromLegacyRows(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const out = [];
  const bySlug = new Map();

  for (const r of rows) {
    if (r?.is_division_header) {
      const slug = asStr(r?.division_slug || r?.division_code || "").trim();
      if (!slug) continue;
      const div = {
        division_slug: slug,
        division: asStr(r?.division || "Division"),
        division_code: asStr(r?.division_code || ""),
        division_status: asStr(r?.division_status || "TBD"),
        division_image_key: asStr(r?.division_image_key || ""),
        division_image_path: asStr(r?.division_image_path || ""),
        rows: [r],
      };
      out.push(div);
      bySlug.set(slug, div);
      continue;
    }

    const slug = asStr(r?.division_slug || r?.division_code || "").trim();
    if (!slug) continue;
    if (!bySlug.has(slug)) {
      const header = {
        is_division_header: true,
        division_slug: slug,
        division_code: slug,
        division: "Division",
        division_status: "TBD",
        division_image_key: "",
        division_image_path: "",
      };
      const div = {
        division_slug: slug,
        division: "Division",
        division_code: slug,
        division_status: "TBD",
        division_image_key: "",
        division_image_path: "",
        rows: [header],
      };
      out.push(div);
      bySlug.set(slug, div);
    }
    bySlug.get(slug).rows.push(r);
  }

  return out;
}

function fromDivisions(payload) {
  const divs = Array.isArray(payload?.divisions) ? payload.divisions : [];
  return divs
    .map((d) => {
      const header = makeDivisionHeaderRow(d);
      const leagues = Array.isArray(d?.leagues) ? d.leagues : [];
      const rows = [header, ...leagues.map(makeLeagueRow)];
      return {
        division_slug: header.division_slug,
        division: header.division,
        division_code: header.division_code,
        division_status: header.division_status,
        division_image_key: header.division_image_key,
        division_image_path: header.division_image_path,
        rows,
      };
    })
    .filter((d) => d.division_slug);
}

export function normalizeBigGameDivisions(payload) {
  // Newer format: { divisions: [...] }
  if (payload && typeof payload === "object" && Array.isArray(payload.divisions)) {
    return fromDivisions(payload);
  }

  // Legacy format: { rows: [...] }
  if (payload && typeof payload === "object" && Array.isArray(payload.rows)) {
    return fromLegacyRows(payload);
  }

  return [];
}
