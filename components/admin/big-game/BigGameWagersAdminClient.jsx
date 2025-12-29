"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
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
      byDivisionWinner: [], // [{ ownerName, division, wager }]
      points: {},
      winner: "",
      pool: 0,
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

  // key: "division::leagueName::ownerName" -> points
  const points = {};

  for (const o of owners) {
    const ownerName = safeStr(o?.ownerName).trim();
    const leagueName = safeStr(o?.leagueName).trim();
    const division = safeStr(o?.division).trim();
    if (!ownerName || !leagueName || !division) continue;

    const v = o?.weekly?.[String(week)] ?? o?.weekly?.[week];
    const n = typeof v === "number" ? v : parseFloat(v);
    const pts = Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;

    const entryId = `${division}::${leagueName}::${ownerName}`;
    points[entryId] = pts;
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

  // key: "Division|||League Name" -> order number
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


export default function BigGameWagersAdminClient({ season }) {
  const [state, setState] = useState(() => buildEmptyState(season));
  const [bigGameMeta, setBigGameMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const DRAFT_KEY = `biggame-wagers-draft:${season}`;



  // Load local draft once (after first render)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && Number(draft.season) === Number(season)) {
        setState((prev) => ({ ...prev, ...draft }));
        setMsg("Loaded local draft (unsaved).");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  // Persist draft on every change (so refresh never loses work)
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {}
  }, [state, season]);


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
        const data = res.ok ? await res.json() : null;
        if (!cancelled) {
          setState((prev) => {
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

  const divisions = useMemo(() => {
    const list = safeArray(bigGameMeta?.rows);
    // theme_name is division in your biggame JSON, name is league name
    const by = new Map();
    for (const r of list) {
      const div = safeStr(r?.theme_name).trim();
      if (!div) continue;
      if (!by.has(div)) by.set(div, []);
      by.get(div).push(r);
    }
    return Array.from(by.keys()).sort((a, b) => a.localeCompare(b));
  }, [bigGameMeta]);
  const leagueOrderIndex = useMemo(() => buildLeagueOrderIndex(bigGameMeta), [bigGameMeta]);

  const eligibilityByDivision = state?.eligibility?.byDivision || {};
  const wagersByDivision = state?.divisionWagers?.byDivision || {};

  const derived = useMemo(() => {
    // derive divisional pools & winners + banks for display
    const entryFee = Number(state?.divisionWagers?.entryFee || 25);

    const out = {
      divisions: {},
      championship: {
        pool: 0,
        winner: safeStr(state?.championship?.winner).trim(),
      },
    };

    for (const div of Object.keys(eligibilityByDivision)) {
      const elig = safeArray(eligibilityByDivision[div]);
      const w = wagersByDivision?.[div] || {};
      const pot1Entrants = w?.pot1?.entrants || {};
      const pot2Entrants = w?.pot2?.entrants || {};

      const eligIds = elig
        .map((e) => safeStr(e.entryId || `${safeStr(e.division || div)}::${safeStr(e.leagueName)}::${safeStr(e.ownerName)}`))
        .filter(Boolean);

      const pot1Count = eligIds.filter((id) => pot1Entrants[id]).length;
      const pot2Count = eligIds.filter((id) => pot2Entrants[id]).length;

      const pot1Pool = pot1Count * entryFee;
      const pot2Pool = pot2Count * entryFee;

      out.divisions[div] = {
        eligibleCount: elig.length,
        pot1Count,
        pot2Count,
        pot1Pool,
        pot2Pool,
        pot1Winner: safeStr(w?.pot1?.winner).trim(),
        pot2Winner: safeStr(w?.pot2?.winner).trim(),
      };
    }

    // championship pool is stored already
    out.championship.pool = Number(state?.championship?.pool || 0);

    return out;
  }, [state, eligibilityByDivision, wagersByDivision]);

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
      // Server responds as { ok: true, data: <full doc> }.
      // Older clients expected the raw doc. Support both shapes.
      const saved = await res.json().catch(() => payload);
      const doc = saved && typeof saved === "object" && "data" in saved ? saved.data : saved;
      setState((prev) => ({ ...prev, ...(doc || payload) }));
      setMsg("Saved.");
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
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

      // Merge: keep existing pot entrant selections if possible.
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

      // Ensure division wager buckets exist + enforce pot2 implies pot1
      next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", byDivision: {} };
      next.divisionWagers.week = 16;
      next.divisionWagers.entryFee = next.divisionWagers.entryFee || 25;
      next.divisionWagers.byDivision = next.divisionWagers.byDivision || {};

      for (const div of Object.keys(byDivision)) {
        const existing = next.divisionWagers.byDivision[div] || {};
        const pot1 = existing.pot1 || { entrants: {}, points: {}, winner: "", pool: 0, resolvedAt: "" };
        const pot2 = existing.pot2 || { entrants: {}, points: {}, winner: "", pool: 0, resolvedAt: "" };

        // Remove entrants that are no longer eligible (keyed by entryId so duplicate owners can be handled per-league)
        const eligible = byDivision[div] || [];
        const eligibleIds = new Set(
          eligible.map((e) => e.entryId || `${safeStr(e.division)}::${safeStr(e.leagueName)}::${safeStr(e.ownerName)}`)
        );

        // Back-compat: if stored keys were just ownerName, migrate only when unambiguous (owner appears once in this division)
        const ownerToSingleEntryId = (() => {
          const map = new Map();
          const counts = new Map();
          for (const e of eligible) {
            const owner = safeStr(e.ownerName);
            const id = e.entryId || `${safeStr(e.division)}::${safeStr(e.leagueName)}::${safeStr(e.ownerName)}`;
            counts.set(owner, (counts.get(owner) || 0) + 1);
            map.set(owner, id);
          }
          const out = new Map();
          for (const [owner, id] of map.entries()) {
            if ((counts.get(owner) || 0) === 1) out.set(owner, id);
          }
          return out;
        })();

        const prune = (obj) => {
          const out = {};
          for (const [k, v] of Object.entries(obj || {})) {
            if (!v) continue;

            // already entryId
            if (eligibleIds.has(k)) {
              out[k] = true;
              continue;
            }

            // legacy ownerName key -> migrate if unambiguous
            const migrated = ownerToSingleEntryId.get(k);
            if (migrated && eligibleIds.has(migrated)) {
              out[migrated] = true;
            }
          }
          return out;
        };

        pot1.entrants = prune(pot1.entrants);
        pot2.entrants = prune(pot2.entrants);

        // enforce pot2 => pot1
        for (const id of Object.keys(pot2.entrants)) {
          pot1.entrants[id] = true;
        }

        next.divisionWagers.byDivision[div] = { ...existing, pot1, pot2 };
      }

      await save(next);
    } catch (e) {
      setMsg(e?.message || "Failed to import Week 15 eligibility.");
    } finally {
      setSaving(false);
    }
  }

  function toggleEntrant(div, pot, entryId, checked) {
    const id = safeStr(entryId).trim();
    if (!id) return;

    const next = structuredClone(state);
    next.divisionWagers = next.divisionWagers || { week: 16, entryFee: 25, resolvedAt: "", byDivision: {} };
    next.divisionWagers.byDivision = next.divisionWagers.byDivision || {};

    const d = next.divisionWagers.byDivision[div] || {};
    const p = d[pot] || { entrants: {}, points: {}, winner: "", pool: 0, resolvedAt: "" };

    p.entrants = p.entrants || {};
    if (checked) p.entrants[id] = true;
    else delete p.entrants[id];

    // enforce pot2 => pot1
    if (pot === "pot2" && checked) {
      d.pot1 = d.pot1 || { entrants: {}, points: {}, winner: "", pool: 0, resolvedAt: "" };
      d.pot1.entrants = d.pot1.entrants || {};
      d.pot1.entrants[id] = true;
    }

    // pot1 unchecked -> pot2 must also be removed
    if (pot === "pot1" && !checked) {
      d.pot2 = d.pot2 || { entrants: {}, points: {}, winner: "", pool: 0, resolvedAt: "" };
      d.pot2.entrants = d.pot2.entrants || {};
      delete d.pot2.entrants[id];
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
        const eligRaw = safeArray(next.eligibility.byDivision[div]);

        // Ensure each eligibility row has a stable entryId so duplicate owners can be managed per-league
        const elig = eligRaw
          .map((e) => ({
            ...e,
            entryId: safeStr(e?.entryId || `${safeStr(e?.division || div)}::${safeStr(e?.leagueName)}::${safeStr(e?.ownerName)}`),
          }))
          .filter((e) => e.entryId && safeStr(e.ownerName));

        const entriesInOrder = elig; // keep deterministic order as provided

        next.divisionWagers.byDivision = next.divisionWagers.byDivision || {};
        const d = next.divisionWagers.byDivision[div] || {};
        const pot1 = d.pot1 || { entrants: {}, points: {}, winner: "", pool: 0, resolvedAt: "" };
        const pot2 = d.pot2 || { entrants: {}, points: {}, winner: "", pool: 0, resolvedAt: "" };

        const pot1Entrants = entriesInOrder.filter((e) => pot1?.entrants?.[safeStr(e.entryId)]);
        const pot2Entrants = entriesInOrder.filter((e) => pot2?.entrants?.[safeStr(e.entryId)]);


        const pickWinner = (entrantEntries) => {
          const scored = (entrantEntries || [])
            .map((e) => {
              const owner = safeStr(e.ownerName);
              const entryId = safeStr(e.entryId);
              const pts = Number(week16Points?.[entryId] ?? 0);
              return {
                entryId: safeStr(e.entryId),
                ownerName: owner,
                leagueName: safeStr(e.leagueName),
                pts,
              };
            })
            .sort((a, b) => {
              if (b.pts !== a.pts) return b.pts - a.pts;
              const la = a.leagueName.toLowerCase();
              const lb = b.leagueName.toLowerCase();
              if (la !== lb) return la.localeCompare(lb);
              return a.entryId.localeCompare(b.entryId);
            });

          return scored[0] || null;
        };

        pot1.points = {};
        for (const e of pot1Entrants) {
          pot1.points[e.entryId] = Number(week16Points?.[safeStr(e.entryId)] ?? 0);
        }
        pot2.points = {};
        for (const e of pot2Entrants) {
          pot2.points[e.entryId] = Number(week16Points?.[safeStr(e.entryId)] ?? 0);
        }

        pot1.pool = pot1Entrants.length * entryFee;
        pot2.pool = pot2Entrants.length * entryFee;

        const w1 = pickWinner(pot1Entrants);
        const w2 = pickWinner(pot2Entrants);
        pot1.winner = w1 ? safeStr(w1.ownerName) : "";
        pot2.winner = w2 ? safeStr(w2.ownerName) : "";

        pot1.resolvedAt = nowIso();
        pot2.resolvedAt = nowIso();

        next.divisionWagers.byDivision[div] = { ...d, pot1, pot2 };
      }

      // Auto-seed championship entrants from pot1 winners
      const seeded = [];
        for (const [div, d] of Object.entries(next.divisionWagers.byDivision || {})) {
          const pot1 = d?.pot1 || {};
          const winnerName = safeStr(pot1?.winner).trim();
          if (!winnerName) continue;

          // Find which eligibility entry (league) that winner came from (highest wk16 among winnerName in pot1 entrants)
          const elig = safeArray(next.eligibility?.byDivision?.[div]).map((e) => ({
            ...e,
            entryId: safeStr(e?.entryId || `${safeStr(e?.division || div)}::${safeStr(e?.leagueName)}::${safeStr(e?.ownerName)}`),
          }));

          const pot1EntrantEntries = elig.filter((e) => pot1?.entrants?.[safeStr(e.entryId)]);
          const winnerEntries = pot1EntrantEntries.filter((e) => safeStr(e.ownerName).trim() === winnerName);

          // pick the entry with the best recorded wk16 (fallback: first)
          winnerEntries.sort((a, b) => {
            const pa = Number(pot1?.points?.[safeStr(a.entryId)] ?? 0);
            const pb = Number(pot1?.points?.[safeStr(b.entryId)] ?? 0);
            return pb - pa;
          });

          const winnerEntry = winnerEntries[0] || null;

          seeded.push({
            division: div,
            ownerName: winnerName,
            leagueName: winnerEntry ? safeStr(winnerEntry.leagueName) : "",
            entryId: winnerEntry ? safeStr(winnerEntry.entryId) : `${div}::${winnerName}`, // fallback but should almost always exist
            wager: 0,
          });
        }

      next.championship = next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", pool: 0 };
      next.championship.week = 17;
      // preserve existing wagers if the same owner is still present
      const prevWagers = new Map(safeArray(next.championship.byDivisionWinner).map((r) => [r.ownerName, Number(r.wager || 0)]));
      next.championship.byDivisionWinner = seeded.map((r) => ({ ...r, wager: prevWagers.get(r.ownerName) || 0 }));
      next.championship.points = {};
      next.championship.winner = "";
      next.championship.pool = 0;
      next.championship.resolvedAt = "";

      await save(next);
    } catch (e) {
      setMsg(e?.message || "Failed to resolve Week 16 division wagers.");
    } finally {
      setSaving(false);
    }
  }

  function setChampWager(ownerName, wager) {
    const next = structuredClone(state);
    next.championship = next.championship || { week: 17, resolvedAt: "", byDivisionWinner: [], points: {}, winner: "", pool: 0 };
    next.championship.byDivisionWinner = safeArray(next.championship.byDivisionWinner).map((r) =>
      r.ownerName === ownerName ? { ...r, wager } : r
    );
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
      const week17Points = getWeekPointsFromLeaderboard(data, season, 17); // this returns entryId -> pts already

      const entrants = safeArray(next.championship.byDivisionWinner).filter((r) => safeStr(r?.entryId).trim());
      const points = {};
      let pool = 0;

      for (const r of entrants) {
        const entryId = safeStr(r.entryId).trim();
        const ownerName = safeStr(r.ownerName).trim();

        const w = Number(r.wager || 0);
        const wNorm = Math.max(0, Math.round(w / 50) * 50);
        r.wager = wNorm;

        pool += wNorm;

        // store points by entryId (stable even if names duplicate)
        points[entryId] = Number(week17Points?.[entryId] ?? 0);

        // keep ownerName present for display
        r.ownerName = ownerName;
      }


      let winnerEntryId = "";
      let best = -Infinity;

      for (const [entryId, pts] of Object.entries(points)) {
        if (pts > best) {
          best = pts;
          winnerEntryId = entryId;
        }
      }

      // store both winnerEntryId and winner name for display
      const winnerRow = entrants.find((r) => safeStr(r.entryId).trim() === winnerEntryId);
      next.championship.winnerEntryId = winnerEntryId;
      next.championship.winner = winnerRow ? safeStr(winnerRow.ownerName) : "";
      next.championship.byDivisionWinner = entrants;
      next.championship.points = points;
      next.championship.pool = pool;
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
              This page is designed so the only manual work is checking who entered each wager. Everything else can be
              pulled from the leaderboard JSON with a button press.
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
            <p className="mt-2 text-xs text-muted">
              Pulls Week 1–15 totals from the leaderboard and picks the highest total in each league.
            </p>
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
            <p className="mt-2 text-xs text-muted">
              Pot #2 requires Pot #1. Checking Pot #2 will automatically check Pot #1.
            </p>
            <div className="mt-3 text-xs text-muted">
              Entry fee: <span className="text-foreground">{fmtMoney(state?.divisionWagers?.entryFee || 25)}</span> per pot.
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Step 3</div>
            <div className="mt-1 font-semibold">Resolve Week 16 & Week 17</div>
            <p className="mt-2 text-xs text-muted">
              Week 16 determines division pot winners. Week 17 determines the overall Big Game champion.
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

      {/* Division entry table(s) */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold">Division Wagers</h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            <SmallBadge>Week 16</SmallBadge>
            {state?.divisionWagers?.resolvedAt ? <SmallBadge>Resolved {new Date(state.divisionWagers.resolvedAt).toLocaleString()}</SmallBadge> : null}
          </div>
        </div>

        <p className="mt-2 text-sm text-muted">
          Each division shows eligible league winners (based on Week 1–15 totals). Toggle who entered Pot #1 and Pot #2.
          Resolving Week 16 locks in points + winners.
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
                const elig = safeArray(eligibilityByDivision[div])
                .slice()
                .sort((a, b) => {
                  const aDiv = safeStr(a?.division || div).trim();
                  const bDiv = safeStr(b?.division || div).trim();
                  const aLeague = safeStr(a?.leagueName).trim();
                  const bLeague = safeStr(b?.leagueName).trim();

                  const aKey = `${aDiv}|||${aLeague}`.toLowerCase();
                  const bKey = `${bDiv}|||${bLeague}`.toLowerCase();

                  const ao = leagueOrderIndex.get(aKey) ?? 999999;
                  const bo = leagueOrderIndex.get(bKey) ?? 999999;

                  if (ao !== bo) return ao - bo;

                  // tie-breakers
                  const ln = aLeague.localeCompare(bLeague);
                  if (ln !== 0) return ln;

                  return safeStr(a?.ownerName).trim().localeCompare(safeStr(b?.ownerName).trim());
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
                          <SmallBadge>Pot1 {derived.divisions?.[div]?.pot1Count || 0} ({fmtMoney(derived.divisions?.[div]?.pot1Pool || 0)})</SmallBadge>
                          <SmallBadge>Pot2 {derived.divisions?.[div]?.pot2Count || 0} ({fmtMoney(derived.divisions?.[div]?.pot2Pool || 0)})</SmallBadge>
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
                            const entryId = safeStr(
                              e.entryId || `${safeStr(e.division || div)}::${safeStr(e.leagueName)}::${safeStr(e.ownerName)}`
                            );

                            const wk16 = pot1?.points?.[entryId] ?? pot2?.points?.[entryId];
                            const wk16Num = typeof wk16 === "number" ? wk16 : parseFloat(wk16);
                            const wk16Show = Number.isNaN(wk16Num) ? "" : wk16Num.toFixed(2);

                            return (
                              <tr key={entryId} className="border-t border-subtle/70">
                                <td className="py-2 pr-3 text-muted whitespace-nowrap">{e.leagueName}</td>
                                <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{name}</td>
                                <td className="py-2 pr-3 text-right tabular-nums text-muted">
                                  {Number(e.total || 0).toFixed(2)}
                                </td>

                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(pot1?.entrants?.[entryId])}
                                    onChange={(ev) => toggleEntrant(div, "pot1", entryId, ev.target.checked)}
                                  />
                                </td>

                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(pot2?.entrants?.[entryId])}
                                    onChange={(ev) => toggleEntrant(div, "pot2", entryId, ev.target.checked)}
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
                      <div>
                        Resolved: {pot1?.resolvedAt ? new Date(pot1.resolvedAt).toLocaleString() : "—"}
                      </div>
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
          By default, this seeds from each division&apos;s <span className="text-foreground">Pot #1 winner</span>. Each winner may wager
          in increments of $50 (0–$150). Resolve Week 17 to lock the champion + pool.
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
                  const entryId = safeStr(r?.entryId);
                  const pts = state?.championship?.points?.[entryId];
                  const ptsNum = typeof pts === "number" ? pts : parseFloat(pts);

                  return (
                    <tr key={entryId} className="border-t border-subtle/70">
                      <td className="py-2 pr-3 text-muted whitespace-nowrap">{div}</td>
                      <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        <div className="inline-flex items-center justify-end gap-2">
                          {[0, 50, 100, 150].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setChampWager(name, amt)}
                              className={`rounded-lg border px-2 py-1 text-xs transition ${Number(r?.wager || 0) === amt ? "border-accent/60 bg-accent/10 text-accent" : "border-subtle bg-panel text-muted hover:border-accent/40"}`}
                            >
                              {amt === 0 ? "—" : fmtMoney(amt)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted">
                        {Number.isNaN(ptsNum) ? "" : ptsNum.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted">
            Pool: <span className="text-foreground font-semibold">{fmtMoney(state?.championship?.pool || 0)}</span> · Winner:{" "}
            <span className="text-foreground font-semibold">{safeStr(state?.championship?.winner) || "—"}</span>
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
