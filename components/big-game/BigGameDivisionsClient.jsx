"use client";

import { useEffect, useState } from "react";
import { CURRENT_SEASON } from "@/lib/season";
import MediaTabCard from "@/components/ui/MediaTabCard";
import { safeStr } from "@/lib/safe";
import { adminR2Url } from "@/lib/r2Client";

const DEFAULT_SEASON = CURRENT_SEASON;
const R2_KEY_FOR = (season) => `data/biggame/leagues_${season}.json`;


function safeNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Supports BOTH schemas:
 * - New Big Game schema (admin saves):
 *   division_name, division_slug, division_order, division_status, division_image_key, division_image_path,
 *   is_division_header, league_name, league_status, league_url, display_order
 *
 * - Old "theme" schema:
 *   theme_name, theme_order, theme_status, theme_imageKey, theme_image_url, name, url, status, league_order
 */
function buildDivisionsFromRows(rows) {
  const map = new Map(); // divisionSlug -> division object

  for (const r of rows || []) {
    // Prefer new schema division name first, fallback to old schema theme_name
    const divisionName = safeStr(r?.division_name || r?.theme_name || r?.division || "").trim();
    if (!divisionName) continue;

    const divisionSlug = safeStr(r?.division_slug).trim() || slugify(divisionName);
    if (!divisionSlug) continue;

    const isHeader = !!r?.is_division_header;

    if (!map.has(divisionSlug)) {
      map.set(divisionSlug, {
        id: divisionSlug,
        division_slug: divisionSlug,
        division_name: divisionName,

        // these will get finalized below (header wins)
        division_order: null,
        division_image: "",
        division_image_key: "",
        status: "",

        leagues: [],
      });
    }

    const div = map.get(divisionSlug);

    // Keep division name updated if header provides it
    if (isHeader && divisionName) div.division_name = divisionName;

    // --- Division fields (HEADER SHOULD WIN) ---
    // Order
    const candidateOrder = safeNum(
      // new schema first
      r?.division_order ??
        // fallback old schema
        r?.theme_order ??
        null,
      null
    );

    if (isHeader) {
      // header always wins
      if (Number.isFinite(candidateOrder)) div.division_order = candidateOrder;

      const st = safeStr(r?.division_status || r?.theme_status || "").trim();
      if (st) div.status = st;

      const key = safeStr(r?.division_image_key || r?.theme_imageKey || r?.theme_image_key || "").trim();
      if (key) div.division_image_key = key;

      const url = safeStr(r?.division_image_path || r?.division_image_url || r?.theme_image_url || r?.division_image || "").trim();
      if (url) div.division_image = url;
    } else {
      // non-header rows only fill blanks
      if (!Number.isFinite(div.division_order) && Number.isFinite(candidateOrder)) div.division_order = candidateOrder;

      const st = safeStr(r?.division_status || r?.theme_status || "").trim();
      if (!div.status && st) div.status = st;

      const key = safeStr(r?.division_image_key || r?.theme_imageKey || r?.theme_image_key || "").trim();
      if (!div.division_image_key && key) div.division_image_key = key;

      const url = safeStr(r?.division_image_path || r?.division_image_url || r?.theme_image_url || r?.division_image || "").trim();
      if (!div.division_image && url) div.division_image = url;
    }

    // --- League entry ---
    // Skip header-only rows from becoming leagues
    if (isHeader) continue;

    const leagueName = safeStr(r?.league_name || r?.name || "").trim();
    const leagueUrl = safeStr(r?.league_url || r?.sleeper_url || r?.sleeperUrl || r?.url || "").trim();
    const leagueStatus = safeStr(r?.league_status || r?.status || "").trim();
    const leagueOrder = safeNum(r?.display_order ?? r?.league_order ?? null, null);

    // If a weird extra blank row exists, don't create a "ghost league card"
    if (!leagueName && !leagueUrl) continue;

    div.leagues.push({
      id: safeStr(r?.id || r?.ID || r?.Id) || `${divisionSlug}:${leagueOrder ?? leagueName ?? Math.random()}`,
      name: leagueName,
      status: leagueStatus,
      url: leagueUrl,
      order: leagueOrder,
    });
  }

  const divisions = Array.from(map.values());

  divisions.forEach((d) => {
    d.leagues.sort((a, b) => {
      const ao = a.order ?? 9999;
      const bo = b.order ?? 9999;
      if (ao !== bo) return ao - bo;
      return safeStr(a.name).localeCompare(safeStr(b.name));
    });
  });

  divisions.sort((a, b) => {
    const ao = a.division_order;
    const bo = b.division_order;

    // order asc if present
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    if (Number.isFinite(ao) && !Number.isFinite(bo)) return -1;
    if (!Number.isFinite(ao) && Number.isFinite(bo)) return 1;

    return safeStr(a.division_name).localeCompare(safeStr(b.division_name));
  });

  return divisions;
}

