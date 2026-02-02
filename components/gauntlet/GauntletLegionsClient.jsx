"use client";

import { useEffect, useMemo, useState } from "react";
import MediaTabCard from "@/components/ui/MediaTabCard";
import { CURRENT_SEASON } from "@/lib/season";
import { safeStr } from "@/lib/safe";
import { r2Url } from "@/lib/r2Url";


function resolveImageSrc({ imagePath, imageKey, updatedAt, bustVersion }) {
  const p = safeStr(imagePath).trim();
  const k = safeStr(imageKey).trim();
  const bust = updatedAt
    ? `v=${encodeURIComponent(String(updatedAt))}`
    : bustVersion
      ? `v=${encodeURIComponent(String(bustVersion))}`
      : `v=0`;

  if (p) {
    // If the stored path is a relative /r2/* URL, route it through r2Url() so
    // localhost uses the public R2 base (no Pages Functions runtime).
    if (p.startsWith("/r2/")) {
      const keyFromPath = p.replace(/^\/r2\//, "");
      return `${r2Url(keyFromPath)}?${bust}`;
    }
    if (p.includes("?")) return p;
    return `${p}?${bust}`;
  }
  if (k) return `${r2Url(k)}?${bust}`;
  return "";
}

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

function fmtSpots(openSpots) {
  if (openSpots == null) return null;
  const n = Number(openSpots);
  if (!Number.isFinite(n)) return null;
  return n;
}

// NOTE: `version` is an optional prop some pages use as a manual cache-bust signal.
// With the manifest-based caching it usually isn't needed, but keeping it here
// prevents build-time ReferenceErrors if a parent still uses it.
export default function GauntletLegionsClient({ season = CURRENT_SEASON, embedded = false, version = "0", manifest = null }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Manifest-first: avoid fetching the heavy JSON until the section manifest exists.
    if (manifest === null) return () => {};

    async function run() {
      setError("");
      setLoading(true);
      try {
        const v = String(version || "0");
        const cacheKeyV = `gauntlet:legions:${season}:version`;
        const cacheKeyRows = `gauntlet:legions:${season}:rows`;
        const cacheKeyUpdated = `gauntlet:legions:${season}:updatedAt`;

        // Session cache gated by manifest version
        try {
          const cachedV = sessionStorage.getItem(cacheKeyV);
          if (cachedV && cachedV === v) {
            const cachedRows = sessionStorage.getItem(cacheKeyRows);
            const cachedUpdated = sessionStorage.getItem(cacheKeyUpdated);
            if (cachedRows) {
              const parsed = JSON.parse(cachedRows);
              if (!cancelled && Array.isArray(parsed)) {
                setRows(parsed);
                setUpdatedAt(String(cachedUpdated || ""));
                setLoading(false);
                return;
              }
            }
          }
        } catch {
          // ignore storage errors
        }

        const url = `${r2Url(`data/gauntlet/leagues_${season}.json`)}?v=${encodeURIComponent(v)}`;
        const res = await fetch(url, { cache: "default" });
        if (!res.ok) throw new Error(`Failed to load gauntlet data (${res.status})`);
        const json = await res.json();
        if (cancelled) return;

        const nextRows = Array.isArray(json?.rows) ? json.rows : [];
        const stamp = String(json?.updated_at || json?.updatedAt || "");
        setRows(nextRows);
        setUpdatedAt(stamp);

        try {
          sessionStorage.setItem(cacheKeyV, v);
          sessionStorage.setItem(cacheKeyRows, JSON.stringify(nextRows));
          sessionStorage.setItem(cacheKeyUpdated, stamp);
        } catch {
          // ignore storage errors
        }
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
  }, [season, version, manifest]);

  const legions = useMemo(() => {
    const headers = rows.filter((r) => r?.is_legion_header);
    return headers
      .map((r) => {
        const legion_slug = r.legion_slug || slugify(r.legion_name);
        const legionLeagues = rows
          .filter((x) => !x?.is_legion_header && (x?.legion_slug || slugify(x?.legion_name)) === legion_slug)
          .sort((a, b) => Number(a?.league_order ?? 0) - Number(b?.league_order ?? 0));

        const activeCount = legionLeagues.filter((x) => x?.is_active !== false).length;

        const openSpotsFromRows = legionLeagues
          .filter((x) => x?.is_active !== false && !x?.notReady)
          .reduce((sum, x) => sum + (Number(x?.open_teams ?? x?.openTeams ?? x?.spots_available) || 0), 0);

        const openSpots = fmtSpots(r?.legion_spots) ?? fmtSpots(openSpotsFromRows);

        const derivedStatus = (() => {
          const labels = legionLeagues
            .filter((x) => x?.is_active !== false && !x?.notReady)
            .map((x) => String(x?.league_status || "").toUpperCase());
          if (!labels.length) return String(r?.legion_status || "TBD").toUpperCase();
          if (labels.includes("DRAFTING")) return "DRAFTING";
          if (labels.every((x) => x === "FULL")) return "FULL";
          if (labels.includes("FILLING")) return "FILLING";
          return "TBD";
        })();

        return {
          ...r,
          legion_slug,
          leagues: legionLeagues,
          activeCount,
          openSpots,
          legion_status: derivedStatus,
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
            subtitle={l.legion_blurb ? String(l.legion_blurb) : "Gauntlet Legion"}
            imageSrc={resolveImageSrc({
              imagePath: l.legion_image_path,
              imageKey: l.legion_image_key,
              updatedAt,
              bustVersion: version,
            })}
            imageAlt={l.legion_name || "Legion"}
            metaLeft={
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badge}`}
              >
                {status}
              </span>
            }
            metaRight={
              <span className="inline-flex items-center gap-2">
                {l.openSpots != null ? (
                  <span className="inline-flex items-center rounded-full border border-subtle bg-card-subtle px-2.5 py-1 text-xs font-semibold text-fg">
                    Open: {l.openSpots}
                  </span>
                ) : null}
                {l.activeCount ? (
                  <span className="inline-flex items-center rounded-full border border-subtle bg-card-subtle px-2.5 py-1 text-xs font-semibold text-fg">
                    {l.activeCount} leagues
                  </span>
                ) : null}
              </span>
            }
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