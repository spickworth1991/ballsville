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
  // - header rows: is_division_header=true, division_* fields
  // - league rows: is_division_header=false, league_* fields
  const is_division_header = !!r?.is_division_header;

  return {
    id: safeStr(r?.id || `${year}_${division_slug}_${idx}`),
    year,
    division_name,
    division_slug,
    is_division_header,
    theme: safeStr(r?.theme || ""),
    // prefer new field names when present
    division_status: safeStr(r?.division_status || r?.status || "TBD"),
    division_fill_note: safeStr(r?.division_blurb || r?.division_fill_note || ""),
    division_image_key: safeStr(r?.division_image_key || ""),
    division_image_path: safeStr(r?.division_image_path || ""),

    league_name: safeStr(r?.league_name || ""),
    league_url: safeStr(r?.league_url || ""),
    league_order: safeNum(r?.league_order ?? r?.display_order, idx + 1),
    league_image_key: safeStr(r?.league_image_key || ""),
    league_image_path: safeStr(r?.league_image_path || ""),

    league_status: safeStr(r?.league_status || r?.status || "TBD"),

    is_active: r?.is_active !== false,
  };
}

function withBust(url, bust) {
  if (!url) return "";
  if (url.includes("?")) return url;
  return `${url}?${bust}`;
}

function resolveImageSrc({ key, url }) {
  if (key) return `/r2/${key}`;
  return url || "";
}

function transformForDivision(rows, divisionSlug) {
  const filtered = rows.filter((r) => r.division_slug === divisionSlug && r.is_active !== false);
  if (filtered.length === 0) {
    return {
      header: { division_name: "", division_fill_note: "", division_image: "" },
      leagues: [],
    };
  }

  const headerRow = filtered.find((r) => r.is_division_header) || filtered[0];
  const header = {
    division_name: headerRow.division_name,
    division_fill_note: headerRow.division_fill_note,
    division_image: resolveImageSrc({ key: headerRow.division_image_key, url: headerRow.division_image_path }),
  };

  // IMPORTANT: exclude the header row from the league list (prevents the "extra league" card)
  const leagues = filtered
    .filter((r) => !r.is_division_header)
    .slice()
    .sort((a, b) => (a.league_order ?? 999) - (b.league_order ?? 999))
    .map((r) => ({
      league_name: r.league_name,
      league_url: r.league_url,
      league_order: r.league_order,
      league_status: r.league_status,
      league_image: resolveImageSrc({ key: r.league_image_key, url: r.league_image_path }),
    }));

  return { header, leagues };
}

export default function BigGameDivisionClient({year = DEFAULT_SEASON,
  divisionSlug = "",
  backHref = "/big-game", version = "0"}) {
  const [division, setDivision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const bust = useMemo(() => `v=${Date.now()}`, []);

  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/r2/${R2_KEY_FOR(year)}?${bust}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load Big Game data (${res.status})`);
        const data = await res.json();
        const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        const normalized = list.map(normalizeRow);
        setDivision(transformForDivision(normalized, safeStr(divisionSlug)));
      } catch (e) {
        setError(e?.message || "Failed to load division.");
      } finally {
        setLoading(false);
      }
    }

    if (!divisionSlug) {
      setDivision(null);
      setLoading(false);
      return;
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionSlug, year, version]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (!division) {
    return (
      <div className="space-y-3">
        <a href={backHref} className="btn btn-outline inline-flex w-fit">
          ← Back
        </a>
        <p className="text-muted">Division not found.</p>
      </div>
    );
  }

  const { header, leagues } = division;
  const headerImage = withBust(header.division_image, bust);

  return (
    <div className="space-y-6">
      <a href={backHref} className="btn btn-outline inline-flex w-fit">
        ← Back
      </a>

      <div className="rounded-3xl border border-subtle bg-card-surface overflow-hidden">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-accent">Big Game Division</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white truncate">{header.division_name}</h1>
              {header.division_fill_note ? <p className="text-sm text-white/70 max-w-prose">{header.division_fill_note}</p> : null}
            </div>

            {headerImage ? (
              <div className="shrink-0 w-28 sm:w-36">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={headerImage} alt="Division" className="w-full h-24 sm:h-28 object-contain" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {leagues.map((lg, idx) => {
          const leagueNum = lg.league_order || idx + 1;
          const img = withBust(lg.league_image, bust);

          return (
            <MediaTabCard
              key={`${leagueNum}-${idx}`}
              href={lg.league_url || "#"}
              external={Boolean(lg.league_url)}
              title={lg.league_name || `League ${leagueNum}`}
              subtitle="Big Game Bestball"
              metaRight={<span className="text-[11px] font-mono text-accent">#{leagueNum}</span>}
              imageSrc={img}
              imageAlt={lg.league_name || `League ${leagueNum}`}
              footerLabel={lg.league_url ? "Open League" : "Link not set"}
            />
          );
        })}
      </div>
    </div>
  );
}
