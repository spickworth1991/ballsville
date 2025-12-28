"use client";

import { useEffect, useMemo, useState } from "react";
import { CURRENT_SEASON } from "@/lib/season";
import MediaTabCard from "@/components/ui/MediaTabCard";

const DEFAULT_SEASON = CURRENT_SEASON;
const R2_KEY_FOR = (season) => `data/biggame/leagues_${season}.json`;

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

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
 * Input json shape:
 * { updatedAt, rows: [{ theme_name (division), name (league), ... }] }
 *
 * We build a division directory from the leagues feed.
 */
function buildDivisionsFromRows(rows) {
  const map = new Map(); // divisionSlug -> { id, division_name, division_order, division_image, leagues[] }

  for (const r of rows || []) {
    const divisionName = safeStr(r?.theme_name || r?.division_name || r?.division || "").trim();
    if (!divisionName) continue;

    const divisionSlug = slugify(divisionName);
    if (!map.has(divisionSlug)) {
      map.set(divisionSlug, {
        id: divisionSlug,
        division_slug: divisionSlug,
        division_name: divisionName,
        division_order: safeNum(r?.theme_order ?? r?.division_order, null),
        division_image: safeStr(r?.theme_image_url || r?.theme_image_url || r?.division_image_url || r?.division_image || "").trim(),
        division_image_key: safeStr(r?.theme_imageKey || r?.theme_image_key || r?.division_image_key || "").trim(),
        status: safeStr(r?.theme_status || r?.division_status || "").trim(),
        leagues: [],
      });
    }

    const div = map.get(divisionSlug);

    // Best available division image (first league row usually has it)
    const nextDivKey = safeStr(r?.theme_imageKey || r?.theme_image_key || r?.division_image_key || "").trim();
    const nextDivUrl = safeStr(r?.theme_image_url || r?.division_image_url || r?.division_image || "").trim();
    if (!div.division_image_key && nextDivKey) div.division_image_key = nextDivKey;
    if (!div.division_image && nextDivUrl) div.division_image = nextDivUrl;

    // League entry
    div.leagues.push({
      id: r?.id || r?.ID || r?.Id || `${divisionSlug}:${safeStr(r?.name)}`,
      name: safeStr(r?.name || r?.league_name || "").trim(),
      status: safeStr(r?.status || "").trim(),
      url: safeStr(r?.sleeper_url || r?.sleeperUrl || r?.url || "").trim(),
      order: safeNum(r?.display_order ?? r?.league_order, null),
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
  const base = key ? `/r2/${key}` : url;
  if (!base) return "";
  if (!updatedAt) return base;
  return base.includes("?") ? base : `${base}?v=${encodeURIComponent(updatedAt)}`;
}

export default function BigGameDivisionsClient({ year = DEFAULT_SEASON, version = "0", manifest = null }) {
  const season = safeNum(year, DEFAULT_SEASON);

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

        const res = await fetch(`/r2/${R2_KEY_FOR(season)}?v=${encodeURIComponent(v)}`, { cache: "default" });
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
