"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import MediaTabCard from "@/components/ui/MediaTabCard";

function statusBadge(status) {
  const s = String(status || "TBD").toUpperCase();
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border";
  if (s === "FULL") return <span className={`${base} bg-emerald-500/15 text-emerald-200 border-emerald-400/30`}>FULL</span>;
  if (s === "FILLING") return <span className={`${base} bg-amber-500/15 text-amber-200 border-amber-400/30`}>FILLING</span>;
  if (s === "DRAFTING") return <span className={`${base} bg-sky-500/15 text-sky-200 border-sky-400/30`}>DRAFTING</span>;
  return <span className={`${base} bg-zinc-500/15 text-zinc-200 border-zinc-400/30`}>TBD</span>;
}

function normalizeRows(rows) {
  const safe = Array.isArray(rows) ? rows : [];
  const headers = safe.filter((r) => r && r.is_legion_header);
  const leagues = safe.filter((r) => r && !r.is_legion_header);
  const byLegion = new Map();
  for (const l of leagues) {
    const slug = String(l.legion_slug || "");
    if (!slug) continue;
    if (!byLegion.has(slug)) byLegion.set(slug, []);
    byLegion.get(slug).push(l);
  }
  for (const [slug, list] of byLegion.entries()) {
    list.sort((a, b) => Number(a.league_order || 0) - Number(b.league_order || 0));
  }
  return { headers, byLegion };
}

export default function GauntletLegionClient({ year, legionSlug, backHref }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/r2/data/gauntlet/leagues_${year}.json`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load gauntlet data (${res.status})`);
        const json = await res.json();
        const next = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];
        if (!alive) return;
        setRows(next);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load data");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [year]);

  const view = useMemo(() => normalizeRows(rows), [rows]);
  const header = useMemo(() => view.headers.find((h) => String(h.legion_slug) === String(legionSlug)), [view.headers, legionSlug]);
  const leagues = useMemo(() => view.byLegion.get(String(legionSlug)) || [], [view.byLegion, legionSlug]);

  if (loading) {
    return (
      <main className="section">
        <div className="container-site">
          <p className="text-muted">Loading…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="section">
        <div className="container-site max-w-3xl mx-auto">
          <div className="card bg-card-surface border border-subtle p-6">
            <h1 className="h2 text-primary">Gauntlet Legion</h1>
            <p className="mt-2 text-fg">{error}</p>
            <div className="mt-6">
              <Link href={backHref || "/gauntlet"} className="btn btn-primary rounded-full px-6 py-3">
                Back
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!header) {
    return (
      <main className="section">
        <div className="container-site max-w-3xl mx-auto">
          <div className="card bg-card-surface border border-subtle p-6">
            <h1 className="h2 text-primary">Legion not found</h1>
            <p className="mt-2 text-muted">We couldn’t find that legion in {year}.</p>
            <div className="mt-6">
              <Link href={backHref || "/gauntlet"} className="btn btn-primary rounded-full px-6 py-3">
                Back to Gauntlet
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const img = header.legion_image_url || header.legion_image_key || "";
  const activeLeagues = leagues.filter((l) => l.is_active !== false);

  return (
    <main className="section">
      <div className="container-site">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-muted">GAUNTLET • {year}</p>
            <h1 className="h1 text-primary">{header.legion_name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(header.legion_status)}
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-subtle bg-card-subtle text-fg">
              {activeLeagues.length} leagues
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <div className="card bg-card-surface border border-subtle overflow-hidden">
              <div className="relative w-full aspect-[4/3] bg-black/20">
                {img ? (
                  <Image src={img} alt={header.legion_name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-muted">No image</div>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm text-muted">Choose a league below to open it on Sleeper.</p>
                <div className="mt-4">
                  <Link href={backHref || "/gauntlet"} className="btn btn-ghost rounded-full px-5 py-2">
                    ← Back
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeLeagues.map((l) => {
                const leagueImg = l.league_image_url || l.league_image_key || "";
                const href = l.league_url || "";

                return (
                  <MediaTabCard
                    key={`${l.legion_slug}_${l.league_order}`}
                    href={href}
                    external
                    title={l.league_name || "Sleeper League"}
                    subtitle={`League ${l.league_order}`}
                    metaLeft={l.league_status ? statusBadge(l.league_status) : null}
                    imageSrc={leagueImg || null}
                    imageAlt={l.league_name || "League"}
                    footerText="Open League"
                  />
                );
              })}

              {activeLeagues.length === 0 ? (
                <div className="card bg-card-surface border border-subtle p-6 sm:col-span-2">
                  <p className="text-fg">No leagues are marked active for this legion yet.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
