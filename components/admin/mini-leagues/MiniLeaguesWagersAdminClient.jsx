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
      week: 14,
      byDivision: {},
    },
    week15: {
      week: 15,
      resolvedAt: "",

      // Rules (editable so the public tracker doesn't have magic numbers)
      coin: 30,
      divisionBonus: 30,
      champBonus: 100,
      wagerBonus: 60,

      // decisions: { [entryKey]: { decision: "keep" | "wager" } }
      decisions: {},

      // points: { [entryKey]: number }
      points: {},

      // computed results saved for the public page
      results: {
        wagerPot: { pool: 0, bonus: 60, total: 60, winner: "", winnerKey: "", winnerDivision: "", winnerPts: 0 },
        divisionBonus: {}, // { [division]: { bonus, winner, winnerKey, pts } }
        championship: { bonus: 100, winner: "", winnerKey: "", winnerDivision: "", winnerPts: 0 },
        missedWagers: [],
      },
    },
  };
}

function getMiniLeaguesRoot(leaderboardsJson, season) {
  const seasonObj = leaderboardsJson?.[String(season)] || {};

  // Try several historical keys so this doesn't break if the generator changes naming.
  const candidates = [
    seasonObj.mini_game,
    seasonObj["mini-game"],
    seasonObj.minigame,
    seasonObj.minigame,
    seasonObj.mini_game,
    seasonObj["mini_game"],
  ].filter(Boolean);

  return candidates[0] || null;
}

function computeLeagueWinnersFromLeaderboard(leaderboardsJson, season, upToWeek = 14) {
  const root = getMiniLeaguesRoot(leaderboardsJson, season);
  const owners = safeArray(root?.owners);

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

  // flatten -> by division
  const byDivision = {};
  for (const w of byDivLeague.values()) {
    if (!byDivision[w.division]) byDivision[w.division] = [];
    byDivision[w.division].push(w);
  }
  return byDivision;
}

