"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminStepTabs from "../AdminStepTabs";
import { safeArray, safeStr } from "@/lib/safe";

function isLocalhost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

function getMiniWagersLoadUrl(season) {
  // local dev override: static JSON served from /public
  if (isLocalhost()) return "/wagers/mini-leagues.json";

  // normal behavior: load from admin API
  return `/api/admin/mini-leagues-wagers?season=${encodeURIComponent(season)}`;
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
      week: 14,
      byDivision: {},
    },
    week15: {
      week: 15,
      resolvedAt: "",

      // ✅ explicit step completion timestamps (for AdminStepTabs checkmarks)
      rulesSavedAt: "",
      decisionsSavedAt: "",

      // Rules (editable so the public tracker doesn't have magic numbers)
      coin: 30,
      divisionBonus: 30,
      champBonus: 100,
      wagerBonus: 60,

      // decisions: { [entryKey]: { decision: "keep" | "wager" | "pending" } }
      decisions: {},

      // points: { [entryKey]: number }
      points: {},

      // computed results saved for the public page
      results: {
        wagerPot: { pool: 0, bonus: 60, total: 60, winner: "", winnerKey: "", winnerDivision: "", winnerPts: 0 },
        divisionBonus: {}, // { [division]: { bonus, winner, winnerKey, pts } }
        championship: { bonus: 100, winner: "", winnerKey: "", winnerDivision: "", winnerPts: 0 },
        wagerMisses: [],
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

function WinnerTag({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
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

// Sorting with NO miniMeta dependency:
// - leagueName ASC
// - ownerName ASC
function sortEligDefault(elig) {
  return safeArray(elig)
    .slice()
    .sort((a, b) => {
      const aLeague = safeStr(a?.leagueName).trim();
      const bLeague = safeStr(b?.leagueName).trim();
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
      const decision = safeStr(decisions?.[k]?.decision || "pending").trim();
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
  const keepers = allEntries.filter((e) => e.decision === "keep");
  const everyone = allEntries;

  const wagerPool = wagerers.length * coin;
  let wagerWinner = null;
  for (const e of wagerers) {
    if (!wagerWinner || e.wk15 > wagerWinner.wk15) wagerWinner = e;
  }

  const divWinners = {};
  for (const div of Object.keys(eligibility)) {
    const divEntries = everyone.filter((e) => e.division === div);
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

  let champWinner = null;
  for (const e of everyone) {
    if (!champWinner || e.wk15 > champWinner.wk15) champWinner = e;
  }

  const wagerTopPts = Number(wagerWinner?.wk15 ?? 0) || 0;
  const wagerMisses = keepers
    .filter((e) => e.wk15 >= wagerTopPts && wagerers.length > 0)
    .sort((a, b) => b.wk15 - a.wk15);

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
    wagerMisses: wagerMisses.map((e) => ({
      ownerName: e.ownerName,
      division: e.division,
      leagueName: e.leagueName,
      key: e.k,
      wk15: e.wk15,
      wouldBeatTopWagerer: e.wk15 > wagerTopPts,
    })),
  };
}

export default function MiniLeaguesWagersAdminClient({ season }) {
  const [state, setState] = useState(() => buildEmptyState(season));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("auto");

  // Load wagers doc
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setMsg("");
      try {
        const res = await fetch(getMiniWagersLoadUrl(season), { cache: "no-store" });
        const saved = res.ok ? await res.json() : null;
        const doc = saved && typeof saved === "object" && "data" in saved ? saved.data : saved;

        if (!cancelled) {
          setState(() => {
            const base = buildEmptyState(season);
            const merged = { ...base, ...(doc || {}), season: Number(season) };

            // ensure timestamp fields exist even on old docs
            merged.week15 = {
              ...base.week15,
              ...(merged.week15 || {}),
              rulesSavedAt: safeStr(merged?.week15?.rulesSavedAt || ""),
              decisionsSavedAt: safeStr(merged?.week15?.decisionsSavedAt || ""),
              results: {
                ...base.week15.results,
                ...(merged?.week15?.results || {}),
              },
            };

            return merged;
          });
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
    let pending = 0;
    for (const k of Object.keys(d)) {
      if (d[k]?.decision === "keep") keep++;
      else if (d[k]?.decision === "wager") wager++;
      else pending++;
    }
    return { keep, wager, pending };
  }, [state]);

  const decisionsComplete = useMemo(() => {
    const byDivision = state?.eligibility?.byDivision || {};
    const total = totalEligibilityCount;
    if (total <= 0) return false;

    const d = state?.week15?.decisions || {};
    let valid = 0;
    for (const div of Object.keys(byDivision)) {
      for (const e of safeArray(byDivision[div])) {
        const k = entryKey({ division: div, leagueName: e.leagueName, ownerName: e.ownerName });
        const dec = safeStr(d?.[k]?.decision || "").trim();
        if (dec === "keep" || dec === "wager") valid++;
      }
    }
    return valid === total;
  }, [state, totalEligibilityCount]);
  
    async function deleteAndStartOver() {
      const ok = window.confirm(
        `Delete Mini Leagues wagers for season ${season}?\n\nThis permanently deletes the JSON in R2 and resets the admin page.`
      );
      if (!ok) return;

      setSaving(true);
      setMsg("");
      try {
        const res = await fetch(`/api/admin/mini-leagues-wagers?season=${encodeURIComponent(season)}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `Delete failed (${res.status})`);
        }

        // Reset local UI state after successful delete
        setState(buildEmptyState(season));
        setTab("auto");
        setMsg("Deleted wagers JSON. You can import eligibility again to start over.");
      } catch (e) {
        setMsg(`Error: ${String(e)}`);
      } finally {
        setSaving(false);
      }
    }


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
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Save failed (${res.status})`);
      }

      const saved = await res.json().catch(() => payload);
      const doc = saved && typeof saved === "object" && "data" in saved ? saved.data : saved;

      setState((prev) => ({ ...prev, ...(doc || payload) }));
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
          resolvedAt: "",
          results: {
            ...state.week15?.results,
            divisionBonus: {},
            wagerPot: { ...state.week15?.results?.wagerPot },
            championship: { ...state.week15?.results?.championship },
            wagerMisses: [],
          },
        },
      };

      await save(next, "Imported Week 14 league winners.");
      setTab("rules");
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

      // IMPORTANT: do NOT set a pointsPulledAt timestamp anymore (you said remove it)
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
    const hasPoints = Object.keys(state?.week15?.points || {}).length > 0;
    if (!hasPoints) {
      setMsg("Error: No Week 15 points found. Pull points first.");
      return;
    }
    const results = computeResults(state);
    const next = {
      ...state,
      week15: { ...state.week15, resolvedAt: nowIso(), results },
    };
    await save(next, "Resolved Week 15 results.");
  }

  // keep hooks top-level (no early returns before useMemo)
  const coin = Number(state?.week15?.coin ?? 30) || 30;
  const wagerBonus = Number(state?.week15?.wagerBonus ?? 60) || 60;
  const divisionBonus = Number(state?.week15?.divisionBonus ?? 30) || 30;
  const champBonus = Number(state?.week15?.champBonus ?? 100) || 100;

  // ✅ FIXED checkmarks:
  // - Step 2 done ONLY when rulesSavedAt exists
  // - Step 3 done ONLY when decisionsSavedAt exists AND decisionsComplete
  //   (no dependency on pulling points anymore)
  const steps = useMemo(() => {
    const hasEligibility = Boolean(state?.eligibility?.computedAt) && Object.keys(state?.eligibility?.byDivision || {}).length > 0;

    const rulesDone = Boolean(safeStr(state?.week15?.rulesSavedAt || "").trim());
    const decisionsDone = Boolean(safeStr(state?.week15?.decisionsSavedAt || "").trim()) && decisionsComplete;
    const resolved = Boolean(safeStr(state?.week15?.resolvedAt || "").trim());

    return [
      { key: "import", label: "1) Import Eligibility", done: hasEligibility },
      { key: "rules", label: "2) Rules", done: rulesDone },
      { key: "decisions", label: "3) Decisions", done: decisionsDone },
      { key: "resolve", label: "4) Resolve", done: resolved },
    ];
  }, [state, decisionsComplete]);

  const activeTab =
    tab === "auto"
      ? safeStr(state?.week15?.resolvedAt || "").trim()
        ? "resolve"
        : state?.eligibility?.computedAt
        ? safeStr(state?.week15?.rulesSavedAt || "").trim()
          ? "decisions"
          : "rules"
        : "import"
      : tab;

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading…</p>
      </Card>
    );
  }

  // convenience
  const pointsMap = state?.week15?.points || {};
  const decisionsMap = state?.week15?.decisions || {};
  const results = state?.week15?.results || {};
  const hasPoints = Object.keys(pointsMap).length > 0;
  const resolvedAt = safeStr(state?.week15?.resolvedAt || "").trim();

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
              Import Week 14 league winners, set each winner to <b>Keep</b> or <b>Wager</b>, then pull Week 15 points and resolve.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/wager-trackers" className="btn btn-secondary">
              ← Wager Trackers
            </Link>

            <button
              type="button"
              onClick={deleteAndStartOver}
              disabled={saving}
              className="btn btn-secondary border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15 disabled:opacity-50"
              title="Deletes the stored JSON in R2 and resets this tool"
            >
              Delete &amp; Start Over
            </button>

            <Link href="/mini-leagues/wagers" className="btn btn-primary">
              View Public Page
            </Link>
          </div>

        </div>

        {msg ? (
          <p className={`mt-4 text-sm ${String(msg).startsWith("Error") ? "text-rose-200" : "text-emerald-200"}`}>{msg}</p>
        ) : null}
      </Card>

      <AdminStepTabs steps={steps} activeKey={activeTab} onChange={setTab} />

      {activeTab === "import" ? (
        <Card>
          <h2 className="text-lg font-semibold text-white">Step 1 — Import Week 14 League Winners</h2>
          <p className="mt-2 text-sm text-muted">Uses the leaderboard feed to find each league’s top points from Weeks 1–14.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton disabled={saving} onClick={importEligibility}>
              Import Eligibility
            </PrimaryButton>
          </div>

          <Divider />

          <div className="flex flex-wrap gap-3 text-sm text-muted">
            <div>
              Eligible Entries: <span className="text-foreground font-semibold">{totalEligibilityCount}</span>
            </div>
            <div>
              Keep: <span className="text-foreground font-semibold">{decisionsCount.keep}</span>
            </div>
            <div>
              Wager: <span className="text-foreground font-semibold">{decisionsCount.wager}</span>
            </div>
            <div>
              Pending: <span className="text-foreground font-semibold">{decisionsCount.pending}</span>
            </div>
          </div>
        </Card>
      ) : null}

      {activeTab === "rules" ? (
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
            <PrimaryButton
              disabled={saving}
              onClick={async () => {
                const next = { ...state, week15: { ...state.week15, rulesSavedAt: nowIso() } };
                await save(next, "Saved rules.");
                setTab("decisions");
              }}
            >
              Save Rules
            </PrimaryButton>

            {safeStr(state?.week15?.rulesSavedAt || "").trim() ? (
              <p className="mt-2 text-xs text-muted">Saved at: {new Date(state.week15.rulesSavedAt).toLocaleString()}</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {activeTab === "decisions" ? (
        <Card>
          <h2 className="text-lg font-semibold text-white">Step 3 — Decisions (Keep vs Wager)</h2>
          <p className="mt-2 text-sm text-muted">
            Keepers keep their {fmtMoney(coin)} and can win Division (+{fmtMoney(divisionBonus)}) and Championship (+{fmtMoney(champBonus)}). Wagerers
            put their {fmtMoney(coin)} into the pot and can win the pooled pot + {fmtMoney(wagerBonus)}.
          </p>

          <Divider />

          {divisions.length === 0 ? (
            <p className="text-sm text-muted">No eligibility yet — import Week 14 winners first.</p>
          ) : (
            <div className="space-y-6">
              {divisions.map((div) => {
                const elig = sortEligDefault(state?.eligibility?.byDivision?.[div] || []);
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
                                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                                        cur === "keep" ? "bg-cyan-500/15 text-cyan-100 border border-cyan-400/30" : "text-muted hover:text-white"
                                      }`}
                                    >
                                      Keep
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDecision(k, "wager")}
                                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                                        cur === "wager"
                                          ? "bg-amber-500/15 text-amber-100 border border-amber-400/30"
                                          : "text-muted hover:text-white"
                                      }`}
                                    >
                                      Wager
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDecision(k, "pending")}
                                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                                        cur === "pending" ? "bg-panel text-foreground border border-subtle" : "text-muted hover:text-white"
                                      }`}
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
            <PrimaryButton
              disabled={saving}
              onClick={async () => {
                if (!decisionsComplete) {
                  setMsg("Error: Decisions not complete. Every entry must be Keep or Wager.");
                  return;
                }
                const next = { ...state, week15: { ...state.week15, decisionsSavedAt: nowIso() } };
                await save(next, "Saved decisions.");
                setTab("resolve");
              }}
            >
              Save Decisions
            </PrimaryButton>

            {safeStr(state?.week15?.decisionsSavedAt || "").trim() ? (
              <p className="text-xs text-muted self-center">Saved at: {new Date(state.week15.decisionsSavedAt).toLocaleString()}</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {activeTab === "resolve" ? (
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-white">Step 4 — Pull Week 15 Points + Resolve</h2>
            <p className="mt-2 text-sm text-muted">
              Pull Week 15 points from the leaderboard, verify them below (same layout as the public page), then resolve winners.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton disabled={saving} onClick={pullWeek15Points}>
                Pull Week 15 Points
              </PrimaryButton>
              <PrimaryButton disabled={saving} tone="muted" onClick={resolveWeek15}>
                Resolve Week 15
              </PrimaryButton>
            </div>

            <Divider />

            <div className="text-xs text-muted">
              <div>Updated: {state?.updatedAt ? new Date(state.updatedAt).toLocaleString() : "—"}</div>
              <div>Resolved: {resolvedAt ? new Date(resolvedAt).toLocaleString() : "—"}</div>
            </div>

            {!hasPoints ? (
              <p className="mt-4 text-sm text-muted">No Week 15 points loaded yet — click “Pull Week 15 Points”.</p>
            ) : null}
          </Card>

          {/* ✅ Winner cards like public page */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white">Wager Pot</h2>
                {safeStr(results?.wagerPot?.winner || "").trim() ? <WinnerTag>Winner</WinnerTag> : <SmallBadge>Pending</SmallBadge>}
              </div>
              <div className="mt-3 text-sm text-muted space-y-1">
                <div>
                  Pool: <span className="text-foreground font-semibold">{fmtMoney(results?.wagerPot?.pool ?? decisionsCount.wager * coin)}</span>
                </div>
                <div>
                  Wager Bonus: <span className="text-foreground font-semibold">{fmtMoney(results?.wagerPot?.bonus ?? wagerBonus)}</span>
                </div>
                <div>
                  Total Paid:{" "}
                  <span className="text-foreground font-semibold">
                    {fmtMoney(results?.wagerPot?.total ?? decisionsCount.wager * coin + wagerBonus)}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                {safeStr(results?.wagerPot?.winner || "").trim() ? (
                  <p className="text-sm text-foreground">
                    <b>{safeStr(results.wagerPot.winner).trim()}</b> ({safeStr(results.wagerPot.winnerDivision).trim() || "—"}) —{" "}
                    {Number(results.wagerPot.winnerPts ?? 0).toFixed(2)} pts
                  </p>
                ) : (
                  <p className="text-sm text-muted">Resolve Week 15 to lock in the winner.</p>
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white">Championship Bonus</h2>
                {safeStr(results?.championship?.winner || "").trim() ? <WinnerTag>Winner</WinnerTag> : <SmallBadge>Pending</SmallBadge>}
              </div>
              <div className="mt-3 text-sm text-muted">
                Bonus:{" "}
                <span className="text-foreground font-semibold">{fmtMoney(results?.championship?.bonus ?? champBonus)}</span>
              </div>
              <div className="mt-4">
                {safeStr(results?.championship?.winner || "").trim() ? (
                  <p className="text-sm text-foreground">
                    <b>{safeStr(results.championship.winner).trim()}</b> ({safeStr(results.championship.winnerDivision).trim() || "—"}) —{" "}
                    {Number(results.championship.winnerPts ?? 0).toFixed(2)} pts
                  </p>
                ) : (
                  <p className="text-sm text-muted">Resolve Week 15 to lock in the winner.</p>
                )}
              </div>
            </Card>
          </div>

          {/* ✅ Tables organized by division, like public page */}
          <div className="space-y-4">
            {divisions.length === 0 ? (
              <Card>
                <p className="text-sm text-muted">No Week 14 eligibility has been imported yet.</p>
              </Card>
            ) : (
              divisions.map((div) => {
                const elig = safeArray(state?.eligibility?.byDivision?.[div] || []);
                const rows = elig
                  .map((e) => {
                    const leagueName = safeStr(e?.leagueName).trim();
                    const ownerName = safeStr(e?.ownerName).trim();
                    const k = entryKey({ division: div, leagueName, ownerName });
                    const pts = Number(pointsMap?.[k] ?? 0) || 0;
                    const decision = safeStr(decisionsMap?.[k]?.decision || "pending").trim() || "pending";
                    return {
                      leagueName,
                      ownerName,
                      total: Number(e?.total ?? 0) || 0,
                      k,
                      decision,
                      wk15: pts,
                    };
                  })
                  .filter((r) => r.leagueName && r.ownerName)
                  .sort((a, b) => b.wk15 - a.wk15);

                const divWinner = safeStr(results?.divisionBonus?.[div]?.winner || "").trim();
                const divWinnerPts = Number(results?.divisionBonus?.[div]?.pts ?? 0) || 0;
                const divWinnerBonus = Number(results?.divisionBonus?.[div]?.bonus ?? divisionBonus) || divisionBonus;

                return (
                  <Card key={div}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{div}</h3>
                        <p className="text-xs text-muted">Week 14 league winners (coins) and Week 15 status.</p>
                      </div>

                      <div className="text-right">
                        {divWinner ? (
                          <div className="space-y-1">
                            <WinnerTag>Division Bonus</WinnerTag>
                            <div className="text-sm text-foreground">
                              <b>{divWinner}</b> — {divWinnerPts.toFixed(2)} pts (+{fmtMoney(divWinnerBonus)})
                            </div>
                          </div>
                        ) : (
                          <SmallBadge>Division Bonus Pending</SmallBadge>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-[0.2em] text-muted">
                            <th className="text-left py-2 pr-4">League</th>
                            <th className="text-left py-2 pr-4">Owner</th>
                            <th className="text-right py-2 pr-4">Wk1-14</th>
                            <th className="text-center py-2 pr-4">Decision</th>
                            <th className="text-right py-2">Wk15</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                          {rows.map((r) => (
                            <tr key={r.k}>
                              <td className="py-2 pr-4 text-foreground">{r.leagueName}</td>
                              <td className="py-2 pr-4 text-foreground">{r.ownerName}</td>
                              <td className="py-2 pr-4 text-right text-muted">{r.total}</td>
                              <td className="py-2 pr-4 text-center">
                                <span
                                  className={
                                    r.decision === "wager"
                                      ? "inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
                                      : r.decision === "keep"
                                      ? "inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200"
                                      : "inline-flex rounded-full border border-subtle bg-panel/60 px-2 py-0.5 text-[11px] font-semibold text-muted"
                                  }
                                >
                                  {r.decision}
                                </span>
                              </td>
                              <td className="py-2 text-right text-foreground font-semibold">{Number(r.wk15 ?? 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* ✅ Who should have wagered + “top scorer wagered” message when applicable */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">Who should have wagered?</h2>
              <SmallBadge>Week 15</SmallBadge>
            </div>

            <Divider />

            {(() => {
              const wagerMisses = safeArray(results?.wagerMisses);
              const anyWagerers = decisionsCount.wager > 0;

              const champKey = safeStr(results?.championship?.winnerKey || "").trim();
              const champDecision = champKey ? safeStr(decisionsMap?.[champKey]?.decision || "").trim() : "";

              if (!anyWagerers) {
                return <p className="text-sm text-muted">No one wagered this week, so there’s no “missed out” list.</p>;
              }

              if (wagerMisses.length === 0) {
                return (
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">No misses</div>
                    <div className="mt-2 text-sm text-white font-semibold">
                      {champDecision === "wager"
                        ? "The top scorer wagered — nobody missed the pot."
                        : "No Keep decision outscored the best wager score — nobody missed the pot."}
                    </div>
                    {safeStr(results?.championship?.winner || "").trim() ? (
                      <div className="mt-1 text-xs text-muted">
                        Top scorer: <span className="text-white">{safeStr(results.championship.winner)}</span>{" "}
                        ({Number(results.championship.winnerPts ?? 0).toFixed(2)} pts) · Decision:{" "}
                        <span className="text-white">{champDecision || "—"}</span>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <>
                  <p className="text-sm text-muted">
                    These managers chose <b>Keep</b> but scored enough in Week 15 to beat (or tie) the best wager score — meaning they could’ve won the
                    pooled pot + {fmtMoney(wagerBonus)}.
                  </p>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-[0.2em] text-muted">
                          <th className="py-2 pr-4">Division</th>
                          <th className="py-2 pr-4">League</th>
                          <th className="py-2 pr-4">Manager</th>
                          <th className="py-2 text-right">Week 15 Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wagerMisses.map((m) => (
                          <tr key={safeStr(m?.key)} className="border-t border-subtle">
                            <td className="py-2 pr-4 text-muted">{safeStr(m?.division)}</td>
                            <td className="py-2 pr-4 text-muted">{safeStr(m?.leagueName)}</td>
                            <td className="py-2 pr-4 text-foreground">{safeStr(m?.ownerName)}</td>
                            <td className="py-2 text-right text-foreground font-semibold">{Number(m?.wk15 ?? 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      ) : null}
    </div>
  );
}