function resolveDivisionImage(div, updatedAt) {
  const key = safeStr(div?.division_image_key).trim();
  const url = safeStr(div?.division_image).trim();

  // If we have an R2 key, always resolve through adminR2Url()
  // so localhost uses the public r2.dev base and production uses /r2/.
  const base = key ? adminR2Url(key) : url;

  if (!base) return "";
  if (!updatedAt) return base;

  return base.includes("?") ? base : `${base}?v=${encodeURIComponent(updatedAt)}`;
}


export default function BigGameDivisionsClient({ year = DEFAULT_SEASON, version = "0", manifest = null }) {
  const season = safeNum(year, DEFAULT_SEASON);
  const bust = `v=${version}`;
  const [divisions, setDivisions] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    // Manifest-first: don't fetch the heavy json until the section manifest exists.
    if (manifest === null) return () => {};

    async function load() {
      try {
        setError("");
        setLoading(true);

        const v = String(version || "0");
        const cacheKeyV = `biggame:divisions:${season}:version`;
        const cacheKeyData = `biggame:divisions:${season}:data`;
        const cacheKeyUpdated = `biggame:divisions:${season}:updatedAt`;

        // Session cache gated by manifest version
        try {
          const cachedV = sessionStorage.getItem(cacheKeyV);
          if (cachedV && cachedV === v) {
            const cachedData = sessionStorage.getItem(cacheKeyData);
            const cachedUpdated = sessionStorage.getItem(cacheKeyUpdated);
            if (cachedData) {
              const parsed = JSON.parse(cachedData);
              if (alive && Array.isArray(parsed)) {
                setDivisions(parsed);
                setUpdatedAt(String(cachedUpdated || ""));
                setLoading(false);
                return;
              }
            }
          }
        } catch {
          // ignore storage errors
        }

        const res = await fetch(adminR2Url(`data/biggame/leagues_${season}.json?${bust}`), { cache: "default" });
        if (!res.ok) throw new Error(`Failed to load Big Game data (${res.status})`);

        const json = await res.json();
        const rows = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];
        const stamp = safeStr(json?.updatedAt || json?.updated_at || "");

        const nextDivisions = buildDivisionsFromRows(rows);

        if (!alive) return;
        setDivisions(nextDivisions);
        setUpdatedAt(stamp);

        try {
          sessionStorage.setItem(cacheKeyV, v);
          sessionStorage.setItem(cacheKeyUpdated, stamp);
          sessionStorage.setItem(cacheKeyData, JSON.stringify(nextDivisions));
        } catch {
          // ignore storage errors
        }
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
  }, [season, version, manifest]);

  if (loading) return <p className="text-sm text-muted">Loading divisions…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {divisions.map((d) => {
        const href = `/big-game/divisions?division=${encodeURIComponent(d.division_slug)}&year=${encodeURIComponent(season)}`;
        const img = resolveDivisionImage(d, updatedAt);

        return (
          <MediaTabCard
            key={d.id}
            href={href}
            title={d.division_name}
            subtitle={`${d.leagues.length} leagues`}
            metaRight={<span className="badge">{safeStr(d.status || "TBD")}</span>}
            imageSrc={img}
            imageAlt="Division"
            footerText="View division"
          />
        );
      })}
    </div>
  );
}