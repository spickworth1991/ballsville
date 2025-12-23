"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

const FALLBACK = {
  title: "Hall of Fame",
  entries: [],
};

function normalizeEntry(e, idx) {
  const id = String(e?.id || e?.slug || idx);
  const title = String(e?.title || e?.name || "").trim();
  const subtitle = String(e?.subtitle || e?.note || "").trim();
  const year = e?.year != null ? String(e.year) : "";
  const imageKey = typeof e?.imageKey === "string" ? e.imageKey : "";
  const imageUrl = typeof e?.imageUrl === "string" ? e.imageUrl : "";

  const img = imageKey ? `/r2/${imageKey}` : imageUrl;

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

function HOFCard({ entry }) {
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
        <div className="relative border-b border-subtle bg-black/20">
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
          </div>
        </div>
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

export default function HallOfFameClient() {
  const [data, setData] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const bust = useMemo(() => `v=${Date.now()}`, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr("");
      setLoading(true);
      try {
        const res = await fetch(`/r2/data/hall-of-fame/hall_of_fame.json?${bust}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setData(FALLBACK);
          return;
        }
        const json = await res.json();
        const title = String(json?.title || FALLBACK.title);
        const list = Array.isArray(json?.entries) ? json.entries : Array.isArray(json) ? json : [];
        const entries = list.map(normalizeEntry).sort((a, b) => a.order - b.order);
        if (!cancelled) setData({ title, entries });
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load Hall of Fame.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bust]);

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
                <span className="font-semibold text-fg">Pro tip:</span> Tap any image to screenshot — these are meant to be shared.
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {data.entries.map((e) => (
                  <HOFCard key={e.id} entry={e} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
