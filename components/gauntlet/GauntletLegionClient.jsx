"use client";

import { useEffect, useMemo, useState } from "react";
import MediaTabCard from "@/components/ui/MediaTabCard";
import { CURRENT_SEASON } from "@/lib/season";
import { safeStr } from "@/lib/safe";
import { r2Url } from "@/lib/r2Url";

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}


function resolveImageSrc({ imagePath, imageKey, updatedAt, version }) {
  const p = safeStr(imagePath).trim();
  const k = safeStr(imageKey).trim();

  // Stable cache-bust token:
  // - Prefer JSON's updated_at so images re-bust when data updates
  // - Fall back to manual version prop
  const bust = encodeURIComponent(safeStr(updatedAt).trim() || safeStr(version).trim() || "0");

  // If we already stored a full URL (/r2/... or https://...), just ensure it has a cache-bust.
  if (p) {
    // /r2/* paths must go through r2Url() so localhost uses the public R2 base.
    if (p.startsWith("/r2/")) {
      const keyFromPath = p.replace(/^\/r2\//, "");
      return `${r2Url(keyFromPath)}?v=${bust}`;
    }
    if (p.includes("?")) return p;
    return `${p}?v=${bust}`;
  }

  if (k) return `${r2Url(k)}?v=${bust}`;
  return "";
}


function buildIndex(rows) {
  const active = Array.isArray(rows) ? rows.filter((r) => r && r.is_active !== false) : [];

  const headers = active
    .filter((r) => r.is_legion_header)
    .map((r, i) => ({
      idx: i,
      legion_name: safeStr(r.legion_name).trim(),
      legion_slug: slugify(r.legion_slug || r.legion_name),
      legion_status: safeStr(r.legion_status || "TBD"),
      legion_spots: Number.isFinite(Number(r.legion_spots)) ? Number(r.legion_spots) : null,
      legion_order: Number.isFinite(Number(r.legion_order)) ? Number(r.legion_order) : 999,
      legion_image_key: safeStr(r.legion_image_key || ""),
      legion_image_path: safeStr(r.legion_image_path || ""),
    }))
    .sort((a, b) => a.legion_order - b.legion_order);

  const leaguesByLegion = new Map();
  active
    .filter((r) => !r.is_legion_header)
    .forEach((r, i) => {
      const slug = slugify(r.legion_slug);
      const arr = leaguesByLegion.get(slug) || [];
      arr.push({
        idx: i,
        legion_slug: slug,
        league_order: Number.isFinite(Number(r.league_order)) ? Number(r.league_order) : 999,
        league_name: safeStr(r.league_name).trim(),
        league_url: safeStr(r.league_url || ""),
        league_status: safeStr(r.league_status || "TBD"),
        league_image_key: safeStr(r.league_image_key || ""),
        league_image_path: safeStr(r.league_image_path || ""),
      });
      leaguesByLegion.set(slug, arr);
    });

  for (const [slug, arr] of leaguesByLegion.entries()) {
    arr.sort((a, b) => a.league_order - b.league_order);
    leaguesByLegion.set(slug, arr);
  }

  return { headers, leaguesByLegion };
}

async function fetchLeagues(season, version) {
  const v = version || Date.now();
  const leaguesKey = `data/gauntlet/leagues_${season}.json`;
  const url = `${r2Url(leaguesKey)}?v=${encodeURIComponent(v)}`;
  const res = await fetch(url, { cache: "default" });
  if (!res.ok) throw new Error(`Failed to load gauntlet leagues (${res.status})`);
  const data = await res.json();
  return { rows: data?.rows || [], updated_at: data?.updated_at || "" };
}

// NOTE: `version` is an optional prop used as a manual cache-bust signal.
// Not required for manifest-based caching, but keeping it allows parent components
// to force a refetch if desired.
export default function GauntletLegionClient({
  season = CURRENT_SEASON,
  legionKey = "",
  titleOverride = "",
  version = "0",
  manifest = null,
}) {
  const [rows, setRows] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Manifest-first: avoid an initial v=0 fetch before SectionManifestGate loads.
    if (!manifest) return () => { cancelled = true; };

    setError("");
    setRows(null);

    fetchLeagues(season, version)
      .then((out) => {
        if (cancelled) return;
        setRows(out.rows);
        setUpdatedAt(String(out.updated_at || ""));
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load gauntlet leagues.");
      });

    return () => {
      cancelled = true;
    };
  }, [season, version, manifest]);

  const { headers, leaguesByLegion } = useMemo(() => buildIndex(rows), [rows]);

  const requestedSlug = slugify(legionKey);
  const header = useMemo(() => {
    if (!headers.length) return null;

    // Prefer exact slug match; fall back to name match; if still not found, use first.
    let found = headers.find((h) => h.legion_slug === requestedSlug);
    if (!found) found = headers.find((h) => slugify(h.legion_name) === requestedSlug);
    return found || headers[0];
  }, [headers, requestedSlug]);

  const leagues = useMemo(() => {
    if (!header) return [];
    return leaguesByLegion.get(header.legion_slug) || [];
  }, [header, leaguesByLegion]);

  if (error) {
    return <p className="container py-10 text-white/80">{error}</p>;
  }

  if (!rows) {
    return <p className="container py-10 text-white/80">Loading…</p>;
  }

  if (!header) {
    return <p className="container py-10 text-white/80">No legions found.</p>;
  }

  const title = titleOverride || header.legion_name || "Legion";
  const legionHeaderImg = resolveImageSrc({
    imagePath: header.legion_image_path,
    imageKey: header.legion_image_key,
    updatedAt,
    version,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-white">{title}</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                {header.legion_status}
              </span>
              {header.legion_spots != null && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Spots: {header.legion_spots}
                </span>
              )}
            </div>
          </div>

          {legionHeaderImg ? (
            <div className="shrink-0 w-28 sm:w-36">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={legionHeaderImg} alt="Legion" className="w-full h-24 sm:h-28 object-contain" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {leagues.map((l) => (
          <MediaTabCard
            key={`${header.legion_slug}_${l.league_order}_${l.league_name}`}
            title={l.league_name || "League"}
            subtitle={l.league_status || ""}
            imageSrc={resolveImageSrc({
              imagePath: l.league_image_path,
              imageKey: l.league_image_key,
              updatedAt,
              version,
            })}
            href={l.league_url || "#"}
            external={Boolean(l.league_url)}
          />
        ))}
      </div>
    </div>
  );
}