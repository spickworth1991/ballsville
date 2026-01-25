"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
function numOrNull(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
}

function ListScroller({ children }) {
  const { isPhoneLike, isPortrait } = useDraftboardLandscapeTip();
  const isPhoneLandscape = isPhoneLike && !isPortrait;

  return (
    <div
      className="overflow-auto"
      style={{
        // let the list breathe more on landscape phones
        maxHeight: isPhoneLandscape
          ? "calc(100dvh - 160px)" // header + controls + some spacing
          : "calc(100dvh - 320px)", // desktop/tablet: keep reasonable
      }}
    >
      {children}
    </div>
  );
}

function cleanSlug(s) {
  return safeStr(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function cls(...a) {
  return a.filter(Boolean).join(" ");
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

function deriveAllLeagueIds(raw) {
  const per = raw?.perLeague;
  const all = [...safeArray(per?.sideA), ...safeArray(per?.sideB), ...safeArray(raw?.leagues)];
  const m = new Map();
  for (const l of all) {
    const id = safeStr(l?.leagueId || l?.id).trim();
    if (!id) continue;
    m.set(id, true);
  }
  return Array.from(m.keys());
}

export default function DraftCompareCompareModesClient() {
  const baseYear = Number(CURRENT_SEASON || 2025);
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => String(baseYear - i)), [baseYear]);

  const [modes, setModes] = useState([]); // flattened options
  const [loadErr, setLoadErr] = useState("");
  

  const [selA, setSelA] = useState("2025|||big-game"); // "year|||slug"
  const [selB, setSelB] = useState("2025|||gauntlet"); // "year|||slug"

  const [rawA, setRawA] = useState(null);
  const [rawB, setRawB] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // view toggle
  const [view, setView] = useState("list");
  const [boardSide, setBoardSide] = useState("A");

  // list controls
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [sortKey, setSortKey] = useState("adp");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadErr("");
      try {
        const results = await Promise.all(
          years.map(async (y) => {
            const url = r2Url(`data/draft-compare/modes_${y}.json`);
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) return null;
            const j = await res.json().catch(() => null);
            const rows = safeArray(j?.rows || j?.modes || j || []);
            const cleaned = rows
              .map((r, idx) => {
                const slug = cleanSlug(r?.modeSlug || r?.slug || r?.id || r?.name || `mode-${idx + 1}`);
                const title = safeStr(r?.title || r?.name || r?.modeName || slug);
                return { year: y, slug, title };
              })
              .filter((x) => x.slug && x.title);
            return cleaned.length ? cleaned : null;
          })
        );

        const flat = results
          .filter(Boolean)
          .flat()
          .sort((a, b) => Number(b.year) - Number(a.year) || a.title.localeCompare(b.title));

        if (!alive) return;
        setModes(flat);
        // initialize defaults if empty
        if (!selA && flat[0]) setSelA(`${flat[0].year}|||${flat[0].slug}`);
        if (!selB && flat[1]) setSelB(`${flat[1].year}|||${flat[1].slug}`);
      } catch (e) {
        if (!alive) return;
        setLoadErr(e?.message || "Failed to load modes");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years.join("|")]);

  const selAInfo = useMemo(() => {
    const [year, slug] = safeStr(selA).split("|||");
    return { year: safeStr(year), slug: cleanSlug(slug) };
  }, [selA]);
  const selBInfo = useMemo(() => {
    const [year, slug] = safeStr(selB).split("|||");
    return { year: safeStr(year), slug: cleanSlug(slug) };
  }, [selB]);

  const urlA = useMemo(() => {
    if (!selAInfo.year || !selAInfo.slug) return "";
    return r2Url(`data/draft-compare/drafts_${selAInfo.year}_${selAInfo.slug}.json`);
  }, [selAInfo.year, selAInfo.slug]);
  const urlB = useMemo(() => {
    if (!selBInfo.year || !selBInfo.slug) return "";
    return r2Url(`data/draft-compare/drafts_${selBInfo.year}_${selBInfo.slug}.json`);
  }, [selBInfo.year, selBInfo.slug]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!urlA || !urlB) return;
      setErr("");
      setLoading(true);
      try {
        const [ra, rb] = await Promise.all([
          fetch(withV(urlA, Date.now()), { cache: "no-store" }),
          fetch(withV(urlB, Date.now()), { cache: "no-store" }),
        ]);
        if (!ra.ok) throw new Error(`Mode A JSON missing (HTTP ${ra.status})`);
        if (!rb.ok) throw new Error(`Mode B JSON missing (HTTP ${rb.status})`);
        const [ja, jb] = await Promise.all([ra.json(), rb.json()]);
        if (cancelled) return;
        setRawA(ja);
        setRawB(jb);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load drafts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [urlA, urlB]);

  const groupA = useMemo(() => {
    if (!rawA) return null;
    const ids = deriveAllLeagueIds(rawA);
    return buildGroupFromDraftJson(rawA, ids);
  }, [rawA]);
  const groupB = useMemo(() => {
    if (!rawB) return null;
    const ids = deriveAllLeagueIds(rawB);
    return buildGroupFromDraftJson(rawB, ids);
  }, [rawB]);

  const teams = safeNum(groupA?.meta?.teams) || safeNum(groupB?.meta?.teams) || 12;
  const rounds = safeNum(groupA?.meta?.rounds) || safeNum(groupB?.meta?.rounds) || 18;

    const metaA = useMemo(() => {
    return {
      teams: safeNum(groupA?.meta?.teams) || 0,
      rounds: safeNum(groupA?.meta?.rounds) || 0,
    };
  }, [groupA]);

  const metaB = useMemo(() => {
    return {
      teams: safeNum(groupB?.meta?.teams) || 0,
      rounds: safeNum(groupB?.meta?.rounds) || 0,
    };
  }, [groupB]);

  const showReliabilityNote = useMemo(() => {
    if (!groupA || !groupB) return false;
    if (!metaA.teams || !metaA.rounds || !metaB.teams || !metaB.rounds) return false;
    return metaA.teams !== metaB.teams || metaA.rounds !== metaB.rounds;
  }, [groupA, groupB, metaA.teams, metaA.rounds, metaB.teams, metaB.rounds]);


  const compareRows = useMemo(() => {
    if (!groupA || !groupB) return [];
    return buildPlayerResults(groupA, groupB);
  }, [groupA, groupB]);

  // adjusted rank map based on Mode A ADP ordering
  const adjustedRankByKey = useMemo(() => {
    if (!groupA) return Object.create(null);
    const base = safeArray(compareRows).map((r) => ({
      key: `${safeStr(r?.name)}|||${safeStr(r?.position)}`,
      // If a player exists on only one side, rank by the side they appear on.
      // Avoid treating missing ADP as 0 (which would incorrectly place them at 1.01).
      adp: numOrNull(r?.adpA) ?? numOrNull(r?.adpB) ?? null,
    }));
    const sorted = base
      .filter((x) => x.key && x.adp != null)
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
  }, [compareRows, groupA, teams]);

  const positions = useMemo(() => {
    const set = new Set();
    for (const r of safeArray(compareRows)) {
      const p = safeStr(r?.position).toUpperCase().trim();
      if (p) set.add(p);
    }
    return ["ALL", ...Array.from(set).sort()];
  }, [compareRows]);

  const listRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pFilter = pos;
    const numForSort = (v) => (v == null ? Number.POSITIVE_INFINITY : safeNum(v));

    const base = safeArray(compareRows).map((r) => {
      const key = `${safeStr(r.name)}|||${safeStr(r.position)}`;
      const adj = adjustedRankByKey?.[key];
      const avgPickA = numOrNull(r.adpA);
      const avgPickB = numOrNull(r.adpB);
      return {
        key,
        name: r.name,
        position: r.position,
        avgPickA,
        avgPickB,
        avgRoundPickA: avgPickA ? formatRoundPickFromAvgOverall(avgPickA, teams) : "—",
        avgRoundPickB: avgPickB ? formatRoundPickFromAvgOverall(avgPickB, teams) : "—",
        adjustedOverall: adj?.adjustedOverall ?? null,
        adjustedRoundPick: adj?.adjustedRoundPick ?? "—",
        delta: r.delta == null ? null : safeNum(r.delta),
      };
    });

    const filtered = base.filter((r) => {
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
      if (sortKey === "adpB") return dir * (numForSort(a.avgPickB) - numForSort(b.avgPickB));
      if (sortKey === "rpA") return dir * (numForSort(a.avgPickA) - numForSort(b.avgPickA));
      if (sortKey === "rpB") return dir * (numForSort(a.avgPickB) - numForSort(b.avgPickB));
      // default: Side A avg pick
      return dir * (numForSort(a.avgPickA) - numForSort(b.avgPickA));
    });
    return filtered;
  }, [adjustedRankByKey, compareRows, pos, query, sortDir, sortKey, teams]);

  function toggleSort(k) {
    setSortDir((prevDir) => (sortKey === k ? (prevDir === "asc" ? "desc" : "asc") : "asc"));
    setSortKey(k);
  }

  const labelA = useMemo(() => {
    const found = modes.find((m) => `${m.year}|||${m.slug}` === selA);
    return found ? `${found.year} — ${found.title}` : "Mode A";
  }, [modes, selA]);
  const labelB = useMemo(() => {
    const found = modes.find((m) => `${m.year}|||${m.slug}` === selB);
    return found ? `${found.year} — ${found.title}` : "Mode B";
  }, [modes, selB]);

  const comparing = !!groupA && !!groupB;
    const boardMeta = useMemo(() => {
    const g = boardSide === "B" ? groupB : groupA;
    return {
      teams: safeNum(g?.meta?.teams) || 12,
      rounds: safeNum(g?.meta?.rounds) || 18,
    };
  }, [boardSide, groupA, groupB]);


  useEffect(() => {
    if (!comparing) setBoardSide("A");
  }, [comparing]);

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/draft-compare" className="text-base sm:text-sm  text-accent hover:underline">
              ← Draft Compare
            </Link>
            <span className="text-xs text-muted">/</span>
            <span className="text-base sm:text-sm  text-muted">Compare gamemodes</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-primary">Compare gamemodes</h1>
          <p className="mt-1 text-base sm:text-sm  text-muted">Compare full mode drafts (no league selection).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-xl border border-border bg-card-surface">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cls(
                "px-3 py-2 text-base sm:text-sm  font-semibold transition",
                view === "list" ? "bg-primary/15 text-primary" : "text-muted hover:bg-background/40"
              )}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              className={cls(
                "px-3 py-2 text-base sm:text-sm  font-semibold transition",
                view === "board" ? "bg-primary/15 text-primary" : "text-muted hover:bg-background/40"
              )}
            >
              Board
            </button>
          </div>
        </div>
      </div>

      {loadErr ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-base sm:text-sm  text-red-200">
          {loadErr}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-border bg-card-surface p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted">Mode A</div>
            <select
              value={selA}
              onChange={(e) => setSelA(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-base sm:text-sm  text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {modes.map((m) => (
                <option key={`A-${m.year}-${m.slug}`} value={`${m.year}|||${m.slug}`}>
                  {m.year} — {m.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted">Mode B</div>
            <select
              value={selB}
              onChange={(e) => setSelB(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-base sm:text-sm  text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {modes.map((m) => (
                <option key={`B-${m.year}-${m.slug}`} value={`${m.year}|||${m.slug}`}>
                  {m.year} — {m.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted">
          <span className="font-semibold text-primary">A:</span> {labelA} <span className="mx-2 opacity-50">•</span>
          <span className="font-semibold text-accent">B:</span> {labelB}
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-base sm:text-sm  text-red-200">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-border bg-card-surface p-6 text-base sm:text-sm  text-muted">Loading…</div>
      ) : null}

      {!loading && comparing ? (
        <div className="mt-6">
          {view === "board" ? (
            <div className="rounded-2xl border border-border bg-card-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Draftboard</h2>
                  <p className="text-xs text-muted">
                    Hint: Click a pick square to see all players drafted at that slot.
                  </p>
                  <p className="text-xs text-muted">
                    Note: Players are placed based on average draft position, so they may not appear in the exact pick they were selected at.
                  </p>
                  {showReliabilityNote ? (
                    <p className="mt-1 text-xs text-white/60">
                      Note: Due to this comparing drafts from different league sizes and round counts, there could be some variance in the rankings.
                    </p>
                  ) : null}

                </div>

                <div className="flex items-center gap-2 text-xs text-muted">
                  Teams: <span className="font-semibold text-primary">{boardMeta.teams}</span> · Rounds:{" "}
                  <span className="font-semibold text-primary">{boardMeta.rounds}</span>
                </div>



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
              </div>

              <div className="p-5">
                <DraftBoard group={boardSide === "B" ? groupB : groupA} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card-surface shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold text-primary">Compare List</h2>
                  {showReliabilityNote ? (
                    <p className="mt-1 text-xs text-white/60">
                      Note: Due to this comparing drafts from different league sizes and round counts, there could be some variance in the rankings.
                    </p>
                  ) : null}



                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search player…"
                      className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-base sm:text-sm  text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <select
                      value={pos}
                      onChange={(e) => setPos(e.target.value)}
                      className="rounded-xl border border-border bg-background/60 px-3 py-2 text-base sm:text-sm  text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
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

              <ListScroller>
  <table className="w-full border-separate border-spacing-0 text-base sm:text-sm ">
  

                
                  <thead className="sticky top-0 bg-card-surface/95 backdrop-blur">
                    <tr className="text-left text-xs text-muted">
                      <Th onClick={() => toggleSort("adpA")} active={sortKey === "adpA"} dir={sortDir}>
                        A Avg Pick
                      </Th>
                      <Th onClick={() => toggleSort("rpA")} active={sortKey === "rpA"} dir={sortDir}>
                        A Avg R.P.
                      </Th>
                      <Th onClick={() => toggleSort("adpB")} active={sortKey === "adpB"} dir={sortDir}>
                        B Avg Pick
                      </Th>
                      <Th onClick={() => toggleSort("rpB")} active={sortKey === "rpB"} dir={sortDir}>
                        B Avg R.P.
                      </Th>
                      <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                        Player
                      </Th>
                      <Th onClick={() => toggleSort("pos")} active={sortKey === "pos"} dir={sortDir}>
                        Pos
                      </Th>
                      <Th onClick={() => toggleSort("delta")} active={sortKey === "delta"} dir={sortDir}>
                        Δ (B − A)
                      </Th>
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
                            {r.avgPickA == null ? "—" : safeNum(r.avgPickA).toFixed(3)}
                          </td>
                          <td className="px-4 py-3 text-muted tabular-nums">{r.avgRoundPickA || "—"}</td>
                          <td className="px-4 py-3 font-semibold text-primary tabular-nums">
                            {r.avgPickB == null ? "—" : safeNum(r.avgPickB).toFixed(3)}
                          </td>
                          <td className="px-4 py-3 text-muted tabular-nums">{r.avgRoundPickB || "—"}</td>
                          <td className="px-4 py-3 text-primary">{r.name}</td>
                          <td className="px-4 py-3 text-muted">{r.position}</td>
                          <td
                            className={cls(
                              "px-4 py-3 font-semibold tabular-nums",
                              deltaGood && "text-emerald-300",
                              deltaBad && "text-rose-300",
                              delta == null && "text-muted"
                            )}
                          >
                            {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(3)}`}
                          </td>
                        </tr>
                      );
                    })}

                    {!listRows.length ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-base sm:text-sm  text-muted">
                          No results.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>

                </table>
              </ListScroller>
              </div>
          )}
        </div>
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

  // NEW: auto-scale for phone landscape so it "zooms out" to fit screen
  const [fitScale, setFitScale] = useState(1);

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

  // NEW: compute "fit to screen" scale in phone landscape
  useEffect(() => {
    if (typeof window === "undefined") return;

    function computeScale() {
      // Only auto-fit when phone-like AND landscape
      if (!isPhoneLike || isPortrait) {
        setFitScale(1);
        return;
      }

      const vv = window.visualViewport;
      const vw = vv?.width || window.innerWidth;

      // Give yourself a tiny padding so it doesn't kiss the edges
      const pad = 16;
      const available = Math.max(320, vw - pad);

      const s = available / boardMinWidthPx;

      // Cap so we never "zoom in" past 1 and never get insanely tiny
      const clamped = Math.max(0.5, Math.min(1, s));
      setFitScale(clamped);
    }

    computeScale();

    const vv = window.visualViewport;
    vv?.addEventListener?.("resize", computeScale);
    vv?.addEventListener?.("scroll", computeScale); // iOS can change viewport on UI show/hide
    window.addEventListener("resize", computeScale);
    window.addEventListener("orientationchange", computeScale);

    return () => {
      vv?.removeEventListener?.("resize", computeScale);
      vv?.removeEventListener?.("scroll", computeScale);
      window.removeEventListener("resize", computeScale);
      window.removeEventListener("orientationchange", computeScale);
    };
  }, [isPhoneLike, isPortrait, boardMinWidthPx]);

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
          {/* NEW: scale wrapper */}
          <div
            className="relative"
            style={{
              minWidth: isPhoneLike ? `max(100%, ${boardMinWidthPx}px)` : "100%",
              transform: `scale(${fitScale})`,
              transformOrigin: "left top",
              // helps avoid blurry text on iOS at non-1 scales
              willChange: fitScale !== 1 ? "transform" : undefined,
            }}
          >
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


function nameTwoLines(fullName) {
  const s = safeStr(fullName).trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}


function CellModal({ cellKey, teams, list, onClose }) {
  const [rStr, pStr] = safeStr(cellKey).split("-");
  const round = safeNum(rStr);
  const pickInRound = safeNum(pStr);
  const overall = (round - 1) * (safeNum(teams) || 12) + pickInRound;
  const rp = `${round}.${String(pickInRound).padStart(2, "0")}`;

  // NEW: reuse the same phone/orientation logic
  const { isPhoneLike, isPortrait } = useDraftboardLandscapeTip();
  const isPhoneLandscape = isPhoneLike && !isPortrait;
  const NAV_OFFSET_PX = 72; // adjust if your navbar is taller
  return (
    <div
        className={cls(
          "fixed inset-0 z-[60] flex bg-black/50",
          isPhoneLandscape ? "items-start justify-center" : "items-center justify-center",
          "p-4"
        )}
        style={{
          // Always reserve space for the navbar (desktop included).
          paddingTop: `calc(env(safe-area-inset-top, 0px) + ${NAV_OFFSET_PX}px)`,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card-surface shadow-xl flex flex-col"
          style={{
            // Match the reserved padding so the modal never hides under the nav or bottom.
            maxHeight: `calc(100dvh - ${NAV_OFFSET_PX}px - 32px)`,
          }}
        >

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

        <div className="flex-1 overflow-auto">
          <table className="w-full text-base sm:text-sm ">
            <thead className="sticky top-0 bg-card-surface/95 backdrop-blur">
              <tr className="text-left text-xs text-white/70">
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
                  <tr key={`${p.name}|||${p.position}`} className="border-t border-white/10">
                    <td className="px-5 py-3 text-white">
                      {(() => {
                        const nm = nameTwoLines(p.name);
                        return (
                          <div className="min-w-0">
                            <div className="truncate font-semibold leading-4 text-white">{nm.first}</div>
                            <div className="truncate text-white/70 leading-4">{nm.last || " "}</div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3 text-white/70">{p.position}</td>
                    <td className="px-5 py-3 text-white/70">{pctFmt(safeNum(p.pct))}</td>
                    <td className="px-5 py-3 text-white/70">{safeNum(p.count)}</td>
                  </tr>
                ))}

              {!list.length ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-base sm:text-sm  text-white/60">
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

