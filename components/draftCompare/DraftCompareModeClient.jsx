"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";
import { r2Url } from "@/lib/r2Url";
import { buildGroupFromDraftJson, buildPlayerResults, formatRoundPickFromAvgOverall } from "@/lib/draftCompareUtils";

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
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export default function DraftCompareModeClient() {
  const sp = useSearchParams();
  const mode = cleanSlug(sp.get("mode") || "");
  const year = safeStr(sp.get("year") || CURRENT_SEASON);

  return (
    <SectionManifestGate section="draft-compare" season={year}>
      {({ version, error }) => (
        <ModeInner mode={mode} year={year} version={version} gateError={error} />
      )}
    </SectionManifestGate>
  );
}

function ModeInner({ mode, year, version, gateError }) {
  const [raw, setRaw] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [sideA, setSideA] = useState([]);
  const [sideB, setSideB] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const dataUrl = useMemo(() => {
    if (!mode) return "";
    const key = `data/draft-compare/drafts_${year}_${mode}.json`;
    return withV(r2Url(key), version);
  }, [mode, year, version]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!dataUrl) return;
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

  const leagueRows = useMemo(() => {
    const leagues = safeArray(raw?.perLeague?.sideA ?? raw?.leagues ?? []);
    return leagues
      .map((l) => ({
        leagueId: safeStr(l?.leagueId || l?.id).trim(),
        name: safeStr(l?.name || l?.leagueName || "").trim(),
      }))
      .filter((x) => x.leagueId);
  }, [raw]);

  // Initialize Side A to "all leagues" once, if user hasn't chosen anything.
  useEffect(() => {
    if (!leagueRows.length) return;
    if (sideA.length || sideB.length) return;
    setSideA(leagueRows.map((x) => x.leagueId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueRows.length]);

  const groupA = useMemo(() => {
    if (!raw) return null;
    return buildGroupFromDraftJson(raw, sideA);
  }, [raw, sideA]);

  const groupB = useMemo(() => {
    if (!raw) return null;
    if (!sideB.length) return null;
    return buildGroupFromDraftJson(raw, sideB);
  }, [raw, sideB]);

  const comparing = !!groupA && !!groupB && sideB.length > 0;

  const compareRows = useMemo(() => {
    if (!comparing) return [];
    return buildPlayerResults(groupA, groupB);
  }, [comparing, groupA, groupB]);

  // --- list controls ---
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [sortKey, setSortKey] = useState("adp"); // adp | name | pos | delta | count
  const [sortDir, setSortDir] = useState("asc"); // asc/desc

  const listRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pFilter = pos;

    // Non-compare list from groupA.players
    const base = comparing
      ? compareRows.map((r) => ({
          key: `${safeStr(r.name)}|||${safeStr(r.position)}`,
          name: r.name,
          position: r.position,
          adp: safeNum(r.adpA),
          count: safeNum(r.countA),
          adpB: safeNum(r.adpB),
          countB: safeNum(r.countB),
          delta: safeNum(r.delta), // B - A
        }))
      : safeArray(groupA?.playersList ?? groupA?.players ?? []).map((r) => ({
          key: `${safeStr(r.name)}|||${safeStr(r.position)}`,
          name: r.name,
          position: r.position,
          adp: safeNum(r.avgOverallPick ?? r.adp ?? r.avgPick),
          count: safeNum(r.count ?? 0),
          delta: null,
        }));

    const filtered = base.filter((r) => {
      if (pFilter !== "ALL" && safeStr(r.position).toUpperCase() !== pFilter) return false;
      if (q && !safeStr(r.name).toLowerCase().includes(q)) return false;
      return true;
    });

    const dir = sortDir === "desc" ? -1 : 1;
    filtered.sort((a, b) => {
      if (sortKey === "name") return dir * safeStr(a.name).localeCompare(safeStr(b.name));
      if (sortKey === "pos") return dir * safeStr(a.position).localeCompare(safeStr(b.position));
      if (sortKey === "delta") return dir * (safeNum(a.delta) - safeNum(b.delta));
      if (sortKey === "count") return dir * (safeNum(a.count) - safeNum(b.count));
      // default: adp asc
      return dir * (safeNum(a.adp) - safeNum(b.adp));
    });

    return filtered;
  }, [query, pos, sortKey, sortDir, comparing, compareRows, groupA]);

  const positions = useMemo(() => {
    const set = new Set();
    for (const r of safeArray(groupA?.playersList ?? groupA?.players ?? [])) {
      const p = safeStr(r?.position).toUpperCase().trim();
      if (p) set.add(p);
    }
    for (const r of safeArray(compareRows)) {
      const p = safeStr(r?.position).toUpperCase().trim();
      if (p) set.add(p);
    }
    return ["ALL", ...Array.from(set).sort()];
  }, [groupA, compareRows]);

  function toggleSort(k) {
    setSortKey((prev) => {
      if (prev === k) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(k === "name" || k === "pos" ? "asc" : "asc");
      return k;
    });
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
            <span className="text-sm text-muted">{year}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-primary">{mode}</h1>
          <p className="mt-1 text-sm text-muted">
            {comparing ? "Comparing Side A vs Side B" : "Aggregated view (Side A)"}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-card-surface shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-primary">Draftboard</h2>
                <p className="text-xs text-muted">
                  Click a pick square to see all players drafted at that slot.
                </p>
              </div>
              {comparing ? (
                <div className="text-xs text-muted">
                  Showing: <span className="font-semibold text-primary">Side A</span>
                </div>
              ) : (
                <div className="text-xs text-muted">
                  Leagues: <span className="font-semibold text-primary">{safeNum(groupA.leagueCount)}</span>
                </div>
              )}
            </div>
            <div className="p-5">
              <DraftBoard group={groupA} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card-surface shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-primary">
                {comparing ? "Compare List" : "Player List"}
              </h2>
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
                      ADP
                    </Th>
                    {comparing ? (
                      <Th onClick={() => toggleSort("delta")} active={sortKey === "delta"} dir={sortDir}>
                        Δ (B − A)
                      </Th>
                    ) : null}
                    <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                      Player
                    </Th>
                    <Th onClick={() => toggleSort("pos")} active={sortKey === "pos"} dir={sortDir}>
                      Pos
                    </Th>
                    <Th onClick={() => toggleSort("count")} active={sortKey === "count"} dir={sortDir}>
                      Count
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
                        <td className="px-4 py-3 font-semibold text-primary">
                          {safeNum(r.adp) ? safeNum(r.adp).toFixed(1) : "—"}
                          <div className="text-[11px] text-muted">
                            {formatRoundPickFromAvgOverall(safeNum(r.adp), safeNum(groupA?.meta?.teams) || 12)}
                          </div>
                        </td>
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
                        <td className="px-4 py-3 text-primary">{r.name}</td>
                        <td className="px-4 py-3 text-muted">{r.position}</td>
                        <td className="px-4 py-3 text-muted">{safeNum(r.count) || 0}</td>
                      </tr>
                    );
                  })}
                  {!listRows.length ? (
                    <tr>
                      <td colSpan={comparing ? 5 : 4} className="px-4 py-8 text-center text-sm text-muted">
                        No results.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {pickerOpen ? (
        <LeaguePicker
          leagues={leagueRows}
          sideA={sideA}
          sideB={sideB}
          onClose={() => setPickerOpen(false)}
          onChange={(a, b) => {
            setSideA(a);
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
        "cursor-pointer select-none px-4 py-3",
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

  if (!g || !m) return null;
  const teams = safeNum(m.teams) || 12;
  const rounds = safeNum(m.rounds) || 18;

  const cells = g?.draftboard?.cells || {};

  const grid = [];
  for (let r = 1; r <= rounds; r++) {
    const row = [];
    for (let p = 1; p <= teams; p++) {
      const key = `${r}-${p}`;
      const list = safeArray(cells[key]);
      const top = list[0] || null;
      const overall = (r - 1) * teams + p;
      row.push({ key, r, p, overall, top, list });
    }
    grid.push(row);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-xl border border-border">
        <div className="min-w-[900px]">
          {grid.map((row, i) => (
            <div key={i} className="grid" style={{ gridTemplateColumns: `repeat(${teams}, minmax(0, 1fr))` }}>
              {row.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setOpenKey(c.key)}
                  className="group relative h-[74px] border-r border-b border-border/70 bg-background/20 p-2 text-left transition hover:bg-background/35"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-muted">
                      {c.r}.{String(c.p).padStart(2, "0")}
                    </div>
                    <div className="text-[11px] text-muted">#{c.overall}</div>
                  </div>
                  {c.top ? (
                    <div className="mt-1">
                      <div className="truncate text-[12px] font-semibold text-primary">{c.top.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <span>{pctFmt(c.top.pct)}</span>
                        <span className="opacity-60">•</span>
                        <span>{safeNum(c.top.count)}x</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-muted opacity-70">—</div>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {openKey ? (
        <CellModal
          cellKey={openKey}
          teams={teams}
          list={safeArray(cells[openKey])}
          onClose={() => setOpenKey(null)}
        />
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="text-xs text-muted">Pick</div>
            <div className="text-lg font-semibold text-primary">
              {rp} <span className="text-sm text-muted">•</span> <span className="text-sm text-muted">#{overall}</span>
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
                .sort((a, b) => (safeNum(b?.pct) - safeNum(a?.pct)) || safeStr(a?.name).localeCompare(safeStr(b?.name)))
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-primary">Select leagues</div>
            <div className="mt-1 text-xs text-muted">
              Click A or B per league. A league cannot be in both sides.
            </div>
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
