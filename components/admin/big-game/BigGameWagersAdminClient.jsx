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
      pools: {
        main: { threshold: 50, pool: 0, winner: "", winnerKey: "" },
        side1: { threshold: 100, pool: 0, winner: "", winnerKey: "" },
        side2: { threshold: 150, pool: 0, winner: "", winnerKey: "" },
      },
      pool: 0,
      winner: "",
      winnerKey: "",
      wouldHaveWon: { ownerName: "", entryKey: "" },
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
      byDivLeague.set(key, {
        ownerName,
        leagueName,
        division,
        total,
      });
    }
  }

  // flatten -> by division
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

  // key: "division|||leagueName" (lowercased) -> order number
  const map = new Map();
  for (const r of rows) {
    const div = safeStr(r?.theme_name).trim(); // division
    const leagueName = safeStr(r?.name).trim(); // league name
    if (!div || !leagueName) continue;
    const orderRaw = r?.display_order ?? r?.displayOrder ?? r?.league_order ?? r?.order;
    const orderNum = Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : 999999;
    map.set(`${div}|||${leagueName}`.toLowerCase(), orderNum);
  }
  return map;
}

function orderForLeague(leagueOrderIndex, div, leagueName) {
  const k = `${safeStr(div).trim()}|||${safeStr(leagueName).trim()}`.toLowerCase();
  const v = leagueOrderIndex?.get?.(k);
  return Number.isFinite(Number(v)) ? Number(v) : 999999;
}

