"use client";

import { useEffect, useMemo, useState } from "react";
import { CURRENT_SEASON } from "@/lib/season";

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

  return {
    id: safeStr(r?.id || `${year}_${division_slug}_${idx}`),
    year,
    division_name,
    division_slug,
    theme: safeStr(r?.theme || ""),
    status: safeStr(r?.status || "TBD"),
    division_fill_note: safeStr(r?.division_fill_note || ""),
    division_image_key: safeStr(r?.division_image_key || ""),
    division_image_path: safeStr(r?.division_image_path || ""),

    league_name: safeStr(r?.league_name || ""),
    league_url: safeStr(r?.league_url || ""),
    league_order: safeNum(r?.league_order ?? r?.display_order, idx + 1),
    league_image_key: safeStr(r?.league_image_key || ""),
    league_image_path: safeStr(r?.league_image_path || ""),

    is_active: r?.is_active !== false,
  };
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

  const first = filtered[0];
  const header = {
    division_name: first.division_name,
    division_fill_note: first.division_fill_note,
    division_image: resolveImageSrc({ key: first.division_image_key, url: first.division_image_path }),
  };

  const leagues = filtered
    .slice()
    .sort((a, b) => (a.league_order ?? 999) - (b.league_order ?? 999))
    .map((r) => ({
      league_name: r.league_name,
      league_url: r.league_url,
      league_order: r.league_order,
      league_image: resolveImageSrc({ key: r.league_image_key, url: r.league_image_path }),
    }));

  return { header, leagues };
}

export default function BigGameDivisionClient({
  year = DEFAULT_SEASON,
  divisionSlug = "",
  backHref = "/big-game",
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
  }, [divisionSlug, year]);

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

  return (
    <div className="space-y-6">
      <a href={backHref} className="btn btn-outline inline-flex w-fit">
        ← Back
      </a>

      <div className="rounded-3xl border border-subtle bg-card-surface overflow-hidden">
        {header.division_image ? (
          <div className="bg-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={header.division_image} alt="Division" className="w-full h-auto" />
          </div>
        ) : null}

        <div className="p-6 md:p-8 space-y-2">
          <h1 className="h2">{header.division_name}</h1>
          {header.division_fill_note ? <p className="text-sm text-muted">{header.division_fill_note}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {leagues.map((lg, idx) => (
          <a
            key={`${lg.league_order}-${idx}`}
            href={lg.league_url || "#"}
            target={lg.league_url ? "_blank" : undefined}
            rel={lg.league_url ? "noreferrer" : undefined}
            className="group rounded-2xl border border-subtle bg-card-surface p-5 hover:border-accent/60 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg truncate">{lg.league_name || `League ${lg.league_order || idx + 1}`}</p>
                <p className="text-xs text-muted mt-1">League #{lg.league_order || idx + 1}</p>
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition">→</span>
            </div>

            {lg.league_image ? (
              <div className="mt-4 rounded-xl overflow-hidden border border-subtle bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lg.league_image} alt="League" className="w-full h-auto" />
              </div>
            ) : null}

            <div className="mt-4 text-xs text-muted truncate">{lg.league_url ? "Open in Sleeper" : "Link not set"}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
