"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
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
function cleanSlug(s) {
  return safeStr(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
function fmt(n) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(1);
}


function roundPickLabel(roundNum, pickInRound) {
  return `${roundNum}.${String(pickInRound).padStart(2, "0")}`;
}

function DraftBoard({ group, onClose, sideLabel = "A" }) {
  const g = group;
  const m = g?.meta;
  const [openCell, setOpenCell] = useState(null);
  if (!g || !m) return null;
  const { teams, rounds } = m;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary">Draft Board</h2>
          <div className="text-xs text-muted">
            Click a square to see everyone drafted there across the selected leagues (Side {sideLabel}).
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={onClose}>
            Back to list
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-subtle bg-card-surface shadow-sm">
        <div className="min-w-[980px]">
          {Array.from({ length: rounds }).map((_, roundIdx) => {
            const roundNum = roundIdx + 1;
            const direction = roundNum % 2 === 1 ? "L2R" : "R2L";

            return (
              <div
                key={roundIdx}
                className="grid"
                style={{ gridTemplateColumns: `86px repeat(${teams}, minmax(0, 1fr))` }}
              >
                <div className="p-2 border-b border-r border-subtle font-semibold bg-black/10">
                  <div className="text-xs text-muted">Round</div>
                  <div className="text-sm text-primary">R{roundNum}</div>
                </div>

                {Array.from({ length: teams }).map((_, colIdx) => {
                  const displaySlot = colIdx + 1;
                  const actualSlot = direction === "L2R" ? displaySlot : teams - displaySlot + 1;

                  // pick number *within the round* (1..teams) left-to-right in time order
                  const pickInRound = direction === "L2R" ? actualSlot : teams - actualSlot + 1;
                  const overallPick = (roundNum - 1) * teams + pickInRound;

                  const cellKey = `${roundNum}-${actualSlot}`;
                  const entries = g?.draftboard?.cells?.[cellKey] || [];
                  const primary = entries[0];

                  const handleOpen = () => {
                    if (!entries.length) return;
                    setOpenCell({
                      cellKey,
                      round: roundNum,
                      slot: actualSlot,
                      pickInRound,
                      overallPick,
                      label: roundPickLabel(roundNum, pickInRound),
                      entries,
                    });
                  };

                  return (
                    <div
                      key={colIdx}
                      role={entries.length ? "button" : undefined}
                      tabIndex={entries.length ? 0 : -1}
                      onClick={handleOpen}
                      onKeyDown={(e) => {
                        if (!entries.length) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpen();
                        }
                      }}
                      className={[
                        "p-2 border-b border-r border-subtle text-xs",
                        "relative min-h-[64px]",
                        entries.length ? "cursor-pointer hover:bg-black/5" : "",
                      ].join(" ")}
                    >
                      <div className="absolute right-2 top-2 rounded-full border border-subtle bg-black/10 px-2 py-[2px] text-[10px] text-muted">
                        {roundPickLabel(roundNum, pickInRound)}
                      </div>

                      {primary ? (
                        <>
                          <div className="font-semibold truncate text-primary pr-10">{primary.name}</div>
                          <div className="text-muted pr-10">{primary.position}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-black/10 px-2 py-[2px] text-[10px] text-muted">
                              {Math.round((primary.pct || 0) * 100)}%
                            </span>
                            <span className="text-[10px] text-muted">{primary.count}x</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-muted/40">—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-muted">
        Slot labels show <span className="font-semibold">round.pick</span> (pick-in-round). Because this is aggregated,
        each square can contain multiple players.
      </div>

      {openCell ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpenCell(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-subtle bg-card-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-subtle px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-primary">
                  Pick {openCell.label} <span className="text-muted">•</span> Overall #{openCell.overallPick}
                </div>
                <div className="text-xs text-muted">
                  Round {openCell.round} • Pick {openCell.pickInRound} in round • Cell {openCell.cellKey}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setOpenCell(null)}>
                Close
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-auto">
              <div className="mb-3 text-xs text-muted">
                Showing all players drafted at this slot across the selected leagues, sorted by frequency.
              </div>

              <div className="overflow-x-auto rounded-xl border border-subtle">
                <table className="min-w-[650px] w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted bg-black/10">
                      <th className="text-left px-3 py-2">Player</th>
                      <th className="text-left px-3 py-2">Pos</th>
                      <th className="text-left px-3 py-2">Share</th>
                      <th className="text-left px-3 py-2">Count</th>
                      <th className="text-left px-3 py-2">Avg pick</th>
                      <th className="text-left px-3 py-2">Avg round.pick</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openCell.entries.map((e, idx) => (
                      <tr key={`${e.name}|||${e.position}|||${idx}`} className="border-t border-subtle">
                        <td className="px-3 py-2 font-semibold text-primary whitespace-nowrap">{e.name}</td>
                        <td className="px-3 py-2 text-muted">{e.position}</td>
                        <td className="px-3 py-2 text-muted">{Math.round((e.pct || 0) * 100)}%</td>
                        <td className="px-3 py-2 text-muted">{e.count}</td>
                        <td className="px-3 py-2 text-muted">{fmt(e.avgOverallPick)}</td>
                        <td className="px-3 py-2 text-muted">{safeStr(e.roundPick || "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


function LeagueSelectPanel({ open, onClose, leagues, assignments, setAssignments }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4" onClick={onClose}>
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-subtle bg-card-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-primary">Select leagues</div>
            <div className="text-xs text-muted">Pick Side A, Side B, or leave blank.</div>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>

        <div className="p-4">
          <div className="grid gap-2">
            {leagues.map((l) => {
              const val = assignments[l.leagueId] || "";
              return (
                <div key={l.leagueId} className="grid grid-cols-1 gap-2 rounded-xl border border-subtle bg-black/10 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="font-semibold text-primary truncate">{l.name}</div>
                    <div className="text-xs text-muted truncate">{l.leagueId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`btn ${val === "A" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setAssignments((p) => ({ ...p, [l.leagueId]: val === "A" ? "" : "A" }))}
                    >
                      Side A
                    </button>
                    <button
                      className={`btn ${val === "B" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setAssignments((p) => ({ ...p, [l.leagueId]: val === "B" ? "" : "B" }))}
                    >
                      Side B
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DraftCompareModeClient() {
  const sp = useSearchParams();
  const params = useParams();
  const year = Number(sp.get("year") || CURRENT_SEASON) || CURRENT_SEASON;
  const modeFromPath = cleanSlug(params?.mode);
  const mode = modeFromPath || cleanSlug(sp.get("mode"));

  const [manifest, setManifest] = useState(null);
  const [modes, setModes] = useState([]);
  const [draftJson, setDraftJson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showBoard, setShowBoard] = useState(false);
  const [boardSide, setBoardSide] = useState("A");
  const [selectOpen, setSelectOpen] = useState(false);
  const [posFilter, setPosFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("adpA"); // default; will reset based on compare mode
  const [sortDir, setSortDir] = useState("asc");

  const [assignments, setAssignments] = useState({});

  const version = useMemo(() => safeStr(manifest?.updatedAt || "0"), [manifest]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr("");
      setLoading(true);

      if (manifest === null) return;
      if (!mode) {
        setErr("Missing mode.");
        setLoading(false);
        return;
      }

      try {
        const [mRes, dRes] = await Promise.all([
          await fetch(`${r2Url(`/data/draft-compare/modes_${year}.json?v=${encodeURIComponent(version)}`)}`),
          await fetch(`${r2Url(`data/draft-compare/drafts_${year}_${mode}.json?v=${encodeURIComponent(version)}`)}`),
        ]);

        if (mRes.ok) {
          const m = await mRes.json();
          if (!cancelled) setModes(safeArray(m?.rows || m));
        }

        if (dRes.status === 404) throw new Error("Draft data not found for this mode.");
        if (!dRes.ok) throw new Error(`Failed to load draft data (${dRes.status})`);
        const d = await dRes.json();
        if (!cancelled) setDraftJson(d);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load mode.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [year, mode, version, manifest]);

  const modeMeta = useMemo(() => {
    const rows = safeArray(modes);
    const row = rows
      .map((r) => ({
        ...r,
        modeSlug: cleanSlug(r?.modeSlug || r?.slug || r?.id || r?.name),
        title: safeStr(r?.title || r?.name || r?.modeName || "Draft Compare"),
        subtitle: safeStr(r?.subtitle || r?.blurb || ""),
      }))
      .find((r) => r.modeSlug === mode);
    return row || { modeSlug: mode, title: mode || "Draft Compare", subtitle: "" };
  }, [modes, mode]);

  const allGroup = useMemo(() => {
    if (!draftJson) return null;
    return buildGroupFromDraftJson(draftJson, null);
  }, [draftJson]);

  const leagues = useMemo(() => safeArray(allGroup?.leagues || []), [allGroup]);

  const selectedA = useMemo(
    () => leagues.filter((l) => assignments[l.leagueId] === "A").map((l) => l.leagueId),
    [leagues, assignments]
  );
  const selectedB = useMemo(
    () => leagues.filter((l) => assignments[l.leagueId] === "B").map((l) => l.leagueId),
    [leagues, assignments]
  );

  const hasAnySelection = selectedA.length || selectedB.length;
  const compareActive = selectedA.length && selectedB.length;

  useEffect(() => {
    // Default sort behavior mirrors ADPCompare:
    // - Compare: delta desc (biggest risers/fallers)
    // - Single side: ADP asc
    if (compareActive) {
      setSortKey("delta");
      setSortDir("desc");
    } else {
      setSortKey("adpA");
      setSortDir("asc");
    }
  }, [compareActive]);

  const groupA = useMemo(() => {
    if (!draftJson) return null;
    if (!hasAnySelection) return allGroup;
    if (!selectedA.length) return null;
    return buildGroupFromDraftJson(draftJson, selectedA);
  }, [draftJson, hasAnySelection, selectedA, allGroup]);

  const groupB = useMemo(() => {
    if (!draftJson) return null;
    if (!selectedB.length) return null;
    return buildGroupFromDraftJson(draftJson, selectedB);
  }, [draftJson, selectedB]);

  const teams = allGroup?.meta?.teams || 12;

  
  const baseResults = useMemo(() => {
    if (!compareActive) {
      const g = groupA || allGroup;
      const players = g?.players || {};
      return Object.values(players).map((p) => ({
        name: p.name,
        position: p.position,
        adpA: p.avgOverallPick,
        adpB: null,
        delta: null,
        roundPickA: safeStr(p.modeRoundPick || formatRoundPickFromAvgOverall(p.avgOverallPick, teams)),
        roundPickB: "—",
      }));
    }

    return buildPlayerResults(groupA, groupB);
  }, [compareActive, groupA, groupB, allGroup, teams]);

  const positionOptions = useMemo(() => {
    const set = new Set();
    for (const r of baseResults) {
      const p = safeStr(r?.position).trim();
      if (p) set.add(p);
    }
    return ["ALL", ...Array.from(set).sort()];
  }, [baseResults]);

  const results = useMemo(() => {
    const q = safeStr(search).trim().toLowerCase();
    const pf = safeStr(posFilter).trim();

    const filtered = baseResults.filter((r) => {
      if (pf && pf !== "ALL" && safeStr(r.position) !== pf) return false;
      if (q) {
        const n = safeStr(r.name).toLowerCase();
        if (!n.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === "desc" ? -1 : 1;

    function cmpNum(a, b) {
      const an = a == null ? null : Number(a);
      const bn = b == null ? null : Number(b);
      if (an == null && bn == null) return 0;
      if (an == null) return 1;
      if (bn == null) return -1;
      return an < bn ? -1 : an > bn ? 1 : 0;
    }
    function cmpStr(a, b) {
      const as = safeStr(a).toLowerCase();
      const bs = safeStr(b).toLowerCase();
      return as < bs ? -1 : as > bs ? 1 : 0;
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * cmpStr(a.name, b.name);
        case "position":
          return dir * cmpStr(a.position, b.position);
        case "adpA":
          return dir * cmpNum(a.adpA, b.adpA);
        case "roundPickA":
          return dir * cmpStr(a.roundPickA, b.roundPickA);
        case "adpB":
          return dir * cmpNum(a.adpB, b.adpB);
        case "roundPickB":
          return dir * cmpStr(a.roundPickB, b.roundPickB);
        case "delta":
          // for delta, nulls last; compare absolute if compareActive
          if (compareActive) {
            const da = a.delta == null ? null : Math.abs(a.delta);
            const db = b.delta == null ? null : Math.abs(b.delta);
            return dir * cmpNum(da, db);
          }
          return dir * cmpNum(a.delta, b.delta);
        default:
          return dir * cmpNum(a.adpA, b.adpA);
      }
    });

    return sorted;
  }, [baseResults, search, posFilter, sortKey, sortDir, compareActive]);


  const boardGroup = compareActive ? (boardSide === "B" ? groupB : groupA) : groupA || allGroup;

  const toggleSort = (key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "delta" && compareActive ? "desc" : "asc");
      return key;
    });
  };

  const sortCaret = (key) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-[10px] text-muted">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  return (
    <SectionManifestGate section="draft-compare" season={year} onManifest={setManifest}>
      <section className="section">
        <div className="container-site space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Draft Compare</div>
              <h1 className="mt-1 text-2xl font-semibold text-primary">{modeMeta.title}</h1>
              {modeMeta.subtitle ? <p className="mt-2 text-sm text-muted">{modeMeta.subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <Link prefetch={false} href="/draft-compare" className="btn btn-secondary">All modes</Link>
              <button className="btn btn-primary" onClick={() => setSelectOpen(true)}>Select leagues</button>
            </div>
          </div>

          {err ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">Loading…</div>
          ) : null}

          {!loading && !err && !draftJson ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">
              No data found for this mode.
            </div>
          ) : null}

          {!loading && !err && draftJson ? (
            <>
              {compareActive ? (
                <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">
                  Comparing <span className="font-semibold text-primary">Side A</span> ({selectedA.length}) vs <span className="font-semibold text-primary">Side B</span> ({selectedB.length}).
                </div>
              ) : hasAnySelection ? (
                <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">
                  Showing {selectedA.length ? "Side A" : "Side B"} selection. Pick both sides to compare.
                </div>
              ) : null}

              {showBoard ? (
                <>
                  {compareActive ? (
                    <div className="flex items-center gap-2">
                      <button className={`btn ${boardSide === "A" ? "btn-primary" : "btn-secondary"}`} onClick={() => setBoardSide("A")}>Side A</button>
                      <button className={`btn ${boardSide === "B" ? "btn-primary" : "btn-secondary"}`} onClick={() => setBoardSide("B")}>Side B</button>
                    </div>
                  ) : null}
                  <DraftBoard group={boardGroup} sideLabel={boardSide} onClose={() => setShowBoard(false)} />
                </>
              ) : (
                <div className="rounded-2xl border border-subtle bg-card-surface overflow-hidden">
                  
                  <div className="border-b border-subtle px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-primary">Player List</div>
                        <div className="text-xs text-muted">
                          Sort any column • filter by name/position • {compareActive ? "Side A vs Side B" : "Selected leagues"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <input
                          className="input w-full sm:w-64"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search player name..."
                        />
                        <select className="input w-full sm:w-40" value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
                          {positionOptions.map((p) => (
                            <option key={p} value={p}>
                              {p === "ALL" ? "All positions" : p}
                            </option>
                          ))}
                        </select>

                        <div className="text-xs text-muted sm:mr-1">
                          {results.length} player{results.length === 1 ? "" : "s"}
                        </div>

                        <button className="btn btn-secondary" onClick={() => setShowBoard(true)}>
                          View draftboard
                        </button>
                      </div>
                    </div>
                  </div>

<div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted">
                          <th className="text-left px-4 py-3"><button className="hover:underline" onClick={() => toggleSort("name")}>Player{sortCaret("name")}</button></th>
                          <th className="text-left px-4 py-3"><button className="hover:underline" onClick={() => toggleSort("position")}>Pos{sortCaret("position")}</button></th>
                          <th className="text-left px-4 py-3"><button className="hover:underline" onClick={() => toggleSort("adpA")}>ADP (A){sortCaret("adpA")}</button></th>
                          <th className="text-left px-4 py-3"><button className="hover:underline" onClick={() => toggleSort("roundPickA")}>Mode (A){sortCaret("roundPickA")}</button></th>
                          {compareActive ? (
                            <>
                              <th className="text-left px-4 py-3"><button className="hover:underline" onClick={() => toggleSort("adpB")}>ADP (B){sortCaret("adpB")}</button></th>
                              <th className="text-left px-4 py-3"><button className="hover:underline" onClick={() => toggleSort("roundPickB")}>Mode (B){sortCaret("roundPickB")}</button></th>
                              <th className="text-left px-4 py-3">Δ (B - A)</th>
                            </>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r) => (
                          <tr key={`${r.name}|||${r.position}`} className="border-t border-subtle">
                            <td className="px-4 py-3 font-semibold text-primary whitespace-nowrap">{r.name}</td>
                            <td className="px-4 py-3 text-muted">{r.position}</td>
                            <td className="px-4 py-3 text-muted">{r.adpA == null ? "—" : fmt(r.adpA)}</td>
                            <td className="px-4 py-3 text-muted">{r.roundPickA || "—"}</td>
                            {compareActive ? (
                              <>
                                <td className="px-4 py-3 text-muted">{r.adpB == null ? "—" : fmt(r.adpB)}</td>
                                <td className="px-4 py-3 text-muted">{r.roundPickB || "—"}</td>
                                <td className={`px-4 py-3 font-semibold ${
                                  r.delta == null
                                    ? "text-muted"
                                    : r.delta > 0
                                    ? "text-emerald-200"
                                    : r.delta < 0
                                    ? "text-rose-200"
                                    : "text-muted"
                                }`}
                                >
                                  {r.delta == null ? (
                                    "—"
                                  ) : (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-[10px]">{r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "•"}</span>
                                      {fmt(r.delta)}
                                    </span>
                                  )}
                                </td>
                              </>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </section>

      <LeagueSelectPanel
        open={selectOpen}
        onClose={() => setSelectOpen(false)}
        leagues={leagues}
        assignments={assignments}
        setAssignments={setAssignments}
      />
    </SectionManifestGate>
  );
}
