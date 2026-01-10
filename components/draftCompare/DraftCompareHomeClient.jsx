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
function cleanSlug(s) {
  return safeStr(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function DraftCompareHomeClient() {
  const startYear = Number(CURRENT_SEASON || 2025);
  const years = useMemo(() => {
    // Show the current season and a few past seasons if they exist.
    const out = [];
    for (let i = 0; i < 6; i++) out.push(String(startYear - i));
    return out;
  }, [startYear]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Draft Compare</h1>
          <p className="mt-2 text-sm text-muted">Compare draft tendencies by league groups.</p>
        </div>
        <Link href="/" className="rounded-xl border border-subtle bg-black/10 px-4 py-2 text-sm hover:bg-black/15">
          Home
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/draft-compare/compare-modes"
          className="group relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-soft transition-shadow hover:shadow-glow"
        >
          <div className="relative p-6">
            <div className="text-xs text-muted">Mode</div>
            <div className="mt-1 text-lg font-semibold">Compare gamemodes</div>
            <div className="mt-2 text-sm text-muted line-clamp-3">
              Compare two full gamemodes (no league selection).
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-sm text-accent">
              Open <span aria-hidden>→</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-10 space-y-10">
        {years.map((year) => (
          <YearSection key={year} year={year} />
        ))}
      </div>
    </section>
  );
}

function YearSection({ year }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  return (
    <SectionManifestGate
      manifestKey={`data/manifests/draft-compare_${year}.json`}
      title="Draft Compare"
      description="Compare draft tendencies by league groups."
    >
      {({ version }) => {
        const modesKey = `data/draft-compare/modes_${year}.json?v=${encodeURIComponent(version || "")}`;
        const fetchUrl = useMemo(() => r2Url(modesKey), [modesKey]);

        useEffect(() => {
          let alive = true;
          setErr("");

          fetch(fetchUrl, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then((j) => {
              if (!alive) return;
              const raw = safeArray(j?.rows || j?.modes || j || []);
              const next = raw
                .map((r0, idx) => {
                  const r1 = r0 || {};
                  const slug = cleanSlug(r1.modeSlug || r1.slug || r1.id || r1.name || `mode-${idx + 1}`);
                  return {
                    id: safeStr(r1.id || slug || idx),
                    slug,
                    title: safeStr(r1.title || r1.name || r1.modeName || "Draft Compare"),
                    subtitle: safeStr(r1.subtitle || r1.blurb || ""),
                    order: Number(r1.order ?? r1.sort ?? idx),
                    image_url: safeStr(r1.image_url || r1.imageUrl || r1.image || ""),
                    year: safeStr(r1.year || year),
                  };
                })
                .filter((x) => x.slug)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
              setRows(next);
            })
            .catch((e) => {
              // Missing season is normal — we just hide the section.
              if (!alive) return;
              setErr(e?.message || "Failed to load modes");
              setRows([]);
            });

          return () => {
            alive = false;
          };
        }, [fetchUrl]);

        if (err || !rows.length) return null;

        return (
          <div>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold text-primary">{year}</h2>
              <div className="text-xs text-muted">Modes: {rows.length}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((m) => (
                <Link
                  key={m.id}
                  href={`/draft-compare/mode?mode=${encodeURIComponent(m.slug)}&year=${encodeURIComponent(m.year)}`}
                  className="group relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-soft transition-shadow hover:shadow-glow"
                >
                  <div className="absolute inset-0 opacity-20">
                    {m.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="relative p-6">
                    <div className="text-xs text-muted">Mode</div>
                    <div className="mt-1 text-lg font-semibold">{m.title}</div>
                    {m.subtitle ? (
                      <div className="mt-2 text-sm text-muted line-clamp-3">{m.subtitle}</div>
                    ) : (
                      <div className="mt-2 text-sm text-muted">Open this mode</div>
                    )}
                    <div className="mt-5 inline-flex items-center gap-2 text-sm text-accent">
                      Open <span aria-hidden>→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      }}
    </SectionManifestGate>
  );
}
