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
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function DraftCompareHomeClient() {
  const season = CURRENT_SEASON;
  const [manifest, setManifest] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const version = useMemo(() => safeStr(manifest?.updatedAt || "0"), [manifest]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr("");
      setLoading(true);

      if (manifest === null) return; // wait for SectionManifestGate

      try {
        const res = await fetch(`/r2/data/draft-compare/modes_${season}.json?v=${encodeURIComponent(version)}`);
        if (res.status === 404) {
          if (!cancelled) setRows([]);
          return;
        }
        if (!res.ok) throw new Error(`Failed to load modes (${res.status})`);
        const data = await res.json();
        const next = safeArray(data?.rows || data);
        if (!cancelled) setRows(next);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load draft compare modes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [season, version, manifest]);

  const visible = useMemo(() => {
    return safeArray(rows)
      .map((r) => ({
        ...r,
        modeSlug: cleanSlug(r?.modeSlug || r?.slug || r?.id || r?.name),
        title: safeStr(r?.title || r?.name || r?.modeName || "Draft Mode"),
        subtitle: safeStr(r?.subtitle || r?.blurb || ""),
      }))
      .filter((r) => r.modeSlug)
      .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));
  }, [rows]);

  return (
    <SectionManifestGate section="draft-compare" season={season} onManifest={setManifest}>
      <section className="section">
        <div className="container-site space-y-6">
          <div className="rounded-2xl border border-subtle bg-card-surface p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Tools</div>
            <h1 className="mt-1 text-2xl font-semibold text-primary">Draft Compare</h1>
            <p className="mt-2 text-sm text-muted">Pick a game mode, then choose which leagues to compare.</p>
          </div>

          {err ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">Loading…</div>
          ) : null}

          {!loading && !visible.length ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">
              No draft compare modes have been configured yet.
            </div>
          ) : null}

          {visible.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((m) => (
                <Link
                  key={m.modeSlug}
                  prefetch={false}
                  // NOTE: This site uses Next output: "export" (static export), so dynamic
                  // route segments cannot be generated at runtime. Use the query-based mode page.
                  href={`/draft-compare/mode?mode=${encodeURIComponent(m.modeSlug)}&year=${encodeURIComponent(String(season))}`}
                  className="card bg-card-surface border border-subtle p-5 hover:border-accent hover:-translate-y-0.5 transition"
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
    </SectionManifestGate>
  );
}