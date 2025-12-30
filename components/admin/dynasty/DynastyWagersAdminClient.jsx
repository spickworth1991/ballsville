"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
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
        wagerBonus: { bonus: 200, winner: "", winnerKey: "", winnerDivision: "", winnerLeague: "", winnerPts: 0 },
        overall: {
          first: { bonus: 250, winner: "", winnerKey: "", division: "", leagueName: "", pts: 0 },
          second: { bonus: 100, winner: "", winnerKey: "", division: "", leagueName: "", pts: 0 },
          third: { bonus: 50, winner: "", winnerKey: "", division: "", leagueName: "", pts: 0 },
        },
        leagueWinners: {
          // `${division}|||${leagueName}` -> { winner, winnerKey, pts, bonus, opponent, opponentPts, tie }
        },
        // banked finalists who would have won the wager bonus if they wagered
        wagerMisses: [],
      },
    },

    week18: {
      week: 18,
      resolvedAt: "",
      // { [entryKey]: number }
      points: {},
      showdown: {
        // Derived from Week 17: highest scorer among finalists in each division.
        champions: {
          // [division]: { ownerName, key, leagueName, wk17 }
        },
        // Week 18 head-to-head result across division champs.
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

  // Normalize to arrays
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
    const div = safeStr(r?.theme_name).trim();
    const leagueName = safeStr(r?.name).trim();
    if (!div || !leagueName) continue;
    const n = Number(r?.display_order);
    const orderNum = Number.isFinite(n) ? n : 999999;
    map.set(`${div}|||${leagueName}`.toLowerCase(), orderNum);
  }

  return map;
}

