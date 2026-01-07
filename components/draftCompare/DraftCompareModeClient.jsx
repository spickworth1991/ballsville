"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import { buildGroupFromDraftJson, buildPlayerResults, formatRoundPickFromAvgOverall } from "@/lib/draftCompareUtils";

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

function DraftBoard({ group, onClose }) {
  const g = group;
  const m = g?.meta;
  const [openCell, setOpenCell] = useState(null);
  if (!g || !m) return null;
  const { teams, rounds } = m;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-primary">Draft Board</h2>
        <button className="btn btn-secondary" onClick={onClose}>Back to list</button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-subtle bg-card-surface">
        <div className="min-w-[900px]">
          {Array.from({ length: rounds }).map((_, roundIdx) => {
            const roundNum = roundIdx + 1;
            const direction = roundNum % 2 === 1 ? "L2R" : "R2L";
            return (
              <div
                key={roundIdx}
                className="grid"
                style={{ gridTemplateColumns: `80px repeat(${teams}, minmax(0, 1fr))` }}
              >
                <div className="p-2 border-b border-r border-subtle font-semibold bg-black/10">R{roundNum}</div>
                {Array.from({ length: teams }).map((_, colIdx) => {
                  const displaySlot = colIdx + 1;
                  const actualSlot = direction === "L2R" ? displaySlot : teams - displaySlot + 1;
                  const cellKey = `${roundNum}-${actualSlot}`;
                  const entries = g?.draftboard?.cells?.[cellKey] || [];
                  const primary = entries[0];

                  const handleOpen = () => {
                    if (!entries.length) return;
                    setOpenCell({ cellKey, round: roundNum, slot: actualSlot, entries });
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
                      className={`p-2 border-b border-r border-subtle text-xs ${entries.length ? "cursor-pointer hover:bg-black/5" : ""}`}
                    >
                      {primary ? (
                        <>
                          <div className="font-semibold truncate text-primary">{primary.name}</div>
                          <div className="text-muted">{primary.position}</div>
                          <div className="text-muted">
                            {primary.count}x ({Math.round((primary.pct || 0) * 100)}%)
                          </div>
                          {entries.length > 1 ? <div className="mt-1 text-[11px] text-muted">+{entries.length - 1} more</div> : null}
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
        Each square = that draft slot for that round. Multiple leagues are aggregated, so a square can contain multiple different players.
      </div>

      {openCell ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpenCell(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-subtle bg-card-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-primary">Round {openCell.round}, Slot {openCell.slot}</div>
                <div className="text-xs text-muted">{openCell.cellKey}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setOpenCell(null)}>Close</button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              <div className="space-y-2">
                {openCell.entries.map((e, idx) => (
                  <div key={idx} className="rounded-xl border border-subtle bg-black/10 px-3 py-2 text-sm">
                    <div className="font-semibold text-primary">{e.name} <span className="text-muted">({e.position})</span></div>
                    <div className="text-xs text-muted">
                      {e.count}x · {Math.round((e.pct || 0) * 100)}% · avg {fmt(e.avgOverallPick)} ({e.roundPick})
                    </div>
                  </div>
                ))}
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
          fetch(`/r2/data/draft-compare/modes_${year}.json?v=${encodeURIComponent(version)}`),
          fetch(`/r2/data/draft-compare/drafts_${year}_${mode}.json?v=${encodeURIComponent(version)}`),
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

  const results = useMemo(() => {
    if (!compareActive) {
      const g = groupA || allGroup;
      const players = g?.players || {};
      return Object.values(players)
        .map((p) => ({
          name: p.name,
          position: p.position,
          adpA: p.avgOverallPick,
          adpB: null,
          delta: null,
          roundPickA: safeStr(p.modeRoundPick || formatRoundPickFromAvgOverall(p.avgOverallPick, teams)),
          roundPickB: "—",
        }))
        .sort((a, b) => (a.adpA ?? 9999) - (b.adpA ?? 9999));
    }

    return buildPlayerResults(groupA, groupB)
      .sort((a, b) => {
        const da = a.delta;
        const db = b.delta;
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        // biggest movers first
        return Math.abs(db) - Math.abs(da);
      });
  }, [compareActive, groupA, groupB, allGroup, teams]);

  const boardGroup = compareActive ? (boardSide === "B" ? groupB : groupA) : groupA || allGroup;

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
                  <DraftBoard group={boardGroup} onClose={() => setShowBoard(false)} />
                </>
              ) : (
                <div className="rounded-2xl border border-subtle bg-card-surface overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
                    <div className="text-sm font-semibold text-primary">Player List</div>
                    <button className="btn btn-secondary" onClick={() => setShowBoard(true)}>View draftboard</button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted">
                          <th className="text-left px-4 py-3">Player</th>
                          <th className="text-left px-4 py-3">Pos</th>
                          <th className="text-left px-4 py-3">ADP (A)</th>
                          <th className="text-left px-4 py-3">Mode (A)</th>
                          {compareActive ? (
                            <>
                              <th className="text-left px-4 py-3">ADP (B)</th>
                              <th className="text-left px-4 py-3">Mode (B)</th>
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
                                <td className={`px-4 py-3 ${r.delta == null ? "text-muted" : r.delta > 0 ? "text-emerald-200" : "text-rose-200"}`}
                                >
                                  {r.delta == null ? "—" : fmt(r.delta)}
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
