// DraftCompareHomeClient.jsx (or .js)
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
function safeNum(v, d = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
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
  const season = String(CURRENT_SEASON || "2025");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  return (
    <SectionManifestGate
      manifestKey={`data/manifests/draft-compare_${season}.json`}
      title="Draft Compare"
      description="Compare draft tendencies by league groups."
    >
      {({ version }) => {
        const allKey = `data/draft-compare/modes_all.json?v=${encodeURIComponent(version || "")}`;
        const seasonKey = `data/draft-compare/modes_${season}.json?v=${encodeURIComponent(version || "")}`;

        const allUrl = useMemo(() => r2Url(allKey), [allKey]);
        const seasonUrl = useMemo(() => r2Url(seasonKey), [seasonKey]);

        useEffect(() => {
          let alive = true;
          setErr("");

          async function load() {
            try {
              // try modes_all first
              const resAll = await fetch(allUrl, { cache: "no-store" });
              if (resAll.ok) {
                const j = await resAll.json();
                if (!alive) return;
                setRows(safeArray(j?.rows || j?.modes || j || []));
                return;
              }

              // fallback to modes_{season}.json (back-compat)
              const resSeason = await fetch(seasonUrl, { cache: "no-store" });
              if (!resSeason.ok) throw new Error(`HTTP ${resSeason.status}`);
              const j2 = await resSeason.json();
              if (!alive) return;
              setRows(safeArray(j2?.rows || j2?.modes || j2 || []));
            } catch (e) {
              if (!alive) return;
              setErr(e?.message || "Failed to load modes");
            }
          }

          load();
          return () => {
            alive = false;
          };
        }, [allUrl, seasonUrl]);

        const normalized = useMemo(() => {
          return safeArray(rows)
            .map((r0, idx) => {
              const r1 = r0 || {};
              const title = safeStr(r1.title || r1.name || r1.modeName || "Draft Compare");
              const slug = cleanSlug(r1.slug || r1.modeSlug || r1.id || r1.name || `mode-${idx + 1}`);
              const year = safeNum(r1.year, safeNum(season));
              return {
                id: safeStr(r1.id || `${year}-${slug}` || idx),
                year,
                slug,
                title,
                subtitle: safeStr(r1.subtitle || r1.blurb || ""),
                order: safeNum(r1.order ?? r1.sort ?? idx, idx),
                image_url: safeStr(r1.image_url || r1.imageUrl || r1.image || ""),
              };
            })
            .filter((x) => x.slug)
            .sort((a, b) => (b.year - a.year) || (a.order - b.order));
        }, [rows, season]);

        const byYear = useMemo(() => {
          const m = new Map();
          for (const r of normalized) {
            if (!m.has(r.year)) m.set(r.year, []);
            m.get(r.year).push(r);
          }
          // sort within year
          for (const [y, arr] of m.entries()) {
            arr.sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));
            m.set(y, arr);
          }
          return Array.from(m.entries()).sort((a, b) => b[0] - a[0]); // year desc
        }, [normalized]);

        return (
          <section className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Draft Compare</h1>
                <p className="mt-2 text-sm text-muted">
                  Pick a mode, then build Side A / Side B sets to compare.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/draft-compare/compare-modes"
                  className="rounded-xl border border-subtle bg-black/10 px-4 py-2 text-sm hover:bg-black/15"
                >
                  Compare gamemodes
                </Link>
                <Link
                  href="/"
                  className="rounded-xl border border-subtle bg-black/10 px-4 py-2 text-sm hover:bg-black/15"
                >
                  Home
                </Link>
              </div>
            </div>

            {err ? (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {err}
              </div>
            ) : null}

            {byYear.length ? (
              <div className="mt-8 space-y-10">
                {byYear.map(([year, list]) => (
                  <div key={year}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-primary">{year}</h2>
                      <div className="text-xs text-muted">{list.length} modes</div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((m) => (
                        <Link
                          key={m.id}
                          href={`/draft-compare/mode?mode=${encodeURIComponent(m.slug)}&year=${encodeURIComponent(
                            String(m.year)
                          )}`}
                          className="group relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-soft hover:shadow-glow transition-shadow"
                        >
                          {m.image_url ? (
                            <div className="absolute inset-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.image_url}
                                alt=""
                                className="h-full w-full object-cover opacity-25 group-hover:opacity-30 transition-opacity"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-black/5" />
                          )}

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
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-subtle bg-black/5 p-6 text-sm text-muted">
                No modes yet. Add one in <span className="font-semibold">Admin → Draft Compare</span>.
              </div>
            )}
          </section>
        );
      }}
    </SectionManifestGate>
  );
}