export default function BigGameWagersAdminClient({ season }) {
  const [state, setState] = useState(() => buildEmptyState(season));
  const [bigGameMeta, setBigGameMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Load Big Game page config (division names, league cards, images) so the tracker can feel native.
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

  const leagueOrderIndex = useMemo(() => buildLeagueOrderIndex(bigGameMeta), [bigGameMeta]);

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
        // Server normally responds as { ok: true, data: <full doc|null> }.
        // Older clients/servers may have returned the raw doc.
        const data = saved && typeof saved === "object" && "data" in saved ? saved.data : saved;
        if (!cancelled) {
          setState(() => {
            const base = buildEmptyState(season);
            const merged = { ...base, ...(data || {}), season: Number(season) };
            // ensure new fields exist
            merged.championship = merged.championship || base.championship;
            merged.championship.pools = merged.championship.pools || base.championship.pools;
            merged.championship.wouldHaveWon = merged.championship.wouldHaveWon || base.championship.wouldHaveWon;
            return merged;
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

  const eligibilityByDivision = state?.eligibility?.byDivision || {};
  const wagersByDivision = state?.divisionWagers?.byDivision || {};

  const derived = useMemo(() => {
    const entryFee = Number(state?.divisionWagers?.entryFee || 25);
    const out = {
      divisions: {},
      championship: {
        pool: Number(state?.championship?.pool || 0),
        pools: state?.championship?.pools || buildEmptyState(season).championship.pools,
        wouldHaveWon: state?.championship?.wouldHaveWon || { ownerName: "", entryKey: "" },
      },
    };

    for (const div of Object.keys(eligibilityByDivision)) {
      const elig = safeArray(eligibilityByDivision[div]);
      const w = wagersByDivision?.[div] || {};
      const pot1Entrants = w?.pot1?.entrants || {};
      const pot2Entrants = w?.pot2?.entrants || {};

      const pot1Keys = elig
        .map((e) => ({ e, k: entryKey({ division: div, leagueName: e?.leagueName, ownerName: e?.ownerName }) }))
        .filter(({ e, k }) => pot1Entrants && (pot1Entrants[k] || pot1Entrants[e.ownerName]));
      const pot2Keys = elig
        .map((e) => ({ e, k: entryKey({ division: div, leagueName: e?.leagueName, ownerName: e?.ownerName }) }))
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
  }, [eligibilityByDivision, wagersByDivision, season, state?.championship, state?.divisionWagers?.entryFee]);

  async function save(next) {
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        ...next,
        season: Number(season),
        updatedAt: nowIso(),
      };
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
      next.source = {
        leaderboardUrl: url,
        lastFetchedAt: nowIso(),
        leaderboardEtag: etag,
      };
      next.eligibility = {
        computedAt: nowIso(),
        week: 15,
        byDivision,
      };

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
          eligList.map((e) => entryKey({ division: div, leagueName: e.leagueName, ownerName: e.ownerName }))
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
        for (const k of Object.keys(pot2.entrants)) pot1.entrants[k] = true;

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

    // Clean up any legacy key for this entry if it exists
    if (legacyName) delete p.entrants[legacyName];

    // enforce pot2 => pot1
    if (pot === "pot2" && checked) {
      d.pot1 = d.pot1 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };
      d.pot1.entrants = d.pot1.entrants || {};
      d.pot1.entrants[k] = true;
      if (legacyName) delete d.pot1.entrants[legacyName];
    }

    // and if pot1 unchecked -> pot2 must also be removed
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
      next.source = {
        leaderboardUrl: url,
        lastFetchedAt: nowIso(),
        leaderboardEtag: etag,
      };

      next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", byDivision: {} };
      next.divisionWagers.week = 16;
      next.divisionWagers.resolvedAt = nowIso();

      const entryFee = Number(next.divisionWagers.entryFee || 25);

      for (const div of Object.keys(next.eligibility?.byDivision || {})) {
        const elig = safeArray(next.eligibility.byDivision[div]);
        const keyToEntry = new Map(
          elig.map((e) => [entryKey({ division: div, leagueName: e?.leagueName, ownerName: e?.ownerName }), e])
        );
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

      // Auto-seed championship entrants from pot1 winners (roster-instance keyed)
      const seeded = [];
      for (const [div, d] of Object.entries(next.divisionWagers.byDivision || {})) {
        const winKey = safeStr(d?.pot1?.winnerKey).trim();
        if (!winKey) continue;
        const ownerName = safeStr(d?.pot1?.winner).trim();
        seeded.push({ entryKey: winKey, ownerName, division: div, wager: 0 });
      }

      next.championship = next.championship || buildEmptyState(season).championship;
      next.championship.week = 17;

      // preserve existing wagers for the same roster instance
      const prevWagers = new Map(
        safeArray(next.championship.byDivisionWinner).map((r) => [safeStr(r.entryKey || r.ownerName), Number(r.wager || 0)])
      );

      next.championship.byDivisionWinner = seeded.map((r) => ({ ...r, wager: prevWagers.get(r.entryKey) || 0 }));
      next.championship.points = {};
      next.championship.pools = buildEmptyState(season).championship.pools;
      next.championship.pool = 0;
      next.championship.winner = "";
      next.championship.winnerKey = "";
      next.championship.wouldHaveWon = { ownerName: "", entryKey: "" };
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
    next.championship = next.championship || buildEmptyState(season).championship;
    next.championship.byDivisionWinner = safeArray(next.championship.byDivisionWinner).map((r) =>
      r.entryKey === entryKeyStr ? { ...r, wager } : r
    );
    setState(next);
  }

  async function resolveChampionshipWeek17() {
    const ok = window.confirm(
      "Resolve Big Game Championship using Week 17 scores?\n\nThis will:\n- pull Week 17 points\n- determine winners for: Main Pot ($50), Side Pot 1 (+$50), Side Pot 2 (+$50)\n- record pools + winners\n\nNote: If someone did NOT wager, they are NOT eligible to win a pot (but we will still show if they would've won for fun)."
    );
    if (!ok) return;

    setSaving(true);
    setMsg("");
    try {
      const { data, etag, url } = await fetchLeaderboardJson();
      const week17Points = getWeekPointsFromLeaderboard(data, season, 17);

      const next = structuredClone(state);
      next.source = {
        leaderboardUrl: url,
        lastFetchedAt: nowIso(),
        leaderboardEtag: etag,
      };

      next.championship = next.championship || buildEmptyState(season).championship;
      next.championship.week = 17;

      const entrantsAll = safeArray(next.championship.byDivisionWinner).filter((r) => safeStr(r?.ownerName).trim());
      const points = {}; // keyed by entryKey

      for (const r of entrantsAll) {
        const name = safeStr(r.ownerName).trim();
        const k = safeStr(r.entryKey).trim() || entryKey({ division: r.division, leagueName: r.leagueName, ownerName: name });
        points[k] = Number(week17Points?.[k] ?? 0);
        r.entryKey = k;
        // enforce increments of 50, clamp 0–150
        const w = Number(r.wager || 0);
        const wNorm = Math.max(0, Math.min(150, Math.round(w / 50) * 50));
        r.wager = wNorm;
      }

      // would-have-won (includes non-bettors)
      let wouldName = "";
      let wouldKey = "";
      let bestAny = -Infinity;
      for (const r of entrantsAll) {
        const k = safeStr(r.entryKey).trim();
        const pts = Number(points[k] ?? 0);
        if (pts > bestAny) {
          bestAny = pts;
          wouldName = safeStr(r.ownerName).trim();
          wouldKey = k;
        }
      }

      const pickPotWinner = (threshold) => {
        const participants = entrantsAll.filter((r) => Number(r.wager || 0) >= threshold);
        let winner = "";
        let winnerKey = "";
        let best = -Infinity;
        for (const r of participants) {
          const k = safeStr(r.entryKey).trim();
          const pts = Number(points[k] ?? 0);
          if (pts > best) {
            best = pts;
            winner = safeStr(r.ownerName).trim();
            winnerKey = k;
          }
        }
        return {
          threshold,
          participants,
          pool: participants.length * 50,
          winner,
          winnerKey,
        };
      };

      const main = pickPotWinner(50);
      const side1 = pickPotWinner(100);
      const side2 = pickPotWinner(150);

      const totalPool = Number(main.pool || 0) + Number(side1.pool || 0) + Number(side2.pool || 0);

      next.championship.byDivisionWinner = entrantsAll;
      next.championship.points = points;
      next.championship.pools = {
        main: { threshold: 50, pool: main.pool, winner: main.winner, winnerKey: main.winnerKey },
        side1: { threshold: 100, pool: side1.pool, winner: side1.winner, winnerKey: side1.winnerKey },
        side2: { threshold: 150, pool: side2.pool, winner: side2.winner, winnerKey: side2.winnerKey },
      };
      next.championship.pool = totalPool;

      // "winner" is just the main pot winner (most prominent)
      next.championship.winner = main.winner;
      next.championship.winnerKey = main.winnerKey;

      next.championship.wouldHaveWon = { ownerName: wouldName, entryKey: wouldKey };
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
              Manual work: just check who entered each wager. Everything else can be pulled from the leaderboard JSON.
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
            <p className="mt-2 text-xs text-muted">Pulls Week 1–15 totals and picks the top total in each league.</p>
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
            <div className="mt-1 font-semibold">Mark division wager entries</div>
            <p className="mt-2 text-xs text-muted">Pot #2 requires Pot #1. Checking Pot #2 auto-checks Pot #1.</p>
            <div className="mt-3 text-xs text-muted">
              Entry fee: <span className="text-foreground">{fmtMoney(state?.divisionWagers?.entryFee || 25)}</span> per pot.
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Step 3</div>
            <div className="mt-1 font-semibold">Resolve Week 16 & Week 17</div>
            <p className="mt-2 text-xs text-muted">
              Week 16 resolves division pots. Week 17 resolves championship pots ($50 tiers).
            </p>
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
          Each division shows eligible league winners (Week 1–15 totals). Toggle who entered Pot #1 and Pot #2. Eligible
          leagues are ordered by your Big Game page <span className="text-foreground">display_order</span>.
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
                const eligRaw = safeArray(eligibilityByDivision[div]);
                const elig = [...eligRaw].sort((a, b) => {
                  const ao = orderForLeague(leagueOrderIndex, div, a?.leagueName);
                  const bo = orderForLeague(leagueOrderIndex, div, b?.leagueName);
                  if (ao !== bo) return ao - bo;
                  return safeStr(a?.leagueName).localeCompare(safeStr(b?.leagueName));
                });

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
            {state?.championship?.resolvedAt ? (
              <SmallBadge>Resolved {new Date(state.championship.resolvedAt).toLocaleString()}</SmallBadge>
            ) : null}
          </div>
        </div>

        <p className="mt-2 text-sm text-muted">
          Seeds from each division&apos;s <span className="text-foreground">Pot #1 winner</span>. Wagers are in increments of $50
          (0–$150). Each $50 tier is its own pot: <span className="text-foreground">Main</span>, <span className="text-foreground">Side 1</span>, <span className="text-foreground">Side 2</span>.
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
                  const k = safeStr(r?.entryKey) || entryKey({ division: div, leagueName: r?.leagueName, ownerName: name });
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
                              className={`rounded-lg border px-2 py-1 text-xs transition ${Number(r?.wager || 0) === amt ? "border-accent/60 bg-accent/10 text-accent" : "border-subtle bg-panel text-muted hover:border-accent/40"}`}
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

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Main Pot</div>
            <div className="mt-1 text-sm text-muted">$50 entry</div>
            <div className="mt-2 text-sm">
              Pool: <span className="font-semibold text-foreground">{fmtMoney(state?.championship?.pools?.main?.pool || 0)}</span>
            </div>
            <div className="mt-1 text-sm">
              Winner: <span className="font-semibold text-foreground">{safeStr(state?.championship?.pools?.main?.winner) || "—"}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Side Pot 1</div>
            <div className="mt-1 text-sm text-muted">+$50 (bet ≥ $100)</div>
            <div className="mt-2 text-sm">
              Pool: <span className="font-semibold text-foreground">{fmtMoney(state?.championship?.pools?.side1?.pool || 0)}</span>
            </div>
            <div className="mt-1 text-sm">
              Winner: <span className="font-semibold text-foreground">{safeStr(state?.championship?.pools?.side1?.winner) || "—"}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Side Pot 2</div>
            <div className="mt-1 text-sm text-muted">+$50 (bet ≥ $150)</div>
            <div className="mt-2 text-sm">
              Pool: <span className="font-semibold text-foreground">{fmtMoney(state?.championship?.pools?.side2?.pool || 0)}</span>
            </div>
            <div className="mt-1 text-sm">
              Winner: <span className="font-semibold text-foreground">{safeStr(state?.championship?.pools?.side2?.winner) || "—"}</span>
            </div>
          </div>
        </div>

        {safeStr(state?.championship?.wouldHaveWon?.ownerName).trim() &&
        safeStr(state?.championship?.pools?.main?.winner).trim() &&
        safeStr(state?.championship?.wouldHaveWon?.ownerName).trim() !== safeStr(state?.championship?.pools?.main?.winner).trim() ? (
          <div className="mt-4 rounded-2xl border border-subtle bg-panel/50 p-4 text-sm">
            <span className="text-muted">For fun:</span>{" "}
            <span className="text-foreground font-semibold">{safeStr(state?.championship?.wouldHaveWon?.ownerName)}</span>{" "}
            <span className="text-muted">would have won Week 17 overall (including non-bettors).</span>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted">
            Total pool (all pots): <span className="text-foreground font-semibold">{fmtMoney(state?.championship?.pool || 0)}</span>
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
