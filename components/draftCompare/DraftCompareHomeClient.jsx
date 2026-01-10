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
        const modesKey = `data/draft-compare/modes_${season}.json?v=${encodeURIComponent(version || "")}`;
        const fetchUrl = useMemo(() => r2Url(modesKey), [modesKey]);

        useEffect(() => {
          let alive = true;
          setErr("");
          fetch(fetchUrl)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then((j) => {
              if (!alive) return;
              const raw = safeArray(j?.rows || j?.modes || j || []);
              const next = raw
                .map((r0, idx) => {
                  const r1 = r0 || {};
                  const slug = cleanSlug(r1.slug || r1.modeSlug || r1.id || r1.name || `mode-${idx + 1}`);
                  return {
                    id: safeStr(r1.id || slug || idx),
                    slug,
                    title: safeStr(r1.title || r1.name || r1.modeName || "Draft Compare"),
                    subtitle: safeStr(r1.subtitle || r1.blurb || ""),
                    order: Number(r1.order ?? r1.sort ?? idx),
                    image_url: safeStr(r1.image_url || r1.imageUrl || r1.image || ""),
                  };
                })
                .filter((x) => x.slug)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
              setRows(next);
            })
            .catch((e) => {
              if (!alive) return;
              setErr(e?.message || "Failed to load modes");
            });
          return () => {
            alive = false;
          };
        }, [fetchUrl]);

        return (
          <section className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Draft Compare</h1>
                <p className="mt-2 text-sm text-muted">
                  Pick a mode, then build Side A / Side B sets to compare.
                </p>
              </div>
              <Link
                href="/"
                className="rounded-xl border border-subtle bg-black/10 px-4 py-2 text-sm hover:bg-black/15"
              >
                Home
              </Link>
            </div>

            {err ? (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {err}
              </div>
            ) : null}

            {rows.length ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((m) => (
                  <Link
                    key={m.id}
                    href={`/draft-compare/mode?mode=${encodeURIComponent(m.slug)}&year=${encodeURIComponent(
                      season
                    )}`}
                    className="group relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-soft hover:shadow-glow transition-shadow"
                  >
                    <div className="absolute inset-0 opacity-20">
                      {m.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
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
