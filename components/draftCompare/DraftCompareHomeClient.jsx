
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import { r2Url } from "@/lib/r2Url";

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default function DraftCompareHomeClient({ year }) {
  const season = year ?? CURRENT_SEASON;

  const [modes, setModes] = useState([]);
  const [err, setErr] = useState("");

  return (
    <SectionManifestGate section="draft-compare" season={season} title="Draft Compare" description="Compare draft tendencies by mode.">
      {({ version, error }) => {
        const v = safeStr(version || "");
        const modesKey = `data/draft-compare/modes_${season}.json${v ? `?v=${encodeURIComponent(v)}` : ""}`;
        const modesUrl = useMemo(() => r2Url(modesKey, { kind: "data" }), [modesKey]);

        useEffect(() => {
          let alive = true;
          setErr("");
          setModes([]);

          fetch(modesUrl)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed to load modes (${r.status})`))))
            .then((j) => {
              if (!alive) return;
              const rows = safeArr(j?.rows || j?.modes || j || []);
              // Normalize minimal fields
              const out = rows
                .map((x) => {
                  const o = x || {};
                  const slug = safeStr(o.slug || o.mode || o.id).trim();
                  if (!slug) return null;
                  return {
                    slug,
                    title: safeStr(o.title || o.name || slug).trim(),
                    subtitle: safeStr(o.subtitle || o.blurb || "").trim(),
                    order: Number.isFinite(Number(o.order)) ? Number(o.order) : 9999,
                    imageKey: safeStr(o.imageKey || o.image_key || "").trim(),
                    imageUrl: safeStr(o.imageUrl || o.image_url || "").trim(),
                  };
                })
                .filter(Boolean)
                .sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));

              setModes(out);
            })
            .catch((e) => {
              if (!alive) return;
              setErr(safeStr(e?.message || e));
            });

          return () => {
            alive = false;
          };
        }, [modesUrl]);

        const finalErr = err || safeStr(error || "");

        return (
          <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">Draft Compare</h1>
                <p className="mt-2 text-sm text-muted">
                  Pick a mode to view its draftboard and player list — then select leagues to compare.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/admin" className="rounded-xl border border-subtle bg-card-surface px-3 py-2 text-sm hover:bg-card-surface/80">
                  Admin
                </Link>
              </div>
            </div>

            {finalErr ? (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {finalErr}
              </div>
            ) : null}

            {!finalErr && modes.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-subtle bg-card-surface p-6 text-sm text-muted">
                Loading modes…
              </div>
            ) : null}

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modes.map((m) => {
                const img = m.imageUrl ? m.imageUrl : m.imageKey ? r2Url(m.imageKey, { kind: "media" }) : "";
                return (
                  <Link
                    key={m.slug}
                    href={`/draft-compare/mode?mode=${encodeURIComponent(m.slug)}&year=${encodeURIComponent(String(season))}`}
                    className="group relative overflow-hidden rounded-2xl border border-subtle bg-card-surface shadow-soft transition hover:-translate-y-[1px] hover:shadow-md"
                  >
                    <div className="absolute inset-0 opacity-70">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="h-full w-full object-cover opacity-40 blur-[0px] transition group-hover:opacity-50" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-white/5 via-transparent to-white/5" />
                      )}
                    </div>
                    <div className="relative p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-lg font-semibold">{m.title}</div>
                          {m.subtitle ? <div className="mt-1 line-clamp-2 text-sm text-muted">{m.subtitle}</div> : null}
                        </div>
                        <div className="shrink-0 rounded-xl border border-subtle bg-black/10 px-2 py-1 text-[11px] text-muted">
                          {m.slug}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-muted">
                        <span>View draftboard</span>
                        <span className="rounded-lg border border-subtle bg-black/10 px-2 py-1 transition group-hover:bg-black/15">
                          Open →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      }}
    </SectionManifestGate>
  );
}
