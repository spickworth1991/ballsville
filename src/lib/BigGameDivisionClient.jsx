"use client";

import { useEffect, useMemo, useState } from "react";

function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function StatusPill({ status }) {
  const map = {
    FULL: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    FILLING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    DRAFTING: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    TBD: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };

  const cls = map[status] || map.TBD;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}
    >
      {status || "TBD"}
    </span>
  );
}

export default function BigGameDivisionClient({
  divisionSlug,
  year,
  backHref,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(
        `/r2/data/biggame/leagues_${year}.json?bust=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setLoading(false);
    }
    load();
  }, [year]);

  const divisionKey = slugify(divisionSlug);

  const divisionRows = useMemo(() => {
    return rows.filter(
      (r) =>
        slugify(r.division_slug || r.division_name) === divisionKey &&
        r.is_active !== false
    );
  }, [rows, divisionKey]);

  const header = divisionRows.find((r) => r.is_division_header);
  const leagues = divisionRows
    .filter((r) => !r.is_division_header)
    .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99));

  if (loading) {
    return <p className="text-muted">Loading division…</p>;
  }

  if (!header) {
    return (
      <div className="card bg-card-surface border border-subtle p-8">
        <p className="text-sm text-muted">Division not found.</p>
      </div>
    );
  }

  return (
    <section className="space-y-10">
      {/* Header */}
      <div className="card bg-card-surface border border-subtle p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">
              Big Game · {year}
            </p>
            <h1 className="text-2xl font-bold mt-1">
              {header.division_name}
            </h1>
            {header.division_blurb && (
              <p className="text-muted mt-3 max-w-3xl">
                {header.division_blurb}
              </p>
            )}
          </div>

          {backHref && (
            <a
              href={backHref}
              className="btn btn-outline rounded-full px-6"
            >
              ← Back
            </a>
          )}
        </div>
      </div>

      {/* Leagues */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {leagues.map((l) => {
          const max = Number(l.max_spots || 0);
          const filled = Number(l.filled_spots || 0);
          const remaining =
            max && filled ? Math.max(max - filled, 0) : null;

          return (
            <a
              key={l.id}
              href={l.league_url || "#"}
              target={l.league_url ? "_blank" : undefined}
              rel="noreferrer"
              className="group card bg-card-surface border border-subtle p-5 hover:border-accent hover:shadow-lg transition"
            >
              {/* Image */}
              {l.image_url && (
                <div className="mb-4 overflow-hidden rounded-xl">
                  <img
                    src={l.image_url}
                    alt={l.league_name}
                    className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Title + status */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold leading-tight">
                  {l.league_name}
                </h3>
                <StatusPill status={l.league_status} />
              </div>

              {/* Spots */}
              <div className="mt-3 text-sm">
                {remaining === 0 ? (
                  <span className="font-semibold text-emerald-400">
                    League Full
                  </span>
                ) : remaining != null ? (
                  <span className="text-muted">
                    {remaining} spot{remaining === 1 ? "" : "s"} remaining
                  </span>
                ) : (
                  <span className="text-muted">Spots TBD</span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
