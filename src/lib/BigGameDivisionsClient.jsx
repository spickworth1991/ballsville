"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const DEFAULT_SEASON = 2025;
const R2_KEY_FOR = (season) => `data/biggame/leagues_${season}.json`;

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function slugify(input) {
  return safeStr(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeRow(r, idx = 0) {
  const year = safeNum(r?.year, DEFAULT_SEASON);
  const division_name = safeStr(r?.division_name || r?.theme_name || "Division").trim();
  const division_slug = safeStr(r?.division_slug || slugify(division_name));

  // R2-admin schema:
  // - header rows: is_division_header=true, division_* fields, division_status
  // - league rows: is_division_header=false, league_* fields, league_status
  // Legacy/supabase rows may still provide generic `status` and `name/url`.
  const is_division_header = !!r?.is_division_header || !!r?.is_division_header;
  const division_status = safeStr(r?.division_status || r?.status || "TBD").trim() || "TBD";
  const league_status = safeStr(r?.league_status || r?.status || "TBD").trim() || "TBD";

  return {
    id: safeStr(r?.id || `${year}_${division_slug}_${idx}`),
    year,
    division_name,
    division_slug,
    is_division_header,
    division_status,
    league_status,
    theme: safeStr(r?.theme || ""),
    is_active: r?.is_active !== false,

    // images
    division_image_key: safeStr(r?.division_image_key || ""),
    division_image_path: safeStr(r?.division_image_path || r?.division_image_url || ""),
    league_image_key: safeStr(r?.league_image_key || ""),
    league_image_path: safeStr(r?.league_image_path || r?.league_image_url || ""),

    // league
    name: safeStr(r?.league_name || r?.name || "").trim(),
    sleeper_url: safeStr(r?.league_url || r?.sleeper_url || r?.url || "").trim(),
    display_order: safeNum(r?.display_order, idx + 1),
    fill_note: safeStr(r?.fill_note || "").trim(),
  };
}

function r2ImgSrc(key, fallbackUrl) {
  if (key) return `/r2/${key}?v=${encodeURIComponent(key)}`;
  return fallbackUrl || "";
}

function transformDivisions(rows, season) {
  const divisionsMap = new Map();

  for (const row of rows) {
    if (!row || row.is_active === false) continue;
    if (Number(row.year) !== Number(season)) continue;

    const divKey = row.division_slug || slugify(row.division_name) || "division";

    if (!divisionsMap.has(divKey)) {
      divisionsMap.set(divKey, {
        id: divKey,
        division_slug: divKey,
        division_name: row.division_name,
        status: row.division_status || "TBD",
        division_image: r2ImgSrc(row.division_image_key, row.division_image_path),
        leagues: [],
      });
    }

    const div = divisionsMap.get(divKey);

    // Prefer header row as the source of division meta
    if (row.is_division_header) {
      div.division_name = row.division_name || div.division_name;
      div.status = row.division_status || div.status || "TBD";
      div.division_image = r2ImgSrc(row.division_image_key, row.division_image_path) || div.division_image;
      continue;
    }

    div.leagues.push({
      name: safeStr(row.name).trim(),
      sleeper_url: safeStr(row.sleeper_url).trim(),
      status: safeStr(row.league_status || row.division_status || "TBD").trim(),
      display_order: safeNum(row.display_order, null),
      spots_available: safeNum(row.spots_available, null),
      fill_note: safeStr(row.fill_note).trim(),
      league_image: r2ImgSrc(row.league_image_key, row.league_image_path),
    });
  }

  const divisions = Array.from(divisionsMap.values());
  for (const d of divisions) {
    d.leagues.sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
  }

  divisions.sort((a, b) => {
    const ao = a.division_order;
    const bo = b.division_order;
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    if (Number.isFinite(ao) && !Number.isFinite(bo)) return -1;
    if (!Number.isFinite(ao) && Number.isFinite(bo)) return 1;
    return safeStr(a.division_name).localeCompare(safeStr(b.division_name));
  });
  return divisions;
}

export default function BigGameDivisionsClient({ year = DEFAULT_SEASON }) {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const season = useMemo(() => Number(year) || DEFAULT_SEASON, [year]);
  const bust = useMemo(() => `v=${Date.now()}` , []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/r2/${R2_KEY_FOR(season)}?${bust}`, { cache: "no-store" });
        if (!res.ok) {
          if (!alive) return;
          setDivisions([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        const normalized = list.map(normalizeRow);
        const divs = transformDivisions(normalized, season);
        if (!alive) return;
        setDivisions(divs);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load Big Game data.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [season, bust]);

  if (loading) {
    return <p className="text-sm text-muted">Loading divisions…</p>;
  }

  if (error) {
    return <p className="text-sm text-muted">{error}</p>;
  }

  if (!divisions.length) {
    return <p className="text-sm text-muted">No divisions published yet.</p>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {divisions.map((d) => (
        <Link
          key={d.id}
          href={`/big-game/divisions/${encodeURIComponent(d.division_slug)}?year=${season}`}
          className="card bg-card-surface border border-subtle p-5 rounded-3xl hover:border-accent/60 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{d.division_name}</p>
              <p className="text-xs text-muted mt-1 truncate">{d.leagues.length} leagues</p>
            </div>
            <span className="badge">{safeStr(d.status || "TBD")}</span>
          </div>

          {d.division_image ? (
            <div className="mt-4 rounded-2xl overflow-hidden border border-subtle bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.division_image} alt="Division" className="w-full h-auto" />
            </div>
          ) : null}

          <div className="mt-4 text-xs text-muted flex items-center justify-between">
            <span className="truncate">View division</span>
            <span>→</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
