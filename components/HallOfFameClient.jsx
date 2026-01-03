"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const FALLBACK = {
  title: "Hall of Fame",
  entries: [],
};

function isLocalhost() {
  if (typeof window === "undefined") return false;
  const h = String(window.location?.hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function adminR2Base() {
  // Production: go through /r2 (bucket binding + caching)
  // Localhost: hit the public r2.dev base directly (no Pages Functions required)
  if (!isLocalhost()) return "/r2";

  const base =
    process.env.NEXT_PUBLIC_ADMIN_R2_PROXY_BASE ||
    process.env.NEXT_PUBLIC_ADMIN_R2_PUBLIC_BASE ||
    // Last-resort: your admin bucket public URL (only used on localhost)
    "https://pub-b20eaa361fb04ee5afea1a9cf22eeb57.r2.dev";

  return String(base).replace(/\/$/, "");
}

function normalizeEntry(e, idx) {
  const id = String(e?.id || e?.slug || idx);
  const title = String(e?.title || e?.name || "").trim();
  const subtitle = String(e?.subtitle || e?.note || "").trim();
  const year = e?.year != null ? String(e.year) : "";
  // imageKey should be an R2 key like "media/hall-of-fame/2025/<id>.png".
  // Be tolerant of accidental leading slashes.
  const imageKeyRaw = typeof e?.imageKey === "string" ? e.imageKey : "";
  const imageKey = imageKeyRaw.replace(/^\/+/, "");
  const imageUrl = typeof e?.imageUrl === "string" ? e.imageUrl : "";

  const img = imageKey ? `${adminR2Base()}/${imageKey}` : imageUrl;

  return {
    id,
    title,
    subtitle,
    year,
    imageKey,
    imageUrl,
    img,
    order: Number.isFinite(Number(e?.order)) ? Number(e.order) : idx + 1,
  };
}

function GoldPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--color-primary)]/35 bg-[color:var(--color-primary)]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
      {children}
    </span>
  );
}

function PremiumFrame({ kicker, title, subtitle, children }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen">
        <div className="absolute -top-28 -left-20 h-72 w-72 rounded-full bg-[color:var(--color-primary)]/18 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-[color:var(--color-accent)]/16 blur-3xl" />
        <div className="absolute top-6 right-1/3 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/6 via-transparent to-black/25" />
      </div>

      <div className="relative space-y-4">
        <header className="text-center space-y-2">
          {kicker ? (
            <p className="text-xs uppercase tracking-[0.35em] text-accent">{kicker}</p>
          ) : null}
          {title ? (
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-primary">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="text-sm sm:text-base text-muted max-w-3xl mx-auto">{subtitle}</p>
          ) : null}
        </header>

        {children}
      </div>
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted text-center">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );
}