function sortByLeagueOrder(entries, orderIndex) {
  return [...entries].sort((a, b) => {
    const ak = `${a.division}|||${a.leagueName}`.toLowerCase();
    const bk = `${b.division}|||${b.leagueName}`.toLowerCase();
    const ao = orderIndex.get(ak) ?? 999999;
    const bo = orderIndex.get(bk) ?? 999999;
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
  const leagueWinBonus = Number(wk?.leagueWinBonus ?? 125) || 125;
  const empireBonus = Number(wk?.empireBonus ?? 225) || 225;

  const decisions = wk?.decisions || {};
  const points = wk?.points || {};
  const empireTriggered = wk?.empireTriggered || {};

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

  // Overall ranking (all finalists)
  const ranked = [...rows].sort((a, b) => b.pts - a.pts);

  const overall = {
    first: ranked[0]
      ? { bonus: champ1, winner: ranked[0].ownerName, winnerKey: ranked[0].k, division: ranked[0].division, leagueName: ranked[0].leagueName, pts: ranked[0].pts }
      : { bonus: champ1, winner: "", winnerKey: "", division: "", leagueName: "", pts: 0 },
    second: ranked[1]
      ? { bonus: champ2, winner: ranked[1].ownerName, winnerKey: ranked[1].k, division: ranked[1].division, leagueName: ranked[1].leagueName, pts: ranked[1].pts }
      : { bonus: champ2, winner: "", winnerKey: "", division: "", leagueName: "", pts: 0 },
    third: ranked[2]
      ? { bonus: champ3, winner: ranked[2].ownerName, winnerKey: ranked[2].k, division: ranked[2].division, leagueName: ranked[2].leagueName, pts: ranked[2].pts }
      : { bonus: champ3, winner: "", winnerKey: "", division: "", leagueName: "", pts: 0 },
  };

  // Wager bonus winner (among those who wager)
  const wagered = rows.filter((r) => r.decision === "wager");
  const wageredRank = [...wagered].sort((a, b) => b.pts - a.pts);
  const wagerWinner = wageredRank[0] || null;

  const wagerBonusResult = wagerWinner
    ? { bonus: wagerBonus, winner: wagerWinner.ownerName, winnerKey: wagerWinner.k, winnerDivision: wagerWinner.division, winnerLeague: wagerWinner.leagueName, winnerPts: wagerWinner.pts }
    : { bonus: wagerBonus, winner: "", winnerKey: "", winnerDivision: "", winnerLeague: "", winnerPts: 0 };

  // League winners (+$125) per league (finalists head-to-head)
  const leagueWinners = {};
  const byLeague = new Map();
  for (const r of rows) {
    const lk = `${r.division}|||${r.leagueName}`;
    if (!byLeague.has(lk)) byLeague.set(lk, []);
    byLeague.get(lk).push(r);
  }

  for (const [lk, arr] of byLeague.entries()) {
    const a = arr[0];
    const b = arr[1];
    if (!a || !b) continue;
    if (a.pts === b.pts) {
      leagueWinners[lk] = {
        bonus: leagueWinBonus,
        tie: true,
        winner: "TIE",
        winnerKey: "",
        pts: a.pts,
        opponent: "TIE",
        opponentPts: b.pts,
        empireBonus: empireTriggered?.[lk] ? empireBonus : 0,
      };
      continue;
    }
    const win = a.pts > b.pts ? a : b;
    const lose = a.pts > b.pts ? b : a;
    leagueWinners[lk] = {
      bonus: leagueWinBonus,
      tie: false,
      winner: win.ownerName,
      winnerKey: win.k,
      pts: win.pts,
      opponent: lose.ownerName,
      opponentPts: lose.pts,
      empireBonus: empireTriggered?.[lk] ? empireBonus : 0,
    };
  }

  // Who should have wagered? (bankers who outscored the top wagered score)
  const topWagerPts = wagerWinner ? wagerWinner.pts : null;
  const wagerMisses = [];
  if (topWagerPts != null) {
    for (const r of rows) {
      if (r.decision !== "bank") continue;
      if (r.pts >= topWagerPts) {
        wagerMisses.push({
          ownerName: r.ownerName,
          division: r.division,
          leagueName: r.leagueName,
          wk17: r.pts,
          key: r.k,
        });
      }
    }
  }
  wagerMisses.sort((a, b) => b.wk17 - a.wk17);

  // Week 18: derive division champs from Week 17 (highest scorer among finalists in each division)
  const nextWeek18 = (() => {
    const prev18 = doc?.week18 || {};
    const points18 = prev18?.points || {};

    const champions = {};
    for (const div of Object.keys(byDivision)) {
      const divRows = rows.filter((r) => r.division === div);
      const best = divRows.sort((a, b) => b.pts - a.pts)[0];
      if (!best) continue;
      champions[div] = {
        ownerName: best.ownerName,
        key: best.k,
        leagueName: best.leagueName,
        wk17: best.pts,
      };
    }

    // Resolve Week 18 winner between the first two divisions (sorted) if possible.
    const divs = Object.keys(champions).sort((a, b) => a.localeCompare(b));
    const aDiv = divs[0] || "";
    const bDiv = divs[1] || "";
    const aChamp = aDiv ? champions[aDiv] : null;
    const bChamp = bDiv ? champions[bDiv] : null;

    const aPts = aChamp ? Number(points18?.[aChamp.key] ?? 0) || 0 : 0;
    const bPts = bChamp ? Number(points18?.[bChamp.key] ?? 0) || 0 : 0;
    const tie = !!aChamp && !!bChamp && aPts === bPts;

    const result = (() => {
      if (!aChamp || !bChamp) {
        return { ...buildEmptyState(doc?.season || new Date().getFullYear()).week18.showdown.result };
      }
      if (tie) {
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
        wagerBonus: wagerBonusResult,
        overall,
        leagueWinners,
        wagerMisses,
      },
    },
    week18: nextWeek18,
  };
}

export default function DynastyWagersAdminClient() {
  const [season, setSeason] = useState(() => new Date().getFullYear());
  const [doc, setDoc] = useState(() => buildEmptyState(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [step, setStep] = useState("finalists");

  const [leagueOrderIndex, setLeagueOrderIndex] = useState(() => new Map());
  // { [division]: { [leagueName]: string[] } }
  const [ownersByDivisionLeague, setOwnersByDivisionLeague] = useState(null);

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
    loadDoc(new Date().getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (setStepAfter) setStep(setStepAfter);
    } catch (e) {
      setErrorMsg(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function importFinalistsFromR2Manual(seasonToLoad) {
    const bust = `v=${Date.now()}`;
    const res = await fetch(`/r2/data/dynasty/wagering_${encodeURIComponent(seasonToLoad)}.json?${bust}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const rows = safeArray(data?.rows || data);
    return rows
      .map((r) => ({
        division: safeStr(r?.group_name).trim(),
        leagueName: safeStr(r?.league_name).trim(),
        finalist1: safeStr(r?.finalist1_name).trim(),
        finalist2: safeStr(r?.finalist2_name).trim(),
      }))
      .filter((r) => r.division && r.leagueName && r.finalist1 && r.finalist2);
  }

  function inferFinalistsFromLeaderboard(leaderboardsJson, seasonToLoad) {
    const root = getDynastyRoot(leaderboardsJson, seasonToLoad);
    const owners = safeArray(root?.owners);

    // group by division+league, take top 2 by Week17 points
    const byDivLeague = new Map();
    for (const o of owners) {
      const division = safeStr(o?.division).trim();
      const leagueName = safeStr(o?.leagueName).trim();
      const ownerName = safeStr(o?.ownerName).trim();
      if (!division || !leagueName || !ownerName) continue;
      const v = o?.weekly?.["17"] ?? o?.weekly?.[17];
      const n = typeof v === "number" ? v : parseFloat(v);
      const pts = Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
      const k = `${division}|||${leagueName}`;
      if (!byDivLeague.has(k)) byDivLeague.set(k, []);
      byDivLeague.get(k).push({ ownerName, pts });
    }

    const rows = [];
    for (const [k, arr] of byDivLeague.entries()) {
      const [division, leagueName] = k.split("|||");
      const top2 = [...arr].sort((a, b) => b.pts - a.pts).slice(0, 2);
      if (top2.length < 2) continue;
      rows.push({ division, leagueName, finalist1: top2[0].ownerName, finalist2: top2[1].ownerName });
    }
    return rows;
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
    // Basic validation: each league has 2 unique finalists.
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
            if (!decisions[k]) decisions[k] = { decision: "bank" };
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

  function toggleEmpire(leagueKey) {
    setDoc((prev) => {
      const current = !!prev?.week17?.empireTriggered?.[leagueKey];
      const next = {
        ...prev,
        week17: {
          ...prev.week17,
          empireTriggered: {
            ...(prev.week17?.empireTriggered || {}),
            [leagueKey]: !current,
          },
        },
      };
      return computeResults(next);
    });
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
          const ak = `${a.division}|||${a.leagueName}`.toLowerCase();
          const bk = `${b.division}|||${b.leagueName}`.toLowerCase();
          const ao = leagueOrderIndex.get(ak) ?? 999999;
          const bo = leagueOrderIndex.get(bk) ?? 999999;
          if (ao !== bo) return ao - bo;
          return a.leagueName.localeCompare(b.leagueName);
        }),
      });
    }
    return out.sort((a, b) => a.division.localeCompare(b.division));
  }, [doc, leagueOrderIndex]);

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

  const results = doc?.week17?.results || {};

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
              Steps: pick the 2 finalists per league (pulled from leaderboards) → set Bank/Wager → resolve Week 17 → resolve Week 18 showdown.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton tone="muted" onClick={() => loadDoc(season)} disabled={loading || saving}>
              Reload
            </PrimaryButton>
            <PrimaryButton onClick={loadOwners} disabled={loading || saving}>
              Load Leagues & Owners
            </PrimaryButton>
            <PrimaryButton tone="accent2" onClick={() => save(doc)} disabled={loading || saving}>
              Save
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

      <div className="flex flex-wrap gap-2">
        <PrimaryButton tone={step === "finalists" ? "accent" : "muted"} onClick={() => setStep("finalists")}>
          1) Finalists
        </PrimaryButton>
        <PrimaryButton tone={step === "decisions" ? "accent" : "muted"} onClick={() => setStep("decisions")}>
          2) Decisions
        </PrimaryButton>
        <PrimaryButton tone={step === "resolve17" ? "accent" : "muted"} onClick={() => setStep("resolve17")}>
          3) Resolve Wk17
        </PrimaryButton>
        <PrimaryButton tone={step === "resolve18" ? "accent" : "muted"} onClick={() => setStep("resolve18")}>
          4) Resolve Wk18
        </PrimaryButton>
        <PrimaryButton tone={step === "results" ? "accent" : "muted"} onClick={() => setStep("results")}>
          5) Results
        </PrimaryButton>
      </div>

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
                      const current = safeArray(doc?.eligibility?.byDivision?.[d.division])
                        .find((x) => safeStr(x?.leagueName).trim() === l.leagueName)?.finalists || ["", ""];

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
              <PrimaryButton tone="accent2" onClick={() => save(doc, { setStepAfter: "resolve17" })} disabled={saving}>
                Save & Next
              </PrimaryButton>
            </div>
          </div>

          <Divider />

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-2 pr-4">Division</th>
                  <th className="py-2 pr-4">League</th>
                  <th className="py-2 pr-4">Finalist</th>
                  <th className="py-2 pr-4">Week 17</th>
                  <th className="py-2 pr-4">Decision</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((r) => (
                  <tr key={r.k} className="border-t border-subtle">
                    <td className="py-2 pr-4 whitespace-nowrap">{r.division}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{r.leagueName}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-medium text-white">{r.ownerName}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{r.pts.toFixed(2)}</td>
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
        </Card>
      )}

      {step === "resolve17" && (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Resolve Week 17</h2>
              <p className="mt-2 text-sm text-muted">
                Pull Week 17 points for all selected finalists and compute: Wager Bonus, Overall Bonuses, League Winner Bonus, and Empire flags.
              </p>
              <p className="mt-2 text-sm text-muted">
                <b>Empire warning:</b> If a league winner repeats as champion, their league can trigger an Empire reset. Toggle the Empire flag per league below (if needed).
              </p>
            </div>
            <div className="flex gap-2">
              <PrimaryButton onClick={resolveWeek17AndNext} disabled={saving}>
                Resolve Week 17 & Next
              </PrimaryButton>
            </div>
          </div>

          <Divider />

          <div className="space-y-3">
            {Object.keys(results?.leagueWinners || {}).length === 0 ? (
              <div className="text-sm text-muted">No Week 17 results yet.</div>
            ) : (
              Object.entries(results?.leagueWinners || {})
                .sort(([a], [b]) => {
                  const ao = leagueOrderIndex.get(String(a).toLowerCase()) ?? 999999;
                  const bo = leagueOrderIndex.get(String(b).toLowerCase()) ?? 999999;
                  if (ao !== bo) return ao - bo;
                  return String(a).localeCompare(String(b));
                })
                .map(([lk, row]) => (
                  <div key={lk} className="rounded-2xl border border-subtle bg-panel/40 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-white font-semibold">{lk.split("|||")[1]}</div>
                      <button
                        type="button"
                        onClick={() => toggleEmpire(lk)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                          doc?.week17?.empireTriggered?.[lk]
                            ? "bg-amber-500/15 border-amber-400/40 text-amber-100"
                            : "bg-panel border-subtle text-foreground hover:border-amber-400/30"
                        }`}
                      >
                        Empire {doc?.week17?.empireTriggered?.[lk] ? "ON" : "OFF"}
                      </button>
                    </div>
                    <div className="mt-2 text-sm text-muted">
                      Winner: <span className="text-white font-medium">{row?.winner}</span> · {Number(row?.pts ?? 0).toFixed(2)}
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>
      )}

      {step === "resolve18" && (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Resolve Week 18 Showdown</h2>
              <p className="mt-2 text-sm text-muted">
                Week 18 is a head-to-head between the <b>division champs</b> (highest Week 17 scorer in each division).
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
                  : `${Number(doc?.week18?.showdown?.result?.winnerPts ?? 0).toFixed(2)} vs ${Number(doc?.week18?.showdown?.result?.loserPts ?? 0).toFixed(2)}`}
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {step === "results" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-white">Bonuses</h2>
            <Divider />

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Wager Bonus (highest among wagered)</span>
                <span className="font-semibold text-white">{fmtMoney(results?.wagerBonus?.bonus ?? doc?.week17?.wagerBonus ?? 200)}</span>
              </div>
              {results?.wagerBonus?.winner ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-amber-200">Winner</div>
                  <div className="mt-1 text-white font-semibold">{results.wagerBonus.winner}</div>
                  <div className="mt-1 text-muted">{results.wagerBonus.winnerDivision} · {results.wagerBonus.winnerLeague} · {Number(results.wagerBonus.winnerPts ?? 0).toFixed(2)}</div>
                </div>
              ) : (
                <div className="text-muted">No wagered finalists yet.</div>
              )}

              <Divider />

              <div className="text-xs uppercase tracking-[0.25em] text-muted">Overall (all finalists)</div>
              {["first", "second", "third"].map((k) => {
                const row = results?.overall?.[k];
                const label = k === "first" ? "🥇 1st" : k === "second" ? "🥈 2nd" : "🥉 3rd";
                return (
                  <div key={k} className="flex items-center justify-between rounded-xl border border-subtle bg-panel/60 px-3 py-2">
                    <div className="text-white font-medium">{label} {row?.winner ? `· ${row.winner}` : ""}</div>
                    <div className="text-muted">{fmtMoney(row?.bonus ?? 0)} {row?.pts ? `· ${Number(row.pts).toFixed(2)}` : ""}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white">League Winners (+{fmtMoney(doc?.week17?.leagueWinBonus ?? 125)})</h2>
            <p className="mt-2 text-sm text-muted">Winner is the finalist who outscored their opponent in Week 17.</p>
            <Divider />

            <div className="space-y-3">
              {Object.keys(results?.leagueWinners || {}).length === 0 && <div className="text-sm text-muted">No leagues imported yet.</div>}
              {Object.entries(results?.leagueWinners || {})
                .sort(([a], [b]) => {
                  const ao = leagueOrderIndex.get(String(a).toLowerCase()) ?? 999999;
                  const bo = leagueOrderIndex.get(String(b).toLowerCase()) ?? 999999;
                  if (ao !== bo) return ao - bo;
                  return String(a).localeCompare(String(b));
                })
                .map(([lk, w]) => {
                  const [div, leagueName] = lk.split("|||");
                  const empireOn = !!doc?.week17?.empireTriggered?.[lk];
                  return (
                    <div key={lk} className="rounded-xl border border-subtle bg-panel/60 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.25em] text-muted">{div}</div>
                          <div className="mt-1 text-white font-semibold">{leagueName}</div>
                          <div className="mt-1 text-sm text-muted">
                            {w?.tie ? (
                              <>Tie: {Number(w?.pts ?? 0).toFixed(2)} – {Number(w?.opponentPts ?? 0).toFixed(2)}</>
                            ) : (
                              <>
                                Winner: <span className="text-white font-medium">{w?.winner}</span> ({Number(w?.pts ?? 0).toFixed(2)})
                                <span className="mx-1">·</span>
                                Opponent: {w?.opponent} ({Number(w?.opponentPts ?? 0).toFixed(2)})
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleEmpire(lk)}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                              empireOn
                                ? "bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-100"
                                : "bg-panel border-subtle text-foreground hover:border-fuchsia-400/30"
                            }`}
                            title="If the overall champ repeats in this league (Empire trigger), toggle this on so the public page can highlight it."
                          >
                            Empire {empireOn ? "ON" : "OFF"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white">Who should have wagered?</h2>
            <p className="mt-2 text-sm text-muted">
              Banked finalists who scored at least as many Week 17 points as the highest scorer among those who wagered.
            </p>
            <Divider />

            {safeArray(results?.wagerMisses).length === 0 ? (
              <div className="text-sm text-muted">No misses detected (or no one wagered yet).</div>
            ) : (
              <div className="space-y-2">
                {safeArray(results?.wagerMisses).slice(0, 20).map((m, idx) => (
                  <div key={`${m?.key || idx}`} className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3">
                    <div className="text-white font-semibold">{safeStr(m?.ownerName)}</div>
                    <div className="mt-1 text-sm text-muted">
                      {safeStr(m?.division)} · {safeStr(m?.leagueName)} · {Number(m?.wk17 ?? 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white">Save to publish</h2>
            <p className="mt-2 text-sm text-muted">
              The public page reads from R2. After editing decisions or Empire toggles, click Save.
            </p>
            <Divider />
            <PrimaryButton tone="accent2" onClick={() => save(doc)} disabled={saving}>
              Save
            </PrimaryButton>
          </Card>
        </div>
      )}
    </div>
  );
}
