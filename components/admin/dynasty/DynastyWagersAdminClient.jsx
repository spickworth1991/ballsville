"use client";
import { CURRENT_SEASON } from "@/lib/season";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminStepTabs from "../AdminStepTabs";
import { safeArray, safeStr } from "@/lib/safe";




function parseLeagueNumberFromName(name) {
  // Expected suffix like "... 3/16" (we sort by the leading number)
  const s = safeStr(name).trim();
  const m = s.match(/(\d+)\s*\/\s*(\d+)\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function scrollTopSmooth() {
  if (typeof window === "undefined") return;
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }
}

// Key by roster-instance (theme/division + leagueName + ownerName)
function entryKey(p) {
  const division = safeStr(p?.division || "").trim();
  const leagueName = safeStr(p?.leagueName || "").trim();
  const ownerName = safeStr(p?.ownerName || "").trim();
  return `${division}|||${leagueName}|||${ownerName}`;
}

function nowIso() {
  return new Date().toISOString();
}

const LEADERBOARD_URL_BY_SEASON = (season) =>
  `https://ballsville-leaderboard.pages.dev/data/leaderboards_${encodeURIComponent(season)}.json`;

function fmtMoney(n) {
  const x = typeof n === "number" ? n : parseFloat(n);
  if (Number.isNaN(x)) return "$0";
  return `$${x.toFixed(0)}`;
}

function buildEmptyState(season) {
  return {
    season: Number(season),
    updatedAt: "",
    source: {
      leaderboardUrl: LEADERBOARD_URL_BY_SEASON(season),
      lastFetchedAt: "",
      leaderboardEtag: "",
    },

    eligibility: {
      computedAt: "",
      week: 17,
      byDivision: {},
    },

    week17: {
      week: 17,
      resolvedAt: "",

      // Rules (editable so the public page has no magic numbers)
      credit: 50,
      wagerBonus: 200,
      champBonus: 250,
      champBonus2: 100,
      champBonus3: 50,
      leagueWinBonus: 125,
      empireBonus: 225,

      // { [entryKey]: { decision: "bank" | "wager" } }
      decisions: {},
      // { [entryKey]: number }
      points: {},

      // League-level toggles/notes
      empireTriggered: {
        // `${division}|||${leagueName}` -> true
      },

      results: {
        divisions: {},
        leagueWinners: {},
        wagerMisses: [],
      },
    },

    week18: {
      week: 18,
      resolvedAt: "",
      points: {},
      showdown: {
        champions: {},
        result: {
          winner: "",
          winnerKey: "",
          winnerDivision: "",
          winnerPts: 0,
          loser: "",
          loserKey: "",
          loserDivision: "",
          loserPts: 0,
          tie: false,
        },
      },
    },
  };
}

function getDynastyRoot(leaderboardsJson, season) {
  const seasonObj = leaderboardsJson?.[String(season)] || {};
  const candidates = [
    seasonObj.dynasty,
    seasonObj.dyn,
    seasonObj.empire,
    seasonObj["dynasty-leagues"],
    seasonObj["dynasty_leagues"],
  ].filter(Boolean);
  return candidates[0] || null;
}

function getWeekPointsMapFromLeaderboard(leaderboardsJson, season, week) {
  const root = getDynastyRoot(leaderboardsJson, season);
  const owners = safeArray(root?.owners);
  const map = {};

  for (const o of owners) {
    const ownerName = safeStr(o?.ownerName).trim();
    const leagueName = safeStr(o?.leagueName).trim();
    const division = safeStr(o?.division).trim();
    if (!ownerName || !leagueName || !division) continue;

    const k = entryKey({ division, leagueName, ownerName });
    const v = o?.weekly?.[String(week)] ?? o?.weekly?.[week];
    const n = typeof v === "number" ? v : parseFloat(v);
    map[k] = Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }

  return map;
}

function buildOwnersByDivisionLeague(leaderboardsJson, season) {
  const root = getDynastyRoot(leaderboardsJson, season);
  const owners = safeArray(root?.owners);
  const byDiv = {};

  for (const o of owners) {
    const division = safeStr(o?.division).trim();
    const leagueName = safeStr(o?.leagueName).trim();
    const ownerName = safeStr(o?.ownerName).trim();
    if (!division || !leagueName || !ownerName) continue;
    if (!byDiv[division]) byDiv[division] = {};
    if (!byDiv[division][leagueName]) byDiv[division][leagueName] = new Set();
    byDiv[division][leagueName].add(ownerName);
  }

  const out = {};
  for (const div of Object.keys(byDiv)) {
    out[div] = {};
    for (const leagueName of Object.keys(byDiv[div])) {
      out[div][leagueName] = Array.from(byDiv[div][leagueName]).sort((a, b) => a.localeCompare(b));
    }
  }
  return out;
}

function buildLeagueOrderIndex(dynastyLeaguesJson, season) {
  const rows = safeArray(dynastyLeaguesJson?.rows || dynastyLeaguesJson);
  const map = new Map();

  for (const r of rows) {
    const y = Number(r?.year);
    if (Number.isFinite(y) && Number.isFinite(Number(season)) && y !== Number(season)) continue;

    const div = safeStr(r?.division || r?.theme_name || r?.themeName || "").trim();
    const leagueName = safeStr(r?.leagueName || r?.name || r?.league_name || "").trim();
    if (!div || !leagueName) continue;

    const raw =
      r?.display_order ??
      r?.displayOrder ??
      r?.league_order ??
      r?.leagueOrder ??
      r?.order ??
      r?.displayorder;

    const n = Number(raw);
    const fromName = parseLeagueNumberFromName(leagueName);

    // Prefer explicit display_order, otherwise use trailing "1/16"
    const orderNum = Number.isFinite(n) ? n : Number.isFinite(fromName) ? fromName : 999999;
    map.set(`${div}|||${leagueName}`.toLowerCase(), orderNum);
  }

  return map;
}

function getLeagueOrder(orderIndex, division, leagueName) {
  const key = `${safeStr(division).trim()}|||${safeStr(leagueName).trim()}`.toLowerCase();
  const v = orderIndex?.get?.(key);
  if (Number.isFinite(v)) return v;

  const fromName = parseLeagueNumberFromName(leagueName);
  return Number.isFinite(fromName) ? fromName : 999999;
}

function sortByLeagueOrder(entries, orderIndex) {
  return [...entries].sort((a, b) => {
    const ao = getLeagueOrder(orderIndex, a.division, a.leagueName);
    const bo = getLeagueOrder(orderIndex, b.division, b.leagueName);
    if (ao !== bo) return ao - bo;
    const al = safeStr(a.leagueName).localeCompare(safeStr(b.leagueName));
    if (al !== 0) return al;
    return safeStr(a.ownerName).localeCompare(safeStr(b.ownerName));
  });
}

function PrimaryButton({ children, onClick, disabled, tone = "accent" }) {
  const toneCls =
    tone === "danger"
      ? "bg-rose-500/15 border-rose-400/30 text-rose-100 hover:bg-rose-500/20"
      : tone === "muted"
      ? "bg-panel border-subtle text-foreground hover:border-accent/40"
      : tone === "accent2"
      ? "bg-sky-500/15 border-sky-400/30 text-sky-100 hover:bg-sky-500/20"
      : "bg-accent/15 border-accent/30 text-accent hover:bg-accent/20";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold tracking-[0.15em] uppercase transition disabled:opacity-50 disabled:cursor-not-allowed ${toneCls}`}
    >
      {children}
    </button>
  );
}

function SmallBadge({ children }) {
  return (
    <span className="inline-flex text-[11px] uppercase tracking-[0.25em] text-muted rounded-full border border-subtle bg-panel/60 px-3 py-1">
      {children}
    </span>
  );
}

function Card({ children }) {
  return <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm backdrop-blur p-5">{children}</div>;
}

function Divider() {
  return <div className="h-px w-full bg-subtle my-4" />;
}

function normalizeLoadedDoc(saved, season) {
  const base = buildEmptyState(season);
  const doc = saved?.data ?? saved ?? null;
  if (!doc || typeof doc !== "object") return base;
  return {
    ...base,
    ...doc,
    season: Number(doc?.season ?? season) || Number(season),
    eligibility: {
      ...base.eligibility,
      ...(doc?.eligibility || {}),
      byDivision: doc?.eligibility?.byDivision || {},
    },
    week17: {
      ...base.week17,
      ...(doc?.week17 || {}),
      decisions: doc?.week17?.decisions || {},
      points: doc?.week17?.points || {},
      empireTriggered: doc?.week17?.empireTriggered || {},
      results: {
        ...base.week17.results,
        ...(doc?.week17?.results || {}),
      },
    },
    week18: {
      ...base.week18,
      ...(doc?.week18 || {}),
      points: doc?.week18?.points || {},
      showdown: {
        ...base.week18.showdown,
        ...(doc?.week18?.showdown || {}),
        champions: doc?.week18?.showdown?.champions || {},
        result: {
          ...base.week18.showdown.result,
          ...(doc?.week18?.showdown?.result || {}),
        },
      },
    },
  };
}

function computeResults(doc) {
  const wk = doc?.week17 || {};
  const credit = Number(wk?.credit ?? 50) || 50;
  const wagerBonus = Number(wk?.wagerBonus ?? 200) || 200;
  const champ1 = Number(wk?.champBonus ?? 250) || 250;
  const champ2 = Number(wk?.champBonus2 ?? 100) || 100;
  const champ3 = Number(wk?.champBonus3 ?? 50) || 50;

  const decisions = wk?.decisions || {};
  const points = wk?.points || {};

  // Flatten finalists from eligibility
  const entries = [];
  const byDivision = doc?.eligibility?.byDivision || {};
  for (const div of Object.keys(byDivision)) {
    const leagues = safeArray(byDivision[div]);
    for (const l of leagues) {
      const leagueName = safeStr(l?.leagueName).trim();
      const finalists = safeArray(l?.finalists);
      for (const ownerName of finalists) {
        const k = entryKey({ division: div, leagueName, ownerName });
        entries.push({ division: div, leagueName, ownerName: safeStr(ownerName).trim(), k });
      }
    }
  }

  const rows = entries
    .filter((e) => e.ownerName && e.leagueName && e.division)
    .map((e) => ({
      ...e,
      decision: safeStr(decisions?.[e.k]?.decision || "bank").trim() || "bank",
      pts: Number(points?.[e.k] ?? 0) || 0,
      credit,
    }));

  // Per-division podium + wager pot winner
  const divisionResults = {};
  const divisionsSorted = Object.keys(byDivision).sort((a, b) => a.localeCompare(b));

  for (const div of divisionsSorted) {
    const divRows = rows.filter((r) => r.division === div);
    const ranked = [...divRows].sort((a, b) => b.pts - a.pts);

    const champ = ranked[0]
      ? { bonus: champ1, winner: ranked[0].ownerName, winnerKey: ranked[0].k, leagueName: ranked[0].leagueName, pts: ranked[0].pts }
      : { bonus: champ1, winner: "", winnerKey: "", leagueName: "", pts: 0 };
    const second = ranked[1]
      ? { bonus: champ2, winner: ranked[1].ownerName, winnerKey: ranked[1].k, leagueName: ranked[1].leagueName, pts: ranked[1].pts }
      : { bonus: champ2, winner: "", winnerKey: "", leagueName: "", pts: 0 };
    const third = ranked[2]
      ? { bonus: champ3, winner: ranked[2].ownerName, winnerKey: ranked[2].k, leagueName: ranked[2].leagueName, pts: ranked[2].pts }
      : { bonus: champ3, winner: "", winnerKey: "", leagueName: "", pts: 0 };

    const wagered = divRows.filter((r) => r.decision === "wager");
    const wagerPool = wagered.length * credit;
    const wagerWinner = [...wagered].sort((a, b) => b.pts - a.pts)[0] || null;

    const wagerPot = wagerWinner
      ? {
          pool: wagerPool,
          bonus: wagerBonus,
          total: wagerPool + wagerBonus,
          winner: wagerWinner.ownerName,
          winnerKey: wagerWinner.k,
          winnerLeague: wagerWinner.leagueName,
          winnerPts: wagerWinner.pts,
        }
      : { pool: wagerPool, bonus: wagerBonus, total: wagerPool + wagerBonus, winner: "", winnerKey: "", winnerLeague: "", winnerPts: 0 };

    divisionResults[div] = { champ, second, third, wagerPot };
  }

  // Wager misses (same as your new file)
  const wagerMisses = [];
  for (const div of Object.keys(byDivision)) {
    const topWagerPts = Number(divisionResults?.[div]?.wagerPot?.winnerPts ?? 0) || 0;
    const hasWagerWinner = Boolean(divisionResults?.[div]?.wagerPot?.winnerKey);
    const wouldHaveWon = Number(divisionResults?.[div]?.wagerPot?.total ?? 0) || 0;
    if (!hasWagerWinner) continue;

    for (const r of rows) {
      if (r.division !== div) continue;
      if (r.decision !== "bank") continue;
      if (r.pts >= topWagerPts) {
        wagerMisses.push({
          ownerName: r.ownerName,
          division: r.division,
          leagueName: r.leagueName,
          wk17: r.pts,
          key: r.k,
          wouldHaveWon,
        });
      }
    }
  }
  wagerMisses.sort((a, b) => b.wk17 - a.wk17);

  // ✅ Restore Week 18 champion derivation + result (from your old working file)
  const nextWeek18 = (() => {
    const prev18 = doc?.week18 || {};
    const points18 = prev18?.points || {};

    const champions = {};
    for (const div of Object.keys(byDivision)) {
      const champEntry = divisionResults?.[div]?.champ;
      if (!champEntry?.winner || !champEntry?.winnerKey) continue;
      champions[div] = {
        ownerName: champEntry.winner,
        key: champEntry.winnerKey,
        leagueName: champEntry.leagueName || "",
        wk17: Number(champEntry.pts ?? 0) || 0,
      };
    }

    const divs = Object.keys(champions).sort((a, b) => a.localeCompare(b));
    const aDiv = divs[0] || "";
    const bDiv = divs[1] || "";
    const aChamp = aDiv ? champions[aDiv] : null;
    const bChamp = bDiv ? champions[bDiv] : null;

    const aPts = aChamp ? Number(points18?.[aChamp.key] ?? 0) || 0 : 0;
    const bPts = bChamp ? Number(points18?.[bChamp.key] ?? 0) || 0 : 0;

    const result = (() => {
      if (!aChamp || !bChamp) {
        return { ...buildEmptyState(doc?.season || new Date().getFullYear()).week18.showdown.result };
      }
      if (aPts === bPts) {
        return {
          winner: "TIE",
          winnerKey: "",
          winnerDivision: "",
          winnerPts: aPts,
          loser: "TIE",
          loserKey: "",
          loserDivision: "",
          loserPts: bPts,
          tie: true,
        };
      }

      const win = aPts > bPts ? { div: aDiv, champ: aChamp, pts: aPts } : { div: bDiv, champ: bChamp, pts: bPts };
      const lose = aPts > bPts ? { div: bDiv, champ: bChamp, pts: bPts } : { div: aDiv, champ: aChamp, pts: aPts };

      return {
        winner: win.champ.ownerName,
        winnerKey: win.champ.key,
        winnerDivision: win.div,
        winnerPts: win.pts,
        loser: lose.champ.ownerName,
        loserKey: lose.champ.key,
        loserDivision: lose.div,
        loserPts: lose.pts,
        tie: false,
      };
    })();

    return {
      ...prev18,
      week: 18,
      points: points18,
      showdown: {
        ...prev18.showdown,
        champions,
        result,
      },
    };
  })();

  return {
    ...doc,
    week17: {
      ...wk,
      results: {
        divisions: divisionResults,
        wagerMisses,
      },
    },
    week18: nextWeek18,
  };
}

function slugify(v) {
  const s = safeStr(v).trim().toLowerCase();
  return s
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function leagueAnchorId(season, division, leagueName) {
  return `dw-admin-${slugify(season)}-${slugify(division)}-${slugify(leagueName)}`;
}

function scrollToId(id) {
  if (typeof window === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    el.scrollIntoView();
  }
}

function DecisionPill({ decision }) {
  const isWager = decision === "wager";
  return (
    <span
      className={
        isWager
          ? "inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200"
          : "inline-flex items-center gap-1 rounded-full border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200"
      }
      title={isWager ? "Wagered" : "Banked"}
    >
      <span aria-hidden>{isWager ? "🎯" : "🏦"}</span>
      {isWager ? "Wager" : "Bank"}
    </span>
  );
}



export default function DynastyWagersAdminClient() {
  const [season, setSeason] = useState(() => CURRENT_SEASON)
  const [doc, setDoc] = useState(() => buildEmptyState(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [step, setStep] = useState("finalists");

  const [leagueOrderIndex, setLeagueOrderIndex] = useState(() => new Map());
  // { [division]: { [leagueName]: string[] } }
  const [ownersByDivisionLeague, setOwnersByDivisionLeague] = useState(null);
  const [openDivisions, setOpenDivisions] = useState({});

  function jumpToLeague(div, leagueName) {
    const division = safeStr(div).trim();
    const league = safeStr(leagueName).trim();
    if (!division || !league) return;

    const divId = `div-${slugify(season)}-${slugify(division)}`;
    setOpenDivisions((prev) => ({ ...prev, [divId]: true }));

    const id = leagueAnchorId(season, division, league);
    setTimeout(() => scrollToId(id), 60);
  }

  const divisions = useMemo(() => {
    const byDiv = doc?.eligibility?.byDivision || {};
    const out = [];

    for (const div of Object.keys(byDiv)) {
      const leagues = safeArray(byDiv[div]).map((l) => {
        const leagueName = safeStr(l?.leagueName).trim();
        const finalists = safeArray(l?.finalists).map((x) => safeStr(x).trim()).filter(Boolean);
        return { division: div, leagueName, finalists };
      });

      out.push({
        division: div,
        leagues: leagues.sort((a, b) => {
          const ao = getLeagueOrder(leagueOrderIndex, div, a.leagueName);
          const bo = getLeagueOrder(leagueOrderIndex, div, b.leagueName);
          if (ao !== bo) return ao - bo;
          return a.leagueName.localeCompare(b.leagueName);
        }),
      });
    }

    return out.sort((a, b) => a.division.localeCompare(b.division));
  }, [doc, leagueOrderIndex]);

  // ✅ FIX: this was undefined before and caused step 2 to crash
  const divisionsSorted = useMemo(() => divisions.map((d) => d.division).sort((a, b) => a.localeCompare(b)), [divisions]);

  const flatRows = useMemo(() => {
    const out = [];
    for (const d of divisions) {
      for (const l of d.leagues) {
        for (const ownerName of l.finalists) {
          const k = entryKey({ division: d.division, leagueName: l.leagueName, ownerName });
          const decision = safeStr(doc?.week17?.decisions?.[k]?.decision || "bank").trim() || "bank";
          const pts = Number(doc?.week17?.points?.[k] ?? 0) || 0;
          out.push({ division: d.division, leagueName: l.leagueName, ownerName, k, decision, pts });
        }
      }
    }
    return sortByLeagueOrder(out, leagueOrderIndex);
  }, [divisions, doc, leagueOrderIndex]);

  const flatRowsByDivision = useMemo(() => {
    const m = {};
    for (const r of flatRows) {
      const div = safeStr(r?.division).trim();
      if (!div) continue;
      if (!m[div]) m[div] = [];
      m[div].push(r);
    }
    return m;
  }, [flatRows]);

  async function loadLeagueOrderIndex(seasonToLoad) {
    try {
      const bust = `v=${Date.now()}`;
      const res = await fetch(`/r2/data/dynasty/leagues.json?${bust}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setLeagueOrderIndex(buildLeagueOrderIndex(data, seasonToLoad));
    } catch {}
  }

  async function loadDoc(seasonToLoad) {
    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");
    try {
      await loadLeagueOrderIndex(seasonToLoad);
      const res = await fetch(`/api/admin/dynasty-wagers?season=${encodeURIComponent(seasonToLoad)}`, {
        cache: "no-store",
      });
      const saved = await res.json().catch(() => null);
      const next = normalizeLoadedDoc(saved, seasonToLoad);
      setDoc(next);
      setSeason(Number(seasonToLoad));
    } catch (e) {
      setErrorMsg(e?.message || "Failed to load Dynasty wagers.");
      setDoc(buildEmptyState(seasonToLoad));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSeason(CURRENT_SEASON);
  }, []);

  useEffect(() => {
    if (!season) return;
    loadDoc(season);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  async function deleteDocAndReset() {
    const ok = typeof window !== "undefined" && window.confirm("Delete this season's Dynasty wagers doc and start over? This cannot be undone.");
    if (!ok) return;

    setSaving(true);
    setErrorMsg("");
    setInfoMsg("");
    try {
      const res = await fetch(`/api/admin/dynasty-wagers?season=${encodeURIComponent(season)}`, {
        method: "DELETE",
      });
      const out = await res.json().catch(() => null);
      if (!res.ok || out?.ok === false) {
        throw new Error(out?.error || `Delete failed (${res.status})`);
      }

      setDoc(buildEmptyState(season));
      setStep("finalists");
      setInfoMsg("Deleted. Starting fresh.");
    } catch (e) {
      setErrorMsg(e?.message || "Failed to delete Dynasty wagers.");
    } finally {
      setSaving(false);
    }
  }

  async function save(nextDoc, { setStepAfter } = {}) {
    setSaving(true);
    setErrorMsg("");
    setInfoMsg("");
    try {
      const payload = {
        ...nextDoc,
        updatedAt: nowIso(),
      };
      const res = await fetch(`/api/admin/dynasty-wagers?season=${encodeURIComponent(season)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saved = await res.json().catch(() => null);
      if (!res.ok || saved?.ok === false) {
        throw new Error(saved?.error || `Save failed (${res.status})`);
      }
      const normalized = normalizeLoadedDoc(saved, season);
      setDoc(normalized);
      setInfoMsg("Saved.");
      if (setStepAfter) {
        setStep(setStepAfter);
        scrollTopSmooth();
      }
    } catch (e) {
      setErrorMsg(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function loadOwners() {
    setSaving(true);
    setErrorMsg("");
    setInfoMsg("");
    try {
      const lbUrl = LEADERBOARD_URL_BY_SEASON(season);
      const lbRes = await fetch(lbUrl, { cache: "no-store" });
      if (!lbRes.ok) throw new Error(`Failed to fetch leaderboards (${lbRes.status})`);
      const leaderboardsJson = await lbRes.json();

      const ownersMap = buildOwnersByDivisionLeague(leaderboardsJson, season);
      setOwnersByDivisionLeague(ownersMap);

      // If we have no eligibility yet, seed the league list now (finalists blank).
      setDoc((prev) => {
        const existing = prev?.eligibility?.byDivision || {};
        if (Object.keys(existing).length) return prev;

        const byDivision = {};
        for (const div of Object.keys(ownersMap)) {
          // KEEP unsorted here; UI sorting is handled by leagueOrderIndex in `divisions` memo
          byDivision[div] = Object.keys(ownersMap[div]).map((leagueName) => ({ leagueName, finalists: ["", ""] }));
        }

        return {
          ...prev,
          source: { ...prev.source, leaderboardUrl: lbUrl, lastFetchedAt: nowIso() },
          eligibility: { ...prev.eligibility, week: 16, computedAt: "", byDivision },
        };
      });

      setInfoMsg("Loaded leagues & owners from leaderboards.");
    } catch (e) {
      setErrorMsg(e?.message || "Failed to load owners.");
    } finally {
      setSaving(false);
    }
  }

  function setFinalist(division, leagueName, idx, ownerName) {
    setDoc((prev) => {
      const byDivision = { ...(prev?.eligibility?.byDivision || {}) };
      const leagues = safeArray(byDivision[division]).map((l) => ({ ...l }));
      const i = leagues.findIndex((l) => safeStr(l?.leagueName).trim() === leagueName);
      if (i === -1) return prev;

      const cur = safeArray(leagues[i].finalists);
      const nextFinals = [safeStr(cur[0] || "").trim(), safeStr(cur[1] || "").trim()];
      nextFinals[idx] = safeStr(ownerName || "").trim();

      // Prevent duplicates within the league.
      if (nextFinals[0] && nextFinals[0] === nextFinals[1]) {
        nextFinals[1 - idx] = "";
      }

      leagues[i].finalists = nextFinals;
      byDivision[division] = leagues;

      return {
        ...prev,
        eligibility: { ...prev.eligibility, week: 16, byDivision },
      };
    });
  }

  async function saveFinalistsAndNext() {
    const byDivision = doc?.eligibility?.byDivision || {};
    for (const div of Object.keys(byDivision)) {
      for (const l of safeArray(byDivision[div])) {
        const finals = safeArray(l?.finalists).map((x) => safeStr(x).trim()).filter(Boolean);
        if (finals.length !== 2 || finals[0] === finals[1]) {
          setErrorMsg(`Missing finalists for ${div} · ${safeStr(l?.leagueName)}`);
          return;
        }
      }
    }

    const next = {
      ...doc,
      eligibility: {
        ...doc.eligibility,
        week: 16,
        computedAt: nowIso(),
      },
    };
    await save(next, { setStepAfter: "decisions" });
  }

  function updateDecision(k, decision) {
    setDoc((prev) => {
      const next = {
        ...prev,
        week17: {
          ...prev.week17,
          decisions: {
            ...(prev.week17?.decisions || {}),
            [k]: { decision },
          },
        },
      };
      return computeResults(next);
    });
  }
  async function resolveWeek17AndNext() {
    setSaving(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      const lbUrl = LEADERBOARD_URL_BY_SEASON(season);
      const lbRes = await fetch(lbUrl, { cache: "no-store" });
      if (!lbRes.ok) throw new Error(`Failed to fetch leaderboards (${lbRes.status})`);
      const leaderboardsJson = await lbRes.json();

      const pointsMap = getWeekPointsMapFromLeaderboard(leaderboardsJson, season, 17);

      const decisions = { ...(doc?.week17?.decisions || {}) };
      const points = { ...(doc?.week17?.points || {}) };

      for (const div of Object.keys(doc?.eligibility?.byDivision || {})) {
        for (const league of safeArray(doc?.eligibility?.byDivision?.[div])) {
          const leagueName = safeStr(league?.leagueName).trim();
          for (const ownerName of safeArray(league?.finalists)) {
            const on = safeStr(ownerName).trim();
            if (!on) continue;

            const k = entryKey({ division: div, leagueName, ownerName: on });

            // ensure a default decision exists
            if (!decisions[k]) decisions[k] = { decision: "bank" };

            // pull week 17 points
            points[k] = Number(pointsMap?.[k] ?? 0) || 0;
          }
        }
      }

      const next = computeResults({
        ...doc,
        source: { ...doc.source, leaderboardUrl: lbUrl, lastFetchedAt: nowIso() },
        week17: { ...doc.week17, week: 17, decisions, points, resolvedAt: nowIso() },
      });

      await save(next, { setStepAfter: "resolve18" });
      setInfoMsg("Resolved Week 17 points.");
    } catch (e) {
      setErrorMsg(e?.message || "Resolve Week 17 failed.");
    } finally {
      setSaving(false);
    }
  }

  async function resolveWeek18AndNext() {
    setSaving(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      const lbUrl = LEADERBOARD_URL_BY_SEASON(season);
      const lbRes = await fetch(lbUrl, { cache: "no-store" });
      if (!lbRes.ok) throw new Error(`Failed to fetch leaderboards (${lbRes.status})`);
      const leaderboardsJson = await lbRes.json();

      const pointsMap = getWeekPointsMapFromLeaderboard(leaderboardsJson, season, 18);

      const champions = doc?.week18?.showdown?.champions || {};
      const points = { ...(doc?.week18?.points || {}) };

      for (const div of Object.keys(champions)) {
        const k = safeStr(champions?.[div]?.key).trim();
        if (!k) continue;
        points[k] = Number(pointsMap?.[k] ?? 0) || 0;
      }

      const next = computeResults({
        ...doc,
        week18: { ...doc.week18, week: 18, points, resolvedAt: nowIso() },
      });

      await save(next, { setStepAfter: "results" });
      setInfoMsg("Resolved Week 18 showdown.");
    } catch (e) {
      setErrorMsg(e?.message || "Resolve Week 18 failed.");
    } finally {
      setSaving(false);
    }
  }



  async function saveDecisionsAndNext() {
    await save(doc, { setStepAfter: "resolve17" });
  }

  const results = doc?.week17?.results || {};

  // ✅ FIX: step completion logic now uses eligibility.byDivision.finalists (not nonexistent finalistsByLeague)
  const steps = useMemo(() => {
    const byDivision = doc?.eligibility?.byDivision || {};
    const hasLeagues = Object.keys(byDivision).length > 0;

    let finalistsDone = hasLeagues && Boolean(doc?.eligibility?.computedAt);
    if (finalistsDone) {
      for (const div of Object.keys(byDivision)) {
        for (const l of safeArray(byDivision[div])) {
          const f = safeArray(l?.finalists).map((x) => safeStr(x).trim()).filter(Boolean);
          if (f.length !== 2 || f[0] === f[1]) {
            finalistsDone = false;
            break;
          }
        }
        if (!finalistsDone) break;
      }
    }

    let decisionsDone = finalistsDone;
    if (decisionsDone) {
      const d = doc?.week17?.decisions || {};
      for (const div of Object.keys(byDivision)) {
        for (const l of safeArray(byDivision[div])) {
          const leagueName = safeStr(l?.leagueName).trim();
          const f = safeArray(l?.finalists).map((x) => safeStr(x).trim()).filter(Boolean);
          for (const ownerName of f) {
            const k = entryKey({ division: div, leagueName, ownerName });
            const dec = safeStr(d?.[k]?.decision || "").trim();
            if (dec !== "bank" && dec !== "wager") {
              decisionsDone = false;
              break;
            }
          }
          if (!decisionsDone) break;
        }
        if (!decisionsDone) break;
      }
    }

    const week17Resolved = Boolean(doc?.week17?.resolvedAt);
    const week18Resolved = Boolean(doc?.week18?.resolvedAt);

    return [
      { key: "finalists", label: "1) Finalists", done: finalistsDone },
      { key: "decisions", label: "2) Decisions", done: decisionsDone },
      { key: "resolve17", label: "3) Week 17 Results", done: week17Resolved },
      { key: "resolve18", label: "4) Week 18 Showdown", done: week18Resolved },
    ];
  }, [doc]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SmallBadge>SEASON</SmallBadge>
              <input
                value={season}
                onChange={(e) => setSeason(Number(e.target.value) || season)}
                className="input max-w-[120px]"
                inputMode="numeric"
              />
              <SmallBadge>WEEK 17</SmallBadge>
            </div>
            <p className="mt-3 text-sm text-muted">
              Steps: pick the 2 finalists per league → set Bank/Wager → resolve Week 17 → resolve Week 18 showdown.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={loadOwners} disabled={loading || saving}>
              Load Leagues & Owners
            </PrimaryButton>
            <PrimaryButton tone="accent2" onClick={() => save(doc)} disabled={loading || saving}>
              Save
            </PrimaryButton>
            <PrimaryButton tone="danger" onClick={deleteDocAndReset} disabled={loading || saving}>
              Delete & Start Over
            </PrimaryButton>
            <Link href="/admin/wager-trackers" className="btn btn-secondary">
              ← Wager Trackers
            </Link>
          </div>
        </div>

        {(errorMsg || infoMsg) && (
          <div className="mt-4 space-y-2">
            {errorMsg && <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{errorMsg}</div>}
            {infoMsg && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{infoMsg}</div>}
          </div>
        )}
      </Card>

      <AdminStepTabs steps={steps} activeKey={step} onChange={setStep} />

      {step === "finalists" && (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Week 16 · Select Finalists</h2>
              <p className="mt-2 text-sm text-muted">
                Choose the <b>top 2 teams per league</b> (based on record). Owners are pulled from the Dynasty leaderboards JSON for this season.
              </p>
            </div>
            <div className="flex gap-2">
              <PrimaryButton tone="muted" onClick={loadOwners} disabled={saving}>
                Load Owners
              </PrimaryButton>
              <PrimaryButton tone="accent2" onClick={saveFinalistsAndNext} disabled={saving}>
                Save Finalists & Next
              </PrimaryButton>
            </div>
          </div>

          <Divider />

          {!ownersByDivisionLeague ? (
            <div className="text-sm text-muted">
              Click <b>Load Owners</b> to populate the dropdowns.
            </div>
          ) : (
            <div className="space-y-4">
              {divisions.map((d) => (
                <div key={d.division} className="rounded-2xl border border-subtle bg-panel/30 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-muted">Division</div>
                  <div className="mt-1 text-lg font-semibold text-white">{d.division}</div>

                  <div className="mt-4 space-y-3">
                    {d.leagues.map((l) => {
                      const opts = ownersByDivisionLeague?.[d.division]?.[l.leagueName] || [];
                      const current =
                        safeArray(doc?.eligibility?.byDivision?.[d.division]).find((x) => safeStr(x?.leagueName).trim() === l.leagueName)
                          ?.finalists || ["", ""];

                      return (
                        <div key={`${d.division}|||${l.leagueName}`} className="rounded-2xl border border-subtle bg-card-surface p-4">
                          <div className="text-white font-semibold">{l.leagueName}</div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[0, 1].map((idx) => (
                              <label key={idx} className="flex flex-col gap-1">
                                <span className="text-xs uppercase tracking-[0.22em] text-muted">Finalist {idx + 1}</span>
                                <select
                                  className="input"
                                  value={safeStr(current[idx] || "")}
                                  onChange={(e) => setFinalist(d.division, l.leagueName, idx, e.target.value)}
                                >
                                  <option value="">Select owner...</option>
                                  {opts.map((name) => (
                                    <option key={name} value={name}>
                                      {name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <PrimaryButton tone="accent2" onClick={saveFinalistsAndNext} disabled={saving}>
                      Save Finalists & Next
                    </PrimaryButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {step === "decisions" && (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Finalists · Decisions</h2>
              <p className="mt-1 text-sm text-muted">
                Each finalist gets a {fmtMoney(doc?.week17?.credit ?? 50)} credit. Choose <b>Bank</b> or <b>Wager</b>.
              </p>
            </div>
            <div className="flex gap-2">
              <PrimaryButton tone="accent2" onClick={saveDecisionsAndNext} disabled={saving}>
                Save & Next
              </PrimaryButton>
            </div>
          </div>

          <Divider />

          <div className="space-y-6">
            {divisionsSorted.map((div) => {
              const rows = flatRowsByDivision?.[div] || [];
              if (!rows.length) return null;

              return (
                <div key={div} className="rounded-2xl border border-subtle bg-panel/40 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">{div}</h3>
                    <SmallBadge>{rows.length} finalists</SmallBadge>
                  </div>

                  <div className="mt-3 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted">
                          <th className="py-2 pr-4">League</th>
                          <th className="py-2 pr-4">Finalist</th>
                          <th className="py-2 pr-4">Week 17</th>
                          <th className="py-2 pr-4">Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.k} className="border-t border-subtle">
                            <td className="py-2 pr-4 whitespace-nowrap">{r.leagueName}</td>
                            <td className="py-2 pr-4 whitespace-nowrap font-medium text-white">{r.ownerName}</td>
                            <td className="py-2 pr-4 whitespace-nowrap">{Number(r.pts ?? 0).toFixed(2)}</td>
                            <td className="py-2 pr-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateDecision(r.k, "bank")}
                                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                                    r.decision === "bank"
                                      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-100"
                                      : "bg-panel border-subtle text-foreground hover:border-emerald-400/30"
                                  }`}
                                >
                                  Bank
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateDecision(r.k, "wager")}
                                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                                    r.decision === "wager"
                                      ? "bg-amber-500/15 border-amber-400/40 text-amber-100"
                                      : "bg-panel border-subtle text-foreground hover:border-amber-400/30"
                                  }`}
                                >
                                  Wager
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <PrimaryButton tone="accent2" onClick={saveDecisionsAndNext} disabled={saving}>
                      Save & Next
                    </PrimaryButton>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

            {step === "resolve17" && (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Resolve Week 17</h2>
              <p className="mt-2 text-sm text-muted">
                Pull Week 17 points for all selected finalists and compute division payouts.
              </p>
              <p className="mt-1 text-sm text-muted">
                Winners stay visible. Expand a division to verify each league’s Week 17 scores.
              </p>
            </div>
            <div className="flex gap-2">
              <PrimaryButton onClick={resolveWeek17AndNext} disabled={saving}>
                Resolve Week 17 & Next
              </PrimaryButton>
            </div>
          </div>

          <Divider />

          {Object.keys(results?.divisions || {}).length === 0 ? (
            <div className="text-sm text-muted">No Week 17 results yet.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(results.divisions)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([div, r]) => {
                  const divId = `div-${slugify(season)}-${slugify(div)}`;

                  const champ = r?.champ || {};
                  const second = r?.second || {};
                  const third = r?.third || {};
                  const wagerPot = r?.wagerPot || {};

                  const champKey = safeStr(champ?.winnerKey || "").trim();
                  const secondKey = safeStr(second?.winnerKey || "").trim();
                  const thirdKey = safeStr(third?.winnerKey || "").trim();
                  const wagerKey = safeStr(wagerPot?.winnerKey || "").trim();

                  function tagsForKey(k) {
                    const tags = [];
                    if (k && k === champKey) tags.push({ icon: "🏆", label: "Champ" });
                    if (k && k === secondKey) tags.push({ icon: "🥈", label: "2nd" });
                    if (k && k === thirdKey) tags.push({ icon: "🥉", label: "3rd" });
                    if (k && k === wagerKey) tags.push({ icon: "🎯", label: "Wager Winner" });
                    return tags;
                  }

                  const leagues = safeArray(doc?.eligibility?.byDivision?.[div]).filter(
                    (l) => safeStr(l?.leagueName).trim() && safeArray(l?.finalists).length
                  );

                  const allEntries = leagues.flatMap((l) => {
                    const leagueName = safeStr(l?.leagueName).trim();
                    const finals = safeArray(l?.finalists).map((x) => safeStr(x).trim()).filter(Boolean);
                    return finals.map((ownerName) => {
                      const k = entryKey({ division: div, leagueName, ownerName });
                      const decision = safeStr(doc?.week17?.decisions?.[k]?.decision || "bank").trim() || "bank";
                      const pts = Number(doc?.week17?.points?.[k] ?? 0) || 0;
                      return { division: div, leagueName, ownerName, k, decision, pts };
                    });
                  });

                  const totalFinalists = allEntries.length;
                  const totalWager = allEntries.filter((x) => x.decision === "wager").length;
                  const totalBank = totalFinalists - totalWager;

                  return (
                    <div key={div} className="rounded-2xl border border-subtle bg-panel/30 p-4">
                      {/* Division header */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-[0.25em] text-muted">Division</div>
                          <div className="mt-1 text-lg font-semibold text-white truncate">{div}</div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="rounded-full border border-subtle bg-panel/40 px-2 py-0.5">
                              🏟️ {leagues.length} leagues
                            </span>
                            <span className="rounded-full border border-subtle bg-panel/40 px-2 py-0.5">
                              👥 {totalFinalists} finalists
                            </span>
                            <span className="rounded-full border border-subtle bg-panel/40 px-2 py-0.5">
                              🎯 {totalWager} wager
                            </span>
                            <span className="rounded-full border border-subtle bg-panel/40 px-2 py-0.5">
                              🏦 {totalBank} bank
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Winner cards OUTSIDE collapse */}
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className="rounded-2xl border border-subtle bg-panel/40 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">🏆 Champ</span>
                            <span className="text-white font-semibold truncate">{champ?.winner || "—"}</span>
                          </div>
                          {champ?.leagueName ? (
                            <div className="mt-1 flex items-center justify-between text-xs text-muted">
                              <span className="truncate">{champ.leagueName}</span>
                              <span className="text-white font-medium">{Number(champ?.pts ?? 0).toFixed(2)}</span>
                            </div>
                          ) : null}
                          <div className="mt-1 text-xs text-muted">+{fmtMoney(champ?.bonus ?? 0)}</div>
                        </div>

                        <div className="rounded-2xl border border-subtle bg-panel/40 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">🎯 Wager Winner</span>
                            <span className="text-white font-semibold truncate">{wagerPot?.winner || "—"}</span>
                          </div>
                          {wagerPot?.winnerLeague ? (
                            <div className="mt-1 flex items-center justify-between text-xs text-muted">
                              <span className="truncate">{wagerPot.winnerLeague}</span>
                              <span className="text-white font-medium">{Number(wagerPot?.winnerPts ?? 0).toFixed(2)}</span>
                            </div>
                          ) : null}
                          <div className="mt-1 text-xs text-muted">{fmtMoney(wagerPot?.total ?? 0)}</div>
                        </div>

                        <div className="rounded-2xl border border-subtle bg-panel/40 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">🥈 2nd</span>
                            <span className="text-white font-semibold truncate">{second?.winner || "—"}</span>
                          </div>
                          {second?.leagueName ? (
                            <div className="mt-1 flex items-center justify-between text-xs text-muted">
                              <span className="truncate">{second.leagueName}</span>
                              <span className="text-white font-medium">{Number(second?.pts ?? 0).toFixed(2)}</span>
                            </div>
                          ) : null}
                          <div className="mt-1 text-xs text-muted">+{fmtMoney(second?.bonus ?? 0)}</div>
                        </div>

                        <div className="rounded-2xl border border-subtle bg-panel/40 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">🥉 3rd</span>
                            <span className="text-white font-semibold truncate">{third?.winner || "—"}</span>
                          </div>
                          {third?.leagueName ? (
                            <div className="mt-1 flex items-center justify-between text-xs text-muted">
                              <span className="truncate">{third.leagueName}</span>
                              <span className="text-white font-medium">{Number(third?.pts ?? 0).toFixed(2)}</span>
                            </div>
                          ) : null}
                          <div className="mt-1 text-xs text-muted">+{fmtMoney(third?.bonus ?? 0)}</div>
                        </div>
                      </div>

                      {/* Collapsible leagues (verification) */}
                      <details
                        open={!!openDivisions[divId]}
                        onToggle={(e) => {
                          const isOpen = e.currentTarget?.open === true;
                          setOpenDivisions((prev) => ({ ...prev, [divId]: isOpen }));
                        }}
                        className="group mt-3 rounded-2xl border border-subtle bg-card-surface"
                      >
                        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs uppercase tracking-[0.22em] text-muted">Leagues</div>
                              <div className="mt-1 text-sm text-muted">Tap to expand / collapse this division’s leagues</div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-subtle bg-panel/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                Click to see leagues
                              </span>
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5 text-muted transition-transform duration-200 group-open:rotate-180"
                                aria-hidden="true"
                              >
                                <path
                                  fill="currentColor"
                                  d="M12 15.5a1 1 0 0 1-.7-.29l-6-6a1 1 0 1 1 1.4-1.42L12 13.09l5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-.7.29Z"
                                />
                              </svg>
                            </div>
                          </div>
                        </summary>

                        <div className="px-4 pb-4 space-y-3">
                          {leagues
                            .slice()
                            .sort((a, b) => {
                              const ao = getLeagueOrder(leagueOrderIndex, div, safeStr(a?.leagueName).trim());
                              const bo = getLeagueOrder(leagueOrderIndex, div, safeStr(b?.leagueName).trim());
                              if (ao !== bo) return ao - bo;
                              return safeStr(a?.leagueName).localeCompare(safeStr(b?.leagueName));
                            })
                            .map((l) => {
                              const leagueName = safeStr(l?.leagueName).trim();
                              const finals = safeArray(l?.finalists).map((x) => safeStr(x).trim()).filter(Boolean);
                              const anchorId = leagueAnchorId(season, div, leagueName);

                              const entries = finals
                                .map((ownerName) => {
                                  const k = entryKey({ division: div, leagueName, ownerName });
                                  const decision = safeStr(doc?.week17?.decisions?.[k]?.decision || "bank").trim() || "bank";
                                  const pts = Number(doc?.week17?.points?.[k] ?? 0) || 0;
                                  return { ownerName, k, decision, pts };
                                })
                                .sort((a, b) => b.pts - a.pts);

                              return (
                                <div
                                  key={`${div}|||${leagueName}`}
                                  id={anchorId}
                                  className="rounded-2xl border border-subtle bg-panel/30 p-4"
                                >
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-white font-semibold">{leagueName}</div>
                                    <div className="flex items-center gap-2">
                                      <div className="text-[11px] text-muted">Finalists · Week 17 points</div>
                                      <button
                                        type="button"
                                        onClick={() => jumpToLeague(div, leagueName)}
                                        className="rounded-full border border-subtle bg-panel/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-panel/60"
                                        title="Jump to this league"
                                      >
                                        Jump
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {entries.map((e) => {
                                      const tags = tagsForKey(e.k);

                                      return (
                                        <div key={e.k} className="rounded-2xl border border-subtle bg-card-surface p-3">
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="flex items-start gap-2">
                                                <div className="text-white font-semibold truncate">{e.ownerName}</div>
                                                {tags.length ? (
                                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                                    {tags.map((t) => (
                                                      <span
                                                        key={t.label}
                                                        title={t.label}
                                                        className="inline-flex items-center rounded-full border border-subtle bg-panel/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white"
                                                      >
                                                        {t.icon}
                                                      </span>
                                                    ))}
                                                  </div>
                                                ) : null}
                                              </div>
                                            </div>

                                            <div className="shrink-0 text-right">
                                              <div className="text-white font-semibold">{Number(e.pts ?? 0).toFixed(2)}</div>
                                              <div className="mt-1">
                                                <DecisionPill decision={e.decision} />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </details>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      )}

      {step === "resolve18" && (
  <Card>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-white">Resolve Week 18 Showdown</h2>
        <p className="mt-2 text-sm text-muted">
          Week 18 is head-to-head between the <b>division champs</b> (highest Week 17 scorer in each division).
        </p>
      </div>
      <div className="flex gap-2">
        <PrimaryButton onClick={resolveWeek18AndNext} disabled={saving}>
          Resolve Week 18 & Next
        </PrimaryButton>
      </div>
    </div>

    <Divider />

    <div className="grid gap-3 sm:grid-cols-2">
      {Object.keys(doc?.week18?.showdown?.champions || {}).length === 0 ? (
        <div className="text-sm text-muted">Resolve Week 17 first to determine division champs.</div>
      ) : (
        Object.entries(doc.week18.showdown.champions)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([div, c]) => (
            <div key={div} className="rounded-2xl border border-subtle bg-panel/40 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-muted">Champion · {div}</div>
              <div className="mt-1 text-white font-semibold">{c.ownerName}</div>
              <div className="mt-1 text-sm text-muted">Week 17: {Number(c.wk17 ?? 0).toFixed(2)}</div>
              <div className="mt-1 text-sm text-muted">Week 18: {Number(doc?.week18?.points?.[c.key] ?? 0).toFixed(2)}</div>
            </div>
          ))
      )}
    </div>

    {doc?.week18?.resolvedAt ? (
      <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
        <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Showdown Result</div>
        <div className="mt-1 text-white font-semibold">{doc?.week18?.showdown?.result?.winner || "—"}</div>
        <div className="mt-1 text-sm text-muted">
          {doc?.week18?.showdown?.result?.tie
            ? "Tie"
            : `${Number(doc?.week18?.showdown?.result?.winnerPts ?? 0).toFixed(2)} vs ${Number(
                doc?.week18?.showdown?.result?.loserPts ?? 0
              ).toFixed(2)}`}
        </div>
      </div>
    ) : null}
  </Card>
)}

    </div>
  );
}