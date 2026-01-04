"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";
import AdminStepTabs from "../AdminStepTabs";
import { safeArray, safeStr } from "@/lib/safe";

function isLocalhost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function getWagersLoadUrl(season) {
  if (isLocalhost()) return "/wagers/big-game.json";
  return `/api/admin/biggame-wagers?season=${encodeURIComponent(season)}`;
}


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
  `https://ballsville.pages.dev/data/leaderboards_${encodeURIComponent(season)}.json`;

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
      entriesSavedAt: "", // drives Step 2 checkmark
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
      bonus: 200,
      pots: {
        main: { entrants: 0, pool: 0, winner: "", winnerKey: "" },
        side1: { entrants: 0, pool: 0, winner: "", winnerKey: "" },
        side2: { entrants: 0, pool: 0, winner: "", winnerKey: "" },
      },
      wouldHaveWonNoBet: { ownerName: "", division: "", points: 0 },
      poolWagers: 0,
      pool: 0,
    },
  };
}

function computeLeagueWinnersFromLeaderboard(leaderboardsJson, season, upToWeek = 15) {
  const bigGame = leaderboardsJson?.[String(season)]?.big_game;
  const owners = safeArray(bigGame?.owners);

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
    const div = safeStr(r?.theme_name).trim();
    const leagueName = safeStr(r?.name).trim();
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

function WinnerPill({ pot1, pot2 }) {
  const both = pot1 && pot2;
  if (!pot1 && !pot2) return null;

  if (both) {
    return (
      <span className="ml-2 inline-flex rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
        Pot 1 + Pot 2 Winner
      </span>
    );
  }
  if (pot1) {
    return (
      <span className="ml-2 inline-flex rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
        Pot 1 Winner
      </span>
    );
  }
  return (
    <span className="ml-2 inline-flex rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
      Pot 2 Winner
    </span>
  );
}

export default function BigGameWagersAdminClient({ season }) {
  const [state, setState] = useState(() => buildEmptyState(season));
  const [bigGameMeta, setBigGameMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("auto");

  async function adminToken() {
    try {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || "";
    } catch {
      return "";
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const token = await adminToken();
        const res = await fetch(`/api/admin/biggame?season=${encodeURIComponent(season)}&type=page`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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

  function setBetLevel(div, entry, level) {
    const k = entryKey({ division: div, leagueName: entry?.leagueName, ownerName: entry?.ownerName });
    const legacyName = safeStr(entry?.ownerName).trim();

    const next = structuredClone(state);
    next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", entriesSavedAt: "", byDivision: {} };
    next.divisionWagers.byDivision = next.divisionWagers.byDivision || {};

    const d = next.divisionWagers.byDivision[div] || {};
    const pot1 = d.pot1 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };
    const pot2 = d.pot2 || { entrants: {}, points: {}, winner: "", winnerKey: "", pool: 0, resolvedAt: "" };

    pot1.entrants = pot1.entrants || {};
    pot2.entrants = pot2.entrants || {};

    delete pot1.entrants[k];
    delete pot2.entrants[k];
    if (legacyName) {
      delete pot1.entrants[legacyName];
      delete pot2.entrants[legacyName];
    }

    if (level === "half") {
      pot1.entrants[k] = true;
    } else if (level === "max") {
      pot1.entrants[k] = true;
      pot2.entrants[k] = true;
    }

    d.pot1 = pot1;
    d.pot2 = pot2;
    next.divisionWagers.byDivision[div] = d;
    setState(next);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setMsg("");
      try {
        const res = await fetch(getWagersLoadUrl(season), { cache: "no-store" });
        const saved = res.ok ? await res.json() : null;
        const data = saved && typeof saved === "object" && "data" in saved ? saved.data : saved;

        if (!cancelled) {
          setState(() => {
            const base = buildEmptyState(season);
            const merged = { ...base, ...(data || {}), season: Number(season) };

            merged.divisionWagers = {
              ...base.divisionWagers,
              ...(merged.divisionWagers || {}),
              entriesSavedAt: safeStr(merged?.divisionWagers?.entriesSavedAt || ""),
            };

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
  }, [state, eligibilityByDivision, wagersByDivision]);

  async function save(next, note) {
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
      setMsg(note || "Saved.");
      return true;
    } catch (e) {
      setMsg(e?.message || "Failed to save.");
      return false;
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

      next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", entriesSavedAt: "", byDivision: {} };
      next.divisionWagers.week = 16;
      next.divisionWagers.entryFee = next.divisionWagers.entryFee || 25;
      next.divisionWagers.byDivision = next.divisionWagers.byDivision || {};
      next.divisionWagers.entriesSavedAt = "";

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

        // if someone is in pot2, they MUST be in pot1
        for (const k of Object.keys(pot2.entrants || {})) pot1.entrants[k] = true;

        next.divisionWagers.byDivision[div] = { ...existing, pot1, pot2 };
      }

      const okSave = await save(next, "Imported Week 15 eligibility.");
      if (okSave) setTab("entries");
    } catch (e) {
      setMsg(e?.message || "Failed to import Week 15 eligibility.");
    } finally {
      setSaving(false);
    }
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

      next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", entriesSavedAt: "", byDivision: {} };
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

      // Auto-seed championship entrants from pot1 winners
      const seeded = [];
      for (const [div, d] of Object.entries(next.divisionWagers.byDivision || {})) {
        const winKey = safeStr(d?.pot1?.winnerKey).trim();
        if (!winKey) continue;
        const ownerName = safeStr(d?.pot1?.winner).trim();
        seeded.push({ entryKey: winKey, ownerName, division: div, wager: 0 });
      }

      next.championship =
        next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", winnerKey: "", pool: 0, bonus: 200 };
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

      const okSave = await save(next, "Resolved Week 16 division wagers and seeded Week 17.");
      if (okSave) setTab("week17");
    } catch (e) {
      setMsg(e?.message || "Failed to resolve Week 16 division wagers.");
    } finally {
      setSaving(false);
    }
  }

  function setChampWager(entryKeyStr, wager) {
    const next = structuredClone(state);
    next.championship =
      next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", winnerKey: "", pool: 0, bonus: 200 };
    next.championship.byDivisionWinner = safeArray(next.championship.byDivisionWinner).map((r) =>
      safeStr(r.entryKey).trim() === entryKeyStr ? { ...r, wager } : r
    );
    setState(next);
  }

  function setChampionshipBonus(bonus) {
    const next = structuredClone(state);
    next.championship =
      next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", winnerKey: "", bonus: 200, poolWagers: 0, pool: 0 };
    const n = Number(bonus);
    next.championship.bonus = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
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

      next.championship =
        next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", winnerKey: "", pool: 0, bonus: 200 };
      next.championship.week = 17;

      const seeded = safeArray(next.championship.byDivisionWinner).filter((r) => safeStr(r?.ownerName).trim());

      const points = {};
      for (const r of seeded) {
        const k = safeStr(r.entryKey).trim();
        const w = Number(r.wager || 0);
        r.wager = Math.max(0, Math.round(w / 50) * 50);
        points[k] = Number(week17Points?.[k] ?? 0);
      }

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

      const poolWagers = poolMain + poolSide1 + poolSide2 - bonus;
      next.championship.poolWagers = poolWagers;
      next.championship.pool = poolWagers + bonus;

      next.championship.pots = {
        main: { label: "Main Pot", minWager: 50, entrants: mainKeys, pool: poolMain, winnerKey: mainWinnerKey, winner: mainWinnerName },
        side1: { label: "Side Pot 1", minWager: 100, entrants: side1Keys, pool: poolSide1, winnerKey: side1WinnerKey, winner: side1WinnerName },
        side2: { label: "Side Pot 2", minWager: 150, entrants: side2Keys, pool: poolSide2, winnerKey: side2WinnerKey, winner: side2WinnerName },
      };

      next.championship.winner = mainWinnerName;
      next.championship.winnerKey = mainWinnerKey;
      next.championship.wouldHaveWonNoBet = wouldHaveWonNoBet;
      next.championship.resolvedAt = nowIso();

      await save(next, "Resolved Week 17 championship.");
    } catch (e) {
      setMsg(e?.message || "Failed to resolve Week 17 championship.");
    } finally {
      setSaving(false);
    }
  }

  async function resetTracker() {
    const ok = window.confirm(
      "Delete this Big Game wager tracker JSON for this season?\n\nThis removes the R2 file entirely so you can start over."
    );
    if (!ok) return;

    if (isLocalhost()) {
      setState(buildEmptyState(season));
      setMsg("Local reset (localhost) — no R2 file to delete.");
      setTab("import");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/biggame-wagers?season=${encodeURIComponent(season)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Delete failed (${res.status})`);
      }

      setState(buildEmptyState(season));
      setMsg("Deleted tracker JSON. Starting over.");
      setTab("import");
    } catch (e) {
      setMsg(e?.message || "Failed to delete tracker JSON.");
    } finally {
      setSaving(false);
    }
  }

  const canResolveW16 = Boolean(Object.keys(eligibilityByDivision || {}).length);
  const canResolveW17 = Boolean(safeArray(state?.championship?.byDivisionWinner).length);

  const steps = useMemo(() => {
    const hasEligibility = Boolean(state?.eligibility?.computedAt) && Object.keys(state?.eligibility?.byDivision || {}).length > 0;
    const entriesSaved = Boolean(safeStr(state?.divisionWagers?.entriesSavedAt || "").trim());
    const resolvedW16 = Boolean(state?.divisionWagers?.resolvedAt);
    const resolvedW17 = Boolean(state?.championship?.resolvedAt);

    return [
      { key: "import", label: "1) Import Eligibility", done: hasEligibility },
      { key: "entries", label: "2) Mark Entries", done: entriesSaved },
      { key: "week16", label: "3) Resolve Week 16", done: resolvedW16 },
      { key: "week17", label: "4) Championship (Week 17)", done: resolvedW17 },
    ];
  }, [state]);

  const activeTab =
    tab === "auto"
      ? state?.championship?.resolvedAt
        ? "week17"
        : state?.divisionWagers?.resolvedAt
        ? "week16"
        : safeStr(state?.divisionWagers?.entriesSavedAt || "").trim()
        ? "week16"
        : state?.eligibility?.computedAt
        ? "entries"
        : "import"
      : tab;

  // Hooks BEFORE any early return
  const week16Resolved = Boolean(state?.divisionWagers?.resolvedAt);

  // Step 3 view: entrants-only (tight layout + pot-specific winner labels)
  const step3ByDivision = useMemo(() => {
    const out = {};
    for (const div of Object.keys(eligibilityByDivision || {})) {
      const elig = safeArray(eligibilityByDivision[div]);
      const d = wagersByDivision?.[div] || {};
      const pot1 = d?.pot1 || {};
      const pot2 = d?.pot2 || {};

      const rows = elig
        .map((e) => {
          const ownerName = safeStr(e?.ownerName).trim();
          const leagueName = safeStr(e?.leagueName).trim();
          const k = entryKey({ division: div, leagueName, ownerName });

          const has1 = Boolean(pot1?.entrants?.[k]);
          const has2 = Boolean(pot2?.entrants?.[k]);

          if (!has1 && !has2) return null;

          const wk16 = has2 ? Number(pot2?.points?.[k] ?? 0) : Number(pot1?.points?.[k] ?? 0);

          const isPot1Winner = safeStr(pot1?.winnerKey).trim() === k;
          const isPot2Winner = safeStr(pot2?.winnerKey).trim() === k;

          return {
            division: div,
            leagueName,
            ownerName,
            k,
            total151: Number(e?.total ?? 0) || 0,
            level: has1 && has2 ? "max" : "half",
            wk16,
            isPot1Winner,
            isPot2Winner,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.total151 - a.total151);

      out[div] = {
        pot1Pool: Number(pot1?.pool || 0),
        pot2Pool: Number(pot2?.pool || 0),
        pot1Winner: safeStr(pot1?.winner || "").trim(),
        pot2Winner: safeStr(pot2?.winner || "").trim(),
        rows,
      };
    }
    return out;
  }, [eligibilityByDivision, wagersByDivision]);

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
            <p className="text-sm text-muted">Mark entrants for the division pots, resolve Week 16, then seed + resolve Week 17 championship.</p>
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

            <PrimaryButton disabled={saving} onClick={resetTracker} tone="danger">
              Delete Tracker JSON
            </PrimaryButton>
          </div>
        </div>

        {msg ? <div className="mt-4 rounded-xl border border-subtle bg-panel/50 px-4 py-3 text-sm text-foreground">{msg}</div> : null}

        <Divider />
        <p className="text-sm text-muted">Use the tabs below to work through the tracker step-by-step.</p>
      </Card>

      <AdminStepTabs steps={steps} activeKey={activeTab} onChange={setTab} />

      {activeTab === "import" ? (
        <Card>
          <h2 className="text-base font-semibold">Step 1 — Import Week 15 league winners</h2>
          <p className="mt-2 text-sm text-muted">Pulls Week 1–15 totals from the leaderboard and picks the highest total in each league.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={importEligibilityWeek15} disabled={saving}>
              Import Week 15 Eligibility
            </PrimaryButton>
          </div>
          {state?.eligibility?.computedAt ? <div className="mt-3 text-xs text-muted">Last import: {new Date(state.eligibility.computedAt).toLocaleString()}</div> : null}
        </Card>
      ) : null}

      {activeTab === "entries" ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold">Step 2 — Mark Entries</h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <SmallBadge>Week 16</SmallBadge>
              {safeStr(state?.divisionWagers?.entriesSavedAt || "").trim() ? (
                <SmallBadge>Entries saved {new Date(state.divisionWagers.entriesSavedAt).toLocaleString()}</SmallBadge>
              ) : null}
            </div>
          </div>

          <p className="mt-2 text-sm text-muted">Toggle who entered Pot #1 and Pot #2. Step 3 will not show “who matters” until Week 16 is resolved.</p>

          <div className="mt-5 space-y-10">
            {Object.keys(eligibilityByDivision || {}).length === 0 ? (
              <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-center text-sm text-muted">Import Week 15 eligibility to begin.</div>
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
                            Pot1 winner: <span className="text-foreground">{state?.divisionWagers?.resolvedAt ? safeStr(pot1?.winner) || "—" : "—"}</span> · Pot2 winner:{" "}
                            <span className="text-foreground">{state?.divisionWagers?.resolvedAt ? safeStr(pot2?.winner) || "—" : "—"}</span>
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
                              <th className="text-center py-2 px-2">Bet</th>
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

                              const has1 = Boolean(pot1?.entrants?.[k] || pot1?.entrants?.[name]);
                              const has2 = Boolean(pot2?.entrants?.[k] || pot2?.entrants?.[name]);
                              const level = has1 && has2 ? "max" : has1 ? "half" : "none";

                              return (
                                <tr key={`${div}:${e.leagueName}:${name}`} className="border-t border-subtle/70">
                                  <td className="py-2 pr-3 text-muted whitespace-nowrap">{e.leagueName}</td>
                                  <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{name}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums text-muted">{Number(e.total || 0).toFixed(2)}</td>

                                  <td className="py-2 px-2 text-center">
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setBetLevel(div, e, level === "half" ? "none" : "half")}
                                        className={`rounded-lg border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                                          level === "half" ? "bg-accent/20 border-accent/40 text-accent" : "bg-panel/40 border-subtle text-muted hover:border-accent/30"
                                        }`}
                                        title="Half Bet (Pot #1 only)"
                                      >
                                        Half
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setBetLevel(div, e, level === "max" ? "none" : "max")}
                                        className={`rounded-lg border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                                          level === "max" ? "bg-primary/20 border-primary/40 text-primary" : "bg-panel/40 border-subtle text-muted hover:border-primary/30"
                                        }`}
                                        title="Max Bet (Pot #1 + Pot #2)"
                                      >
                                        Max
                                      </button>
                                    </div>
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

          <div className="mt-5 flex justify-end gap-2">
            <PrimaryButton
              onClick={async () => {
                const next = structuredClone(state);
                next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", entriesSavedAt: "", byDivision: {} };
                next.divisionWagers.entriesSavedAt = nowIso();
                const okSave = await save(next, "Saved entries.");
                if (okSave) setTab("week16");
              }}
              disabled={saving}
              tone="muted"
            >
              Save Entries
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {activeTab === "week16" ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold">Step 3 — Resolve Week 16</h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <SmallBadge>Week 16</SmallBadge>
              {state?.divisionWagers?.resolvedAt ? <SmallBadge>Resolved {new Date(state.divisionWagers.resolvedAt).toLocaleString()}</SmallBadge> : null}
            </div>
          </div>

          <p className="mt-2 text-sm text-muted">Resolve Week 16 to lock division pot points + winners. Until it’s resolved, this step will not show any managers.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={resolveDivisionWagersWeek16} disabled={saving || !canResolveW16}>
              Resolve Week 16
            </PrimaryButton>
          </div>

          <Divider />

          {!week16Resolved ? (
            <div className="rounded-2xl border border-subtle bg-panel/30 p-5 text-sm text-muted">Nothing to show yet — resolve Week 16 first.</div>
          ) : (
            <div className="space-y-6">
              {Object.keys(step3ByDivision || {})
                .sort((a, b) => a.localeCompare(b))
                .map((div) => {
                  const block = step3ByDivision[div] || {};
                  const rows = safeArray(block.rows);

                  return (
                    <div key={div} className="rounded-2xl border border-subtle bg-panel/20 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.25em] text-muted">Division</div>
                          <div className="mt-1 text-lg font-semibold text-white">{div}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <SmallBadge>Pot1 {fmtMoney(block.pot1Pool || 0)}</SmallBadge>
                          <SmallBadge>Pot2 {fmtMoney(block.pot2Pool || 0)}</SmallBadge>
                        </div>
                      </div>

                      {/* ✅ Tight / not-stretched table */}
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.2em] text-muted">
                              <th className="py-2 pr-4">League</th>
                              <th className="py-2 pr-4">Owner</th>
                              <th className="py-2 pr-4">Bet</th>
                              <th className="py-2 text-right pr-4">W1–15</th>
                              <th className="py-2 text-right">Wk16</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-4 text-center text-sm text-muted">
                                  No entrants marked in this division.
                                </td>
                              </tr>
                            ) : (
                              rows.map((r) => (
                                <tr key={r.k} className="border-t border-subtle/70">
                                  <td className="py-2 pr-4 text-muted whitespace-nowrap">{r.leagueName}</td>
                                  <td className="py-2 pr-4 text-foreground font-medium whitespace-nowrap">
                                    {r.ownerName}
                                    <WinnerPill pot1={r.isPot1Winner} pot2={r.isPot2Winner} />
                                  </td>
                                  <td className="py-2 pr-4 text-muted">
                                    {r.level === "max" ? (
                                      <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                                        Max
                                      </span>
                                    ) : (
                                      <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                                        Half
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-4 text-right tabular-nums text-muted">{Number(r.total151 || 0).toFixed(2)}</td>
                                  <td className="py-2 text-right tabular-nums text-foreground font-semibold">{Number(r.wk16 || 0).toFixed(2)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      ) : null}

      {activeTab === "week17" ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold">Step 4 — Big Game Championship</h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <SmallBadge>Week 17</SmallBadge>
              {state?.championship?.resolvedAt ? <SmallBadge>Resolved {new Date(state.championship.resolvedAt).toLocaleString()}</SmallBadge> : null}
            </div>
          </div>

          <p className="mt-2 text-sm text-muted">
            Seeds from each division’s <span className="text-foreground">Pot #1 winner</span>. Each winner may wager in increments of $50 (0–$150). Resolve Week 17 to lock the champion + pots.
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
              <PrimaryButton onClick={() => save(state, "Saved wagers.")} disabled={saving} tone="muted">
                Save Wagers
              </PrimaryButton>
              <PrimaryButton onClick={resolveChampionshipWeek17} disabled={saving || !canResolveW17}>
                Resolve Week 17
              </PrimaryButton>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}