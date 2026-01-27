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

function ListScroller({ children }) {
  const { isPhoneLike, isPortrait } = useDraftboardLandscapeTip();
  const isPhoneLandscape = isPhoneLike && !isPortrait;

  return (
    <div
      className="overflow-auto"
      style={{
        maxHeight: isPhoneLandscape ? "calc(100dvh - 160px)" : "calc(100dvh - 160px)",
      }}
    >
      {children}
    </div>
  );
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

/* ===========================
   Draft Breakdown helpers
=========================== */

function playerKey(name, position) {
  return `${safeStr(name).trim()}|||${safeStr(position).trim()}`;
}

function parseRP(rp) {
  // "3.07" -> { round: 3, pick: 7 }
  const s = safeStr(rp).trim();
  const m = s.match(/^(\d+)\.(\d+)$/);
  if (!m) return { round: null, pick: null };
  return { round: safeNum(m[1]), pick: safeNum(m[2]) };
}

function buildLeagueIndexFromRaw(raw) {
  // Map(leagueId -> { leagueId, name, players })
  const out = new Map();
  const per = raw?.perLeague || {};
  const all = [...safeArray(per?.sideA), ...safeArray(per?.sideB), ...safeArray(raw?.leagues)];

  for (const l of all) {
    const id = safeStr(l?.leagueId || l?.id).trim();
    if (!id) continue;
    if (!out.has(id)) {
      out.set(id, {
        leagueId: id,
        name: safeStr(l?.name || l?.leagueName || id).trim() || id,
        players: l?.players || {},
      });
    }
  }
  return out;
}

function getDraftBreakdownForPlayer({ leagueIndex, leagueIds, name, position }) {
  const key = playerKey(name, position);
  const rows = [];

  for (const id of safeArray(leagueIds)) {
    const l = leagueIndex.get(id);
    if (!l) continue;

    const p = l.players?.[key];
    if (!p) continue;

    const overall = safeNum(p?.modeOverallPick ?? p?.avgOverallPick ?? 0) || null;
    const rp = safeStr(p?.modeRoundPick ?? p?.avgRoundPick ?? "").trim() || "—";
    const { round, pick } = parseRP(rp);

    rows.push({
      leagueId: id,
      leagueName: l.name,
      overallPick: overall,
      roundPick: rp,
      round,
      pickInRound: pick,
    });
  }

  rows.sort((a, b) => (a.overallPick ?? 999999) - (b.overallPick ?? 999999));
  return rows;
}

/* ===========================
   Shared UI helpers
=========================== */

function Chip({ children, tone = "muted" }) {
  const toneCls =
    tone === "accent"
      ? "border-accent/25 bg-accent/10 text-accent"
      : tone === "primary"
      ? "border-primary/25 bg-primary/10 text-primary"
      : "border-border bg-background/30 text-muted";

  return (
    <span className={cls("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] tabular-nums", toneCls)}>
      {children}
    </span>
  );
}

/* ===========================
   Breakdown Modal
=========================== */

function PlayerDraftBreakdownModal({
  open,
  title,
  subtitle,
  aLabel,
  bLabel,
  sideAData,
  sideBData,
  selectedCountA,
  selectedCountB,
  context, // NEW (same behavior as single-mode)
  onClose,
}) {
  const { isPhoneLike, isPortrait } = useDraftboardLandscapeTip();
  const isPhoneLandscape = isPhoneLike && !isPortrait;

  if (!open) return null;

  const NAV_OFFSET_PX = isPhoneLike ? 64 : 72;

  const hasA = safeArray(sideAData).length > 0 || selectedCountA > 0;
  const hasB = safeArray(sideBData).length > 0 || selectedCountB > 0;

  const placedRp = safeStr(context?.placed?.rp).trim();
  const placedOverall = context?.placed?.overall;

  const from = context?.clickedFrom;
  const fromRp = safeStr(from?.rp).trim();
  const fromOverall = from?.overall;
  const topName = safeStr(from?.topName).trim();
  const topPos = safeStr(from?.topPos).trim();
  const topPct = from?.topPct;

  const headline = (() => {
    if (fromRp) {
      if (topName) {
        return `You clicked from ${fromRp} (#${fromOverall}). Most common at this slot: ${topName}${
          topPos ? ` (${topPos})` : ""
        }${Number.isFinite(topPct) ? ` • ${pctFmt(topPct)}` : ""}.`;
      }
      return `You clicked from ${fromRp} (#${fromOverall}).`;
    }
    return null;
  })();

  const placementLine =
    placedRp && placedOverall ? `Placed on the board at ${placedRp} (#${placedOverall}) based on ADP order.` : null;

  const draftedA = safeArray(sideAData).length;
  const draftedB = safeArray(sideBData).length;

  const mismatchHint = (() => {
    if (!fromRp) return null;
    if (!draftedA && !draftedB) return null;

    const matches = [...safeArray(sideAData), ...safeArray(sideBData)].some(
      (r) => safeStr(r?.roundPick).trim() === fromRp
    );
    if (matches) return `This player was drafted at this exact slot in at least one league in your sample.`;

    return `This player wasn’t drafted at ${fromRp} in your selected leagues — the board placement is based on ADP averages, so the “typical” slot can differ from the exact pick distribution at that square.`;
  })();

  const emptyReason = (() => {
    if (draftedA || draftedB) return null;
    return `In the leagues you selected, this player either went undrafted, was drafted outside the captured draft data, or simply wasn’t taken in those specific drafts. Only leagues where the player was actually drafted contribute to the player’s average.`;
  })();

  const emptyExplainer = (
    <div className="rounded-2xl border border-border bg-background/30 p-4 text-sm text-muted">
      <div className="font-semibold text-primary">No draft selections recorded in this set.</div>
      <p className="mt-1 leading-6">
        Totally normal, especially late in drafts. Some leagues use that pick on a different sleeper/reach, so a player
        can have an ADP in the overall pool but still be{" "}
        <span className="font-semibold">undrafted in this specific sample</span>. Only leagues where the player was
        actually drafted contribute to that player’s average.
      </p>
    </div>
  );

  function SideBlock({ label, rows, selectedCount, accent }) {
    const draftedCount = safeArray(rows).length;
    const tone = accent ? "accent" : "primary";

    return (
      <div className={cls("rounded-2xl border border-border", "bg-card-surface/70 backdrop-blur")}>
        <div className="px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={cls("text-xs font-semibold", accent ? "text-accent" : "text-primary")}>{label}</div>
              <div className="mt-1 text-xs text-muted">
                Drafted in{" "}
                <span className={cls("font-semibold", accent ? "text-accent" : "text-primary")}>{draftedCount}</span> of{" "}
                <span className="font-semibold text-primary">{safeNum(selectedCount)}</span> leagues
              </div>
            </div>
          </div>

          <div className="mt-3">
            {!draftedCount ? (
              emptyExplainer
            ) : isPhoneLike ? (
              <div className="space-y-2">
                {safeArray(rows).map((r) => (
                  <button
                    key={`${r.leagueId}|||${r.roundPick}`}
                    type="button"
                    className="w-full rounded-2xl border border-border bg-background/20 p-3 text-left hover:bg-background/30"
                    onClick={() => {}}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-primary">{r.leagueName}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted">{r.leagueId}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Chip tone={tone}>{r.roundPick}</Chip>
                        <Chip>{r.overallPick ?? "—"}</Chip>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-card-surface/95 backdrop-blur">
                    <tr className="text-left text-xs text-muted">
                      <th className="px-4 py-3">League</th>
                      <th className="px-4 py-3">Round.Pick</th>
                      <th className="px-4 py-3">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeArray(rows).map((r) => (
                      <tr key={`${r.leagueId}|||${r.roundPick}`} className="border-t border-border/60">
                        <td className="px-4 py-3 text-primary">
                          <div className="truncate font-semibold">{r.leagueName}</div>
                          <div className="truncate text-xs text-muted">{r.leagueId}</div>
                        </td>
                        <td className="px-4 py-3 text-muted tabular-nums">
                          <span className="inline-flex rounded-full border border-border bg-background/30 px-2 py-0.5 text-xs">
                            {r.roundPick}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted tabular-nums">{r.overallPick ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cls(
        "fixed inset-0 z-[80] flex bg-black/55",
        isPhoneLandscape ? "items-start justify-center" : "items-center justify-center",
        "p-3 sm:p-4"
      )}
      style={{
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${NAV_OFFSET_PX}px)`,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Player draft breakdown"
    >
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card-surface shadow-2xl flex flex-col"
        style={{ maxHeight: `calc(100dvh - ${NAV_OFFSET_PX}px - 24px)` }}
      >
        <div className="sticky top-0 z-10 border-b border-border bg-card-surface/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-muted sm:text-xs">{subtitle}</div>
              <div className="mt-1 truncate text-base font-semibold text-primary sm:text-lg">{title}</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-primary hover:bg-background/60"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-5">
          <div className="mb-3 space-y-2 rounded-2xl border border-border bg-background/25 p-4 text-sm text-muted">
            {headline ? <div className="font-semibold text-primary">{headline}</div> : null}
            {placementLine ? <div className="text-muted">{placementLine}</div> : null}
            {mismatchHint ? <div className="text-muted">{mismatchHint}</div> : null}
            {emptyReason ? <div className="text-muted">{emptyReason}</div> : null}
          </div>

          <div className={cls("grid gap-3 sm:gap-4", hasB ? "md:grid-cols-2" : "md:grid-cols-1")}>
            {hasA ? <SideBlock label={aLabel} rows={sideAData} selectedCount={selectedCountA} /> : null}
            {hasB ? <SideBlock label={bLabel} rows={sideBData} selectedCount={selectedCountB} accent /> : null}
          </div>

          <div className="mt-3 text-[11px] text-muted sm:mt-4 sm:text-xs">
            Tip: this list shows the exact slot in each league where the player was drafted (the “why” behind the ADP).
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Component
=========================== */

export default function DraftCompareCompareModesClient() {
  const baseYear = Number(CURRENT_SEASON || 2025);
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => String(baseYear - i)), [baseYear]);

  const [modes, setModes] = useState([]);
  const [loadErr, setLoadErr] = useState("");

  const [selA, setSelA] = useState("2025|||big-game");
  const [selB, setSelB] = useState("2025|||gauntlet");

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

  // player breakdown modal
  const [playerModal, setPlayerModal] = useState(null);
  // { name, position, clickedFrom?: {...}, placed?: { rp, overall } }

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
      const avgPickA = numOrNull(r.adpA);
      const avgPickB = numOrNull(r.adpB);
      return {
        key: `${safeStr(r.name)}|||${safeStr(r.position)}`,
        name: r.name,
        position: r.position,
        avgPickA,
        avgPickB,
        avgRoundPickA: avgPickA ? formatRoundPickFromAvgOverall(avgPickA, teams) : "—",
        avgRoundPickB: avgPickB ? formatRoundPickFromAvgOverall(avgPickB, teams) : "—",
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
      if (sortKey === "delta") return dir * (safeNum(a.delta) - safeNum(b.delta));
      if (sortKey === "adpB") return dir * (numForSort(a.avgPickB) - numForSort(b.avgPickB));
      if (sortKey === "rpA") return dir * (numForSort(a.avgPickA) - numForSort(b.avgPickA));
      if (sortKey === "rpB") return dir * (numForSort(a.avgPickB) - numForSort(b.avgPickB));
      return dir * (numForSort(a.avgPickA) - numForSort(b.avgPickA));
    });

    return filtered;
  }, [compareRows, pos, query, sortDir, sortKey, teams]);

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

  // league indexes + league lists for breakdown modal
  const leagueIndexA = useMemo(() => (rawA ? buildLeagueIndexFromRaw(rawA) : new Map()), [rawA]);
  const leagueIndexB = useMemo(() => (rawB ? buildLeagueIndexFromRaw(rawB) : new Map()), [rawB]);
  const allLeagueIdsA = useMemo(() => (rawA ? deriveAllLeagueIds(rawA) : []), [rawA]);
  const allLeagueIdsB = useMemo(() => (rawB ? deriveAllLeagueIds(rawB) : []), [rawB]);

  function groupPlayersArray(group) {
    if (!group) return [];
    const g = group;
    if (Array.isArray(g?.players)) return g.players;
    if (g?.players && typeof g.players === "object") return Object.values(g.players);
    return safeArray(g?.playersList);
  }

  function getPlacedSlotForPlayer(group, name, position, teamsCount) {
    const arr = groupPlayersArray(group);
    const targetKey = playerKey(name, position);

    const ranked = safeArray(arr)
      .map((p) => {
        const nm = safeStr(p?.name).trim();
        const pos = safeStr(p?.position).trim() || "UNK";
        const rawAdp = p?.avgOverallPick ?? p?.adp ?? p?.avgPick;
        const adpNum = typeof rawAdp === "number" ? rawAdp : Number(rawAdp);
        const adp = Number.isFinite(adpNum) && adpNum > 0 ? adpNum : null;
        return { nm, pos, adp };
      })
      .filter((p) => p.nm && p.pos)
      .sort((a, b) => {
        const aAdp = a.adp ?? Number.POSITIVE_INFINITY;
        const bAdp = b.adp ?? Number.POSITIVE_INFINITY;
        if (aAdp !== bAdp) return aAdp - bAdp;
        const n = safeStr(a.nm).localeCompare(safeStr(b.nm));
        if (n) return n;
        return safeStr(a.pos).localeCompare(safeStr(b.pos));
      });

    const idx = ranked.findIndex((p) => playerKey(p.nm, p.pos) === targetKey);
    if (idx < 0) return null;

    const overall = idx + 1;
    return {
      overall,
      rp: formatRoundPickFromAvgOverall(overall, teamsCount),
    };
  }

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
        <div className="mt-6 rounded-2xl border border-border bg-card-surface p-6 text-base sm:text-sm  text-muted">
          Loading…
        </div>
      ) : null}

      {!loading && comparing ? (
        <div className="mt-6">
          {view === "board" ? (
            <div className="rounded-2xl border border-border bg-card-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-primary">Draftboard</h2>
                  <p className="text-xs text-muted">Hint: Click a pick square to see all players drafted at that slot.</p>
                  <p className="text-xs text-muted">
                    Note: Players are placed based on average draft position, so they may not appear in the exact pick they were selected at.
                  </p>
                  {showReliabilityNote ? (
                    <p className="mt-1 text-xs text-white/60">
                      Note: Since these are different league sizes/round counts, there can be some variance in rankings.
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
                <DraftBoard
                  group={boardSide === "B" ? groupB : groupA}
                  onPlayer={(p, ctx) => {
                    const nm = p?.name;
                    const ps = p?.position;
                    if (!nm) return;

                    const g = boardSide === "B" ? groupB : groupA;
                    const placed = getPlacedSlotForPlayer(g, nm, ps, boardMeta.teams);

                    setPlayerModal({
                      name: nm,
                      position: ps,
                      clickedFrom: ctx || null,
                      placed: placed || null,
                    });
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card-surface shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold text-primary">Compare List</h2>
                {showReliabilityNote ? (
                  <p className="mt-1 text-xs text-white/60">
                    Note: Since these are different league sizes/round counts, there can be some variance in rankings.
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

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                // List click: no “from slot” context
                                const g = boardSide === "B" ? groupB : groupA;
                                const placed = getPlacedSlotForPlayer(g, r.name, r.position, boardMeta.teams);
                                setPlayerModal({
                                  name: r.name,
                                  position: r.position,
                                  clickedFrom: null,
                                  placed: placed || null,
                                });
                              }}
                              className="text-left text-primary hover:underline"
                              title="View draft breakdown"
                            >
                              {r.name}
                            </button>
                          </td>

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

      {playerModal ? (
        <PlayerDraftBreakdownModal
          open={!!playerModal}
          title={`${safeStr(playerModal.name)} (${safeStr(playerModal.position)})`}
          subtitle="Draft breakdown"
          aLabel={`Mode A — ${labelA}`}
          bLabel={`Mode B — ${labelB}`}
          selectedCountA={allLeagueIdsA.length}
          selectedCountB={allLeagueIdsB.length}
          sideAData={getDraftBreakdownForPlayer({
            leagueIndex: leagueIndexA,
            leagueIds: allLeagueIdsA,
            name: playerModal.name,
            position: playerModal.position,
          })}
          sideBData={getDraftBreakdownForPlayer({
            leagueIndex: leagueIndexB,
            leagueIds: allLeagueIdsB,
            name: playerModal.name,
            position: playerModal.position,
          })}
          context={playerModal}
          onClose={() => setPlayerModal(null)}
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

function DraftBoard({ group, onPlayer }) {
  const g = group;
  const m = g?.meta;
  const [openCell, setOpenCell] = useState(null);

  const { isPhoneLike, isPortrait, showTip, acknowledge } = useDraftboardLandscapeTip();

  // auto-scale for phone landscape so it "zooms out"
  const [fitScale, setFitScale] = useState(1);

  function posTheme(posRaw) {
    const pos = safeStr(posRaw).toUpperCase().trim();
    if (pos === "WR") return { cell: "bg-sky-400/20 hover:bg-sky-400/30", border: "border-sky-400/25" };
    if (pos === "RB") return { cell: "bg-emerald-400/20 hover:bg-emerald-400/30", border: "border-emerald-400/25" };
    if (pos === "QB") return { cell: "bg-rose-400/20 hover:bg-rose-400/30", border: "border-rose-400/25" };
    if (pos === "TE") return { cell: "bg-amber-300/20 hover:bg-amber-300/30", border: "border-amber-300/25" };
    return { cell: "bg-background/12 hover:bg-background/25", border: "border-border/70" };
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
    .map((p) => {
      const name = safeStr(p?.name).trim();
      const position = safeStr(p?.position).trim() || "UNK";

      // IMPORTANT: do NOT let missing/invalid ADP become 0
      const rawAdp = p?.avgOverallPick ?? p?.adp ?? p?.avgPick;
      const adpNum = typeof rawAdp === "number" ? rawAdp : Number(rawAdp);
      const adp = Number.isFinite(adpNum) && adpNum > 0 ? adpNum : null;

      return {
        name,
        position,
        adp, // null means "no valid ADP"
        count: safeNum(p?.count ?? 0),
      };
    })
    .filter((p) => p.name)
    .sort((a, b) => {
      const aAdp = a.adp ?? Number.POSITIVE_INFINITY;
      const bAdp = b.adp ?? Number.POSITIVE_INFINITY;

      if (aAdp !== bAdp) return aAdp - bAdp;

      const n = safeStr(a.name).localeCompare(safeStr(b.name));
      if (n) return n;
      return safeStr(a.position).localeCompare(safeStr(b.position));
    });

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    function computeScale() {
      if (!isPhoneLike || isPortrait) {
        setFitScale(1);
        return;
      }
      const vv = window.visualViewport;
      const vw = vv?.width || window.innerWidth;
      const pad = 16;
      const available = Math.max(320, vw - pad);
      const s = available / boardMinWidthPx;
      const clamped = Math.max(0.5, Math.min(1, s));
      setFitScale(clamped);
    }

    computeScale();

    const vv = window.visualViewport;
    vv?.addEventListener?.("resize", computeScale);
    vv?.addEventListener?.("scroll", computeScale);
    window.addEventListener("resize", computeScale);
    window.addEventListener("orientationchange", computeScale);

    return () => {
      vv?.removeEventListener?.("resize", computeScale);
      vv?.removeEventListener?.("scroll", computeScale);
      window.removeEventListener("resize", computeScale);
      window.removeEventListener("orientationchange", computeScale);
    };
  }, [isPhoneLike, isPortrait, boardMinWidthPx]);

  function nameTwoLines(fullName) {
    const s = safeStr(fullName).trim();
    if (!s) return { first: "", last: "" };
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-background/10 shadow-sm">
        {isPhoneLike ? (
          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted">
            <span>Swipe to view all picks</span>
            <span className="font-semibold text-white/90">→</span>
          </div>
        ) : null}

        <div className={cls(isPhoneLike ? "overflow-x-auto overflow-y-hidden" : "overflow-hidden")}>
          <div
            className="relative"
            style={{
              minWidth: isPhoneLike ? `max(100%, ${boardMinWidthPx}px)` : "100%",
              transform: `scale(${fitScale})`,
              transformOrigin: "left top",
              willChange: fitScale !== 1 ? "transform" : undefined,
            }}
          >
            {grid.map((row, i) => (
              <div key={i} className="grid" style={{ gridTemplateColumns: `repeat(${teams}, minmax(0, 1fr))` }}>
                {row.map((cell, j) => {
                  if (!cell) {
                    return <div key={`blank-${i}-${j}`} className="h-[88px] border-r border-b border-border/70 bg-background/5" />;
                  }

                  const rpAdjusted = `${cell.r}.${String(cell.pickInRound).padStart(2, "0")}`;
                  const theme = posTheme(cell.player?.position);
                  const nm = nameTwoLines(cell.player?.name);

                  return (
                    <button
                      key={`${cell.r}-${cell.displayCol}`}
                      onClick={() =>
                        setOpenCell({
                          cellKey: cell.origKey,
                          rp: rpAdjusted,
                          overall: cell.overall,
                          placedPlayer: cell.player || null,
                        })
                      }
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

      {openCell ? (
        <CellModal
          cellKey={openCell.cellKey}
          teams={teams}
          list={safeArray(cells[openCell.cellKey])}
          placedPlayer={openCell.placedPlayer}
          placedOverallRank={openCell.overall}
          placedRp={openCell.rp}
          onClose={() => setOpenCell(null)}
          onPlayer={(p, ctx) => onPlayer?.(p, ctx)}
        />
      ) : null}
    </div>
  );
}

function CellModal({ cellKey, teams, list, placedPlayer, placedOverallRank, placedRp, onClose, onPlayer }) {
  const [rStr, pStr] = safeStr(cellKey).split("-");
  const round = safeNum(rStr);
  const pickInRound = safeNum(pStr);
  const overall = (round - 1) * (safeNum(teams) || 12) + pickInRound;
  const rp = `${round}.${String(pickInRound).padStart(2, "0")}`;

  const { isPhoneLike, isPortrait } = useDraftboardLandscapeTip();
  const isPhoneLandscape = isPhoneLike && !isPortrait;
  const NAV_OFFSET_PX = isPhoneLike ? 64 : 72;

  function nameTwoLines(fullName) {
    const s = safeStr(fullName).trim();
    if (!s) return { first: "", last: "" };
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }

  const sorted = safeArray(list)
    .slice()
    .sort((a, b) => safeNum(b?.pct) - safeNum(a?.pct) || safeStr(a?.name).localeCompare(safeStr(b?.name)));

  const top = sorted[0] || null;
  const ctx = {
    cellKey,
    rp,
    overall,
    topName: top?.name || null,
    topPos: top?.position || null,
    topPct: Number.isFinite(safeNum(top?.pct)) ? safeNum(top?.pct) : null,
    uniqueCount: sorted.length,
  };

  return (
    <div
      className={cls(
        "fixed inset-0 z-[60] flex bg-black/50",
        isPhoneLandscape ? "items-start justify-center" : "items-center justify-center",
        "p-3 sm:p-4"
      )}
      style={{
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${NAV_OFFSET_PX}px)`,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Pick distribution"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card-surface shadow-xl flex flex-col"
        style={{ maxHeight: `calc(100dvh - ${NAV_OFFSET_PX}px - 24px)` }}
      >
        <div className="sticky top-0 z-10 bg-card-surface/95 backdrop-blur flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <div className="text-xs text-muted">Pick</div>
            <div className="text-base sm:text-lg font-semibold text-primary">
              {rp} <span className="text-sm text-muted">•</span> <span className="text-sm text-muted">#{overall}</span>
            </div>

            <div className="mt-1 space-y-1 text-xs text-muted">
              <div>{sorted.length ? `${sorted.length} unique players drafted here` : "No data for this exact slot"}</div>

              {top?.name ? (
                <div className="text-white/80">
                  Most common: <span className="font-semibold text-white">{safeStr(top.name)}</span>
                  {top?.position ? <span className="text-white/60"> ({safeStr(top.position)})</span> : null}
                  {Number.isFinite(safeNum(top.pct)) ? <span className="text-white/60"> • {pctFmt(safeNum(top.pct))}</span> : null}
                </div>
              ) : null}

              <div className="text-white/60">
                Tip: this is the <span className="font-semibold text-white/80">distribution</span> for {rp}. The draftboard square
                itself is filled by <span className="font-semibold text-white/80">ADP placement</span>, so it won’t always match
                the most common pick here.
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-primary hover:bg-background/60"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4">
          {isPhoneLike ? (
            <div className="space-y-2">
              {sorted.map((p) => {
                const nm = nameTwoLines(p.name);
                return (
                  <div key={`${p.name}|||${p.position}`} className="rounded-2xl border border-border bg-background/20 p-3">
                    <button
                      type="button"
                      onClick={() => onPlayer?.(p, ctx)}
                      className="w-full text-left"
                      title="View draft breakdown"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold leading-5 text-white">{nm.first}</div>
                        <div className="truncate text-white/70 leading-5">{nm.last || " "}</div>
                      </div>
                    </button>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <Chip>{safeStr(p.position)}</Chip>
                      <Chip>{pctFmt(safeNum(p.pct))}</Chip>
                      <Chip>{safeNum(p.count)}</Chip>
                    </div>
                  </div>
                );
              })}

              {!sorted.length ? (
                <div className="rounded-2xl border border-border bg-background/20 p-5 text-center text-sm text-white/70">
                  <div className="font-semibold text-white">No draft picks recorded at {rp} in your selected leagues.</div>

                  {placedPlayer?.name ? (
                    <div className="mt-2 leading-6 text-white/70">
                      This square is still filled because the board is built from{" "}
                      <span className="font-semibold text-white/80">ADP placement</span>.
                      <span className="font-semibold text-white"> {safeStr(placedPlayer.name)}</span>
                      {placedPlayer?.position ? <span className="text-white/60"> ({safeStr(placedPlayer.position)})</span> : null}{" "}
                      lands here because they rank <span className="font-semibold text-white/80">#{safeNum(placedOverallRank)}</span> by average pick
                      (mapped to <span className="font-semibold text-white/80">{safeStr(placedRp || rp)}</span>).
                    </div>
                  ) : (
                    <div className="mt-2 leading-6 text-white/70">
                      This square exists on the board due to <span className="font-semibold text-white/80">ADP placement</span>, but no leagues in your
                      selection recorded a pick at this exact slot.
                    </div>
                  )}

                  <div className="mt-2 text-white/55 leading-6">
                    Common reasons: some leagues draft fewer rounds, use keepers, or the saved draft data doesn’t include this deep of a pick.
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card-surface/95 backdrop-blur">
                <tr className="text-left text-xs text-white/70">
                  <th className="px-5 py-3">Player</th>
                  <th className="px-5 py-3">Pos</th>
                  <th className="px-5 py-3">%</th>
                  <th className="px-5 py-3">Count</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={`${p.name}|||${p.position}`} className="border-t border-white/10">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => onPlayer?.(p, ctx)}
                        className="w-full text-left text-white hover:underline"
                        title="View draft breakdown"
                      >
                        {(() => {
                          const nm = nameTwoLines(p.name);
                          return (
                            <div className="min-w-0">
                              <div className="truncate font-semibold leading-4 text-white">{nm.first}</div>
                              <div className="truncate text-white/70 leading-4">{nm.last || " "}</div>
                            </div>
                          );
                        })()}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-white/70">{p.position}</td>
                    <td className="px-5 py-3 text-white/70">{pctFmt(safeNum(p.pct))}</td>
                    <td className="px-5 py-3 text-white/70">{safeNum(p.count)}</td>
                  </tr>
                ))}

                {!sorted.length ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-white/70">
                      <div className="font-semibold text-white">No draft picks recorded at {rp} in your selected leagues.</div>

                      {placedPlayer?.name ? (
                        <div className="mt-2 leading-6 text-white/70">
                          This square is filled by <span className="font-semibold text-white/80">ADP placement</span>.
                          <span className="font-semibold text-white"> {safeStr(placedPlayer.name)}</span>
                          {placedPlayer?.position ? <span className="text-white/60"> ({safeStr(placedPlayer.position)})</span> : null}{" "}
                          is shown here because they rank <span className="font-semibold text-white/80">#{safeNum(placedOverallRank)}</span> by average pick
                          (mapped to <span className="font-semibold text-white/80">{safeStr(placedRp || rp)}</span>).
                        </div>
                      ) : (
                        <div className="mt-2 leading-6 text-white/70">
                          This square exists on the board due to <span className="font-semibold text-white/80">ADP placement</span>, but no leagues in your
                          selection recorded a pick at this exact slot.
                        </div>
                      )}

                      <div className="mt-2 text-white/55 leading-6">
                        Common reasons: fewer draft rounds, keepers, or incomplete saved draft depth for this slot.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
