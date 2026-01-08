"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

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

export default function DraftCompareHomeClient({ version }) {
  const season = String(CURRENT_SEASON || "2025");

  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr("");
      try {
        const url = `/r2/data/draft-compare/modes_${encodeURIComponent(season)}.json?v=${encodeURIComponent(
          version || ""
        )}`;

        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const data = await r.json();
        const raw = safeArray(data?.rows || data?.modes || data);

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
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        if (!cancelled) setRows(next);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load modes");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [season, version]);

  const visible = useMemo(() => safeArray(rows), [rows]);

  return (
    <SectionManifestGate section="draft-compare" season={season}>
      {({ version: v2 }) => {
        // prefer the gate's version if provided
        const _v = v2 ?? version;

        return (
          <section className="page">
            <div className="container">
              <div className="hero hero--compact">
                <h1 className="hero__title">Draft Compare</h1>
                <p className="hero__subtitle">
                  Pick a mode, then select leagues for Side A / Side B to compare draft trends.
                </p>
              </div>

              {err ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {err}
                </div>
              ) : null}

              {!visible.length && !err ? (
                <div className="mt-6 rounded-2xl bg-card-surface/40 p-6 text-muted">
                  No modes yet. Add one in Admin → Draft Compare.
                </div>
              ) : null}

              {visible.length ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((m) => (
                    <Link
                      key={m.id}
                      href={`/draft-compare/mode?mode=${encodeURIComponent(m.slug)}&year=${encodeURIComponent(
                        season
                      )}&v=${encodeURIComponent(_v || "")}`}
                      className="group rounded-2xl border border-white/10 bg-card-surface/40 p-5 shadow-sm transition hover:border-white/20 hover:bg-card-surface/60"
                    >
                      <h2 className="text-lg font-semibold text-primary">{m.title}</h2>
                      {m.subtitle ? <p className="mt-1 text-sm text-muted">{m.subtitle}</p> : null}
                      <div className="mt-4 inline-flex items-center gap-2 text-sm text-accent">
                        Open <span aria-hidden>→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        );
      }}
    </SectionManifestGate>
  );
}
