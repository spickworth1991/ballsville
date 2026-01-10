"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import {
  buildGroupFromDraftJson,
  buildPlayerResults,
  formatRoundPickFromAvgOverall,
} from "@/lib/draftCompareUtils";
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

function clsx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function fmtPct(x) {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}

function sortDirToggle(curDir) {
  return curDir === "asc" ? "desc" : "asc";
}

export default function DraftCompareModeClient() {
  const sp = useSearchParams();
  const season = safeStr(sp.get("year") || CURRENT_SEASON || "2025");
  const mode = cleanSlug(sp.get("mode") || "");

  const [draftJson, setDraftJson] = useState(null);
  const [err, setErr] = useState("");

  // league selection
  const [selA, setSelA] = useState(() => new Set());
  const [selB, setSelB] = useState(() => new Set());
  const canCompare = selA.size > 0 && selB.size > 0;

  // premium list controls
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("ALL");
  const [sortKey, setSortKey] = useState("adpA");
  const [sortDir, setSortDir] = useState("asc");

  // draftboard controls
  const [boardSide, setBoardSide] = useState("A"); // "A" | "B"
  const [openCell, setOpenCell] = useState(null); // { key, roundPick, overallPick, entries: [] }

  return (
    <SectionManifestGate
      manifestKey={`data/manifests/draft-compare_${season}.json`}
      title="Draft Compare"
      description="Draft tendencies by mode."
    >
      {({ version }) => {
        const dataKey = `data/draft-compare/drafts_${season}_${mode}.json?v=${encodeURIComponent(
          version || ""
        )}`;
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

        // Leagues present in uploaded JSON
        const allLeagues = useMemo(() => {
          const per = draftJson?.perLeague || {};
          const a = safeArray(per?.sideA);
          const b = safeArray(per?.sideB);
          const all = [...a, ...b];
          const m = new Map();
          for (const lg of all) {
            const id = safeStr(lg?.leagueId || lg?.id).trim();
            if (!id) continue;
            if (!m.has(id))
              m.set(id, {
                leagueId: id,
                name: safeStr(lg?.name || lg?.leagueName || id),
              });
          }
          return Array.from(m.values());
        }, [draftJson]);

        // Default behavior: if nothing selected on either side, treat ALL as A
        const effectiveAIds = useMemo(() => {
          if (selA.size) return Array.from(selA);
          if (selB.size) return Array.from(selA); // empty A is allowed only if B has something, but we'll still keep A empty
          return allLeagues.map((l) => l.leagueId);
        }, [selA, selB, allLeagues]);

        const groupA = useMemo(() => {
          return buildGroupFromDraftJson(draftJson, effectiveAIds);
        }, [draftJson, effectiveAIds]);

        const groupB = useMemo(() => {
          const ids = Array.from(selB);
          return ids.length ? buildGroupFromDraftJson(draftJson, ids) : null;
        }, [draftJson, selB]);

        // Keep board side sane
        useEffect(() => {
          if (!canCompare) setBoardSide("A");
        }, [canCompare]);

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

        const rawRows = useMemo(() => {
          if (!groupA) return [];
          return buildPlayerResults(groupA, groupB);
        }, [groupA, groupB]);

        const allPositions = useMemo(() => {
          const s = new Set();
          for (const r of rawRows) s.add(safeStr(r?.position).trim() || "UNK");
          return Array.from(s).sort((a, b) => a.localeCompare(b));
        }, [rawRows]);

        const filteredRows = useMemo(() => {
          const needle = safeStr(q).trim().toLowerCase();
          return rawRows.filter((r) => {
            if (pos !== "ALL" && safeStr(r?.position).trim() !== pos) return false;
            if (!needle) return true;
            return safeStr(r?.name).toLowerCase().includes(needle);
          });
        }, [rawRows, q, pos]);

        const rows = useMemo(() => {
          const dir = sortDir === "asc" ? 1 : -1;
          const get = (r) => {
            switch (sortKey) {
              case "name":
                return safeStr(r?.name).toLowerCase();
              case "position":
                return safeStr(r?.position).toLowerCase();
              case "adpA":
                return r?.adpA == null ? 1e9 : safeNum(r?.adpA);
              case "adpB":
                return r?.adpB == null ? 1e9 : safeNum(r?.adpB);
              case "delta":
                return r?.delta == null ? 0 : safeNum(r?.delta);
              default:
                return 0;
            }
          };

          const out = [...filteredRows];
          out.sort((a, b) => {
            const av = get(a);
            const bv = get(b);
            if (typeof av === "string" || typeof bv === "string") {
              return dir * String(av).localeCompare(String(bv));
            }
            return dir * (safeNum(av) - safeNum(bv));
          });
          return out;
        }, [filteredRows, sortKey, sortDir]);

        // Draftboard data
        const boardCells = useMemo(() => {
          const g = boardSide === "B" ? groupB : groupA;
          const cells = g?.draftboard?.cells || {};
          return cells && typeof cells === "object" ? cells : {};
        }, [groupA, groupB, boardSide]);

        function openCellModal(cellKey) {
          const entries = safeArray(boardCells?.[cellKey]);
          const [rStr, pStr] = safeStr(cellKey).split("-");
          const round = safeNum(rStr);
          const pickInRound = safeNum(pStr);
          const overallPick = (round - 1) * teams + pickInRound;
          const roundPick = formatRoundPickFromAvgOverall(overallPick, teams);
          setOpenCell({
            key: cellKey,
            entries,
            roundPick,
            overallPick,
            round,
            pickInRound,
          });
        }

        function SortTh({ label, k, align = "left" }) {
          const active = sortKey === k;
          return (
            <th className={clsx("py-2", align === "right" ? "text-right" : "text-left")}>
              <button
                type="button"
                onClick={() => {
                  if (active) setSortDir(sortDirToggle(sortDir));
                  else {
                    setSortKey(k);
                    setSortDir(k === "name" || k === "position" ? "asc" : "asc");
                  }
                }}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 transition",
                  "hover:bg-black/10",
                  active ? "bg-black/10 text-primary" : "text-muted"
                )}
              >
                <span>{label}</span>
                {active ? <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
              </button>
            </th>
          );
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
                              className={clsx(
                                "rounded-xl px-3 py-1.5 text-xs border transition",
                                inA
                                  ? "border-accent/40 bg-accent/15 text-accent"
                                  : "border-subtle bg-black/10 hover:bg-black/15"
                              )}
                            >
                              Side A
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleLeague(id, "B")}
                              className={clsx(
                                "rounded-xl px-3 py-1.5 text-xs border transition",
                                inB
                                  ? "border-primary/40 bg-primary/15 text-primary"
                                  : "border-subtle bg-black/10 hover:bg-black/15"
                              )}
                            >
                              Side B
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Draftboard */}
                <div className="mt-8 rounded-3xl border border-subtle bg-card-surface p-5 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Draftboard</div>
                      <div className="text-xs text-muted">Click any pick to see all players drafted there.</div>
                    </div>
                    {canCompare ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBoardSide("A")}
                          className={clsx(
                            "rounded-xl border px-3 py-1.5 text-xs transition",
                            boardSide === "A"
                              ? "border-accent/40 bg-accent/15 text-accent"
                              : "border-subtle bg-black/10 hover:bg-black/15"
                          )}
                        >
                          Side A
                        </button>
                        <button
                          type="button"
                          onClick={() => setBoardSide("B")}
                          className={clsx(
                            "rounded-xl border px-3 py-1.5 text-xs transition",
                            boardSide === "B"
                              ? "border-primary/40 bg-primary/15 text-primary"
                              : "border-subtle bg-black/10 hover:bg-black/15"
                          )}
                        >
                          Side B
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-muted">Aggregated (Side A)</div>
                    )}
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: `repeat(${Math.max(teams, 1)}, minmax(120px, 1fr))` }}
                    >
                      {Array.from({ length: Math.max(rounds, 1) }, (_, r0) => {
                        const round = r0 + 1;
                        return Array.from({ length: Math.max(teams, 1) }, (_, p0) => {
                          const pickInRound = p0 + 1;
                          const cellKey = `${round}-${pickInRound}`;
                          const entries = safeArray(boardCells?.[cellKey]);
                          const top = entries[0];
                          const overallPick = (round - 1) * teams + pickInRound;
                          const rp = formatRoundPickFromAvgOverall(overallPick, teams);

                          return (
                            <button
                              key={cellKey}
                              type="button"
                              onClick={() => openCellModal(cellKey)}
                              className={clsx(
                                "group relative rounded-2xl border p-3 text-left transition",
                                "border-subtle bg-black/5 hover:bg-black/10"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-[11px] text-muted">
                                  <span className="font-semibold text-primary">{rp}</span>
                                  <span className="ml-2">#{overallPick}</span>
                                </div>
                                <div className="text-[10px] text-muted">{entries.length ? `${entries.length} opts` : ""}</div>
                              </div>

                              {top ? (
                                <>
                                  <div className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                                    {top.name}
                                  </div>
                                  <div className="mt-1 flex items-center justify-between text-[11px]">
                                    <span className="text-muted">{top.position}</span>
                                    <span className="tabular-nums text-muted">
                                      {fmtPct(top.pct)} · {safeNum(top.count)}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="mt-3 text-xs text-muted">No data</div>
                              )}

                              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-transparent transition group-hover:ring-primary/15" />
                            </button>
                          );
                        });
                      }).flat()}
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="mt-8 rounded-3xl border border-subtle bg-card-surface p-5 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{canCompare ? "Compare list" : "Player list"}</div>
                      <div className="mt-1 text-xs text-muted">
                        Sortable columns · Search · Position filter
                      </div>
                    </div>
                    <div className="text-xs text-muted">{rows.length} players</div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[220px]">
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search player…"
                        className="w-full rounded-2xl border border-subtle bg-black/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
                      />
                    </div>
                    <div className="min-w-[170px]">
                      <select
                        value={pos}
                        onChange={(e) => setPos(e.target.value)}
                        className="w-full rounded-2xl border border-subtle bg-black/5 px-3 py-2 text-sm outline-none focus:border-primary/40"
                      >
                        <option value="ALL">All Positions</option>
                        {allPositions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQ("");
                        setPos("ALL");
                        setSortKey("adpA");
                        setSortDir("asc");
                      }}
                      className="rounded-2xl border border-subtle bg-black/10 px-3 py-2 text-sm hover:bg-black/15"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-subtle">
                      <table className="min-w-[860px] w-full text-sm">
                        <thead className="sticky top-0 bg-card-surface text-xs">
                          <tr className="border-b border-subtle">
                            <SortTh label="Player" k="name" align="left" />
                            <SortTh label="Pos" k="position" align="left" />
                            <SortTh label="A ADP" k="adpA" align="right" />
                            <th className="py-2 text-right text-muted">A RP</th>
                            <SortTh label="B ADP" k="adpB" align="right" />
                            <th className="py-2 text-right text-muted">B RP</th>
                            <SortTh label="Δ" k="delta" align="right" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => {
                            const delta = r.delta;
                            return (
                              <tr key={`${r.name}|||${r.position}`} className="border-b border-subtle/70">
                                <td className="py-2 px-3 font-medium">{r.name}</td>
                                <td className="py-2 px-3 text-muted">{r.position}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.adpA ?? "—"}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-muted">
                                  {r.roundPickA ?? (r.adpA != null ? formatRoundPickFromAvgOverall(r.adpA, teams) : "—")}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums">{r.adpB ?? "—"}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-muted">
                                  {r.roundPickB ?? (r.adpB != null ? formatRoundPickFromAvgOverall(r.adpB, teams) : "—")}
                                </td>
                                <td
                                  className={clsx(
                                    "py-2 px-3 text-right tabular-nums",
                                    delta == null
                                      ? "text-muted"
                                      : delta > 0
                                      ? "text-primary"
                                      : delta < 0
                                      ? "text-accent"
                                      : "text-muted"
                                  )}
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
                </div>

                {/* Cell Modal */}
                {openCell ? (
                  <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
                    role="dialog"
                    aria-modal="true"
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) setOpenCell(null);
                    }}
                  >
                    <div className="w-full max-w-2xl rounded-3xl border border-subtle bg-card-surface p-5 shadow-soft">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-muted">Pick</div>
                          <div className="text-lg font-bold">
                            {openCell.roundPick} <span className="text-muted">·</span> #{openCell.overallPick}
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            Round {openCell.round} · Pick {String(openCell.pickInRound).padStart(2, "0")} · {boardSide === "B" ? "Side B" : "Side A"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenCell(null)}
                          className="rounded-2xl border border-subtle bg-black/10 px-3 py-2 text-sm hover:bg-black/15"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-subtle">
                        {safeArray(openCell.entries).length ? (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card-surface text-xs text-muted">
                              <tr className="border-b border-subtle">
                                <th className="py-2 px-3 text-left">Player</th>
                                <th className="py-2 px-3 text-left">Pos</th>
                                <th className="py-2 px-3 text-right">%</th>
                                <th className="py-2 px-3 text-right">Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {safeArray(openCell.entries)
                                .slice()
                                .sort((a, b) => (safeNum(b?.pct) - safeNum(a?.pct)) || safeStr(a?.name).localeCompare(safeStr(b?.name)))
                                .map((e) => (
                                  <tr key={`${e.name}|||${e.position}`} className="border-b border-subtle/70">
                                    <td className="py-2 px-3 font-medium">{e.name}</td>
                                    <td className="py-2 px-3 text-muted">{e.position}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-muted">{fmtPct(e.pct)}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">{safeNum(e.count)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-4 text-sm text-muted">No players recorded for this slot.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        );
      }}
    </SectionManifestGate>
  );
}
