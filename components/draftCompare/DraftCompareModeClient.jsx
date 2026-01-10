"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import { buildGroupFromDraftJson, buildPlayerResults, formatRoundPickFromAvgOverall } from "@/lib/draftCompareUtils";
import { r2Url } from "@/lib/r2Url";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function cleanSlug(s) {
  return safeStr(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function DraftCompareModeClient() {
  const sp = useSearchParams();
  const season = safeStr(sp.get("year") || CURRENT_SEASON || "2025");
  const mode = cleanSlug(sp.get("mode") || "");

  const [draftJson, setDraftJson] = useState(null);
  const [err, setErr] = useState("");

  // selection: { A: Set, B: Set }
  const [selA, setSelA] = useState(() => new Set());
  const [selB, setSelB] = useState(() => new Set());

  const canCompare = selA.size > 0 && selB.size > 0;

  return (
    <SectionManifestGate
      manifestKey={`data/manifests/draft-compare_${season}.json`}
      title="Draft Compare"
      description="Draft tendencies by mode."
    >
      {({ version }) => {
        const dataKey = `data/draft-compare/drafts_${season}_${mode}.json?v=${encodeURIComponent(version || "")}`;
        const fetchUrl = useMemo(() => r2Url(dataKey), [dataKey]);

        useEffect(() => {
          let alive = true;
          setErr("");
          setDraftJson(null);
          if (!mode) return;

          fetch(fetchUrl)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then((j) => {
              if (!alive) return;
              setDraftJson(j);
            })
            .catch((e) => {
              if (!alive) return;
              setErr(e?.message || "Failed to load draft JSON");
            });

          return () => {
            alive = false;
          };
        }, [fetchUrl, mode]);

        const allLeagues = useMemo(() => {
          const per = draftJson?.perLeague || {};
          const a = safeArray(per?.sideA);
          const b = safeArray(per?.sideB);
          const all = [...a, ...b];
          // uniq by leagueId
          const m = new Map();
          for (const lg of all) {
            const id = safeStr(lg?.leagueId || lg?.id).trim();
            if (!id) continue;
            if (!m.has(id)) m.set(id, { leagueId: id, name: safeStr(lg?.name || lg?.leagueName || id) });
          }
          return Array.from(m.values());
        }, [draftJson]);

        // Default: if nothing selected, treat ALL as A (like "All Leagues")
        const groupA = useMemo(() => {
          const ids = selA.size ? Array.from(selA) : allLeagues.map((l) => l.leagueId);
          return buildGroupFromDraftJson(draftJson, ids);
        }, [draftJson, selA, allLeagues]);

        const groupB = useMemo(() => {
          const ids = Array.from(selB);
          return ids.length ? buildGroupFromDraftJson(draftJson, ids) : null;
        }, [draftJson, selB]);

        const rows = useMemo(() => {
          if (!groupA) return [];
          return buildPlayerResults(groupA, groupB);
        }, [groupA, groupB]);

        const teams = safeNum(groupA?.meta?.teams) || 12;
        const rounds = safeNum(groupA?.meta?.rounds) || 18;

        function toggleLeague(id, side) {
          const aHas = selA.has(id);
          const bHas = selB.has(id);

          if (side === "A") {
            const next = new Set(selA);
            if (aHas) next.delete(id);
            else {
              next.add(id);
              // remove from B if present
              if (bHas) {
                const nb = new Set(selB);
                nb.delete(id);
                setSelB(nb);
              }
            }
            setSelA(next);
          } else {
            const next = new Set(selB);
            if (bHas) next.delete(id);
            else {
              next.add(id);
              if (aHas) {
                const na = new Set(selA);
                na.delete(id);
                setSelA(na);
              }
            }
            setSelB(next);
          }
        }

        return (
          <section className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted">Draft Compare</div>
                <h1 className="text-2xl font-bold tracking-tight">{mode || "Mode"}</h1>
                <div className="mt-1 text-sm text-muted">
                  {canCompare ? "Comparing Side A vs Side B" : "Viewing aggregated ADP (Side A)"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/draft-compare"
                  className="rounded-xl border border-subtle bg-black/10 px-4 py-2 text-sm hover:bg-black/15"
                >
                  All Modes
                </Link>
              </div>
            </div>

            {!mode ? (
              <div className="mt-6 rounded-2xl border border-subtle bg-black/5 p-6 text-sm text-muted">
                Missing mode.
              </div>
            ) : err ? (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {err}
              </div>
            ) : !draftJson ? (
              <div className="mt-6 rounded-2xl border border-subtle bg-black/5 p-6 text-sm text-muted">
                Loading…
              </div>
            ) : (
              <>
                {/* League selector */}
                <div className="mt-6 rounded-3xl border border-subtle bg-card-surface p-5 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Select leagues</div>
                      <div className="text-xs text-muted">
                        Click A or B per league. A league can’t be in both sets.
                      </div>
                    </div>
                    <div className="text-xs text-muted">
                      Teams: <span className="font-semibold text-primary">{teams}</span> · Rounds:{" "}
                      <span className="font-semibold text-primary">{rounds}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {allLeagues.map((lg) => {
                      const id = lg.leagueId;
                      const inA = selA.has(id) || (!selA.size && !selB.size); // default all->A
                      const inB = selB.has(id);

                      return (
                        <div
                          key={id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-subtle bg-black/5 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{lg.name}</div>
                            <div className="truncate text-[11px] text-muted">{id}</div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleLeague(id, "A")}
                              className={`rounded-xl px-3 py-1.5 text-xs border transition ${
                                inA
                                  ? "border-accent/40 bg-accent/15 text-accent"
                                  : "border-subtle bg-black/10 hover:bg-black/15"
                              }`}
                            >
                              Side A
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleLeague(id, "B")}
                              className={`rounded-xl px-3 py-1.5 text-xs border transition ${
                                inB
                                  ? "border-primary/40 bg-primary/15 text-primary"
                                  : "border-subtle bg-black/10 hover:bg-black/15"
                              }`}
                            >
                              Side B
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Results */}
                <div className="mt-8 rounded-3xl border border-subtle bg-card-surface p-5 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{canCompare ? "Compare list" : "Player list"}</div>
                    <div className="text-xs text-muted">{rows.length} players</div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[820px] w-full text-sm">
                      <thead className="text-xs text-muted">
                        <tr className="border-b border-subtle">
                          <th className="py-2 text-left">Player</th>
                          <th className="py-2 text-left">Pos</th>
                          <th className="py-2 text-right">A ADP</th>
                          <th className="py-2 text-right">A RP</th>
                          <th className="py-2 text-right">B ADP</th>
                          <th className="py-2 text-right">B RP</th>
                          <th className="py-2 text-right">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const delta = r.delta;
                          return (
                            <tr key={`${r.name}|||${r.position}`} className="border-b border-subtle/70">
                              <td className="py-2 font-medium">{r.name}</td>
                              <td className="py-2 text-muted">{r.position}</td>
                              <td className="py-2 text-right tabular-nums">{r.adpA ?? "—"}</td>
                              <td className="py-2 text-right tabular-nums">
                                {r.roundPickA ?? (r.adpA != null ? formatRoundPickFromAvgOverall(r.adpA, teams) : "—")}
                              </td>
                              <td className="py-2 text-right tabular-nums">{r.adpB ?? "—"}</td>
                              <td className="py-2 text-right tabular-nums">
                                {r.roundPickB ?? (r.adpB != null ? formatRoundPickFromAvgOverall(r.adpB, teams) : "—")}
                              </td>
                              <td
                                className={`py-2 text-right tabular-nums ${
                                  delta == null
                                    ? "text-muted"
                                    : delta > 0
                                    ? "text-primary"
                                    : delta < 0
                                    ? "text-accent"
                                    : "text-muted"
                                }`}
                              >
                                {delta == null ? "—" : delta.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        );
      }}
    </SectionManifestGate>
  );
}