function HOFCard({ entry, onOpenImage }) {
  const e = entry;
  const title = e.title || "Untitled";

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl",
        "transition hover:-translate-y-0.5 hover:border-[color:var(--color-primary)]/35",
      ].join(" ")}
    >
      {/* plaque glow + faint “gold foil” streak */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition">
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/16 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/12 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--color-primary)]/10 via-transparent to-transparent" />
      </div>

      {/* Image */}
      {e.img ? (
        <button
          type="button"
          onClick={() => onOpenImage?.(e)}
          className="relative block w-full text-left border-b border-subtle bg-black/20 cursor-zoom-in"
          aria-label={`Open image for ${title}`}
        >
          <div
            className="relative mx-auto flex items-center justify-center w-full"
            style={{
              height: "clamp(190px, 22vw, 260px)",
              maxWidth: "780px",
            }}
          >
            {/* background polish */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-16 -left-16 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/6 via-transparent to-black/30" />
            </div>

            <Image
              src={e.img}
              alt={title}
              width={1600}
              height={900}
              sizes="(max-width: 1024px) 100vw, 780px"
              className="relative z-10 object-contain p-3"
              style={{
                maxHeight: "100%",
                maxWidth: "100%",
                width: "auto",
                height: "auto",
              }}
            />

            {/* subtle hint */}
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-subtle bg-card-trans/80 backdrop-blur px-3 py-1 text-[11px] text-muted">
              Click to zoom
            </span>
          </div>
        </button>
      ) : null}

      {/* Content */}
      <div className="relative p-5 sm:p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-fg truncate">
              {title}
            </h2>
            {e.subtitle ? (
              <p className="mt-1 text-sm text-muted line-clamp-2">{e.subtitle}</p>
            ) : null}
          </div>

          {e.year ? <GoldPill>{e.year}</GoldPill> : null}
        </div>

        {/* bottom “nameplate” strip */}
        <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="text-muted">BALLSVILLE</span>
            <span className="font-semibold text-[color:var(--color-primary)]">
              Hall of Fame
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HallOfFameClient({ version = "0", manifest = null }) {
  const [data, setData] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Lightbox / modal
  const [activeEntry, setActiveEntry] = useState(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setActiveEntry(null);
    }
    if (activeEntry) {
      window.addEventListener("keydown", onKeyDown);
      // prevent background scroll while open
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prev;
      };
    }
  }, [activeEntry]);

  useEffect(() => {
    let cancelled = false;

    // Manifest-first: avoid an initial v=0 fetch before SectionManifestGate loads.
    // If a caller passes a real version but no manifest, we still proceed.
    if (!manifest && String(version || "0") === "0") {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    async function load() {
      setErr("");
      setLoading(true);
      try {
        const v = String(version || "0");
        const cacheKeyV = "halloffame:version";
        const cacheKeyData = "halloffame:data";

        // If we already have this exact version in sessionStorage, use it and skip network.
        try {
          const cachedV = sessionStorage.getItem(cacheKeyV);
          if (cachedV && cachedV === v) {
            const cached = sessionStorage.getItem(cacheKeyData);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (!cancelled && parsed && typeof parsed === "object") {
                setData(parsed);
                setLoading(false);
                return;
              }
            }
          }
        } catch {
          // ignore storage errors
        }

        const res = await fetch(
          `${adminR2Base()}/data/hall-of-fame/hall_of_fame.json?v=${encodeURIComponent(v)}`,
          { cache: "default" }
        );
        if (!res.ok) {
          if (!cancelled) setData(FALLBACK);
          return;
        }

        const json = await res.json();
        const title = String(json?.title || FALLBACK.title);
        const list = Array.isArray(json?.entries)
          ? json.entries
          : Array.isArray(json)
          ? json
          : [];
        const entries = list.map(normalizeEntry).sort((a, b) => a.order - b.order);
        const next = { title, entries };

        if (!cancelled) setData(next);

        try {
          sessionStorage.setItem(cacheKeyV, v);
          sessionStorage.setItem(cacheKeyData, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load Hall of Fame.");
          setData(FALLBACK);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [version, manifest]);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          {/* Premium Hero Header */}
          <PremiumFrame
            kicker="LEGENDS LIVE HERE"
            title={data.title}
            subtitle="Past champions, winners, and moments worth remembering. This is the Ballsville record book."
          >
            {/* status strip */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs sm:text-sm">
              <span className="rounded-full border border-subtle bg-card-trans backdrop-blur-sm px-3 py-1 text-muted">
                CONGRATS!
              </span>
              <span className="rounded-full border border-subtle bg-card-trans backdrop-blur-sm px-3 py-1 text-muted">
                Check out the winner quotes!
              </span>
            </div>
          </PremiumFrame>

          {err ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {err}
            </div>
          ) : null}

          {loading ? (
            <EmptyState>Loading…</EmptyState>
          ) : data.entries.length === 0 ? (
            <EmptyState>No entries yet.</EmptyState>
          ) : (
            <>
              {/* little featured banner (no logic change, just vibe) */}
              <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted text-center">
                <span className="font-semibold text-fg">Pro tip:</span> Tap any image to
                screenshot — these are meant to be shared.
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {data.entries.map((e) => (
                  <HOFCard key={e.id} entry={e} onOpenImage={setActiveEntry} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Lightbox Modal */}
      {activeEntry?.img ? (
        <div
          className="fixed inset-x-0 top-[var(--nav-h,72px)] z-[9999]
                    flex items-center justify-center p-4"
          style={{ height: "calc(100vh - var(--nav-h, 72px))" }}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onMouseDown={(e) => {
            // close only if they click the backdrop
            if (e.target === e.currentTarget) setActiveEntry(null);
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-2xl">
            {/* top bar */}
            <div className="flex items-center justify-between gap-3 border-b border-subtle bg-card-trans px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-fg">
                  {activeEntry.title || "Untitled"}
                </div>
                {activeEntry.subtitle ? (
                  <div className="truncate text-xs text-muted">{activeEntry.subtitle}</div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setActiveEntry(null)}
                className="rounded-full border border-subtle bg-card-surface px-3 py-1.5 text-xs text-muted hover:text-fg"
              >
                ✕ Close
              </button>
            </div>

            {/* image area */}
            <div className="relative bg-black/20">
              <div className="relative mx-auto flex items-center justify-center w-full">
                {/* Use next/image but in a big contain layout */}
                <Image
                  src={activeEntry.img}
                  alt={activeEntry.title || "Hall of Fame image"}
                  width={2000}
                  height={1200}
                  sizes="100vw"
                  className="object-contain"
                  style={{
                    width: "100%",
                    height: "auto",
                    maxHeight: "80vh",
                  }}
                  priority
                />
              </div>
            </div>

            {/* footer hint */}
            <div className="border-t border-subtle bg-card-trans px-4 py-3 text-xs text-muted">
              Tip: Press <span className="text-fg font-semibold">Esc</span> to close.
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
