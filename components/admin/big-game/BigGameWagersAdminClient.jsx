"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

// Owner names can appear in multiple leagues. Any wager/eligibility/points must be keyed
// by the roster instance (division + leagueName + ownerName) — never by ownerName alone.
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

function sumWeeks(weeklyMap, maxWeek) {
  let total = 0;
  for (let w = 1; w <= maxWeek; w++) {
    const v = weeklyMap?.[String(w)] ?? weeklyMap?.[w];
    const n = typeof v === "number" ? v : parseFloat(v);
    if (!Number.isNaN(n)) total += n;
  }
  return Math.round(total * 100) / 100;
}

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
      week: 15,
      byDivision: {},
    },
    divisionWagers: {
      resolvedAt: "",
      week: 16,
      entryFee: 25,
      byDivision: {},
    },
    championship: {
      week: 17,
      resolvedAt: "",
      byDivisionWinner: [], // [{ entryKey, ownerName, division, wager }]
      points: {},
      winner: "",
      winnerKey: "",
      // Editable bonus added to the MAIN pot (defaults to $200)
      bonus: 200,

      // Per-$50 pots (winner must have that $50 in play to win that pot)
      // - main: everyone who wagered >= 50
      // - side1: everyone who wagered >= 100 (their 2nd $50)
      // - side2: everyone who wagered >= 150 (their 3rd $50)
      pots: {
        main: { entrants: 0, pool: 0, winner: "", winnerKey: "" },
        side1: { entrants: 0, pool: 0, winner: "", winnerKey: "" },
        side2: { entrants: 0, pool: 0, winner: "", winnerKey: "" },
      },

      // Fun: if a non-bettor would have been the overall points winner
      wouldHaveWonNoBet: { ownerName: "", division: "", points: 0 },

      // Computed values (saved so the public page can render without recomputing)
      poolWagers: 0, // sum of wagers actually placed
      pool: 0, // poolWagers + bonus
    },
  };
}

function computeLeagueWinnersFromLeaderboard(leaderboardsJson, season, upToWeek = 15) {
  const bigGame = leaderboardsJson?.[String(season)]?.big_game;
  const owners = safeArray(bigGame?.owners);

  // group by division + leagueName
  const byDivLeague = new Map();
  for (const o of owners) {
    const ownerName = safeStr(o?.ownerName).trim();
    const leagueName = safeStr(o?.leagueName).trim();
    const division = safeStr(o?.division).trim();
    if (!ownerName || !leagueName || !division) continue;

    const total = sumWeeks(o?.weekly || {}, upToWeek);
    const key = `${division}|||${leagueName}`;
    const prev = byDivLeague.get(key);
    if (!prev || total > prev.total) {
      byDivLeague.set(key, { ownerName, leagueName, division, total });
    }
  }

  // flatten -> by division (DO NOT sort here; UI will sort by display_order)
  const byDivision = {};
  for (const w of byDivLeague.values()) {
    if (!byDivision[w.division]) byDivision[w.division] = [];
    byDivision[w.division].push(w);
  }

  return byDivision;
}

function getWeekPointsFromLeaderboard(leaderboardsJson, season, week) {
  const bigGame = leaderboardsJson?.[String(season)]?.big_game;
  const owners = safeArray(bigGame?.owners);
  const points = {};
  for (const o of owners) {
    const name = safeStr(o?.ownerName).trim();
    if (!name) continue;

    const k = entryKey({
      division: safeStr(o?.division).trim(),
      leagueName: safeStr(o?.leagueName).trim(),
      ownerName: name,
    });

    const v = o?.weekly?.[String(week)] ?? o?.weekly?.[week];
    const n = typeof v === "number" ? v : parseFloat(v);
    points[k] = Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }
  return points;
}

