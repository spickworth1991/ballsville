"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import {
  aggregateSelectedLeagues,
  compareAggregates,
  normalizeDraftCompareJson,
  roundPickFromOverall,
} from "@/lib/draftCompareUtils";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function DraftboardGrid({ meta, cells }) {
  const teams = Number(meta?.teams) || 12;
  const rounds = Number(meta?.rounds) || 18;

  const rows = [];
  for (let r = 1; r <= rounds; r++) {
    const cols = [];
    for (let p = 1; p <= teams; p++) {
      const key = `${r}-${p}`;
      const list = safeArr(cells?.[key]);
      const top = list[0];
      cols.push(
        <div key={key} className="min-h-[64px] rounded-lg border border-white/10 bg-card-surface p-2">
          {top ? (
            <div className="text-xs leading-tight">
              <div className="font-semibold text-primary">{top.name}</div>
              <div className="text-muted">{top.position} • {(top.pct * 100).toFixed(0)}%</div>
            </div>
          ) : (
            <div className="text-xs text-muted">—</div>
          )}
        </div>
      );
    }
    rows.push(
      <div key={`r-${r}`} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${teams}, minmax(0, 1fr))` }}>
        {cols}
      </div>
    );
  }

  return <div className="space-y-3 overflow-x-auto">{rows}</div>;
}

export default function DraftCompareModeClient() {
  const sp = useSearchParams();

  const season = safeStr(sp.get("year") || CURRENT_SEASON || "2025");
  const mode = safeStr(sp.get("mode") || "").trim();

  const [raw, setRaw] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // league selections
  const [sideA, setSideA] = useState([]);
  const [sideB, setSideB] = useState([]);

  // view toggles
  const [view, setView] = useState("list"); // "list" | "board"
  const [compareBoardSide, setCompareBoardSide] = useState("A"); // when comparing

  // Load JSON
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!mode) {
        setErr("Missing mode");
        setLoading(false);
        return;
      }
      setErr("");
      setLoading(true);

      try {
        const url = `/r2/data/draft-compare/drafts_${encodeURIComponent(season)}_${encodeURIComponent(
          mode
        )}.json`;

        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const data = await r.json();
        if (cancelled) return;

        setRaw(data);

        const norm = normalizeDraftCompareJson(data);
        const allIds = safeArr(norm.leagues).map((l) => l.leagueId);

        // default: everything on Side A if no selection yet
        setSideA(allIds);
        setSideB([]);
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
  }, [season, mode]);

  const norm = useMemo(() => normalizeDraftCompareJson(raw), [raw]);

  const allLeagues = useMemo(() => safeArr(norm?.leagues), [norm]);
  const allLeagueIds = useMemo(() => allLeagues.map((l) => l.leagueId), [allLeagues]);

  const aggA = useMemo(() => aggregateSelectedLeagues(norm, sideA), [norm, sideA]);
  const aggB = useMemo(() => aggregateSelectedLeagues(norm, sideB), [norm, sideB]);

  const isCompare = sideB.length > 0;

  const compareRows = useMemo(() => (isCompare ? compareAggregates(aggA, aggB) : []), [isCompare, aggA, aggB]);

  // Basic selection rules: cannot be in both sides.
  function toggleLeague(leagueId, target) {
    if (!leagueId) return;

    if (target === "A") {
      setSideA((prev) => {
        const has = prev.includes(leagueId);
        const next = has ? prev.filter((x) => x !== leagueId) : [...prev, leagueId];
        return next;
      });
      setSideB((prev) => prev.filter((x) => x !== leagueId));
    } else {
      setSideB((prev) => {
        const has = prev.includes(leagueId);
        const next = has ? prev.filter((x) => x !== leagueId) : [...prev, leagueId];
        return next;
      });
      setSideA((prev) => prev.filter((x) => x !== leagueId));
    }
  }

  const boardCells = isCompare
    ? compareBoardSide === "A"
      ? aggA.draftboard?.cells
      : aggB.draftboard?.cells
    : aggA.draftboard?.cells;

  return (
    <SectionManifestGate section="draft-compare" season={season}>
      {({ version }) => (
        <section className="page">
          <div className="container">
            <div className="mb-6">
              <Link href="/draft-compare" className="text-sm text-accent hover:underline">
                ← Back to modes
              </Link>
            </div>

            <div className="hero hero--compact">
              <h1 className="hero__title">Draft Compare</h1>
              <p className="hero__subtitle">
                Mode: <span className="text-primary font-semibold">{mode}</span> • Season:{" "}
                <span className="text-primary font-semibold">{season}</span>
              </p>
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl bg-card-surface p-6 text-muted">Loading…</div>
            ) : null}

            {err ? (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {err}
              </div>
            ) : null}

            {!loading && !err ? (
              <>
                {/* Controls */}
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-card-surface p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-primary">View</div>
                      <div className="flex gap-2">
                        <button
                          className={`rounded-lg px-3 py-1 text-sm ${
                            view === "list" ? "bg-white/10 text-primary" : "bg-transparent text-muted"
                          }`}
                          onClick={() => setView("list")}
                        >
                          List
                        </button>
                        <button
                          className={`rounded-lg px-3 py-1 text-sm ${
                            view === "board" ? "bg-white/10 text-primary" : "bg-transparent text-muted"
                          }`}
                          onClick={() => setView("board")}
                        >
                          Draftboard
                        </button>
                      </div>
                    </div>

                    {isCompare ? (
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-muted">Board side</div>
                        <div className="flex gap-2">
                          <button
                            className={`rounded-lg px-3 py-1 text-sm ${
                              compareBoardSide === "A" ? "bg-white/10 text-primary" : "bg-transparent text-muted"
                            }`}
                            onClick={() => setCompareBoardSide("A")}
                          >
                            Side A
                          </button>
                          <button
                            className={`rounded-lg px-3 py-1 text-sm ${
                              compareBoardSide === "B" ? "bg-white/10 text-primary" : "bg-transparent text-muted"
                            }`}
                            onClick={() => setCompareBoardSide("B")}
                          >
                            Side B
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 text-xs text-muted">
                      A leagues: {sideA.length} • B leagues: {sideB.length}
                    </div>
                  </div>

                  <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-card-surface p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-primary">Select leagues</div>
                      <button
                        className="rounded-lg bg-white/10 px-3 py-1 text-sm text-primary hover:bg-white/15"
                        onClick={() => {
                          setSideA(allLeagueIds);
                          setSideB([]);
                        }}
                      >
                        Reset (All → A)
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="text-sm font-semibold text-primary mb-2">Side A</div>
                        <div className="space-y-2 max-h-[260px] overflow-auto pr-2">
                          {allLeagues.map((l) => (
                            <label key={`a-${l.leagueId}`} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={sideA.includes(l.leagueId)}
                                onChange={() => toggleLeague(l.leagueId, "A")}
                              />
                              <span className="text-muted">{l.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="text-sm font-semibold text-primary mb-2">Side B</div>
                        <div className="space-y-2 max-h-[260px] overflow-auto pr-2">
                          {allLeagues.map((l) => (
                            <label key={`b-${l.leagueId}`} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={sideB.includes(l.leagueId)}
                                onChange={() => toggleLeague(l.leagueId, "B")}
                              />
                              <span className="text-muted">{l.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-muted">
                      Leagues cannot be in both sides. If Side B is empty, you get a single aggregated view.
                    </div>
                  </div>
                </div>

                {/* Content */}
                {view === "board" ? (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-card-surface p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-semibold text-primary">
                        Draftboard {isCompare ? `(showing Side ${compareBoardSide})` : ""}
                      </div>
                      <div className="text-xs text-muted">
                        {isCompare
                          ? `${compareBoardSide === "A" ? aggA.leagueCount : aggB.leagueCount} leagues`
                          : `${aggA.leagueCount} leagues`}
                      </div>
                    </div>

                    <DraftboardGrid meta={norm.meta} cells={boardCells} />
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-card-surface p-4 overflow-x-auto">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-semibold text-primary">{isCompare ? "Compare list" : "Aggregated list"}</div>
                      <div className="text-xs text-muted">{isCompare ? "Δ = A - B" : ""}</div>
                    </div>

                    {isCompare ? (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted">
                          <tr>
                            <th className="py-2 pr-4">Player</th>
                            <th className="py-2 pr-4">Pos</th>
                            <th className="py-2 pr-4">A Avg</th>
                            <th className="py-2 pr-4">B Avg</th>
                            <th className="py-2 pr-4">Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compareRows.slice(0, 250).map((r) => (
                            <tr key={`${r.name}|||${r.position}`} className="border-t border-white/10">
                              <td className="py-2 pr-4 text-primary font-medium">{r.name}</td>
                              <td className="py-2 pr-4 text-muted">{r.position}</td>
                              <td className="py-2 pr-4 text-muted">
                                {r.aAvgOverallPick != null
                                  ? `${r.aAvgOverallPick.toFixed(1)} (${roundPickFromOverall(r.aAvgOverallPick, norm.meta.teams)})`
                                  : "—"}
                              </td>
                              <td className="py-2 pr-4 text-muted">
                                {r.bAvgOverallPick != null
                                  ? `${r.bAvgOverallPick.toFixed(1)} (${roundPickFromOverall(r.bAvgOverallPick, norm.meta.teams)})`
                                  : "—"}
                              </td>
                              <td className="py-2 pr-4 text-muted">{r.delta != null ? r.delta.toFixed(1) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted">
                          <tr>
                            <th className="py-2 pr-4">Player</th>
                            <th className="py-2 pr-4">Pos</th>
                            <th className="py-2 pr-4">Avg Pick</th>
                            <th className="py-2 pr-4">Mode</th>
                            <th className="py-2 pr-4">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {safeArr(aggA.players)
                            .slice(0, 250)
                            .map((p) => (
                              <tr key={`${p.name}|||${p.position}`} className="border-t border-white/10">
                                <td className="py-2 pr-4 text-primary font-medium">{p.name}</td>
                                <td className="py-2 pr-4 text-muted">{p.position}</td>
                                <td className="py-2 pr-4 text-muted">
                                  {p.avgOverallPick.toFixed(1)} ({p.avgRoundPick})
                                </td>
                                <td className="py-2 pr-4 text-muted">
                                  {p.modeOverallPick} ({p.modeRoundPick})
                                </td>
                                <td className="py-2 pr-4 text-muted">{p.count}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </section>
      )}
    </SectionManifestGate>
  );
}
