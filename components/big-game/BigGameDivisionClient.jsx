"use client";

import { useEffect, useMemo, useState } from "react";
import { CURRENT_SEASON } from "@/lib/season";
import MediaTabCard from "@/components/ui/MediaTabCard";
import { safeStr } from "@/lib/safe";
import { r2Url } from "@/lib/r2Url";

const DEFAULT_SEASON = CURRENT_SEASON;
const R2_KEY_FOR = (season) => `data/biggame/leagues_${season}.json`;

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

function normalizeSleeperStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "pre_draft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "inseason") return "in_season";
  if (s === "complete") return "complete";
  return s || null;
}

function computeLeagueStatus(row) {
  const raw = String(row?.league_status || "").trim().toUpperCase();
  if (raw && raw !== "AUTO") return raw;

  if (row?.not_ready) return "TBD";

  const ss = normalizeSleeperStatus(row?.sleeper_status);
  if (ss === "drafting") return "DRAFTING";

  if (typeof row?.open_teams === "number" && Number.isFinite(row.open_teams)) {
    return row.open_teams <= 0 ? "FULL" : "FILLING";
  }

  return "TBD";
}

function normalizeRow(r, idx = 0) {
  const year = safeNum(r?.year, DEFAULT_SEASON);
  const division_name = safeStr(r?.division_name || r?.theme_name || "Division").trim();
  const division_slug = safeStr(r?.division_slug || slugify(division_name));

  const is_division_header = !!r?.is_division_header;

  return {
    id: safeStr(r?.id || `${year}_${division_slug}_${idx}`),
    year,
    division_name,
    division_slug,
    is_division_header,

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

    // Sleeper-backed (optional)
    sleeper_league_id: safeStr(r?.sleeper_league_id || r?.leagueId || r?.league_id || ""),
    sleeper_status: safeStr(r?.sleeper_status || ""),
    total_teams: safeNum(r?.total_teams, null),
    filled_teams: safeNum(r?.filled_teams, null),
    open_teams: safeNum(r?.open_teams, null),
    not_ready: r?.not_ready === true,

    is_active: r?.is_active !== false,
  };
}

function withBust(url, bust) {
  if (!url) return "";
  if (url.includes("?")) return url;
  return `${url}?${bust}`;
}

function resolveImageSrc({ key, url, avatarId }) {
  if (key) return r2Url(key, { kind: "biggame" });
  if (url) return url;
  const a = typeof avatarId === "string" ? avatarId.trim() : "";
  return a ? `https://sleepercdn.com/avatars/${a}` : "";
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

  const leagues = filtered
    .filter((r) => !r.is_division_header)
    .slice()
    .sort((a, b) => (a.league_order ?? 999) - (b.league_order ?? 999))
    .map((r) => ({
      league_name: r.league_name,
      league_url: r.league_url,
      league_order: r.league_order,
      league_status: computeLeagueStatus(r),
      league_image: resolveImageSrc({ key: r.league_image_key, url: r.league_image_path, avatarId: r.avatar_id }),
    }));

  return { header, leagues };
}

export default function BigGameDivisionClient({
  year = DEFAULT_SEASON,
  divisionSlug = "",
  backHref = "/big-game",
  version = "0",
}) {
  const [division, setDivision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const bust = useMemo(() => `v=${Date.now()}`, []);

  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`${r2Url(R2_KEY_FOR(year), { kind: "biggame" })}?${bust}`, { cache: "no-store" });
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

          const st = String(lg?.league_status || "").trim().toUpperCase();
          const isFilling = st === "FILLING";
          const invite = String(lg?.league_url || "").trim();
          const desktop = lg?.league_id ? `https://sleeper.com/leagues/${encodeURIComponent(String(lg.league_id))}` : "";
          const href = isFilling ? (invite || desktop) : "";
          const isClickable = Boolean(href);

          return (
            <MediaTabCard
              key={`${leagueNum}-${idx}`}
              href={isClickable ? href : undefined}
              external={isClickable}
              title={lg.league_name || `League ${leagueNum}`}
              subtitle="Big Game Bestball"
              metaLeft={
                <span className="inline-flex items-center rounded-full border border-subtle bg-panel px-2 py-1 text-[10px] font-semibold tracking-wide">
                  {lg?.league_status || "TBD"}
                </span>
              }
              metaRight={<span className="text-[11px] font-mono text-accent">#{leagueNum}</span>}
              imageSrc={img}
              imageAlt={lg.league_name || `League ${leagueNum}`}
              footerLabel={isClickable ? "Open League" : "Not filling"}
              className={["h-full", !isClickable ? "cursor-not-allowed" : ""].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}