function PrimaryButton({ children, onClick, disabled, tone = "accent" }) {
  const toneCls =
    tone === "danger"
      ? "bg-rose-500/15 border-rose-400/30 text-rose-100 hover:bg-rose-500/20"
      : tone === "muted"
      ? "bg-panel border-subtle text-foreground hover:border-accent/40"
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

function buildLeagueOrderIndex(bigGameMeta) {
  const rows = safeArray(bigGameMeta?.rows);
  const map = new Map();

  for (const r of rows) {
    const div = safeStr(r?.theme_name).trim(); // division
    const leagueName = safeStr(r?.name).trim(); // league name
    if (!div || !leagueName) continue;

    const raw =
      r?.display_order ??
      r?.displayOrder ??
      r?.league_order ??
      r?.order ??
      r?.leagueOrder ??
      r?.displayorder;

    const n = Number(raw);
    const orderNum = Number.isFinite(n) ? n : 999999;
    map.set(`${div}|||${leagueName}`.toLowerCase(), orderNum);
  }

  return map;
}

function sortEligByDisplayOrder(elig, div, leagueOrderIndex) {
  return safeArray(elig)
    .slice()
    .sort((a, b) => {
      const aLeague = safeStr(a?.leagueName).trim();
      const bLeague = safeStr(b?.leagueName).trim();

      const ao = leagueOrderIndex.get(`${div}|||${aLeague}`.toLowerCase()) ?? 999999;
      const bo = leagueOrderIndex.get(`${div}|||${bLeague}`.toLowerCase()) ?? 999999;

      if (ao !== bo) return ao - bo;

      const ln = aLeague.localeCompare(bLeague);
      if (ln !== 0) return ln;

      return safeStr(a?.ownerName).trim().localeCompare(safeStr(b?.ownerName).trim());
    });
}

export default function BigGameWagersAdminClient({ season }) {
  const [state, setState] = useState(() => buildEmptyState(season));
  const [bigGameMeta, setBigGameMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Load Big Game page config (division names, league cards, images)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/admin/biggame?season=${encodeURIComponent(season)}&type=page`, {
          cache: "no-store",
        });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setBigGameMeta(data);
      } catch {
        if (!cancelled) setBigGameMeta(null);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [season]);

  // Load wager state
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setMsg("");
      try {
        const res = await fetch(`/api/admin/biggame-wagers?season=${encodeURIComponent(season)}`, {
          cache: "no-store",
        });
        const saved = res.ok ? await res.json() : null;
        const data = saved && typeof saved === "object" && "data" in saved ? saved.data : saved;

        if (!cancelled) {
          setState(() => {
            const base = buildEmptyState(season);
            return { ...base, ...(data || {}), season: Number(season) };
          });
        }
      } catch (e) {
        if (!cancelled) setMsg(e?.message || "Failed to load wager tracker state.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const leagueOrderIndex = useMemo(() => buildLeagueOrderIndex(bigGameMeta), [bigGameMeta]);

  const eligibilityByDivision = state?.eligibility?.byDivision || {};
  const wagersByDivision = state?.divisionWagers?.byDivision || {};

  const derived = useMemo(() => {
    const entryFee = Number(state?.divisionWagers?.entryFee || 25);

    const out = {
      divisions: {},
      championship: {
        pool: Number(state?.championship?.pool || 0),
        winner: safeStr(state?.championship?.winner).trim(),
      },
    };

    for (const div of Object.keys(eligibilityByDivision || {})) {
      const elig = safeArray(eligibilityByDivision[div]);
      const w = wagersByDivision?.[div] || {};
      const pot1Entrants = w?.pot1?.entrants || {};
      const pot2Entrants = w?.pot2?.entrants || {};

      const pot1Keys = elig
        .map((e) => ({ e, k: entryKey(e) }))
        .filter(({ e, k }) => pot1Entrants && (pot1Entrants[k] || pot1Entrants[e.ownerName]));

      const pot2Keys = elig
        .map((e) => ({ e, k: entryKey(e) }))
        .filter(({ e, k }) => pot2Entrants && (pot2Entrants[k] || pot2Entrants[e.ownerName]));

      const pot1Pool = pot1Keys.length * entryFee;
      const pot2Pool = pot2Keys.length * entryFee;

      out.divisions[div] = {
        eligibleCount: elig.length,
        pot1Count: pot1Keys.length,
        pot2Count: pot2Keys.length,
        pot1Pool,
        pot2Pool,
        pot1Winner: safeStr(w?.pot1?.winner).trim(),
        pot2Winner: safeStr(w?.pot2?.winner).trim(),
      };
    }

    return out;
  }, [state, eligibilityByDivision, wagersByDivision]);

  async function save(next) {
    setSaving(true);
    setMsg("");
    try {
      const payload = { ...next, season: Number(season), updatedAt: nowIso() };

      const res = await fetch(`/api/admin/biggame-wagers?season=${encodeURIComponent(season)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Save failed (${res.status})`);
      }

      const saved = await res.json().catch(() => payload);
      const doc = saved && typeof saved === "object" && "data" in saved ? saved.data : saved;

      setState((prev) => ({ ...prev, ...(doc || payload) }));
      setMsg("Saved.");
    } catch (e) {
      setMsg(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function fetchLeaderboardJson() {
    const url = LEADERBOARD_URL_BY_SEASON(season);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load leaderboard JSON (${res.status})`);
    const etag = res.headers.get("etag") || "";
    const data = await res.json();
    return { data, etag, url };
  }

  async function importEligibilityWeek15() {
    const ok = window.confirm(
      "Import Week 15 league winners from the leaderboard JSON?\n\nThis will REPLACE the current eligibility list (but keep your current wager selections if names still match)."
    );
    if (!ok) return;

    setSaving(true);
    setMsg("");
    try {
      const { data, etag, url } = await fetchLeaderboardJson();
      const byDivision = computeLeagueWinnersFromLeaderboard(data, season, 15);

      const next = structuredClone(state);

      next.source = { leaderboardUrl: url, lastFetchedAt: nowIso(), leaderboardEtag: etag };
      next.eligibility = { computedAt: nowIso(), week: 15, byDivision };

      next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", byDivision: {} };
      next.divisionWagers.week = 16;
      next.divisionWagers.entryFee = next.divisionWagers.entryFee || 25;
      next.divisionWagers.byDivision = next.divisionWagers.byDivision || {};

      for (const div of Object.keys(byDivision)) {
        const existing = next.divisionWagers.byDivision[div] || {};
        const pot1 = existing.pot1 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };
        const pot2 = existing.pot2 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };

        const eligList = safeArray(byDivision[div]);

        const keyCountsByOwner = new Map();
        for (const e of eligList) {
          const n = safeStr(e?.ownerName).trim();
          if (!n) continue;
          keyCountsByOwner.set(n, (keyCountsByOwner.get(n) || 0) + 1);
        }

        const eligibleKeys = new Set(
          eligList.map((e) =>
            entryKey({ division: div, leagueName: safeStr(e.leagueName).trim(), ownerName: safeStr(e.ownerName).trim() })
          )
        );

        const migrateAndPrune = (obj) => {
          const out = {};
          for (const [k, v] of Object.entries(obj || {})) {
            if (!v) continue;

            if (eligibleKeys.has(k)) {
              out[k] = true;
              continue;
            }

            const owner = safeStr(k).trim();
            if (!owner) continue;

            if ((keyCountsByOwner.get(owner) || 0) === 1) {
              const match = eligList.find((e) => safeStr(e?.ownerName).trim() === owner);
              if (match) {
                const ek = entryKey({ division: div, leagueName: match.leagueName, ownerName: owner });
                if (eligibleKeys.has(ek)) out[ek] = true;
              }
            }
          }
          return out;
        };

        pot1.entrants = migrateAndPrune(pot1.entrants);
        pot2.entrants = migrateAndPrune(pot2.entrants);

        // enforce pot2 => pot1
        for (const k of Object.keys(pot2.entrants || {})) pot1.entrants[k] = true;

        next.divisionWagers.byDivision[div] = { ...existing, pot1, pot2 };
      }

      await save(next);
    } catch (e) {
      setMsg(e?.message || "Failed to import Week 15 eligibility.");
    } finally {
      setSaving(false);
    }
  }

  function toggleEntrant(div, pot, entry, checked) {
    const k = entryKey({ division: div, leagueName: entry?.leagueName, ownerName: entry?.ownerName });
    const legacyName = safeStr(entry?.ownerName).trim();

    const next = structuredClone(state);
    next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", byDivision: {} };
    next.divisionWagers.byDivision = next.divisionWagers.byDivision || {};

    const d = next.divisionWagers.byDivision[div] || {};
    const p = d[pot] || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };

    p.entrants = p.entrants || {};
    if (checked) p.entrants[k] = true;
    else delete p.entrants[k];

    if (legacyName) delete p.entrants[legacyName];

    // enforce pot2 => pot1
    if (pot === "pot2" && checked) {
      d.pot1 = d.pot1 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };
      d.pot1.entrants = d.pot1.entrants || {};
      d.pot1.entrants[k] = true;
      if (legacyName) delete d.pot1.entrants[legacyName];
    }

    // if pot1 unchecked -> pot2 must also be removed
    if (pot === "pot1" && !checked) {
      d.pot2 = d.pot2 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };
      d.pot2.entrants = d.pot2.entrants || {};
      delete d.pot2.entrants[k];
      if (legacyName) delete d.pot2.entrants[legacyName];
    }

    d[pot] = p;
    next.divisionWagers.byDivision[div] = d;
    setState(next);
  }

  async function resolveDivisionWagersWeek16() {
    const ok = window.confirm(
      "Resolve Division Wagers using Week 16 scores?\n\nThis will:\n- pull Week 16 points for all owners\n- determine pot winners per division (among entrants)\n- record pools + winners\n\nYou can re-run this later; it overwrites week 16 resolution fields."
    );
    if (!ok) return;

    setSaving(true);
    setMsg("");
    try {
      const { data, etag, url } = await fetchLeaderboardJson();
      const week16Points = getWeekPointsFromLeaderboard(data, season, 16);

      const next = structuredClone(state);

      next.source = { leaderboardUrl: url, lastFetchedAt: nowIso(), leaderboardEtag: etag };

      next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", byDivision: {} };
      next.divisionWagers.week = 16;
      next.divisionWagers.resolvedAt = nowIso();
      const entryFee = Number(next.divisionWagers.entryFee || 25);

      for (const div of Object.keys(next.eligibility?.byDivision || {})) {
        const elig = safeArray(next.eligibility.byDivision[div]);
        const keyToEntry = new Map(elig.map((e) => [entryKey({ division: div, leagueName: e?.leagueName, ownerName: e?.ownerName }), e]));
        const keysInOrder = elig.map((e) => entryKey({ division: div, leagueName: e?.leagueName, ownerName: e?.ownerName }));

        next.divisionWagers.byDivision = next.divisionWagers.byDivision || {};
        const d = next.divisionWagers.byDivision[div] || {};
        const pot1 = d.pot1 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };
        const pot2 = d.pot2 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };

        const pot1Entrants = keysInOrder.filter((k) => Boolean(pot1?.entrants?.[k]) && keyToEntry.has(k));
        const pot2Entrants = keysInOrder.filter((k) => Boolean(pot2?.entrants?.[k]) && keyToEntry.has(k));

        const pickWinnerKey = (entrants) => {
          let bestKey = "";
          let bestPts = -Infinity;
          for (const k of entrants) {
            const pts = Number(week16Points?.[k] ?? 0);
            if (pts > bestPts) {
              bestPts = pts;
              bestKey = k;
            }
          }
          return bestKey;
        };

        pot1.points = {};
        for (const k of pot1Entrants) pot1.points[k] = Number(week16Points?.[k] ?? 0);
        pot2.points = {};
        for (const k of pot2Entrants) pot2.points[k] = Number(week16Points?.[k] ?? 0);

        pot1.pool = pot1Entrants.length * entryFee;
        pot2.pool = pot2Entrants.length * entryFee;

        pot1.winnerKey = pickWinnerKey(pot1Entrants);
        pot2.winnerKey = pickWinnerKey(pot2Entrants);

        pot1.winner = safeStr(keyToEntry.get(pot1.winnerKey)?.ownerName || "").trim();
        pot2.winner = safeStr(keyToEntry.get(pot2.winnerKey)?.ownerName || "").trim();

        pot1.resolvedAt = nowIso();
        pot2.resolvedAt = nowIso();

        next.divisionWagers.byDivision[div] = { ...d, pot1, pot2 };
      }

      // Auto-seed championship entrants from pot1 winners (entryKey keyed)
      const seeded = [];
      for (const [div, d] of Object.entries(next.divisionWagers.byDivision || {})) {
        const winKey = safeStr(d?.pot1?.winnerKey).trim();
        if (!winKey) continue;
        const ownerName = safeStr(d?.pot1?.winner).trim();
        seeded.push({ entryKey: winKey, ownerName, division: div, wager: 0 });
      }

      next.championship = next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", winnerKey: "", pool: 0 };
      next.championship.week = 17;

      const prevWagers = new Map(
        safeArray(next.championship.byDivisionWinner).map((r) => [safeStr(r.entryKey || r.ownerName), Number(r.wager || 0)])
      );

      next.championship.byDivisionWinner = seeded.map((r) => ({ ...r, wager: prevWagers.get(r.entryKey) || 0 }));
      next.championship.points = {};
      next.championship.winner = "";
      next.championship.winnerKey = "";
      next.championship.pool = 0;
      next.championship.resolvedAt = "";

      await save(next);
    } catch (e) {
      setMsg(e?.message || "Failed to resolve Week 16 division wagers.");
    } finally {
      setSaving(false);
    }
  }

  function setChampWager(entryKeyStr, wager) {
    const next = structuredClone(state);
    next.championship = next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", winnerKey: "", pool: 0 };
    next.championship.byDivisionWinner = safeArray(next.championship.byDivisionWinner).map((r) =>
      safeStr(r.entryKey).trim() === entryKeyStr ? { ...r, wager } : r
    );
    setState(next);
  }

  function setChampionshipBonus(bonus) {
    const next = structuredClone(state);
    next.championship = next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", winnerKey: "", bonus: 200, poolWagers: 0, pool: 0 };
    const n = Number(bonus);
    next.championship.bonus = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    // Keep displayed total in sync if wagers already resolved.
    const wagers = Number(next.championship.poolWagers || 0);
    next.championship.pool = wagers + Number(next.championship.bonus || 0);
    setState(next);
  }

  async function resolveChampionshipWeek17() {
    const ok = window.confirm(
      "Resolve Big Game Championship using Week 17 scores?\n\nThis will:\n- pull Week 17 points\n- determine the overall champion among seeded division winners\n- compute the pool from wagers and record the winner\n\nYou can re-run this later; it overwrites championship resolution fields."
    );
    if (!ok) return;

    setSaving(true);
    setMsg("");
    try {
      const { data, etag, url } = await fetchLeaderboardJson();
      const week17Points = getWeekPointsFromLeaderboard(data, season, 17);

      const next = structuredClone(state);

      next.source = { leaderboardUrl: url, lastFetchedAt: nowIso(), leaderboardEtag: etag };

      next.championship = next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", winnerKey: "", pool: 0 };
      next.championship.week = 17;

      const seeded = safeArray(next.championship.byDivisionWinner).filter((r) => safeStr(r?.ownerName).trim());

      // Normalize wagers (0/50/100/150) and compute points for *all* seeded entrants.
      const points = {};
      for (const r of seeded) {
        const k = safeStr(r.entryKey).trim();
        const w = Number(r.wager || 0);
        r.wager = Math.max(0, Math.round(w / 50) * 50);
        points[k] = Number(week17Points?.[k] ?? 0);
      }

      // Helper: winner among a given participant list (by entryKey)
      const pickWinnerKey = (keys) => {
        let bestKey = "";
        let bestPts = -Infinity;
        for (const k of keys) {
          const pts = Number(points[k] ?? 0);
          if (pts > bestPts) {
            bestPts = pts;
            bestKey = k;
          }
        }
        return bestKey;
      };

      // Pot membership rules:
      // - MAIN POT: everyone who bet >= $50
      // - SIDE POT 1: everyone who bet >= $100 (their *second* $50)
      // - SIDE POT 2: everyone who bet >= $150 (their *third* $50)
      const mainKeys = seeded.filter((r) => Number(r.wager || 0) >= 50).map((r) => safeStr(r.entryKey).trim());
      const side1Keys = seeded.filter((r) => Number(r.wager || 0) >= 100).map((r) => safeStr(r.entryKey).trim());
      const side2Keys = seeded.filter((r) => Number(r.wager || 0) >= 150).map((r) => safeStr(r.entryKey).trim());

      const bonus = Number(next.championship?.bonus || 0) || 0;
      const poolMain = mainKeys.length * 50 + bonus;
      const poolSide1 = side1Keys.length * 50;
      const poolSide2 = side2Keys.length * 50;

      const mainWinnerKey = pickWinnerKey(mainKeys);
      const side1WinnerKey = pickWinnerKey(side1Keys);
      const side2WinnerKey = pickWinnerKey(side2Keys);

      const seededByKey = new Map(seeded.map((r) => [safeStr(r.entryKey).trim(), r]));
      const mainWinnerName = safeStr(seededByKey.get(mainWinnerKey)?.ownerName).trim();
      const side1WinnerName = safeStr(seededByKey.get(side1WinnerKey)?.ownerName).trim();
      const side2WinnerName = safeStr(seededByKey.get(side2WinnerKey)?.ownerName).trim();

      // Fun: show who would have won if "No Bet" entrants were allowed.
      const allKeys = seeded.map((r) => safeStr(r.entryKey).trim());
      const bestOverallKey = pickWinnerKey(allKeys);
      const bestOverall = seededByKey.get(bestOverallKey) || null;
      const wouldHaveWonNoBet =
        bestOverall && !mainKeys.includes(bestOverallKey)
          ? {
              entryKey: bestOverallKey,
              ownerName: safeStr(bestOverall?.ownerName).trim(),
              division: safeStr(bestOverall?.division).trim(),
              points: Number(points[bestOverallKey] ?? 0),
            }
          : null;

      next.championship.byDivisionWinner = seeded;
      next.championship.points = points;

      // Keep a simple sum too (helps older UI/logic).
      const poolWagers = poolMain + poolSide1 + poolSide2 - bonus;
      next.championship.poolWagers = poolWagers;
      next.championship.pool = poolWagers + bonus;

      next.championship.pots = {
        main: {
          label: "Main Pot",
          minWager: 50,
          entrants: mainKeys,
          pool: poolMain,
          winnerKey: mainWinnerKey,
          winner: mainWinnerName,
        },
        side1: {
          label: "Side Pot 1",
          minWager: 100,
          entrants: side1Keys,
          pool: poolSide1,
          winnerKey: side1WinnerKey,
          winner: side1WinnerName,
        },
        side2: {
          label: "Side Pot 2",
          minWager: 150,
          entrants: side2Keys,
          pool: poolSide2,
          winnerKey: side2WinnerKey,
          winner: side2WinnerName,
        },
      };

      // The overall "winner" shown at the top should be the MAIN POT winner.
      next.championship.winner = mainWinnerName;
      next.championship.winnerKey = mainWinnerKey;
      next.championship.wouldHaveWonNoBet = wouldHaveWonNoBet;
      next.championship.resolvedAt = nowIso();

      await save(next);
    } catch (e) {
      setMsg(e?.message || "Failed to resolve Week 17 championship.");
    } finally {
      setSaving(false);
    }
  }

  const canResolveW16 = Boolean(Object.keys(eligibilityByDivision || {}).length);
  const canResolveW17 = Boolean(safeArray(state?.championship?.byDivisionWinner).length);

  if (loading) {
    return <div className="text-sm text-muted">Loading wager tracker…</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">Big Game Wager Tracker</h1>
              <SmallBadge>Season {season}</SmallBadge>
              {state?.updatedAt ? <SmallBadge>Updated {new Date(state.updatedAt).toLocaleString()}</SmallBadge> : null}
            </div>
            <p className="text-sm text-muted">
              This page is designed so the only manual work is checking who entered each wager. Everything else can be pulled from the leaderboard JSON with a button press.
            </p>
            <div className="text-xs text-muted">
              Leaderboard feed: <span className="text-foreground">{LEADERBOARD_URL_BY_SEASON(season)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/big-game"
              className="inline-flex items-center justify-center rounded-xl border border-subtle bg-panel px-4 py-2 text-xs font-semibold tracking-[0.15em] uppercase text-foreground hover:border-accent/40 transition"
            >
              ← Big Game Admin
            </Link>

            <PrimaryButton disabled={saving} onClick={() => save(state)} tone="muted">
              Save
            </PrimaryButton>
          </div>
        </div>

        {msg ? (
          <div className="mt-4 rounded-xl border border-subtle bg-panel/50 px-4 py-3 text-sm text-foreground">{msg}</div>
        ) : null}

        <Divider />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Step 1</div>
            <div className="mt-1 font-semibold">Import Week 15 league winners</div>
            <p className="mt-2 text-xs text-muted">Pulls Week 1–15 totals from the leaderboard and picks the highest total in each league.</p>
            <div className="mt-3">
              <PrimaryButton onClick={importEligibilityWeek15} disabled={saving}>
                Import Week 15 Eligibility
              </PrimaryButton>
            </div>
            {state?.eligibility?.computedAt ? (
              <div className="mt-3 text-xs text-muted">Last import: {new Date(state.eligibility.computedAt).toLocaleString()}</div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Step 2</div>
            <div className="mt-1 font-semibold">Mark wager entries</div>
            <p className="mt-2 text-xs text-muted">Pot #2 requires Pot #1. Checking Pot #2 will automatically check Pot #1.</p>
            <div className="mt-3 text-xs text-muted">
              Entry fee: <span className="text-foreground">{fmtMoney(state?.divisionWagers?.entryFee || 25)}</span> per pot.
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Step 3</div>
            <div className="mt-1 font-semibold">Resolve Week 16 & Week 17</div>
            <p className="mt-2 text-xs text-muted">Week 16 determines division pot winners. Week 17 determines the overall Big Game champion.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton onClick={resolveDivisionWagersWeek16} disabled={saving || !canResolveW16}>
                Resolve Week 16
              </PrimaryButton>
              <PrimaryButton onClick={resolveChampionshipWeek17} disabled={saving || !canResolveW17}>
                Resolve Week 17
              </PrimaryButton>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold">Division Wagers</h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            <SmallBadge>Week 16</SmallBadge>
            {state?.divisionWagers?.resolvedAt ? (
              <SmallBadge>Resolved {new Date(state.divisionWagers.resolvedAt).toLocaleString()}</SmallBadge>
            ) : null}
          </div>
        </div>

        <p className="mt-2 text-sm text-muted">
          Each division shows eligible league winners (based on Week 1–15 totals). Toggle who entered Pot #1 and Pot #2. Resolving Week 16 locks in points + winners.
        </p>

        <div className="mt-5 space-y-10">
          {Object.keys(eligibilityByDivision || {}).length === 0 ? (
            <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-center text-sm text-muted">
              Import Week 15 eligibility to begin.
            </div>
          ) : (
            Object.keys(eligibilityByDivision)
              .sort((a, b) => a.localeCompare(b))
              .map((div) => {
                const elig = sortEligByDisplayOrder(eligibilityByDivision[div], div, leagueOrderIndex);

                const d = wagersByDivision?.[div] || {};
                const pot1 = d?.pot1 || {};
                const pot2 = d?.pot2 || {};
                const entryFee = Number(state?.divisionWagers?.entryFee || 25);

                return (
                  <div key={div} className="rounded-2xl border border-subtle bg-panel/20 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{div}</h3>
                          <SmallBadge>{elig.length} eligible</SmallBadge>
                          <SmallBadge>
                            Pot1 {derived.divisions?.[div]?.pot1Count || 0} ({fmtMoney(derived.divisions?.[div]?.pot1Pool || 0)})
                          </SmallBadge>
                          <SmallBadge>
                            Pot2 {derived.divisions?.[div]?.pot2Count || 0} ({fmtMoney(derived.divisions?.[div]?.pot2Pool || 0)})
                          </SmallBadge>
                        </div>
                        <div className="text-xs text-muted">
                          Pot1 winner: <span className="text-foreground">{safeStr(pot1?.winner) || "—"}</span> · Pot2 winner:{" "}
                          <span className="text-foreground">{safeStr(pot2?.winner) || "—"}</span>
                        </div>
                      </div>

                      <div className="text-xs text-muted">
                        Entry: <span className="text-foreground">{fmtMoney(entryFee)}</span> / pot
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-[0.25em] text-muted">
                            <th className="text-left py-2 pr-3">League</th>
                            <th className="text-left py-2 pr-3">Owner</th>
                            <th className="text-right py-2 pr-3">W1–15</th>
                            <th className="text-center py-2 px-2">Pot #1</th>
                            <th className="text-center py-2 px-2">Pot #2</th>
                            <th className="text-right py-2 pl-3">Wk16</th>
                          </tr>
                        </thead>
                        <tbody>
                          {elig.map((e) => {
                            const name = safeStr(e.ownerName);
                            const k = entryKey({ division: div, leagueName: e.leagueName, ownerName: name });
                            const wk16 = pot1?.points?.[k] ?? pot2?.points?.[k];
                            const wk16Num = typeof wk16 === "number" ? wk16 : parseFloat(wk16);
                            const wk16Show = Number.isNaN(wk16Num) ? "" : wk16Num.toFixed(2);

                            return (
                              <tr key={`${div}:${e.leagueName}:${name}`} className="border-t border-subtle/70">
                                <td className="py-2 pr-3 text-muted whitespace-nowrap">{e.leagueName}</td>
                                <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{name}</td>
                                <td className="py-2 pr-3 text-right tabular-nums text-muted">{Number(e.total || 0).toFixed(2)}</td>

                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(pot1?.entrants?.[k] || pot1?.entrants?.[name])}
                                    onChange={(ev) => toggleEntrant(div, "pot1", e, ev.target.checked)}
                                  />
                                </td>

                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(pot2?.entrants?.[k] || pot2?.entrants?.[name])}
                                    onChange={(ev) => toggleEntrant(div, "pot2", e, ev.target.checked)}
                                  />
                                </td>

                                <td className="py-2 pl-3 text-right tabular-nums text-muted">{wk16Show}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <div>
                        Pools: Pot1 {fmtMoney(pot1?.pool || 0)} · Pot2 {fmtMoney(pot2?.pool || 0)}
                      </div>
                      <div>Resolved: {pot1?.resolvedAt ? new Date(pot1.resolvedAt).toLocaleString() : "—"}</div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={() => save(state)} disabled={saving} tone="muted">
            Save Entries
          </PrimaryButton>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold">Big Game Championship</h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            <SmallBadge>Week 17</SmallBadge>
            {state?.championship?.resolvedAt ? <SmallBadge>Resolved {new Date(state.championship.resolvedAt).toLocaleString()}</SmallBadge> : null}
          </div>
        </div>

        <p className="mt-2 text-sm text-muted">
          By default, this seeds from each division&apos;s <span className="text-foreground">Pot #1 winner</span>. Each winner may wager in increments of $50 (0–$150). Resolve Week 17 to lock the champion + pool.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.25em] text-muted">
                <th className="text-left py-2 pr-3">Division</th>
                <th className="text-left py-2 pr-3">Owner</th>
                <th className="text-right py-2 pr-3">Wager</th>
                <th className="text-right py-2 pr-3">Wk17</th>
              </tr>
            </thead>
            <tbody>
              {safeArray(state?.championship?.byDivisionWinner).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-sm text-muted">
                    Resolve Week 16 to seed championship entrants.
                  </td>
                </tr>
              ) : (
                safeArray(state?.championship?.byDivisionWinner).map((r) => {
                  const name = safeStr(r?.ownerName);
                  const div = safeStr(r?.division);
                  const k = safeStr(r?.entryKey) || "";
                  const pts = state?.championship?.points?.[k];
                  const ptsNum = typeof pts === "number" ? pts : parseFloat(pts);

                  return (
                    <tr key={k || `${div}:${name}`} className="border-t border-subtle/70">
                      <td className="py-2 pr-3 text-muted whitespace-nowrap">{div}</td>
                      <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        <div className="inline-flex items-center justify-end gap-2">
                          {[0, 50, 100, 150].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setChampWager(k, amt)}
                              className={`rounded-lg border px-2 py-1 text-xs transition ${
                                Number(r?.wager || 0) === amt
                                  ? "border-accent/60 bg-accent/10 text-accent"
                                  : "border-subtle bg-panel text-muted hover:border-accent/40"
                              }`}
                            >
                              {amt === 0 ? "No Bet" : fmtMoney(amt)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted">{Number.isNaN(ptsNum) ? "" : ptsNum.toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>


        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Main Pot</div>
                <div className="mt-1 text-sm text-muted">
                  <span className="text-foreground font-semibold">{fmtMoney(state?.championship?.pots?.main?.pool || 0)}</span>
                  <span className="text-muted"> (includes +{fmtMoney(state?.championship?.bonus || 0)} bonus)</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  Winner: <span className="text-foreground font-semibold">{safeStr(state?.championship?.pots?.main?.winner) || "—"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Side Pot 1</div>
                <div className="mt-1 text-sm text-muted">
                  <span className="text-foreground font-semibold">{fmtMoney(state?.championship?.pots?.side1?.pool || 0)}</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  Winner: <span className="text-foreground font-semibold">{safeStr(state?.championship?.pots?.side1?.winner) || "—"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Side Pot 2</div>
                <div className="mt-1 text-sm text-muted">
                  <span className="text-foreground font-semibold">{fmtMoney(state?.championship?.pots?.side2?.pool || 0)}</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  Winner: <span className="text-foreground font-semibold">{safeStr(state?.championship?.pots?.side2?.winner) || "—"}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <div>
                Total Pool: <span className="text-foreground font-semibold">{fmtMoney(state?.championship?.pool || 0)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="uppercase tracking-[0.25em]">Championship bonus</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={Number(state?.championship?.bonus || 0)}
                  onChange={(e) => setChampionshipBonus(e.target.value)}
                  className="w-24 rounded-lg border border-subtle bg-panel px-3 py-2 text-xs text-foreground"
                />
                <span className="text-muted">(added to the Main Pot)</span>
              </div>
            </div>

            {state?.championship?.wouldHaveWonNoBet?.ownerName ? (
              <div className="text-xs text-muted">
                Fun: <span className="text-foreground font-semibold">{safeStr(state.championship.wouldHaveWonNoBet.ownerName)}</span>
                {state.championship.wouldHaveWonNoBet.division ? (
                  <>
                    <span className="text-muted"> (</span>
                    <span className="text-foreground">{safeStr(state.championship.wouldHaveWonNoBet.division)}</span>
                    <span className="text-muted">)</span>
                  </>
                ) : null}{" "}
                would have won on points, but did not wager.
              </div>
            ) : null}
          </div>

          <div className="flex gap-2">
            <PrimaryButton onClick={() => save(state)} disabled={saving} tone="muted">
              Save Wagers
            </PrimaryButton>
            <PrimaryButton onClick={resolveChampionshipWeek17} disabled={saving || !canResolveW17}>
              Resolve Week 17
            </PrimaryButton>
          </div>
        </div>
      </Card>
    </div>
  );
}
