"use client";

import { useEffect, useMemo, useState } from "react";
import MediaTabCard from "@/components/ui/MediaTabCard";
import { CURRENT_SEASON } from "@/lib/season";

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function statusBadge(status) {
  const s = String(status || "TBD").toUpperCase();
  const map = {
    FULL: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
    FILLING: "bg-amber-500/20 text-amber-200 border-amber-400/30",
    DRAFTING: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
    TBD: "bg-zinc-500/20 text-zinc-200 border-zinc-400/30",
  };
  return map[s] || map.TBD;
}

function r2ImgSrc(key, fallbackUrl) {
  if (key) return `/r2/${key}?v=${encodeURIComponent(key)}`;
  return fallbackUrl || "";
}

function fmtSpots(openSpots) {
  if (openSpots == null) return null;
  const n = Number(openSpots);
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function GauntletLegionsClient({ season = CURRENT_SEASON, embedded = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError("");
      setLoading(true);
      try {
        const r2Base = process.env.NEXT_PUBLIC_ADMIN_R2_PROXY_BASE || "/r2";
        const url = `${r2Base}/data/gauntlet/leagues_${season}.json`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load gauntlet data (${res.status})`);
        const json = await res.json();
        if (!cancelled) setRows(Array.isArray(json?.rows) ? json.rows : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load gauntlet legions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const legions = useMemo(() => {
    const headers = rows.filter((r) => r?.is_legion_header);
    return headers
      .map((r) => {
        const legion_slug = r.legion_slug || slugify(r.legion_name);
        const legionLeagues = rows
          .filter((x) => !x?.is_legion_header && (x?.legion_slug || slugify(x?.legion_name)) === legion_slug)
          .sort((a, b) => Number(a?.league_order ?? 0) - Number(b?.league_order ?? 0));

        const activeCount = legionLeagues.filter((x) => x?.is_active !== false).length;
        const openSpots = fmtSpots(r?.open_spots);

        return {
          ...r,
          legion_slug,
          leagues: legionLeagues,
          activeCount,
          openSpots,
        };
      })
      .sort((a, b) => Number(a?.legion_order ?? 0) - Number(b?.legion_order ?? 0));
  }, [rows]);

  const grid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {legions.map((l) => {
        const status = String(l?.legion_status || "TBD").toUpperCase();
        const badge = statusBadge(status);
        // Match Big Game divisions UX: use the same /gauntlet/legions page,
        // driven by a query param.
        const href = `/gauntlet/legions?legion=${encodeURIComponent(l.legion_slug)}`;

        return (
          <MediaTabCard
            key={l.legion_slug}
            href={href}
            title={l.legion_name || "Unnamed Legion"}
            subtitle={"Gauntlet Legion"}
            imageSrc={r2ImgSrc(l.legion_image_key, l.legion_image_path) || null}
            imageAlt={l.legion_name || "Legion"}
            metaLeft={
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badge}`}
              >
                {status}
              </span>
            }
            metaRight={
              l.activeCount ? (
                <span className="inline-flex items-center rounded-full border border-subtle bg-card-subtle px-2.5 py-1 text-xs font-semibold text-fg">
                  {l.activeCount} leagues
                </span>
              ) : null
            }
            badges={[
              typeof l.openSpots === "number"
                ? {
                    text: `${l.openSpots} spots open`,
                    className:
                      "inline-flex items-center rounded-full border border-subtle bg-card-subtle px-2.5 py-1 text-xs text-muted",
                  }
                : null,
              l.legion_blurb
                ? {
                    text: l.legion_blurb,
                    className:
                      "inline-flex items-center rounded-full border border-subtle bg-card-subtle px-2.5 py-1 text-xs text-muted",
                  }
                : null,
            ].filter(Boolean)}
            footerText="View Legion"
          />
        );
      })}
    </div>
  );

  if (embedded) {
    if (loading) return <p className="text-muted">Loading…</p>;
    return (
      <>
        {error ? (
          <div className="card bg-card-surface border border-subtle p-5">
            <p className="text-red-300">{error}</p>
          </div>
        ) : null}
        {grid}
      </>
    );
  }

  if (loading) {
    return (
      <main className="section">
        <div className="container-site">
          <p className="text-muted">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="container-site">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="h1">The Gauntlet</h1>
            <p className="text-muted mt-2">Choose a legion to view its leagues.</p>
          </div>
          <div className="text-sm text-muted">
            Season: <span className="font-semibold text-fg">{season}</span>
          </div>
        </div>

        {error ? (
          <div className="mt-6 card bg-card-surface border border-subtle p-5">
            <p className="text-red-300">{error}</p>
          </div>
        ) : null}

        <div className="mt-8">{grid}</div>
      </div>
    </main>
  );
}
