// components/big-game/BigGameDivisionClient.jsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function statusBadgeClass(status) {
  const s = String(status || "").toUpperCase().trim();
  if (s === "FULL") return "bg-red-500/10 border-red-500/30 text-red-200";
  if (s === "DRAFTING") return "bg-amber-500/10 border-amber-500/30 text-amber-200";
  if (s === "FILLING") return "bg-emerald-500/10 border-emerald-500/30 text-emerald-200";
  return "bg-slate-500/10 border-slate-500/30 text-slate-200";
}

export default function BigGameDivisionClient({ division, divisionsHref = "/big-game", rulesHref = "/big-game/rules" }) {
  const title = safeStr(division?.division || division?.name || "Division");
  const code = safeStr(division?.division_code || division?.code || "");
  const leagues = useMemo(() => safeArr(division?.leagues), [division]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {code ? <div className="text-sm text-muted">Code: {code}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <Link href={divisionsHref} className="btn btn-outline">
            Back
          </Link>
          <Link href={rulesHref} className="btn btn-outline">
            Rules
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {leagues.map((lg, idx) => {
          const st = String(lg?.league_status || "").trim().toUpperCase();
          const isFilling = st === "FILLING";
          const isClickable = isFilling && Boolean(lg?.league_url);

          const total = lg?.total_teams != null ? Number(lg.total_teams) : null;
          const filled = lg?.filled_teams != null ? Number(lg.filled_teams) : null;
          const open = lg?.open_teams != null ? Number(lg.open_teams) : null;
          const hasCounts = Number.isFinite(total) && Number.isFinite(filled);

          return (
            <div key={lg?.id || idx} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{safeStr(lg?.league_name || "League")}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(st)}`}>{st || "TBD"}</span>
                    {hasCounts ? (
                      <span className="inline-flex items-center rounded-full border border-subtle px-2 py-0.5 text-xs text-muted">
                        {filled}/{total}
                        {Number.isFinite(open) ? ` (${open} open)` : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isClickable ? (
                  <a className="btn" href={lg.league_url} target="_blank" rel="noreferrer">
                    Join League
                  </a>
                ) : (
                  <button className="btn" disabled title="League is not open for joining (FILLING + invite link required).">
                    Join League
                  </button>
                )}

                {lg?.sleeper_url ? (
                  <a className="btn btn-outline" href={lg.sleeper_url} target="_blank" rel="noreferrer">
                    League Page
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
