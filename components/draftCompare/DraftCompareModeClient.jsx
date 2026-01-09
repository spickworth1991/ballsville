
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import { buildGroupFromDraftJson, buildPlayerResults, formatRoundPickFromAvgOverall } from "@/lib/draftCompareUtils";
import { r2Url } from "@/lib/r2Url";

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

const POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF", "UNK"];
const SORT_KEYS = [
  { key: "name", label: "Name" },
  { key: "position", label: "Pos" },
  { key: "adpA", label: "ADP A" },
  { key: "adpB", label: "ADP B" },
  { key: "delta", label: "Δ (B−A)" },
  { key: "roundPickA", label: "R.P A" },
  { key: "roundPickB", label: "R.P B" },
];

function sortPosition(a, b) {
  const pa = safeStr(a || "UNK").toUpperCase();
  const pb = safeStr(b || "UNK").toUpperCase();
  const ia = POS_ORDER.indexOf(pa);
  const ib = POS_ORDER.indexOf(pb);
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function pctLabel(pct) {
  const p = safeNum(pct);
  if (!Number.isFinite(p) || p <= 0) return "";
  return `${Math.round(p * 100)}%`;
}

export default function DraftCompareModeClient() {
  const sp = useSearchParams();
  const mode = safeStr(sp.get("mode") || "").trim();
  const season = safeStr(sp.get("year") || CURRENT_SEASON).trim();

  const [draftJson, setDraftJson] = useState(null);
  const [err, setErr] = useState("");
  const [selectedA, setSelectedA] = useState(() => new Set());
  const [selectedB, setSelectedB] = useState(() => new Set());

  const [view, setView] = useState("list"); // list | board
  const [boardSide, setBoardSide] = useState("A"); // A | B
  const [openCell, setOpenCell] = useState(null);

  // list controls
  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("adpA");
  const [sortDir, setSortDir] = useState("asc"); // asc | desc

  // Load draft json (versioned by manifest)
  return (
    <SectionManifestGate section="draft-compare" season={season} title="Draft Compare" description="Draft tendencies by mode.">
      {({ version, error }) => {
        const v = safeStr(version || "");
        const dataKey = mode ? `data/draft-compare/drafts_${season}_${mode}.json${v ? `?v=${encodeURIComponent(v)}` : ""}` : "";
        const dataUrl = useMemo(() => (dataKey ? r2Url(dataKey, { kind: "data" }) : ""), [dataKey]);

        useEffect(() => {
          let alive = true;
          setErr("");
          setDraftJson(null);

          if (!mode) {
            setErr("Missing mode.");
            return () => {};
          }

          if (!dataUrl) return () => {};

          fetch(dataUrl)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed to load draft data (${r.status})`))))
            .then((j) => {
              if (!alive) return;
              setDraftJson(j);
            })
            .catch((e) => {
              if (!alive) return;
              setErr(safeStr(e?.message || e));
            });

          return () => {
            alive = false;
          };
        }, [mode, dataUrl]);

        const finalErr = err || safeStr(error || "");

        // Leagues list pulled from the uploaded JSON itself
        const allLeagues = useMemo(() => {
          const per = (draftJson && draftJson.perLeague) ? draftJson.perLeague : {};
          const all = [...safeArr(per.sideA), ...safeArr(per.sideB)];
          const m = new Map();
          for (const lg of all) {
            const id = safeStr(lg?.leagueId || lg?.id).trim();
            if (!id) continue;
            if (!m.has(id)) m.set(id, { leagueId: id, name: safeStr(lg?.name || lg?.leagueName || id).trim() });
          }
          return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
        }, [draftJson]);

        // Default selection: if nothing selected, use ALL leagues as Side A
        useEffect(() => {
          if (!draftJson) return;
          if (selectedA.size || selectedB.size) return;
          const ids = allLeagues.map((l) => l.leagueId);
          setSelectedA(new Set(ids));
        }, [draftJson, allLeagues, selectedA.size, selectedB.size]);

        const hasCompare = selectedB.size > 0;

        const groupA = useMemo(() => {
          if (!draftJson) return null;
          const ids = selectedA.size ? Array.from(selectedA) : allLeagues.map((l) => l.leagueId);
          return buildGroupFromDraftJson(draftJson, ids);
        }, [draftJson, selectedA, allLeagues]);

        const groupB = useMemo(() => {
          if (!draftJson) return null;
          if (!selectedB.size) return null;
          return buildGroupFromDraftJson(draftJson, Array.from(selectedB));
        }, [draftJson, selectedB]);

        const rows = useMemo(() => {
          if (!groupA) return [];
          if (!hasCompare) {
            // list-only: map groupA players to compatible results shape
            const meta = groupA.meta || {};
            const teams = safeNum(meta.teams) || 12;
            const playersMap = groupA.players || {};
            const list = Object.values(playersMap).map((p) => {
              const name = safeStr(p?.name).trim();
              const position = safeStr(p?.position || "UNK").trim();
              const adpA = safeNum(p?.avgOverallPick) || null;
              const roundPickA = adpA != null ? formatRoundPickFromAvgOverall(adpA, teams) : null;
              return {
                name,
                position,
                adpA,
                adpB: null,
                delta: null,
                roundPickA,
                roundPickB: null,
                rawA: p,
                rawB: null,
              };
            });
            // default sort by adpA asc
            list.sort((a, b) => safeNum(a.adpA) - safeNum(b.adpA));
            return list;
          }
          return buildPlayerResults(groupA, groupB);
        }, [groupA, groupB, hasCompare]);

        const filteredSorted = useMemo(() => {
          const query = safeStr(q).trim().toLowerCase();
          const pf = safeStr(posFilter).toUpperCase();

          let out = rows.filter((r) => {
            const name = safeStr(r?.name).toLowerCase();
            const pos = safeStr(r?.position || "UNK").toUpperCase();
            if (pf !== "ALL" && pos !== pf) return false;
            if (query && !name.includes(query)) return false;
            return true;
          });

          const dir = sortDir === "desc" ? -1 : 1;

          out.sort((a, b) => {
            if (sortKey === "name") return dir * safeStr(a.name).localeCompare(safeStr(b.name));
            if (sortKey === "position") return dir * sortPosition(a.position, b.position);
            if (sortKey === "adpA") return dir * (safeNum(a.adpA) - safeNum(b.adpA));
            if (sortKey === "adpB") return dir * (safeNum(a.adpB) - safeNum(b.adpB));
            if (sortKey === "delta") return dir * (safeNum(a.delta) - safeNum(b.delta));
            if (sortKey === "roundPickA") return dir * safeStr(a.roundPickA).localeCompare(safeStr(b.roundPickA));
            if (sortKey === "roundPickB") return dir * safeStr(a.roundPickB).localeCompare(safeStr(b.roundPickB));
            return 0;
          });

          return out;
        }, [rows, q, posFilter, sortKey, sortDir]);

        const teams = safeNum(groupA?.meta?.teams) || safeNum(draftJson?.meta?.teams) || 12;
        const rounds = safeNum(groupA?.meta?.rounds) || safeNum(draftJson?.meta?.rounds) || 18;

        const boardGroup = boardSide === "B" && groupB ? groupB : groupA;

        function toggleLeague(id, side) {
          const lid = safeStr(id).trim();
          if (!lid) return;

          setSelectedA((prev) => {
            const n = new Set(prev);
            const inA = n.has(lid);
            if (side === "A") {
              if (inA) n.delete(lid);
              else n.add(lid);
            } else {
              // if toggling B, ensure removed from A
              n.delete(lid);
            }
            return n;
          });

          setSelectedB((prev) => {
            const n = new Set(prev);
            const inB = n.has(lid);
            if (side === "B") {
              if (inB) n.delete(lid);
              else n.add(lid);
            } else {
              // if toggling A, ensure removed from B
              n.delete(lid);
            }
            return n;
          });
        }

        function setSort(nextKey) {
          if (sortKey === nextKey) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          } else {
            setSortKey(nextKey);
            setSortDir(nextKey === "name" || nextKey === "position" ? "asc" : "asc");
          }
        }

        return (
          <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{mode ? safeStr(mode).toUpperCase() : "Draft Compare"}</h1>
                  <span className="rounded-lg border border-subtle bg-card-surface px-2 py-1 text-[11px] text-muted">{season}</span>
                  {hasCompare ? (
                    <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                      Compare mode
                    </span>
                  ) : (
                    <span className="rounded-lg border border-subtle bg-black/10 px-2 py-1 text-[11px] text-muted">All leagues</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted">
                  Select leagues for Side A / Side B, then switch between the premium list and draftboard views.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/draft-compare" className="rounded-xl border border-subtle bg-card-surface px-3 py-2 text-sm hover:bg-card-surface/80">
                  ← Modes
                </Link>
                <Link href="/admin/draft-compare" className="rounded-xl border border-subtle bg-card-surface px-3 py-2 text-sm hover:bg-card-surface/80">
                  Admin
                </Link>
              </div>
            </div>

            {finalErr ? (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {finalErr}
              </div>
            ) : null}

            {!finalErr && !draftJson ? (
              <div className="mt-10 rounded-2xl border border-subtle bg-card-surface p-6 text-sm text-muted">Loading draft data…</div>
            ) : null}

            {!finalErr && draftJson ? (
              <>
                {/* League selector */}
                <div className="mt-8 rounded-2xl border border-subtle bg-card-surface p-4 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-medium">Leagues</div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span>A: {selectedA.size || allLeagues.length}</span>
                      <span>•</span>
                      <span>B: {selectedB.size}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {allLeagues.map((lg) => {
                      const id = lg.leagueId;
                      const inA = selectedA.has(id);
                      const inB = selectedB.has(id);
                      return (
                        <div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-black/5 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{lg.name}</div>
                            <div className="truncate text-[11px] text-muted">{id}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleLeague(id, "A")}
                              className={classNames(
                                "rounded-lg border px-2.5 py-1 text-xs transition",
                                inA ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100" : "border-subtle bg-card-surface hover:bg-card-surface/80"
                              )}
                              title="Toggle Side A"
                            >
                              A
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleLeague(id, "B")}
                              className={classNames(
                                "rounded-lg border px-2.5 py-1 text-xs transition",
                                inB ? "border-purple-400/40 bg-purple-400/15 text-purple-100" : "border-subtle bg-card-surface hover:bg-card-surface/80"
                              )}
                              title="Toggle Side B"
                            >
                              B
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setView("list")}
                        className={classNames(
                          "rounded-xl border px-3 py-2 text-sm transition",
                          view === "list" ? "border-white/20 bg-white/10" : "border-subtle bg-card-surface hover:bg-card-surface/80"
                        )}
                      >
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => setView("board")}
                        className={classNames(
                          "rounded-xl border px-3 py-2 text-sm transition",
                          view === "board" ? "border-white/20 bg-white/10" : "border-subtle bg-card-surface hover:bg-card-surface/80"
                        )}
                      >
                        Draftboard
                      </button>
                    </div>

                    {view === "board" && hasCompare ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBoardSide("A")}
                          className={classNames(
                            "rounded-xl border px-3 py-2 text-sm transition",
                            boardSide === "A" ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100" : "border-subtle bg-card-surface hover:bg-card-surface/80"
                          )}
                        >
                          Side A
                        </button>
                        <button
                          type="button"
                          onClick={() => setBoardSide("B")}
                          className={classNames(
                            "rounded-xl border px-3 py-2 text-sm transition",
                            boardSide === "B" ? "border-purple-400/40 bg-purple-400/15 text-purple-100" : "border-subtle bg-card-surface hover:bg-card-surface/80"
                          )}
                        >
                          Side B
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* List */}
                {view === "list" ? (
                  <div className="mt-6 rounded-2xl border border-subtle bg-card-surface shadow-soft">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle p-4">
                      <div className="text-sm font-medium">Players</div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                          <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search name…"
                            className="w-64 max-w-[75vw] rounded-xl border border-subtle bg-black/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                          />
                        </div>

                        <select
                          value={posFilter}
                          onChange={(e) => setPosFilter(e.target.value)}
                          className="rounded-xl border border-subtle bg-black/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                        >
                          <option value="ALL">All positions</option>
                          {POS_ORDER.filter((p) => p !== "UNK").map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                          <option value="UNK">UNK</option>
                        </select>
                      </div>
                    </div>

                    <div className="max-h-[70vh] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-card-surface">
                          <tr className="border-b border-subtle text-left text-[11px] uppercase tracking-wide text-muted">
                            {SORT_KEYS.map((h) => (
                              <th key={h.key} className="whitespace-nowrap px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setSort(h.key)}
                                  className="inline-flex items-center gap-1 hover:text-white"
                                >
                                  {h.label}
                                  {sortKey === h.key ? <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle/60">
                          {filteredSorted.map((r) => {
                            const delta = r.delta;
                            const deltaCls =
                              delta == null
                                ? "text-muted"
                                : delta > 0
                                ? "text-emerald-200"
                                : delta < 0
                                ? "text-rose-200"
                                : "text-muted";
                            return (
                              <tr key={`${r.name}|||${r.position}`} className="hover:bg-white/5">
                                <td className="px-4 py-3">
                                  <div className="font-medium">{r.name}</div>
                                </td>
                                <td className="px-4 py-3 text-muted">{r.position}</td>
                                <td className="px-4 py-3">{r.adpA == null ? "—" : safeNum(r.adpA).toFixed(1)}</td>
                                <td className="px-4 py-3">{r.adpB == null ? "—" : safeNum(r.adpB).toFixed(1)}</td>
                                <td className={classNames("px-4 py-3", deltaCls)}>
                                  {delta == null ? "—" : `${delta > 0 ? "+" : ""}${safeNum(delta).toFixed(1)}`}
                                </td>
                                <td className="px-4 py-3 text-muted">{r.roundPickA || "—"}</td>
                                <td className="px-4 py-3 text-muted">{r.roundPickB || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-subtle p-4 text-xs text-muted">
                      <div>
                        Showing <span className="text-white">{filteredSorted.length}</span> players
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg border border-subtle bg-black/10 px-2 py-1">
                          Teams: {teams}
                        </span>
                        <span className="rounded-lg border border-subtle bg-black/10 px-2 py-1">
                          Rounds: {rounds}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Draftboard */}
                {view === "board" && boardGroup ? (
                  <div className="mt-6 rounded-2xl border border-subtle bg-card-surface p-4 shadow-soft">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Draftboard</div>
                        <div className="mt-1 text-xs text-muted">
                          Click a square to see all players taken at that spot.
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="rounded-lg border border-subtle bg-black/10 px-2 py-1">R{rounds}</span>
                        <span className="rounded-lg border border-subtle bg-black/10 px-2 py-1">{teams} teams</span>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-subtle">
                      <div className="min-w-[900px]">
                        {Array.from({ length: rounds }).map((_, rIdx) => {
                          const roundNum = rIdx + 1;
                          const direction = roundNum % 2 === 1 ? "L2R" : "R2L";
                          return (
                            <div key={roundNum} className="grid" style={{ gridTemplateColumns: `72px repeat(${teams}, minmax(110px, 1fr))` }}>
                              <div className="border-b border-r border-subtle bg-black/10 p-2 text-xs font-semibold text-muted">R{roundNum}</div>
                              {Array.from({ length: teams }).map((__, colIdx) => {
                                const displaySlot = colIdx + 1;
                                const actualSlot = direction === "L2R" ? displaySlot : teams - displaySlot + 1;
                                const cellKey = `${roundNum}-${actualSlot}`;
                                const entries = safeArr(boardGroup?.draftboard?.cells?.[cellKey]);
                                const primary = entries[0];

                                const overallPick = (roundNum - 1) * teams + actualSlot;
                                const rp = formatRoundPickFromAvgOverall(overallPick, teams);

                                const open = () => {
                                  if (!entries.length) return;
                                  setOpenCell({ cellKey, round: roundNum, slot: actualSlot, overallPick, roundPick: rp, entries });
                                };

                                return (
                                  <div
                                    key={`${roundNum}-${colIdx}`}
                                    role={entries.length ? "button" : undefined}
                                    tabIndex={entries.length ? 0 : -1}
                                    onClick={open}
                                    onKeyDown={(e) => {
                                      if (!entries.length) return;
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        open();
                                      }
                                    }}
                                    className={classNames(
                                      "relative border-b border-r border-subtle p-2 text-xs transition",
                                      entries.length ? "cursor-pointer hover:bg-white/5" : "bg-black/5"
                                    )}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="text-[11px] font-semibold text-muted">{rp}</div>
                                      <div className="text-[10px] text-muted">#{overallPick}</div>
                                    </div>

                                    {primary ? (
                                      <div className="mt-2">
                                        <div className="truncate font-semibold">{primary.name}</div>
                                        <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted">
                                          <span>{primary.position}</span>
                                          <span>{primary.count}x • {pctLabel(primary.pct)}</span>
                                        </div>
                                        {entries.length > 1 ? (
                                          <div className="mt-1 text-[10px] text-muted">+{entries.length - 1} more</div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div className="mt-4 text-center text-[11px] text-muted/50">—</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Modal */}
                    {openCell ? (
                      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
                        <div className="absolute inset-0 bg-black/60" onClick={() => setOpenCell(null)} />
                        <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-subtle bg-card-surface shadow-xl">
                          <div className="flex items-start justify-between gap-3 border-b border-subtle p-4">
                            <div>
                              <div className="text-sm font-semibold">Pick {openCell.roundPick} <span className="text-muted">• #{openCell.overallPick}</span></div>
                              <div className="mt-1 text-xs text-muted">
                                Round {openCell.round}, slot {openCell.slot}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setOpenCell(null)}
                              className="rounded-xl border border-subtle bg-black/10 px-3 py-2 text-xs hover:bg-black/15"
                            >
                              Close
                            </button>
                          </div>

                          <div className="max-h-[65vh] overflow-auto p-4">
                            <div className="space-y-2">
                              {safeArr(openCell.entries)
                                .slice()
                                .sort((a, b) => (safeNum(b.pct) - safeNum(a.pct)) || safeStr(a.name).localeCompare(safeStr(b.name)))
                                .map((e) => (
                                  <div key={`${e.name}|||${e.position}`} className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-black/5 px-3 py-2">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium">{e.name}</div>
                                      <div className="text-[11px] text-muted">{e.position}</div>
                                    </div>
                                    <div className="shrink-0 text-right text-[11px] text-muted">
                                      <div className="font-semibold text-white">{pctLabel(e.pct) || "—"}</div>
                                      <div>{safeNum(e.count)}x</div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="border-t border-subtle p-4 text-xs text-muted">
                            Tip: higher % means that player is drafted at this spot more often across selected leagues.
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        );
      }}
    </SectionManifestGate>
  );
}
