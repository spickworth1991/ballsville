// src/lib/DynastyLeaguesClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MediaTabCard from "@/components/ui/MediaTabCard";

const R2_ROWS_KEY = "data/dynasty/leagues.json";

function normalize(row) {
  const r = row && typeof row === "object" ? row : {};
  const yearNum = Number(r.year ?? r.season);

  // Normalize status early so orphan detection is reliable even if the admin UI
  // only changes `status` (and older rows don't have `is_orphan`).
  const statusRaw = r?.status ?? r?.STATUS ?? "";
  const status = typeof statusRaw === "string" ? statusRaw.trim() : String(statusRaw || "").trim();
  // Treat any status containing "ORPHAN" as an orphan opening.
  // This avoids fragile exact-match logic (e.g. casing/spacing differences).
  const isOrphanByStatus = status.toUpperCase().includes("ORPHAN");

  // Backward compatible field names
  return {
    ...r,
    id: r.id || r.ID || r.Id,
    year: Number.isFinite(yearNum) ? yearNum : r.year,
    name: r.name ?? r.league_name ?? "",
    sleeper_url: r.sleeper_url ?? r.sleeperUrl ?? r.url ?? "",

    status,
    // If `is_orphan` is missing, infer it from status.
    is_orphan: typeof r?.is_orphan === "boolean" ? r.is_orphan : isOrphanByStatus,

    // League image
    imageKey: r.imageKey ?? r.image_key ?? r.league_image_key ?? "",
    image_url: r.image_url ?? r.imageUrl ?? r.league_image_url ?? "",

    // Theme (division) image
    theme_imageKey: r.theme_imageKey ?? r.theme_image_key ?? r.division_image_key ?? "",
    theme_image_url: r.theme_image_url ?? r.division_image_url ?? "",
  };
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Transform raw rows into:
 * - orphans: list of orphan openings
 * - years: sorted list of years (desc)
 * - byYear: Map<year, Map<themeName, leagues[]>>
 */
function transformLeagues(rows) {
  // Only show leagues marked active (or with null/undefined treated as active)
  const active = (rows || []).filter((r) => r?.is_active !== false);

  const orphans = active.filter((r) => {
    const st = String(r?.status || "").trim().toUpperCase();
    return r?.is_orphan === true || st.includes("ORPHAN");
  });

  // IMPORTANT: keep orphans in the main list too, so they still show in their theme
  const byYear = new Map();

  for (const lg of active) {
    const year = Number(lg?.year) || new Date().getFullYear();
    const themeName =
      (typeof lg?.theme_name === "string" && lg.theme_name.trim()) ||
      (typeof lg?.kind === "string" && lg.kind.trim()) ||
      "Dynasty";

    if (!byYear.has(year)) byYear.set(year, new Map());
    const themeMap = byYear.get(year);
    if (!themeMap.has(themeName)) themeMap.set(themeName, []);
    themeMap.get(themeName).push(lg);
  }

  // sort leagues within each theme by display_order then name
  for (const [year, themeMap] of byYear.entries()) {
    for (const [themeName, leagues] of themeMap.entries()) {
      const sorted = leagues.slice().sort((a, b) => {
        const ao = a?.display_order ?? 9999;
        const bo = b?.display_order ?? 9999;
        if (ao !== bo) return ao - bo;
        return String(a?.name || "").localeCompare(String(b?.name || ""));
      });
      themeMap.set(themeName, sorted);
    }
    byYear.set(year, themeMap);
  }

  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return { orphans, years, byYear };
}

function imageSrcForRow(row, updatedAt) {
  const key = typeof row?.imageKey === "string" ? row.imageKey.trim() : "";
  const url = typeof row?.image_url === "string" ? row.image_url.trim() : "";
  // Prefer R2 keys when present. In some older rows, image_url points to
  // local /public paths that may not exist in production.
  const base = (key ? `/r2/${key}` : "") || url;
  if (!base) return "";

  const bust = updatedAt ? `v=${encodeURIComponent(updatedAt)}` : "";
  if (!bust) return base;
  if (base.includes("?")) return base;
  return `${base}?${bust}`;
}

function PremiumSection({ title, subtitle, kicker, children, className = "" }) {
  return (
    <section
      className={[
        "mt-6 relative overflow-hidden rounded-3xl bg-card-surface",
        "shadow-2xl shadow-black/30",
        "px-6 py-6 sm:px-10 sm:py-8",
        className,
      ].join(" ")}
    >
      {/* subtle glow accents like hero */}
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen">
        <div className="absolute -top-24 -left-10 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <header className="space-y-2">
          {kicker ? (
            <p className="text-xs uppercase tracking-[0.35em] text-accent">{kicker}</p>
          ) : null}
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-muted mx-auto">{subtitle}</p>
          ) : null}
        </header>

        <div>{children}</div>
      </div>
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-subtle bg-subtle-surface px-4 py-4 text-sm text-muted text-center">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

export default function DynastyLeaguesClient({
  // Provided by SectionManifestGate; changes only when the section manifest
  // says dynasty data has changed.
  version = "0",
  manifest = null,
  // Optional: render a single "division" (theme) instead of the index view.
  division = "",
  year,
}) {
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // App Router searchParams can sometimes surface as string[] (e.g. repeated params).
  // Normalize here so the division view reliably matches + renders leagues.
  const divisionStr = Array.isArray(division) ? division[0] : division;
  const yearStr = Array.isArray(year) ? year[0] : year;

  useEffect(() => {
    let cancelled = false;

    // Avoid an initial "v=0" fetch before the manifest resolves.
    if (!manifest) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const cacheKeyVersion = "dynasty:leagues:version";
    const cacheKeyRows = "dynasty:leagues:rows";
    const cacheKeyUpdatedAt = "dynasty:leagues:updatedAt";

    async function run() {
      setErrorMsg("");
      setLoading(true);

      try {
        const v = String(version || "0");

        // If this exact version is cached for this session, skip network entirely.
        try {
          const cachedV = sessionStorage.getItem(cacheKeyVersion);
          if (cachedV === v) {
            const cachedRows = sessionStorage.getItem(cacheKeyRows);
            const cachedUpdatedAt = sessionStorage.getItem(cacheKeyUpdatedAt);
            if (cachedRows) {
              const parsed = JSON.parse(cachedRows);
              if (!cancelled && Array.isArray(parsed)) {
                setUpdatedAt(String(cachedUpdatedAt || ""));
                setRows(parsed.map(normalize));
                return;
              }
            }
          }
        } catch {
          // ignore storage errors
        }

        // Let the /r2 proxy + Cloudflare caching do the heavy lifting (ETag / must-revalidate).
        // We only refetch the big JSON when the manifest version changes.
        const res = await fetch(`/r2/${R2_ROWS_KEY}?v=${encodeURIComponent(v)}`, { cache: "default" });
        if (!res.ok) {
          if (!cancelled) setRows([]);
          return;
        }

        const data = await res.json();
        const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        const stamp = data?.updatedAt || data?.updated_at || "";

        if (cancelled) return;

        setUpdatedAt(String(stamp || ""));
        setRows(list.map(normalize));

        // Persist for this session so navigation doesn't refetch unless version changes.
        try {
          sessionStorage.setItem(cacheKeyVersion, v);
          sessionStorage.setItem(cacheKeyUpdatedAt, String(stamp || ""));
          sessionStorage.setItem(cacheKeyRows, JSON.stringify(list));
        } catch {
          // ignore storage errors
        }
      } catch (err) {
        console.error("Failed to load dynasty leagues from R2:", err);
        if (!cancelled) setErrorMsg("Unable to load leagues right now. Please refresh or try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [version, manifest]);

const { orphans, years, byYear } = useMemo(() => transformLeagues(rows), [rows]);

  const divisionSlug = slugify(divisionStr);
  const yearNum = Number(yearStr || new Date().getFullYear());

  const isDivisionView = Boolean(divisionSlug) && Boolean(yearStr) && Number.isFinite(yearNum);
  const isLeagueView = Boolean(divisionSlug) && Number.isFinite(yearNum);
  let divisionThemeName = "";
  let divisionThemeLeagues = null;
  if (isDivisionView) {
    const themeMap = byYear?.get ? byYear.get(yearNum) : null; // Map<themeName, leagues[]>
    if (themeMap && typeof themeMap?.entries === "function") {
      for (const [themeName, leagues] of themeMap.entries()) {
        if (slugify(themeName) === divisionSlug) {
          divisionThemeName = themeName;
          divisionThemeLeagues = Array.isArray(leagues) ? leagues : [];
          break;
        }
      }
    }
  }
  const scopedOrphans = useMemo(() => {
    // Main directory pages show all orphans.
    if (!isLeagueView) return orphans;

    // Division (league list) page shows only orphans for this division + year.
    return orphans.filter((o) => {
      const oy = Number(o?.year);
      const od = slugify(o?.theme_name || o?.kind || "");
      return oy === yearNum && od === divisionSlug;
    });
  }, [orphans, isLeagueView, yearNum, divisionSlug]);

  const hasOrphans = scopedOrphans.length > 0;

  if (loading) {
    return (
      <PremiumSection title="Dynasty Leagues" subtitle="Loading the directory…">
        <p className="text-center text-sm text-muted">Loading leagues…</p>
      </PremiumSection>
    );
  }

  if (errorMsg) {
    return (
      <PremiumSection title="Dynasty Leagues">
        <p className="text-center text-sm text-danger">{errorMsg}</p>
      </PremiumSection>
    );
  }

  return (
    <>
      {/* ORPHAN OPENINGS (TOP LIST) */}
      <PremiumSection
        kicker="Roster Availability"
        title="Orphan Openings"
        subtitle="When a Dynasty Empire roster becomes available, it will appear here. These are rare and usually go fast."
      >
        {!hasOrphans ? (
          <EmptyState>
            No orphan teams are available right now. Check back after the season or follow announcements in the BALLSVILLE chat.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scopedOrphans.map((o, idx) => (
              <Link
                key={o?.id || `${o?.year}-${o?.theme_name}-${o?.name}-${idx}`}
                href={o?.sleeper_url || "#"}
                className={[
                  "group rounded-2xl border border-accent/60 bg-card-surface p-4",
                  "hover:border-accent hover:-translate-y-0.5 transition",
                  "shadow-[0_0_0_1px_rgba(255,255,255,0.03)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {imageSrcForRow(o) ? (
                      <img
                        src={imageSrcForRow(o)}
                        alt={o?.name || "Orphan team"}
                        className="h-12 w-12 shrink-0 rounded-full border border-subtle bg-panel object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{o?.name || "Orphan Team"}</p>
                      <p className="text-[11px] text-muted truncate">
                        {o?.year} · {o?.theme_name || o?.kind || "Dynasty"}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full border border-accent bg-panel px-2 py-1 text-[11px] tracking-wide uppercase text-accent">
                    Orphan Open
                  </span>
                </div>

                <p className="mt-2 text-[11px] text-muted">
                  Click for Sleeper league details and to request the team.
                </p>
              </Link>
            ))}
          </div>
        )}
      </PremiumSection>

      {/* DIRECTORY */}
      <PremiumSection
        kicker="All Leagues"
        title="League Directory"
        subtitle="All full & active Dynasty Empire leagues, grouped by season and theme. New seasons appear automatically once added in the admin dashboard."
      >
        {years.length === 0 ? (
          <EmptyState>No leagues are configured yet.</EmptyState>
        ) : isDivisionView ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link
                href="/dynasty/divisions"
                prefetch={false}
                className="text-sm text-muted hover:text-foreground transition"
              >
                ← Back to Divisions
              </Link>
              <p className="text-xs uppercase tracking-[0.25em] text-accent">{yearNum} Season</p>
            </div>

            {divisionThemeLeagues ? (
              <>
                <div className="text-center">
                  <h3 className="text-2xl sm:text-3xl font-semibold text-foreground">
                    {divisionThemeName} <span className="text-muted">– {yearNum}</span>
                  </h3>
                  {divisionThemeLeagues?.[0]?.theme_blurb ? (
                    <p className="mt-2 text-sm text-muted max-w-4xl mx-auto">{divisionThemeLeagues[0].theme_blurb}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {divisionThemeLeagues.map((lg, idx) => {
                    const img = imageSrcForRow(lg, updatedAt);
                    const isFilling = lg?.status === "CURRENTLY FILLING" || lg?.status === "DRAFTING";

                    return (
                      <MediaTabCard
                        key={lg?.id || `${yearNum}-${divisionThemeName}-${lg?.name}-${idx}`}
                        href={lg?.sleeper_url || undefined}
                        external={Boolean(lg?.sleeper_url)}
                        prefetch={false}
                        title={lg?.name || "League"}
                        subtitle={`12-team SF · Division ${lg?.display_order ?? "–"}`}
                        metaRight={lg?.status || "FULL & ACTIVE"}
                        imageSrc={img}
                        imageAlt={lg?.name || "League"}
                        footerText={isFilling ? lg?.fill_note || lg?.note || "" : lg?.note || ""}
                        className="h-full"
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState>Division not found.</EmptyState>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {years.map((yr) => {
              const themeMap = byYear.get(yr) || new Map();
              const themeNames = Array.from(themeMap.keys()).sort((a, b) => a.localeCompare(b));
              if (themeNames.length === 0) return null;

              return (
                <div key={yr} className="space-y-6">
                  <div className="flex items-center justify-center">
                    <p className="text-xs uppercase tracking-[0.25em] text-accent">{yr} Season</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {themeNames.map((themeName) => {
                      const leaguesInTheme = themeMap.get(themeName) || [];
                      if (leaguesInTheme.length === 0) return null;
                      const first = [...leaguesInTheme].sort(
                        (a, b) => Number(a?.display_order ?? 0) - Number(b?.display_order ?? 0)
                      )[0];
                      const themeImgKey = typeof first?.theme_imageKey === "string" ? first.theme_imageKey.trim() : "";
                      const themeImgUrl = typeof first?.theme_image_url === "string" ? first.theme_image_url.trim() : "";
                      const img = themeImgKey
                        ? `/r2/${themeImgKey}${updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : ""}`
                        : themeImgUrl
                          ? themeImgUrl
                          : first
                            ? imageSrcForRow(first, updatedAt)
                            : "";
                      const themeBlurb = leaguesInTheme[0]?.theme_blurb || "";

                      return (
                        <MediaTabCard
                          key={`${yr}-${themeName}`}
                          href={`/dynasty/divisions?year=${encodeURIComponent(yr)}&division=${encodeURIComponent(
                            slugify(themeName)
                          )}`}
                          prefetch={false}
                          title={themeName}
                          subtitle={themeBlurb || "View this season's 16 leagues"}
                          metaLeft={`${leaguesInTheme.length} leagues`}
                          badgeRight={String(yr)}
                          imageSrc={img}
                          imageAlt={themeName}
                          className="h-full"
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PremiumSection>
    </>
  );
}
