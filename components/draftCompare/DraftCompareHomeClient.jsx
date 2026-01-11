"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import { r2Url } from "@/lib/r2Url";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}
function cleanSlug(s) {
  return safeStr(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function cls(...a) {
  return a.filter(Boolean).join(" ");
}
function withV(url, v) {
  if (!v) return url;
  const hasQ = url.includes("?");
  return `${url}${hasQ ? "&" : "?"}v=${encodeURIComponent(v)}`;
}

async function fetchJsonMaybe(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function normalizeModesFromJson(j, fileSeason) {
  const rows = safeArray(j?.rows || j?.modes || j || []);
  const cleaned = rows
    .map((r, idx) => {
      const slug = cleanSlug(r?.modeSlug || r?.slug || r?.id || r?.name || `mode-${idx + 1}`);
      const title = safeStr(r?.title || r?.name || r?.modeName || slug);
      const subtitle = safeStr(r?.subtitle || r?.blurb || "");
      const order = safeNum(r?.order || r?.sort || 0);
      const year = safeNum(r?.year || r?.season || fileSeason) || safeNum(fileSeason);
      const imageKey = safeStr(r?.imageKey || r?.image_key || "");
      const image_url = safeStr(r?.image_url || r?.imageUrl || r?.image || "");
      return { slug, title, subtitle, order, year, imageKey, image_url };
    })
    .filter((x) => x.slug && x.title);

  // Stable sort inside a year: order -> title
  cleaned.sort((a, b) => safeNum(a.order) - safeNum(b.order) || safeStr(a.title).localeCompare(safeStr(b.title)));
  return cleaned;
}

function useDraftCompareHomeData(seasonsToTry, manifestVersion) {
  const [state, setState] = useState({
    loading: true,
    err: "",
    page: null,
    modesByYear: {},
    yearsWithModes: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, err: "" }));
      try {
        // Hero content: keep using current season for the page content (simple + consistent)
        const heroSeason = seasonsToTry?.[0] ?? Number(CURRENT_SEASON || 2025);
        const pageUrl = withV(r2Url(`content/draft-compare/page_${heroSeason}.json`), manifestVersion);
        const pageJson = await fetchJsonMaybe(pageUrl);

        // Read modes JSONs for each file season...
        const results = await Promise.all(
          safeArray(seasonsToTry).map(async (fileSeason) => {
            const modesUrl = withV(r2Url(`data/draft-compare/modes_${fileSeason}.json`), manifestVersion);
            const j = await fetchJsonMaybe(modesUrl);
            if (!j) return { fileSeason, modes: [] };
            return { fileSeason, modes: normalizeModesFromJson(j, fileSeason) };
          })
        );

        // ...but group cards by *mode.year* so you can have multiple seasons on the homepage at once.
        // De-dupe by (year + slug) in case a mode is accidentally present in multiple files.
        const seen = new Set();
        const modesByYear = Object.create(null);
        for (const r of results) {
          for (const m of safeArray(r?.modes)) {
            const key = `${safeNum(m.year)}|||${m.slug}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const y = safeNum(m.year);
            if (!modesByYear[y]) modesByYear[y] = [];
            modesByYear[y].push(m);
          }
        }

        const yearsWithModes = Object.keys(modesByYear)
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && safeArray(modesByYear[n]).length)
          .sort((a, b) => b - a);

        // Ensure each year section remains sorted.
        for (const y of yearsWithModes) {
          modesByYear[y] = safeArray(modesByYear[y])
            .slice()
            .sort((a, b) => safeNum(a.order) - safeNum(b.order) || safeStr(a.title).localeCompare(safeStr(b.title)));
        }

        if (cancelled) return;
        setState({
          loading: false,
          err: "",
          page: pageJson,
          modesByYear,
          yearsWithModes,
        });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          err: e?.message || "Failed to load Draft Compare content.",
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seasonsToTry.join("|"), manifestVersion]);

  return state;
}

function ModeCard({ mode }) {
  const year = safeNum(mode?.year);
  const imageUrl = safeStr(mode?.image_url);

  return (
    <Link
      prefetch={false}
      href={`/draft-compare/mode?mode=${encodeURIComponent(mode.slug)}&year=${encodeURIComponent(String(year))}`}
      className={cls(
        "group relative overflow-hidden rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm",
        "transition hover:-translate-y-[1px] hover:shadow-lg"
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-contain opacity-[0.22] transition group-hover:opacity-[0.3]"
          loading="lazy"
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/30 to-black/55" />
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-white/10 blur-3xl opacity-0 transition group-hover:opacity-100" />

      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{year}</div>
        <div className="mt-1 text-lg font-semibold text-primary">{mode.title}</div>
        {mode.subtitle ? <div className="mt-1 text-sm text-muted">{mode.subtitle}</div> : null}
        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent">
          Open <span className="transition group-hover:translate-x-0.5">→</span>
        </div>
      </div>
    </Link>
  );
}

function HomeInner({ manifest }) {
  const base = Number(CURRENT_SEASON || 2025);

  // Try current + previous few file seasons (modes JSONs). We only render year sections that actually exist.
  const seasonsToTry = useMemo(() => {
    const out = [];
    for (let i = 0; i < 4; i++) out.push(base - i);
    return out;
  }, [base]);

  const manifestVersion = safeStr(manifest?.updatedAt || manifest?.nonce || "");
  const { loading, err, page, modesByYear, yearsWithModes } = useDraftCompareHomeData(seasonsToTry, manifestVersion);

  const hero = page?.hero || {};
  const heroTitle = safeStr(hero.title || "Draft Compare");
  const heroSubtitle = safeStr(hero.subtitle || "Pick leagues to compare and view ADP + a draftboard.");

  return (
    <section className="section">
      <div className="container-site space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Tools</div>
            <h1 className="mt-1 text-3xl font-semibold text-primary">{heroTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{heroSubtitle}</p>
          </div>

          <div className="flex flex-wrap rounded-2xl border border-subtle bg-card-surface items-center gap-2">
            <Link href="/draft-compare/compare-modes" className="btn btn-secondary">
              Compare gamemodes
            </Link>
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">Loading…</div>
        ) : null}

        {!loading ? (
          <div className="space-y-8">
            {yearsWithModes.map((year) => {
              const modes = safeArray(modesByYear?.[year]);
              if (!modes.length) return null;

              return (
                <div key={year} className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{year} Modes</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {modes.map((m) => (
                      <ModeCard key={`${year}|||${m.slug}`} mode={m} />
                    ))}
                  </div>
                </div>
              );
            })}

            {!yearsWithModes.length ? (
              <div className="rounded-2xl border border-subtle bg-card-surface p-6 text-sm text-muted">
                No mode data found for recent seasons.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function DraftCompareHomeClient() {
  // Use global manifest so updates to any season invalidate the home list.
  return (
    <SectionManifestGate section="draft-compare">{(manifest) => <HomeInner manifest={manifest} />}</SectionManifestGate>
  );
}