function getWeekPointsFromLeaderboard(leaderboardsJson, season, week) {
  const root = getMiniLeaguesRoot(leaderboardsJson, season);
  const owners = safeArray(root?.owners);
  const points = {};
  for (const o of owners) {
    const name = safeStr(o?.ownerName).trim();
    const leagueName = safeStr(o?.leagueName).trim();
    const division = safeStr(o?.division).trim();
    if (!name || !leagueName || !division) continue;

    const k = entryKey({ division, leagueName, ownerName: name });
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

function buildLeagueOrderIndex(miniMeta) {
  const rows = safeArray(miniMeta?.rows);
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

function computeResults(state) {
  const wk15 = state.week15 || {};
  const coin = Number(wk15.coin ?? 30) || 30;
  const divisionBonus = Number(wk15.divisionBonus ?? 30) || 30;
  const champBonus = Number(wk15.champBonus ?? 100) || 100;
  const wagerBonus = Number(wk15.wagerBonus ?? 60) || 60;

  const decisions = wk15.decisions || {};
  const points = wk15.points || {};
  const eligibility = state.eligibility?.byDivision || {};

  const allEntries = [];
  for (const div of Object.keys(eligibility)) {
    for (const e of safeArray(eligibility[div])) {
      const leagueName = safeStr(e?.leagueName).trim();
      const ownerName = safeStr(e?.ownerName).trim();
      const k = entryKey({ division: div, leagueName, ownerName });
      const decision = safeStr(decisions?.[k]?.decision || "pending").trim() || "pending";
      allEntries.push({
        division: div,
        leagueName,
        ownerName,
        k,
        decision,
        wk15: Number(points?.[k] ?? 0) || 0,
      });
    }
  }

  const wagerers = allEntries.filter((e) => e.decision === "wager");
  const nonWagerers = allEntries.filter((e) => e.decision !== "wager");

  // Wager pot: pooled coins from wagerers. Winner is top Week 15 points among wagerers.
  const wagerPool = wagerers.length * coin;
  let wagerWinner = null;
  for (const e of wagerers) {
    if (!wagerWinner || e.wk15 > wagerWinner.wk15) wagerWinner = e;
  }
  const wagerMaxPts = wagerWinner ? Number(wagerWinner.wk15 ?? 0) || 0 : 0;

  // Division bonus: top Week 15 points in each division (regardless of wager decision).
  const divWinners = {};
  for (const div of Object.keys(eligibility)) {
    const divEntries = allEntries.filter((e) => e.division === div);
    let best = null;
    for (const e of divEntries) {
      if (!best || e.wk15 > best.wk15) best = e;
    }
    divWinners[div] = {
      bonus: divisionBonus,
      winner: best?.ownerName || "",
      winnerKey: best?.k || "",
      pts: Number(best?.wk15 ?? 0) || 0,
    };
  }

  // Championship bonus: top Week 15 points overall (regardless of wager decision).
  let champWinner = null;
  for (const e of allEntries) {
    if (!champWinner || e.wk15 > champWinner.wk15) champWinner = e;
  }

  // "Should have wagered" hints: if a non-wagerer beat (or tied) the top wagerer, they likely left money on the table.
  const missedWagers = [];
  if (wagerers.length > 0) {
    for (const e of nonWagerers) {
      if (e.wk15 > wagerMaxPts || e.wk15 === wagerMaxPts) {
        const hypotheticalPool = wagerPool + coin; // if they had wagered, the pool increases by their coin
        missedWagers.push({
          k: e.k,
          division: e.division,
          leagueName: e.leagueName,
          ownerName: e.ownerName,
          wk15: Number(e.wk15 ?? 0) || 0,
          reason: e.wk15 > wagerMaxPts ? "would_win" : "could_tie",
          hypotheticalPool,
          hypotheticalTotal: hypotheticalPool + wagerBonus,
          wagerMaxPts,
        });
      }
    }
  }

  return {
    wagerPot: {
      pool: wagerPool,
      bonus: wagerBonus,
      total: wagerPool + wagerBonus,
      winner: wagerWinner?.ownerName || "",
      winnerKey: wagerWinner?.k || "",
      winnerDivision: wagerWinner?.division || "",
      winnerPts: Number(wagerWinner?.wk15 ?? 0) || 0,
    },
    divisionBonus: divWinners,
    championship: {
      bonus: champBonus,
      winner: champWinner?.ownerName || "",
      winnerKey: champWinner?.k || "",
      winnerDivision: champWinner?.division || "",
      winnerPts: Number(champWinner?.wk15 ?? 0) || 0,
    },
    missedWagers,
  };
}

export default function MiniLeaguesWagersAdminClient({ season }) {
  const [state, setState] = useState(() => buildEmptyState(season));
  const [miniMeta, setMiniMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Load Mini Leagues page config (division names, league cards, etc.)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/admin/mini-leagues?season=${encodeURIComponent(season)}&type=page`, {
          cache: "no-store",
        });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setMiniMeta(data);
      } catch {
        if (!cancelled) setMiniMeta(null);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [season]);

  // Load wagers doc
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setMsg("");
      try {
        const res = await fetch(`/api/admin/mini-leagues-wagers?season=${encodeURIComponent(season)}`, {
          cache: "no-store",
        });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) {
          setState(data && typeof data === "object" ? data : buildEmptyState(season));
        }
      } catch {
        if (!cancelled) setState(buildEmptyState(season));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const leagueOrderIndex = useMemo(() => buildLeagueOrderIndex(miniMeta), [miniMeta]);

  const divisions = useMemo(() => {
    const byDivision = state?.eligibility?.byDivision || {};
    const keys = Object.keys(byDivision);
    return keys.sort((a, b) => a.localeCompare(b));
  }, [state]);

  const totalEligibilityCount = useMemo(() => {
    const byDivision = state?.eligibility?.byDivision || {};
    let n = 0;
    for (const div of Object.keys(byDivision)) n += safeArray(byDivision[div]).length;
    return n;
  }, [state]);

  const decisionsCount = useMemo(() => {
    const d = state?.week15?.decisions || {};
    let keep = 0;
    let wager = 0;
    for (const k of Object.keys(d)) {
      if (d[k]?.decision === "keep") keep++;
      if (d[k]?.decision === "wager") wager++;
    }
    return { keep, wager };
  }, [state]);

  async function save(nextState, note) {
    setSaving(true);
    setMsg("");
    try {
      const payload = { ...nextState, updatedAt: nowIso() };
      const res = await fetch(`/api/admin/mini-leagues-wagers?season=${encodeURIComponent(season)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const data = await res.json();
      setState(data && typeof data === "object" ? data : payload);
      setMsg(note || "Saved.");
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function importEligibility() {
    setSaving(true);
    setMsg("");
    try {
      const url = state?.source?.leaderboardUrl || LEADERBOARD_URL_BY_SEASON(season);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Leaderboard fetch failed (${res.status})`);

      const etag = res.headers.get("etag") || "";
      const json = await res.json();

      const byDivision = computeLeagueWinnersFromLeaderboard(json, season, 14);

      // Keep existing decisions where possible (match by entryKey)
      const nextDecisions = { ...(state?.week15?.decisions || {}) };
      for (const div of Object.keys(byDivision)) {
        for (const e of safeArray(byDivision[div])) {
          const k = entryKey(e);
          if (!nextDecisions[k]) nextDecisions[k] = { decision: "pending" };
        }
      }

      const next = {
        ...state,
        source: { ...state.source, leaderboardUrl: url, lastFetchedAt: nowIso(), leaderboardEtag: etag },
        eligibility: { computedAt: nowIso(), week: 14, byDivision },
        week15: {
          ...state.week15,
          decisions: nextDecisions,
          // reset resolution whenever we re-import eligibility
          resolvedAt: "",
          results: { ...state.week15?.results, divisionBonus: {}, wagerPot: { ...state.week15?.results?.wagerPot }, championship: { ...state.week15?.results?.championship } },
        },
      };

      await save(next, "Imported Week 14 league winners.");
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function setDecision(k, decision) {
    setState((prev) => {
      const next = { ...prev };
      next.week15 = { ...next.week15, decisions: { ...(next.week15?.decisions || {}) } };
      next.week15.decisions[k] = { decision };
      return next;
    });
  }

  async function pullWeek15Points() {
    setSaving(true);
    setMsg("");
    try {
      const url = state?.source?.leaderboardUrl || LEADERBOARD_URL_BY_SEASON(season);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Leaderboard fetch failed (${res.status})`);
      const etag = res.headers.get("etag") || "";
      const json = await res.json();

      const points = getWeekPointsFromLeaderboard(json, season, 15);
      const next = {
        ...state,
        source: { ...state.source, leaderboardUrl: url, lastFetchedAt: nowIso(), leaderboardEtag: etag },
        week15: { ...state.week15, points },
      };
      await save(next, "Pulled Week 15 points.");
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function resolveWeek15() {
    const results = computeResults(state);
    const next = {
      ...state,
      week15: { ...state.week15, resolvedAt: nowIso(), results },
    };
    await save(next, "Resolved Week 15 results.");
  }

  async function restoreBackup() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/mini-leagues-wagers-backup?season=${encodeURIComponent(season)}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Restore failed (${res.status})`);
      const data = await res.json();
      setState(data && typeof data === "object" ? data : buildEmptyState(season));
      setMsg("Restored backup.");
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading…</p>
      </Card>
    );
  }

  const coin = Number(state?.week15?.coin ?? 30) || 30;
  const wagerBonus = Number(state?.week15?.wagerBonus ?? 60) || 60;
  const divisionBonus = Number(state?.week15?.divisionBonus ?? 30) || 30;
  const champBonus = Number(state?.week15?.champBonus ?? 100) || 100;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SmallBadge>Mini Leagues</SmallBadge>
              <SmallBadge>Season {String(season)}</SmallBadge>
            </div>
            <p className="mt-3 text-sm text-muted">
              Import Week 14 league winners, set each winner to <b>Keep</b> or <b>Wager</b>, then pull Week 15 points and
              resolve.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/wager-trackers" className="btn btn-secondary">
              ← Wager Trackers
            </Link>
            <Link href="/mini-leagues/wagers" className="btn btn-primary">
              View Public Page
            </Link>
          </div>
        </div>

        {msg ? (
          <p className={`mt-4 text-sm ${String(msg).startsWith("Error") ? "text-rose-200" : "text-emerald-200"}`}>{msg}</p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white">Step 1 — Import Week 14 League Winners</h2>
        <p className="mt-2 text-sm text-muted">
          Uses the leaderboard feed to find each league’s top points from Weeks 1–14.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton disabled={saving} onClick={importEligibility}>
            Import Eligibility
          </PrimaryButton>
          <PrimaryButton disabled={saving} tone="muted" onClick={restoreBackup}>
            Restore Week 14 Backup
          </PrimaryButton>
        </div>

        <Divider />

        <div className="flex flex-wrap gap-3 text-sm text-muted">
          <div>Eligible Entries: <span className="text-foreground font-semibold">{totalEligibilityCount}</span></div>
          <div>Keep: <span className="text-foreground font-semibold">{decisionsCount.keep}</span></div>
          <div>Wager: <span className="text-foreground font-semibold">{decisionsCount.wager}</span></div>
        </div>

        {safeArray(state?.week15?.results?.missedWagers).length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-200">Wager Misses</div>
            <p className="mt-2 text-sm text-muted">
              These entries did not wager, but their Week 15 score was strong enough that they {` `}
              {safeArray(state?.week15?.results?.missedWagers).some((m) => m?.reason === "would_win") ? "would have won" : "could have tied for"} the top wager score.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              {safeArray(state?.week15?.results?.missedWagers)
                .slice()
                .sort((a, b) => (Number(b?.wk15 ?? 0) || 0) - (Number(a?.wk15 ?? 0) || 0))
                .map((m) => (
                  <div key={safeStr(m?.k)}>
                    <span className="text-foreground font-semibold">{safeStr(m?.ownerName)}</span>{" "}
                    <span className="text-muted">({safeStr(m?.division)} • {safeStr(m?.leagueName)})</span>{" "}
                    <span className="text-muted">— {Number(m?.wk15 ?? 0) || 0} pts</span>
                    <span className="text-amber-200">
                      {" "}
                      {safeStr(m?.reason) === "would_win" ? "→ would have won" : "→ could have tied for"} {fmtMoney(Number(m?.hypotheticalTotal ?? 0) || 0)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white">Step 2 — Rules (Editable)</h2>
        <p className="mt-2 text-sm text-muted">These values are stored in the JSON so the public page stays in sync.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-sm text-muted">
            Coin
            <input
              className="mt-1 w-full rounded-xl border border-subtle bg-panel px-3 py-2 text-sm text-foreground"
              type="number"
              value={coin}
              onChange={(e) => setState((p) => ({ ...p, week15: { ...p.week15, coin: Number(e.target.value) || 0 } }))}
            />
          </label>
          <label className="text-sm text-muted">
            Wager Bonus
            <input
              className="mt-1 w-full rounded-xl border border-subtle bg-panel px-3 py-2 text-sm text-foreground"
              type="number"
              value={wagerBonus}
              onChange={(e) => setState((p) => ({ ...p, week15: { ...p.week15, wagerBonus: Number(e.target.value) || 0 } }))}
            />
          </label>
          <label className="text-sm text-muted">
            Division Bonus
            <input
              className="mt-1 w-full rounded-xl border border-subtle bg-panel px-3 py-2 text-sm text-foreground"
              type="number"
              value={divisionBonus}
              onChange={(e) => setState((p) => ({ ...p, week15: { ...p.week15, divisionBonus: Number(e.target.value) || 0 } }))}
            />
          </label>
          <label className="text-sm text-muted">
            Championship Bonus
            <input
              className="mt-1 w-full rounded-xl border border-subtle bg-panel px-3 py-2 text-sm text-foreground"
              type="number"
              value={champBonus}
              onChange={(e) => setState((p) => ({ ...p, week15: { ...p.week15, champBonus: Number(e.target.value) || 0 } }))}
            />
          </label>
        </div>

        <div className="mt-4">
          <PrimaryButton disabled={saving} onClick={() => save(state, "Saved rules.")}>Save Rules</PrimaryButton>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white">Step 3 — Decisions (Keep vs Wager)</h2>
        <p className="mt-2 text-sm text-muted">
          Everyone keeps their {fmtMoney(coin)} coin if they don’t wager. The Division (+{fmtMoney(divisionBonus)}) and Championship (+{fmtMoney(champBonus)}) bonuses go to the top Week 15 points (regardless of wager). Wagerers also compete for the pooled pot + +{fmtMoney(wagerBonus)}.
        </p>

        <Divider />

        {divisions.length === 0 ? (
          <p className="text-sm text-muted">No eligibility yet — import Week 14 winners first.</p>
        ) : (
          <div className="space-y-6">
            {divisions.map((div) => {
              const elig = sortEligByDisplayOrder(state?.eligibility?.byDivision?.[div] || [], div, leagueOrderIndex);
              return (
                <div key={div} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">{div}</h3>
                    <SmallBadge>{elig.length} leagues</SmallBadge>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-[0.2em] text-muted">
                          <th className="text-left py-2 pr-4">League</th>
                          <th className="text-left py-2 pr-4">Owner</th>
                          <th className="text-right py-2 pr-4">Wk1-14</th>
                          <th className="text-center py-2">Decision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle">
                        {elig.map((e) => {
                          const k = entryKey({ division: div, leagueName: e.leagueName, ownerName: e.ownerName });
                          const cur = safeStr(state?.week15?.decisions?.[k]?.decision || "pending").trim() || "pending";
                          return (
                            <tr key={k}>
                              <td className="py-2 pr-4 text-foreground">{safeStr(e?.leagueName).trim()}</td>
                              <td className="py-2 pr-4 text-foreground">{safeStr(e?.ownerName).trim()}</td>
                              <td className="py-2 pr-4 text-right text-muted">{Number(e?.total ?? 0) || 0}</td>
                              <td className="py-2 text-center">
                                <div className="inline-flex rounded-xl border border-subtle bg-panel/60 p-1">
                                  <button
                                    type="button"
                                    onClick={() => setDecision(k, "keep")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${cur === "keep" ? "bg-cyan-500/15 text-cyan-100 border border-cyan-400/30" : "text-muted hover:text-white"}`}
                                  >
                                    Keep
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDecision(k, "wager")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${cur === "wager" ? "bg-amber-500/15 text-amber-100 border border-amber-400/30" : "text-muted hover:text-white"}`}
                                  >
                                    Wager
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDecision(k, "pending")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${cur === "pending" ? "bg-panel text-foreground border border-subtle" : "text-muted hover:text-white"}`}
                                  >
                                    —
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <PrimaryButton disabled={saving} onClick={() => save(state, "Saved decisions.")}>Save Decisions</PrimaryButton>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white">Step 4 — Pull Week 15 Points + Resolve</h2>
        <p className="mt-2 text-sm text-muted">Pull Week 15 points from the leaderboard, then resolve winners.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton disabled={saving} onClick={pullWeek15Points}>Pull Week 15 Points</PrimaryButton>
          <PrimaryButton disabled={saving} tone="muted" onClick={resolveWeek15}>Resolve Week 15</PrimaryButton>
        </div>

        <Divider />

        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-xl border border-subtle bg-panel/60 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Wager Pot</div>
            <div className="mt-1 text-foreground font-semibold">{fmtMoney(state?.week15?.results?.wagerPot?.total ?? (decisionsCount.wager * coin + wagerBonus))}</div>
            <div className="mt-1 text-xs text-muted">
              Winner: {safeStr(state?.week15?.results?.wagerPot?.winner).trim() || "—"}
            </div>
          </div>
          <div className="rounded-xl border border-subtle bg-panel/60 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Championship Bonus</div>
            <div className="mt-1 text-foreground font-semibold">{fmtMoney(champBonus)}</div>
            <div className="mt-1 text-xs text-muted">
              Winner: {safeStr(state?.week15?.results?.championship?.winner).trim() || "—"}
            </div>
          </div>
          <div className="rounded-xl border border-subtle bg-panel/60 p-3">
            <div className="text-xs uppercase tracking-[0.2em] text-muted">Resolved At</div>
            <div className="mt-1 text-xs text-muted">{state?.week15?.resolvedAt ? new Date(state.week15.resolvedAt).toLocaleString() : "—"}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
