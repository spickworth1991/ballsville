"use client";

import { useEffect, useMemo, useState } from "react";
import MediaTabCard from "@/components/ui/MediaTabCard";

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function resolveImageSrc({ imagePath, imageKey, updatedAt }) {
  const p = safeStr(imagePath).trim();
  const k = safeStr(imageKey).trim();
  const bust = updatedAt ? `v=${encodeURIComponent(updatedAt)}` : `v=${Date.now()}`;

  // If we already stored a full URL (/r2/... or https://...), just ensure it has a cache-bust.
  if (p) {
    if (p.includes("?")) return p;
    return `${p}?${bust}`;
  }
  // If we stored only the key, build a public /r2 URL.
  if (k) return `/r2/${k}?${bust}`;
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

async function fetchLeagues(season) {
  const url = `/r2/data/gauntlet/leagues_${season}.json?cachebust=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load gauntlet leagues (${res.status})`);
  const data = await res.json();
  return { rows: data?.rows || [], updated_at: data?.updated_at || "" };
}

export default function GauntletLegionClient({ season = 2025, legionKey = "", titleOverride = "" }) {
  const [rows, setRows] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    setRows(null);

    fetchLeagues(season)
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
  }, [season]);

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

  return (
    <div className="rounded-3xl border border-subtle bg-card-surface overflow-hidden">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur">
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
            })}
            href={l.league_url || "#"}
            external={Boolean(l.league_url)}
          />
        ))}
      </div>
    </div>
  );
}
