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
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function withV(url, v) {
  if (!v) return url;
  const hasQ = url.includes("?");
  return `${url}${hasQ ? "&" : "?"}v=${encodeURIComponent(v)}`;
}

export default function DraftCompareHomeClient() {
  const season = CURRENT_SEASON;
  const [modes, setModes] = useState([]);
  const [err, setErr] = useState("");

  return (
    <SectionManifestGate section="draft-compare" season={season}>
      {({ version, error }) => (
        <HomeInner
          season={season}
          version={version}
          gateError={error}
          modes={modes}
          setModes={setModes}
          err={err}
          setErr={setErr}
        />
      )}
    </SectionManifestGate>
  );
}

function HomeInner({ season, version, gateError, modes, setModes, err, setErr }) {
  const modesUrl = useMemo(() => {
    const key = `data/draft-compare/modes_${season}.json`;
    return withV(r2Url(key), version);
  }, [season, version]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setErr("");
        const res = await fetch(modesUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`modes fetch failed (${res.status})`);
        const data = await res.json();
        const rows = safeArray(data?.rows ?? data?.modes ?? data);
        const normalized = rows
          .map((r) => {
            const o = r && typeof r === "object" ? r : {};
            const slug = cleanSlug(o.slug || o.mode || o.id || "");
            return {
              slug,
              title: safeStr(o.title || o.name || slug).trim(),
              subtitle: safeStr(o.subtitle || o.blurb || "").trim(),
              order: Number.isFinite(Number(o.order)) ? Number(o.order) : 9999,
              imageUrl: safeStr(o.imageUrl || o.image_url || o.image || "").trim(),
            };
          })
          .filter((x) => x.slug);

        normalized.sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));
        if (!cancelled) setModes(normalized);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load modes");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [modesUrl, setModes, setErr]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">Draft Compare</h1>
          <p className="mt-2 text-sm text-muted">
            Pick a mode, then select leagues for Side A and Side B to compare drafts.
          </p>
        </div>
      </div>

      {gateError ? (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Manifest error: {String(gateError)}
        </div>
      ) : null}

      {err ? (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {!err && modes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card-surface p-6 text-sm text-muted">
          Loading…
        </div>
      ) : null}

      {modes.length ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map((m) => {
            const href = `/draft-compare/mode?mode=${encodeURIComponent(m.slug)}&year=${encodeURIComponent(
              String(season)
            )}`;
            return (
              <Link
                key={m.slug}
                href={href}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-accent/10 blur-2xl" />
                  <div className="absolute -right-24 -bottom-24 h-56 w-56 rounded-full bg-primary/10 blur-2xl" />
                </div>

                <div className="relative p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-primary">{m.title}</h2>
                      {m.subtitle ? <p className="mt-1 text-sm text-muted">{m.subtitle}</p> : null}
                    </div>
                    <span className="inline-flex items-center rounded-full border border-border bg-background/60 px-2 py-1 text-xs text-muted">
                      {String(season)}
                    </span>
                  </div>

                  <div className="mt-4 inline-flex items-center gap-2 text-sm text-accent">
                    Open <span aria-hidden>→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
