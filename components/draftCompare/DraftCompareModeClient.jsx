// Client-side component for Draft Compare mode.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import { r2Url } from "@/lib/r2Url";
import DraftboardLandscapeTipOverlay from "@/components/draftCompare/DraftboardLandscapeTipOverlay";
import { useDraftboardLandscapeTip } from "@/components/draftCompare/useDraftboardLandscapeTip";
import {
  buildGroupFromDraftJson,
  buildPlayerResults,
  formatRoundPickFromAvgOverall,
} from "@/lib/draftCompareUtils";

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
function withV(url, v) {
  if (!v) return url;
  const hasQ = url.includes("?");
  return `${url}${hasQ ? "&" : "?"}v=${encodeURIComponent(v)}`;
}
function pctFmt(x) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(0)}%`;
}
function cls(...a) {
  return a.filter(Boolean).join(" ");
}

function groupPlayersArray(group) {
  if (!group) return [];
  const g = group;
  if (Array.isArray(g?.players)) return g.players;
  if (g?.players && typeof g.players === "object") return Object.values(g.players);
  return safeArray(g?.playersList);
}

export default function DraftCompareModeClient() {
  const sp = useSearchParams();
  const mode = cleanSlug(sp.get("mode") || "");
  const season = safeStr(sp.get("year") || CURRENT_SEASON || "2025");

  return (
    <SectionManifestGate section="draft-compare" season={season}>
      {({ version, error }) => (
        <ModeInner mode={mode} season={season} version={version} gateError={error} />
      )}
    </SectionManifestGate>
  );
}

function ModeInner({ mode, season, version, gateError }) {
  const [raw, setRaw] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefer the human-friendly title saved in Admin (if present in the JSON)
  const pageTitle = useMemo(() => {
    const t =
      raw?.meta?.title ||
      raw?.meta?.displayTitle ||
      raw?.title ||
      raw?.displayTitle ||
      raw?.modeTitle ||
      raw?.name;
    return safeStr(t).trim() || mode;
  }, [raw, mode]);

  // league sets
  const [sideA, setSideA] = useState([]);
  const [sideB, setSideB] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // view toggle (board/list) — split removed
  const [view, setView] = useState("list"); // "board" | "list"

  // which group is shown on the board when comparing
  const [boardSide, setBoardSide] = useState("A"); // "A" | "B"

  const dataUrl = useMemo(() => {
    if (!mode) return "";
    const key = `data/draft-compare/drafts_${season}_${mode}.json`;
    return withV(r2Url(key), version);
  }, [mode, season, version]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!dataUrl) {
        setRaw(null);
        setLoading(false);
        return;
      }
      try {
        setErr("");
        setLoading(true);
        const res = await fetch(dataUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`draft json fetch failed (${res.status})`);
        const j = await res.json();
        if (!cancelled) setRaw(j);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load draft JSON");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  // Derive league list from the JSON (supports perLeague.sideA/sideB and direct leagues array)
  const leagueRows = useMemo(() => {
    const per = raw?.perLeague;
    const all = [...safeArray(per?.sideA), ...safeArray(per?.sideB), ...safeArray(raw?.leagues)];

    const m = new Map();
    for (const l of all) {
      const id = safeStr(l?.leagueId || l?.id).trim();
      if (!id) continue;
      if (!m.has(id)) {
        m.set(id, {
          leagueId: id,
          name: safeStr(l?.name || l?.leagueName || id).trim() || id,
        });
      }
    }
    return Array.from(m.values());
  }, [raw]);

  // Initialize Side A to "all leagues" once, if user hasn't chosen anything.
  useEffect(() => {
    if (!leagueRows.length) return;
    if (sideA.length || sideB.length) return;
    setSideA(leagueRows.map((x) => x.leagueId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueRows.length]);

  // Safety: if Side A is ever emptied, treat it as "all leagues" so list/board always work.
  const effectiveSideA = useMemo(() => {
    if (sideA.length) return sideA;
    return leagueRows.map((x) => x.leagueId);
  }, [sideA, leagueRows]);

  const comparing = effectiveSideA.length > 0 && sideB.length > 0;

  // keep boardSide sane
  useEffect(() => {
    if (!comparing) setBoardSide("A");
  }, [comparing]);

  const groupA = useMemo(() => {
    if (!raw) return null;
    return buildGroupFromDraftJson(raw, effectiveSideA);
  }, [raw, effectiveSideA]);

  const groupB = useMemo(() => {
    if (!raw) return null;
    if (!sideB.length) return null;
    return buildGroupFromDraftJson(raw, sideB);
  }, [raw, sideB]);

  const effectiveGroupForBoard = useMemo(() => {
    if (!groupA) return null;
    if (!comparing) return groupA;
    return boardSide === "B" && groupB ? groupB : groupA;
  }, [groupA, groupB, comparing, boardSide]);

  const teams = safeNum(groupA?.meta?.teams) || safeNum(groupB?.meta?.teams) || 12;
  const rounds = safeNum(groupA?.meta?.rounds) || safeNum(groupB?.meta?.rounds) || 18;

  const compareRows = useMemo(() => {
    if (!groupA || !groupB) return [];
    return buildPlayerResults(groupA, groupB);
  }, [groupA, groupB]);

  // Adjusted order: renumber players strictly by ADP order (1..N), then map to round.pick.
  // Used for the draftboard and as an extra column in the list.
  const adjustedRankByKey = useMemo(() => {
    if (!groupA) return Object.create(null);

    const base = comparing
      ? safeArray(compareRows).map((r) => ({
          key: `${safeStr(r?.name)}|||${safeStr(r?.position)}`,
          // If a player only appears on one side, use the side that exists
          // so they land in the correct adjusted slot instead of 1.01.
          adp: safeNum(r?.sortAdp || r?.adpA || r?.adpB),
        }))
      : groupPlayersArray(groupA).map((p) => ({
          key: `${safeStr(p?.name)}|||${safeStr(p?.position)}`,
          adp: safeNum(p?.avgOverallPick ?? p?.adp ?? p?.avgPick),
        }));

    const sorted = base
      .filter((x) => x.key && Number.isFinite(x.adp) && x.adp > 0)
      .slice()
      .sort((a, b) => a.adp - b.adp);

    const out = Object.create(null);
    let rank = 0;
    for (const it of sorted) {
      rank += 1;
      out[it.key] = {
        adjustedOverall: rank,
        adjustedRoundPick: formatRoundPickFromAvgOverall(rank, teams),
      };
    }
    return out;
  }, [groupA, compareRows, comparing, teams]);

  // --- list controls ---
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [sortKey, setSortKey] = useState("adp"); // adp | rp | name | pos | delta | adj
  const [sortDir, setSortDir] = useState("asc"); // asc/desc

  const positions = useMemo(() => {
    const set = new Set();
    for (const r of groupPlayersArray(groupA)) {
      const p = safeStr(r?.position).toUpperCase().trim();
      if (p) set.add(p);
    }
    for (const r of safeArray(compareRows)) {
      const p = safeStr(r?.position).toUpperCase().trim();
      if (p) set.add(p);
    }
    return ["ALL", ...Array.from(set).sort()];
  }, [groupA, compareRows]);

  const listRows = useMemo(() => {
    if (!groupA) return [];

    const q = query.trim().toLowerCase();
    const pFilter = pos;

    const base = comparing
      ? compareRows.map((r) => {
          const adpA = r.adpA == null ? null : safeNum(r.adpA);
          const adpB = r.adpB == null ? null : safeNum(r.adpB);
          // Sorting should never treat "missing" as 0 (which forces 1.01).
          const adpSortA = adpA && adpA > 0 ? adpA : Number.POSITIVE_INFINITY;
          const adpSortB = adpB && adpB > 0 ? adpB : Number.POSITIVE_INFINITY;
          return {
            key: `${safeStr(r.name)}|||${safeStr(r.position)}`,
            name: r.name,
            position: r.position,
            adpA,
            adpB,
            adpSortA,
            adpSortB,
            delta: r.delta == null ? null : safeNum(r.delta), // B - A
          };
        })
      : groupPlayersArray(groupA).map((r) => ({
          key: `${safeStr(r.name)}|||${safeStr(r.position)}`,
          name: r.name,
          position: r.position,
          adp: safeNum(r.avgOverallPick ?? r.adp ?? r.avgPick),
          delta: null,
        }));

    const withAdj = base.map((r) => {
      const adj = adjustedRankByKey?.[r.key];
      if (comparing) {
        const a = r.adpA;
        const b = r.adpB;
        return {
          ...r,
          avgPickA: a,
          avgPickB: b,
          // Round.pick for *average overall pick* (A and B stay separate when comparing).
          avgRoundPickA: Number.isFinite(a) && a > 0 ? formatRoundPickFromAvgOverall(a, teams) : "—",
          avgRoundPickB: Number.isFinite(b) && b > 0 ? formatRoundPickFromAvgOverall(b, teams) : "—",
          adjustedOverall: adj?.adjustedOverall ?? null,
          adjustedRoundPick: adj?.adjustedRoundPick ?? "—",
        };
      }
      return {
        ...r,
        avgRoundPick: Number.isFinite(safeNum(r.adp)) && safeNum(r.adp) > 0 ? formatRoundPickFromAvgOverall(safeNum(r.adp), teams) : "—",
        adjustedOverall: adj?.adjustedOverall ?? null,
        adjustedRoundPick: adj?.adjustedRoundPick ?? "—",
      };
    });

    const filtered = withAdj.filter((r) => {
      if (pFilter !== "ALL" && safeStr(r.position).toUpperCase() !== pFilter) return false;
      if (q && !safeStr(r.name).toLowerCase().includes(q)) return false;
      return true;
    });

    const dir = sortDir === "desc" ? -1 : 1;
    filtered.sort((a, b) => {
      if (sortKey === "name") return dir * safeStr(a.name).localeCompare(safeStr(b.name));
      if (sortKey === "pos") return dir * safeStr(a.position).localeCompare(safeStr(b.position));
      if (sortKey === "adj") return dir * (safeNum(a.adjustedOverall) - safeNum(b.adjustedOverall));
      if (sortKey === "delta") return dir * (safeNum(a.delta) - safeNum(b.delta));
      if (comparing) {
      const aA = Number.isFinite(a.adpSortA) ? a.adpSortA : Number.POSITIVE_INFINITY;
      const bA = Number.isFinite(b.adpSortA) ? b.adpSortA : Number.POSITIVE_INFINITY;

      const aB = Number.isFinite(a.adpSortB) ? a.adpSortB : Number.POSITIVE_INFINITY;
      const bB = Number.isFinite(b.adpSortB) ? b.adpSortB : Number.POSITIVE_INFINITY;

      // Support sorting by either side when comparing
      if (sortKey === "adpB" || sortKey === "rpB") return dir * (aB - bB);
      // Default compare sorting remains Side A
        return dir * (aA - bA);
      }
      if (sortKey === "rp") return dir * (safeNum(a.adp) - safeNum(b.adp));
      return dir * (safeNum(a.adp) - safeNum(b.adp));
    });

    return filtered;
  }, [groupA, comparing, compareRows, query, pos, sortKey, sortDir, adjustedRankByKey, teams]);

  function toggleSort(k) {
    // Click same column to toggle direction; switching columns defaults to ascending.
    setSortDir((prevDir) => (sortKey === k ? (prevDir === "asc" ? "desc" : "asc") : "asc"));
    setSortKey(k);
  }

  if (!mode) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-border bg-card-surface p-6 text-sm text-muted">
          Missing mode. Go back and select a mode.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/draft-compare" className="text-sm text-accent hover:underline">
              ← Draft Compare
            </Link>
            <span className="text-xs text-muted">/</span>
            <span className="text-sm text-muted">{season}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-primary">{pageTitle}</h1>
          <p className="mt-1 text-sm text-muted">
            {comparing ? "Comparing Side A vs Side B" : "Aggregated view (Side A)"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-xl border border-border bg-card-surface">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cls(
                "px-3 py-2 text-sm font-semibold transition",
                view === "list" ? "bg-primary/15 text-primary" : "text-muted hover:bg-background/40"
              )}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              className={cls(
                "px-3 py-2 text-sm font-semibold transition",
                view === "board" ? "bg-primary/15 text-primary" : "text-muted hover:bg-background/40"
              )}
            >
              Board
            </button>
          </div>

          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
          >
            Select Leagues
          </button>
        </div>
      </div>

      {gateError ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Manifest error: {String(gateError)}
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-border bg-card-surface p-6 text-sm text-muted">
          Loading…
        </div>
      ) : null}

      {!loading && raw && groupA ? (
        <div className="mt-6">
          {view === "board" ? (
            <div className="rounded-2xl border border-border bg-card-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Draftboard</h2>
                  <p className="text-xs text-muted">Click a pick square to see all players drafted at that slot.</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted">
                  Teams: <span className="font-semibold text-primary">{teams}</span> · Rounds:{" "}
                  <span className="font-semibold text-primary">{rounds}</span>
                  <span className="mx-2 opacity-50">•</span>
                  Leagues:{" "}
                  <span className={cls("font-semibold", boardSide === "B" ? "text-accent" : "text-primary")}>
                    {safeNum((effectiveGroupForBoard || groupA)?.leagueCount)}
                  </span>
                </div>

                {comparing ? (
                  <div className="ml-auto inline-flex overflow-hidden rounded-xl border border-border bg-background/30">
                    <button
                      type="button"
                      onClick={() => setBoardSide("A")}
                      className={cls(
                        "px-3 py-2 text-xs font-semibold transition",
                        boardSide === "A" ? "bg-primary/15 text-primary" : "text-muted hover:bg-background/40"
                      )}
                    >
                      Side A
                    </button>
                    <button
                      type="button"
                      onClick={() => setBoardSide("B")}
                      className={cls(
                        "px-3 py-2 text-xs font-semibold transition",
                        boardSide === "B" ? "bg-accent/15 text-accent" : "text-muted hover:bg-background/40"
                      )}
                    >
                      Side B
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="p-5">
                <DraftBoard group={effectiveGroupForBoard} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card-surface shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold text-primary">{comparing ? "Compare List" : "Player List"}</h2>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search player…"
                      className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <select
                      value={pos}
                      onChange={(e) => setPos(e.target.value)}
                      className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {positions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-xs text-muted">
                    Rows: <span className="font-semibold text-primary">{listRows.length}</span>
                  </div>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 bg-card-surface/95 backdrop-blur">
                    <tr className="text-left text-xs text-muted">
                      <Th onClick={() => toggleSort("adp")} active={sortKey === "adp"} dir={sortDir}>
                        Avg Pick
                      </Th>
                      <Th onClick={() => toggleSort("rp")} active={sortKey === "rp"} dir={sortDir}>
                        Avg R.P.
                      </Th>
                      {!comparing ? (
                          <Th onClick={() => toggleSort("adj")} active={sortKey === "adj"} dir={sortDir}>
                            Adj Pick
                          </Th>
                        ) : null}
                      {comparing ? (
                        <>
                          <Th onClick={() => toggleSort("adpB")} active={sortKey === "adpB"} dir={sortDir}>
                          B Avg Pick
                        </Th>
                          <Th onClick={() => toggleSort("rpB")} active={sortKey === "rpB"} dir={sortDir}>
                          B Avg R.P.
                        </Th>
                        </>
                      ) : null}
                      <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                        Player
                      </Th>
                      <Th onClick={() => toggleSort("pos")} active={sortKey === "pos"} dir={sortDir}>
                        Pos
                      </Th>
                      {comparing ? (
                        <Th onClick={() => toggleSort("delta")} active={sortKey === "delta"} dir={sortDir}>
                          Δ (B − A)
                        </Th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {listRows.map((r) => {
                      const delta = r.delta;
                      const deltaGood = delta != null && delta > 0;
                      const deltaBad = delta != null && delta < 0;
                      return (
                        <tr key={r.key} className="border-t border-border/60 hover:bg-background/30">
                          <td className="px-4 py-3 font-semibold text-primary tabular-nums">
                            {comparing
                              ? r.avgPickA && r.avgPickA > 0
                                ? r.avgPickA.toFixed(3)
                                : "—"
                              : safeNum(r.adp)
                              ? safeNum(r.adp).toFixed(3)
                              : "—"}
                          </td>
                          {!comparing ? (
                              <td className="px-4 py-3 font-semibold text-primary tabular-nums">
                                {r.adjustedRoundPick || "—"}
                                <div className="text-[11px] text-muted">#{r.adjustedOverall || "—"}</div>
                              </td>
                            ) : null}
                          <td className="px-4 py-3 text-muted tabular-nums">
                            {comparing ? r.avgRoundPickA : r.avgRoundPick || "—"}
                          </td>
                          {comparing ? (
                            <>
                              <td className="px-4 py-3 font-semibold text-accent tabular-nums">
                                {r.avgPickB && r.avgPickB > 0 ? r.avgPickB.toFixed(3) : "—"}
                              </td>
                              <td className="px-4 py-3 text-muted tabular-nums">{r.avgRoundPickB || "—"}</td>
                            </>
                          ) : null}
                        
                          <td className="px-4 py-3 text-primary">{r.name}</td>
                          <td className="px-4 py-3 text-muted">{r.position}</td>
                          {comparing ? (
                            <td
                              className={cls(
                                "px-4 py-3 font-semibold tabular-nums",
                                deltaGood && "text-emerald-300",
                                deltaBad && "text-rose-300",
                                delta == null && "text-muted"
                              )}
                            >
                              {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}

                    {!listRows.length ? (
                      <tr>
                        <td colSpan={comparing ? 7 : 5} className="px-4 py-8 text-center text-sm text-muted">
                          No results.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {pickerOpen ? (
        <LeaguePicker
          leagues={leagueRows}
          sideA={effectiveSideA}
          sideB={sideB}
          onClose={() => setPickerOpen(false)}
          onChange={(a, b) => {
            const nextA = a.length ? a : leagueRows.map((x) => x.leagueId);
            setSideA(nextA);
            setSideB(b);
          }}
        />
      ) : null}
    </section>
  );
}

function Th({ children, onClick, active, dir }) {
  return (
    <th
      onClick={onClick}
      className={cls(
        onClick ? "cursor-pointer" : "cursor-default",
        "select-none px-4 py-3",
        active ? "text-primary" : "text-muted",
        "border-b border-border"
      )}
    >
      <div className="inline-flex items-center gap-2">
        {children}
        {active ? <span className="text-[10px] text-muted">{dir === "asc" ? "▲" : "▼"}</span> : null}
      </div>
    </th>
  );
}

function DraftBoard({ group }) {
  const g = group;
  const m = g?.meta;
  const [openKey, setOpenKey] = useState(null);

  const { isPhoneLike, isPortrait, showTip, acknowledge } = useDraftboardLandscapeTip();


  function posTheme(posRaw) {
    const pos = safeStr(posRaw).toUpperCase().trim();
    if (pos === "WR") return { cell: "bg-sky-400/20 hover:bg-sky-400/30", border: "border-sky-400/25" };
    if (pos === "RB") return { cell: "bg-emerald-400/20 hover:bg-emerald-400/30", border: "border-emerald-400/25" };
    if (pos === "QB") return { cell: "bg-rose-400/20 hover:bg-rose-400/30", border: "border-rose-400/25" };
    if (pos === "TE") return { cell: "bg-amber-300/20 hover:bg-amber-300/30", border: "border-amber-300/25" };
    return { cell: "bg-background/12 hover:bg-background/25", border: "border-border/70" };
  }

  function nameTwoLines(fullName) {
    const s = safeStr(fullName).trim();
    if (!s) return { first: "", last: "" };
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }

  if (!g || !m) return null;
  const teams = safeNum(m.teams) || 12;
  const rounds = safeNum(m.rounds) || 18;

  const boardMinWidthPx = teams * 86;
  const cells = g?.draftboard?.cells || {};

  const playersArr = Array.isArray(g?.players)
    ? g.players
    : g?.players && typeof g.players === "object"
    ? Object.values(g.players)
    : safeArray(g?.playersList);

  const ranked = safeArray(playersArr)
    .map((p) => ({
      name: safeStr(p?.name).trim(),
      position: safeStr(p?.position).trim() || "UNK",
      adp: safeNum(p?.avgOverallPick ?? p?.adp ?? p?.avgPick),
      count: safeNum(p?.count ?? 0),
    }))
    .filter((p) => p.name)
    .sort((a, b) => safeNum(a.adp) - safeNum(b.adp));

  const grid = [];
  for (let r = 1; r <= rounds; r++) {
    const row = [];
    for (let c = 1; c <= teams; c++) row.push(null);
    grid.push(row);
  }

  for (let overall = 1; overall <= teams * rounds; overall++) {
    const idx = overall - 1;
    const player = ranked[idx] || null;
    const r = Math.floor((overall - 1) / teams) + 1;
    const pickInRound = ((overall - 1) % teams) + 1;

    const displayCol = r % 2 === 1 ? pickInRound : teams - pickInRound + 1;

    const origKey = `${r}-${pickInRound}`;
    const dist = safeArray(cells[origKey]);
    const top = dist[0] || null;

    grid[r - 1][displayCol - 1] = {
      origKey,
      r,
      displayCol,
      pickInRound,
      overall,
      player,
      dist,
      top,
    };
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-background/10 shadow-sm">
        {/* swipe hint only on phone */}
        {isPhoneLike ? (
          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted">
            <span>Swipe to view all picks</span>
            <span className="font-semibold text-white/90">→</span>
          </div>
        ) : null}

        {/* Phones: horizontal swipe; non-phones: locked */}
        <div className={cls(isPhoneLike ? "overflow-x-auto overflow-y-hidden" : "overflow-hidden")}>
          <div className="relative" style={{ minWidth: isPhoneLike ? `max(100%, ${boardMinWidthPx}px)` : "100%" }}>
            {grid.map((row, i) => (
              <div key={i} className="grid" style={{ gridTemplateColumns: `repeat(${teams}, minmax(0, 1fr))` }}>
                {row.map((cell, j) => {
                  if (!cell) {
                    return (
                      <div
                        key={`blank-${i}-${j}`}
                        className="h-[88px] border-r border-b border-border/70 bg-background/5"
                      />
                    );
                  }

                  const rpAdjusted = `${cell.r}.${String(cell.pickInRound).padStart(2, "0")}`;
                  const theme = posTheme(cell.player?.position);
                  const nm = nameTwoLines(cell.player?.name);

                  return (
                    <button
                      key={`${cell.r}-${cell.displayCol}`}
                      onClick={() => setOpenKey(cell.origKey)}
                      className={cls(
                        "group relative h-[88px] border-r border-b p-2.5 text-left transition",
                        theme.border,
                        theme.cell,
                        "hover:shadow-[0_6px_16px_rgba(0,0,0,0.25)] hover:shadow-black/20",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      )}
                      title={cell.player ? `${cell.player.name} (${cell.player.position})` : rpAdjusted}
                    >
                      {/* Always show ONLY round.pick pill (white text) */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cls(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            "shadow-[0_2px_10px_rgba(0,0,0,0.16)] backdrop-blur",
                            "border-white/20 bg-black/25 text-white"
                          )}
                        >
                          {rpAdjusted}
                        </span>
                      </div>

                      {cell.player ? (
                        <div className="mt-2">
                          {/* Always two-line split name */}
                          <div className="truncate text-[13px] font-semibold leading-4 text-white">{nm.first}</div>
                          <div className="truncate text-[12px] leading-4 text-white/90">{nm.last || " "}</div>
                        </div>
                      ) : (
                        <div className="mt-6 text-[11px] text-white/60">—</div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <DraftboardLandscapeTipOverlay open={showTip} isPortrait={isPortrait} onClose={acknowledge} />


      {openKey ? (
        <CellModal cellKey={openKey} teams={teams} list={safeArray(cells[openKey])} onClose={() => setOpenKey(null)} />
      ) : null}
    </div>
  );
}

function CellModal({ cellKey, teams, list, onClose }) {
  const [rStr, pStr] = safeStr(cellKey).split("-");
  const round = safeNum(rStr);
  const pickInRound = safeNum(pStr);
  const overall = (round - 1) * (safeNum(teams) || 12) + pickInRound;
  const rp = `${round}.${String(pickInRound).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="text-xs text-muted">Pick</div>
            <div className="text-lg font-semibold text-primary">
              {rp} <span className="text-sm text-muted">•</span>{" "}
              <span className="text-sm text-muted">#{overall}</span>
            </div>
            <div className="mt-1 text-xs text-muted">{list.length ? `${list.length} unique players` : "No data"}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-primary hover:bg-background/60"
          >
            Close
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card-surface/95 backdrop-blur">
              <tr className="text-left text-xs text-muted">
                <th className="px-5 py-3">Player</th>
                <th className="px-5 py-3">Pos</th>
                <th className="px-5 py-3">%</th>
                <th className="px-5 py-3">Count</th>
              </tr>
            </thead>
            <tbody>
              {safeArray(list)
                .slice()
                .sort((a, b) => safeNum(b?.pct) - safeNum(a?.pct) || safeStr(a?.name).localeCompare(safeStr(b?.name)))
                .map((p) => (
                  <tr key={`${p.name}|||${p.position}`} className="border-t border-border/60">
                    <td className="px-5 py-3 text-primary">{p.name}</td>
                    <td className="px-5 py-3 text-muted">{p.position}</td>
                    <td className="px-5 py-3 text-muted">{pctFmt(safeNum(p.pct))}</td>
                    <td className="px-5 py-3 text-muted">{safeNum(p.count)}</td>
                  </tr>
                ))}
              {!list.length ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted">
                    Nothing recorded at this slot.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LeaguePicker({ leagues, sideA, sideB, onClose, onChange }) {
  const [a, setA] = useState(sideA);
  const [b, setB] = useState(sideB);

  const setASet = useMemo(() => new Set(a), [a]);
  const setBSet = useMemo(() => new Set(b), [b]);

  function toggle(id, side) {
    const inA = setASet.has(id);
    const inB = setBSet.has(id);

    if (side === "A") {
      const nextA = inA ? a.filter((x) => x !== id) : [...a, id];
      const nextB = inB ? b.filter((x) => x !== id) : b;
      setA(nextA);
      setB(nextB);
      return;
    }
    const nextB = inB ? b.filter((x) => x !== id) : [...b, id];
    const nextA = inA ? a.filter((x) => x !== id) : a;
    setA(nextA);
    setB(nextB);
  }

  function apply() {
    onChange(a, b);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-primary">Select leagues</div>
            <div className="mt-1 text-xs text-muted">Click A or B per league. A league cannot be in both sides.</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-primary hover:bg-background/60"
          >
            Close
          </button>
        </div>

        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card-surface/95 backdrop-blur">
              <tr className="text-left text-xs text-muted">
                <th className="px-5 py-3">League</th>
                <th className="px-5 py-3">Side A</th>
                <th className="px-5 py-3">Side B</th>
              </tr>
            </thead>
            <tbody>
              {safeArray(leagues).map((l) => {
                const id = l.leagueId;
                const inA = setASet.has(id);
                const inB = setBSet.has(id);
                return (
                  <tr key={id} className="border-t border-border/60">
                    <td className="px-5 py-3 text-primary">{l.name || id}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggle(id, "A")}
                        className={cls(
                          "rounded-lg border px-3 py-1 text-xs font-semibold",
                          inA ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/30 text-muted"
                        )}
                      >
                        A
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggle(id, "B")}
                        className={cls(
                          "rounded-lg border px-3 py-1 text-xs font-semibold",
                          inB ? "border-accent bg-accent/15 text-accent" : "border-border bg-background/30 text-muted"
                        )}
                      >
                        B
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!safeArray(leagues).length ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted">
                    No leagues found in this draft JSON.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <div className="text-xs text-muted">
            Side A: <span className="font-semibold text-primary">{a.length}</span> • Side B:{" "}
            <span className="font-semibold text-accent">{b.length}</span>
          </div>
          <button
            onClick={apply}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-background shadow-sm transition hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
