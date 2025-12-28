// src/lib/BigGameThemeClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import MediaTabCard from "@/components/ui/MediaTabCard";
import { CURRENT_SEASON } from "@/lib/season";

const DEFAULT_SEASON = CURRENT_SEASON;
const R2_KEY_FOR = (season) => `data/biggame/leagues_${season}.json`;

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function getImageSrc({ key, urlFallback, defaultSrc }) {
  if (key) return `/r2/${key}`;
  if (urlFallback) return urlFallback;
  return defaultSrc;
}

export default function BigGameThemeClient({ themeSlug, season = DEFAULT_SEASON }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!themeSlug) return;
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErrorMsg("");

        const bust = `v=${Date.now()}`;
        const res = await fetch(`/r2/${R2_KEY_FOR(season)}?${bust}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setRows([]);
          return;
        }

        const data = await res.json();
        const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];

        const filtered = list
          .filter((r) => safeStr(r?.theme_slug || r?.division_slug).trim() === themeSlug)
          .filter((r) => r?.is_active !== false)
          .sort((a, b) => Number(a?.display_order || 9999) - Number(b?.display_order || 9999));

        if (!cancelled) setRows(filtered);
      } catch (err) {
        console.error("Failed to load biggame leagues from R2:", err);
        if (!cancelled) setErrorMsg("Unable to load leagues for this division right now. Please refresh or try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [themeSlug, season]);

  const header = useMemo(() => (rows.length > 0 ? rows[0] : null), [rows]);

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Division Leagues</h2>
        <p className="text-sm text-muted">Loading leagues…</p>
      </section>
    );
  }

  if (errorMsg) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Division Leagues</h2>
        <p className="text-sm text-danger">{errorMsg}</p>
      </section>
    );
  }

  if (!header) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Division Leagues</h2>
        <p className="text-sm text-muted">No leagues found for this division yet.</p>
      </section>
    );
  }

  const themeName = safeStr(header.theme_name || header.division_name || themeSlug);
  const themeBlurb = safeStr(header.theme_blurb || header.division_blurb || "");
  const status = safeStr(header.status || header.division_status || "TBD");

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">Big Game Division</p>
        <h1 className="text-3xl sm:text-4xl font-semibold">{themeName}</h1>
        <p className="text-xs sm:text-sm text-muted">
          Status: <span className="font-semibold">{status}</span>
        </p>
        {themeBlurb && <p className="text-sm text-muted max-w-prose">{themeBlurb}</p>}
        <p className="text-xs text-muted">This division consists of up to 8 leagues. Each tile below links directly to the Sleeper league.</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((lg) => {
          const leagueUrl = safeStr(lg?.sleeper_url || lg?.league_url);

          const leagueImg = getImageSrc({
            key: safeStr(lg?.league_image_key || ""),
            urlFallback: safeStr(lg?.league_image_url || lg?.league_image_path || ""),
            defaultSrc: "/photos/biggame/default-league.jpg",
          });

          return (
            <MediaTabCard
              key={safeStr(lg.id)}
              href={leagueUrl || "#"}
              external
              title={safeStr(lg.league_name || lg.name || "League")}
              subtitle="Big Game Bestball"
              metaRight={<span className="text-[11px] font-mono text-accent">#{lg.display_order ?? "—"}</span>}
              imageSrc={leagueImg}
              imageAlt={safeStr(lg.league_name || lg.name || "League")}
              footerLabel="Open League"
            />
          );
        })}
      </div>
    </section>
  );
}
