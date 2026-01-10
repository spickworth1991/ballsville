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

function normalizeModesFromJson(j, season) {
  const rows = safeArray(j?.rows || j?.modes || j || []);
  const cleaned = rows
    .map((r, idx) => {
      const slug = cleanSlug(r?.modeSlug || r?.slug || r?.id || r?.name || `mode-${idx + 1}`);
      const title = safeStr(r?.title || r?.name || r?.modeName || slug);
      const subtitle = safeStr(r?.subtitle || r?.blurb || "");
      const order = safeNum(r?.order || r?.sort || 0);

      // ✅ bring image fields back (admin saves these on the mode row)
      const imageKey = safeStr(r?.imageKey || r?.image_key || "");
      const image_url = safeStr(r?.image_url || r?.imageUrl || r?.image || "");

      return { season, slug, title, subtitle, order, imageKey, image_url };
    })
    .filter((x) => x.slug && x.title);

  // Stable sort: order -> title
  cleaned.sort((a, b) => safeNum(a.order) - safeNum(b.order) || safeStr(a.title).localeCompare(safeStr(b.title)));
  return cleaned;
}

function useDraftCompareHomeData(seasons, manifestVersion) {
  const [state, setState] = useState({
    loading: true,
    err: "",
    page: null,
    modesBySeason: {},
    seasonsWithModes: [],
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, loading: true, err: "" }));
      try {
        // Page content: keep using CURRENT_SEASON for the hero (simple + consistent)
        const heroSeason = seasons?.[0] ?? Number(CURRENT_SEASON || 2025);
        const pageUrl = withV(r2Url(`content/draft-compare/page_${heroSeason}.json`), manifestVersion);
        const pageJson = await fetchJsonMaybe(pageUrl);

        // Modes per season
        const results = await Promise.all(
          safeArray(seasons).map(async (y) => {
            const modesUrl = withV(r2Url(`data/draft-compare/modes_${y}.json`), manifestVersion);
            const j = await fetchJsonMaybe(modesUrl);
            if (!j) return { season: y, modes: [] };
            return { season: y, modes: normalizeModesFromJson(j, y) };
          })
        );

        const modesBySeason = Object.create(null);
        const seasonsWithModes = [];
        for (const r of results) {
          modesBySeason[r.season] = safeArray(r.modes);
          if (safeArray(r.modes).length) seasonsWithModes.push(r.season);
        }

        seasonsWithModes.sort((a, b) => Number(b) - Number(a));

        if (cancelled) return;
        setState({
          loading: false,
          err: "",
          page: pageJson,
          modesBySeason,
          seasonsWithModes,
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
  }, [seasons.join("|"), manifestVersion]);

  return state;
}

function ModeCard({ season, mode }) {
  const hasImg = !!safeStr(mode?.image_url).trim();

  return (
    <Link
      prefetch={false}
      href={`/draft-compare/mode?mode=${encodeURIComponent(mode.slug)}&year=${encodeURIComponent(String(season))}`}
      className={cls(
        "group relative overflow-hidden rounded-2xl border border-subtle bg-card-surface shadow-sm",
        "transition hover:-translate-y-[1px] hover:shadow-lg"
      )}
    >
      {/* subtle glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-white/10 blur-3xl opacity-0 transition group-hover:opacity-100" />

      {/* ✅ image header */}
      {hasImg ? (
        <div className="relative">
          <div className="h-28 w-full overflow-hidden border-b border-border/40 bg-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mode.image_url}
              alt=""
              className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:opacity-100 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent" />
        </div>
      ) : null}

      <div className="relative p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{season}</div>
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

  // Try current + previous few seasons; only render sections that actually have modes JSON.
  const seasonsToTry = useMemo(() => {
    const out = [];
    for (let i = 0; i < 4; i++) out.push(base - i); // 4 seasons (adjust if you want)
    return out;
  }, [base]);

  const manifestVersion = safeStr(manifest?.updatedAt || manifest?.nonce || "");

  const { loading, err, page, modesBySeason, seasonsWithModes } = useDraftCompareHomeData(seasonsToTry, manifestVersion);

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
            {seasonsWithModes.map((season) => {
              const modes = safeArray(modesBySeason?.[season]);
              if (!modes.length) return null;

              return (
                <div key={season} className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {season} Modes
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {modes.map((m) => (
                      <ModeCard key={`${season}|||${m.slug}`} season={season} mode={m} />
                    ))}
                  </div>
                </div>
              );
            })}

            {!seasonsWithModes.length ? (
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
    <SectionManifestGate section="draft-compare">
      {(manifest) => <HomeInner manifest={manifest} />}
    </SectionManifestGate>
  );
}
