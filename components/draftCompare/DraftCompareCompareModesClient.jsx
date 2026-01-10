// DraftCompareCompareModesClient.jsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { r2Url } from "@/lib/r2Url";
import { CURRENT_SEASON } from "@/lib/season";

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
  return safeStr(s).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export default function DraftCompareCompareModesClient() {
  const season = String(CURRENT_SEASON || "2025");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const modesUrl = useMemo(() => r2Url(`data/draft-compare/modes_all.json?v=${Date.now()}`), []);

  useEffect(() => {
    let alive = true;
    setErr("");

    async function load() {
      try {
        const res = await fetch(modesUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load modes (${res.status})`);
        const j = await res.json();
        if (!alive) return;
        setRows(safeArray(j?.rows || j || []));
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load modes");
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [modesUrl]);

  const normalized = useMemo(() => {
    return safeArray(rows)
      .map((r, idx) => ({
        year: safeNum(r?.year, safeNum(season)),
        slug: cleanSlug(r?.modeSlug || r?.slug || r?.id || `mode-${idx + 1}`),
        title: safeStr(r?.title || r?.name || "Mode"),
      }))
      .filter((x) => x.year && x.slug)
      .sort((a, b) => (b.year - a.year) || a.title.localeCompare(b.title));
  }, [rows, season]);

  const [a, setA] = useState(null);
  const [b, setB] = useState(null);

  const options = normalized;

  const goHref = useMemo(() => {
    if (!a || !b) return "";
    return `/draft-compare/compare-modes/view?yearA=${encodeURIComponent(String(a.year))}&modeA=${encodeURIComponent(
      a.slug
    )}&yearB=${encodeURIComponent(String(b.year))}&modeB=${encodeURIComponent(b.slug)}`;
  }, [a, b]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/draft-compare" className="text-sm text-accent hover:underline">
              ← Draft Compare
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Compare gamemodes</h1>
          <p className="mt-2 text-sm text-muted">
            This compares full gamemodes (no league selection). Choose Mode A and Mode B.
          </p>
        </div>
      </div>

      {err ? (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-border bg-card-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted">Mode A</div>
            <select
              className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-primary"
              value={a ? `${a.year}|||${a.slug}` : ""}
              onChange={(e) => {
                const [y, s] = e.target.value.split("|||");
                const found = options.find((o) => String(o.year) === String(y) && o.slug === s);
                setA(found || null);
              }}
            >
              <option value="">Select…</option>
              {options.map((o) => (
                <option key={`A-${o.year}-${o.slug}`} value={`${o.year}|||${o.slug}`}>
                  {o.year} — {o.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-muted">Mode B</div>
            <select
              className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-primary"
              value={b ? `${b.year}|||${b.slug}` : ""}
              onChange={(e) => {
                const [y, s] = e.target.value.split("|||");
                const found = options.find((o) => String(o.year) === String(y) && o.slug === s);
                setB(found || null);
              }}
            >
              <option value="">Select…</option>
              {options.map((o) => (
                <option key={`B-${o.year}-${o.slug}`} value={`${o.year}|||${o.slug}`}>
                  {o.year} — {o.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Link href="/draft-compare" className="btn btn-secondary">
            Cancel
          </Link>
          {goHref ? (
            <Link href={goHref} className="btn btn-primary">
              Compare →
            </Link>
          ) : (
            <button className="btn btn-primary" disabled>
              Compare →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

