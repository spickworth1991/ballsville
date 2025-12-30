"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function entryKey(p) {
  const group = safeStr(p?.group || "").trim();
  const leagueName = safeStr(p?.leagueName || "").trim();
  const ownerName = safeStr(p?.ownerName || "").trim();
  return `${group}|||${leagueName}|||${ownerName}`;
}

const LEADERBOARD_URL_BY_SEASON = (season) =>
  `https://ballsville-leaderboard.pages.dev/data/leaderboards_${encodeURIComponent(season)}.json`;

function buildEmptyState(season) {
  return {
    season: Number(season),
    updatedAt: "",
    source: {
      leaderboardUrl: LEADERBOARD_URL_BY_SEASON(season),
      lastFetchedAt: "",
      leaderboardEtag: "",
    },
    settings: {
      finalistCredit: 50,
      week17: 17,
      wagerBonus: 200,
      championshipBonuses: { first: 250, second: 100, third: 50 },
      leagueWinnerBonus: 125,
      empireWarning:
        "If you win the 🏆 a second year in a row, it triggers the Empire upside (+$225 potential) and resets YOUR league only (other leagues are unaffected).",
    },
    finalists: {
      // byGroup: { [group]: { [leagueName]: [{ ownerName, choice: 'bank'|'wager' }] } }
      byGroup: {},
      savedAt: "",
    },
    week17: {
      resolvedAt: "",
      points: {}, // { [entryKey]: number }
      results: {
        leagueWinners: {}, // { [group|||leagueName]: { winnerName, winnerKey, loserName, ptsWinner, ptsLoser, bonus } }
        wagerBonus: { winnerName: "", winnerKey: "", pts: 0, bonus: 200 },
        overall: {
          first: { winnerName: "", winnerKey: "", pts: 0, bonus: 250 },
          second: { winnerName: "", winnerKey: "", pts: 0, bonus: 100 },
          third: { winnerName: "", winnerKey: "", pts: 0, bonus: 50 },
        },
        groupChamps: {}, // { [group]: { winnerName, winnerKey, pts } }
        shouldHaveWagered: [], // [{ ownerName, group, leagueName, pts }]
      },
    },
  };
}

function PrimaryButton({ children, onClick, disabled, tone = "accent" }) {
  const toneCls =
    tone === "danger"
      ? "bg-rose-500/15 border-rose-400/30 text-rose-100 hover:bg-rose-500/20"
      : tone === "muted"
      ? "bg-panel border-subtle text-foreground hover:border-accent/40"
      : tone === "success"
      ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/20"
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

function Card({ children }) {
  return <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm backdrop-blur p-5">{children}</div>;
}

function getDynastyRoot(leaderboardsJson, season) {
  const seasonObj = leaderboardsJson?.[String(season)] || {};
  const candidates = [
    seasonObj.dynasty,
    seasonObj.dynasty_game,
    seasonObj.dynasty_league,
    seasonObj.dynasty_leagues,
    seasonObj["dynasty-game"],
    seasonObj["dynasty-leagues"],
  ].filter(Boolean);
  return candidates[0] || null;
}

function getWeekPointsFromLeaderboard(leaderboardsJson, season, week) {
  const root = getDynastyRoot(leaderboardsJson, season);
  const owners = safeArray(root?.owners);
  const points = {};

  for (const o of owners) {
    const ownerName = safeStr(o?.ownerName).trim();
    const leagueName = safeStr(o?.leagueName).trim();
    const group = safeStr(o?.division || o?.group || o?.group_name).trim();
    if (!ownerName || !leagueName || !group) continue;

    const k = entryKey({ group, leagueName, ownerName });
    const v = o?.weekly?.[String(week)] ?? o?.weekly?.[week];
    const n = typeof v === "number" ? v : parseFloat(v);
    points[k] = Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }

  return points;
}

function computeResults(doc) {
  const settings = doc?.settings || {};
  const byGroup = doc?.finalists?.byGroup || {};
  const points = doc?.week17?.points || {};

  // Flatten all finalists
  const finalists = [];
  for (const group of Object.keys(byGroup)) {
    const byLeague = byGroup[group] || {};
    for (const leagueName of Object.keys(byLeague)) {
      const arr = safeArray(byLeague[leagueName]);
      for (const f of arr) {
        const ownerName = safeStr(f?.ownerName).trim();
        if (!ownerName) continue;
        const k = entryKey({ group, leagueName, ownerName });
        finalists.push({ group, leagueName, ownerName, key: k, choice: safeStr(f?.choice || "bank"), pts: Number(points[k] ?? 0) || 0 });
      }
    }
  }

  // League winners (+$125)
  const leagueWinners = {};
  for (const group of Object.keys(byGroup)) {
    const byLeague = byGroup[group] || {};
    for (const leagueName of Object.keys(byLeague)) {
      const arr = safeArray(byLeague[leagueName]);
      if (arr.length < 2) continue;
      const a = safeStr(arr[0]?.ownerName).trim();
      const b = safeStr(arr[1]?.ownerName).trim();
      if (!a || !b) continue;
      const ka = entryKey({ group, leagueName, ownerName: a });
      const kb = entryKey({ group, leagueName, ownerName: b });
      const pa = Number(points[ka] ?? 0) || 0;
      const pb = Number(points[kb] ?? 0) || 0;
      const id = `${group}|||${leagueName}`;
      const bonus = Number(settings?.leagueWinnerBonus ?? 125) || 125;
      if (pa === pb) {
        leagueWinners[id] = { winnerName: "", winnerKey: "", loserName: "", ptsWinner: pa, ptsLoser: pb, bonus, note: "TIE" };
      } else if (pa > pb) {
        leagueWinners[id] = { winnerName: a, winnerKey: ka, loserName: b, ptsWinner: pa, ptsLoser: pb, bonus };
      } else {
        leagueWinners[id] = { winnerName: b, winnerKey: kb, loserName: a, ptsWinner: pb, ptsLoser: pa, bonus };
      }
    }
  }

  // Wager bonus winner among wagered
  const wagered = finalists.filter((f) => safeStr(f.choice).toLowerCase() === "wager");
  const wagerBonusAmount = Number(settings?.wagerBonus ?? 200) || 200;
  const wagerWinner = wagered.slice().sort((x, y) => (y.pts || 0) - (x.pts || 0))[0] || null;
  const wagerBonus = {
    winnerName: wagerWinner ? wagerWinner.ownerName : "",
    winnerKey: wagerWinner ? wagerWinner.key : "",
    pts: wagerWinner ? wagerWinner.pts : 0,
    bonus: wagerBonusAmount,
  };

  // Overall top 3 (all finalists)
  const sortedAll = finalists.slice().sort((x, y) => (y.pts || 0) - (x.pts || 0));
  const champBonuses = settings?.championshipBonuses || {};
  const first = sortedAll[0] || null;
  const second = sortedAll[1] || null;
  const third = sortedAll[2] || null;
  const overall = {
    first: { winnerName: first ? first.ownerName : "", winnerKey: first ? first.key : "", pts: first ? first.pts : 0, bonus: Number(champBonuses.first ?? 250) || 250 },
    second: { winnerName: second ? second.ownerName : "", winnerKey: second ? second.key : "", pts: second ? second.pts : 0, bonus: Number(champBonuses.second ?? 100) || 100 },
    third: { winnerName: third ? third.ownerName : "", winnerKey: third ? third.key : "", pts: third ? third.pts : 0, bonus: Number(champBonuses.third ?? 50) || 50 },
  };

  // Group champs (Heroes vs Dragons Week 18)
  const groupChamps = {};
  for (const group of Object.keys(byGroup)) {
    const top = finalists.filter((f) => f.group === group).sort((x, y) => (y.pts || 0) - (x.pts || 0))[0] || null;
    groupChamps[group] = { winnerName: top ? top.ownerName : "", winnerKey: top ? top.key : "", pts: top ? top.pts : 0 };
  }

  // Should-have-wagered callouts:
  // If you banked but would have won the wager bonus (i.e., would be top among wagered+you).
  const shouldHaveWagered = [];
  if (wagered.length) {
    const topWagerPts = wagerWinner ? wagerWinner.pts : 0;
    for (const f of finalists) {
      const isBank = safeStr(f.choice).toLowerCase() !== "wager";
      if (!isBank) continue;
      if ((f.pts || 0) > topWagerPts) {
        shouldHaveWagered.push({ ownerName: f.ownerName, group: f.group, leagueName: f.leagueName, pts: f.pts });
      }
    }
  }

  return { leagueWinners, wagerBonus, overall, groupChamps, shouldHaveWagered };
}

export default function DynastyWagersAdminClient({ season }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState(() => buildEmptyState(season));
  const [leagueRows, setLeagueRows] = useState([]);

  async function getToken() {
    const supa = getSupabase();
    const { data } = await supa.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function apiFetch(path, init = {}) {
    const token = await getToken();
    const headers = { ...(init.headers || {}), authorization: `Bearer ${token}` };
    const res = await fetch(path, { ...init, headers, cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok || j?.ok === false) {
      throw new Error(j?.error || `Request failed (${res.status})`);
    }
    return j;
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // Load leagues so we can render the finalist picker.
        const leaguesRes = await apiFetch(`/api/admin/dynasty?type=leagues&season=${encodeURIComponent(season)}`);
        const rows = safeArray(leaguesRes?.data?.rows || leaguesRes?.data) // some endpoints nest rows
          .filter((r) => Number(r?.year) === Number(season));
        if (alive) setLeagueRows(rows);

        const wagersRes = await apiFetch(`/api/admin/dynasty-wagers?season=${encodeURIComponent(season)}`);
        const existing = wagersRes?.data;
        const base = buildEmptyState(season);
        const next = existing && typeof existing === "object" ? { ...base, ...existing } : base;
        // Ensure required nested shapes exist.
        next.source = { ...base.source, ...(next.source || {}) };
        next.settings = { ...base.settings, ...(next.settings || {}) };
        next.finalists = { ...base.finalists, ...(next.finalists || {}) };
        next.finalists.byGroup = next.finalists.byGroup || {};
        next.week17 = { ...base.week17, ...(next.week17 || {}) };
        next.week17.points = next.week17.points || {};
        next.week17.results = { ...base.week17.results, ...(next.week17.results || {}) };
        if (alive) setDoc(next);
      } catch (e) {
        if (alive) setError(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [season]);

  const leaguesByGroup = useMemo(() => {
    const groups = {};
    for (const r of leagueRows) {
      const group = safeStr(r?.theme_name || r?.theme || r?.division || "").trim();
      const leagueName = safeStr(r?.name || "").trim();
      if (!group || !leagueName) continue;
      if (!groups[group]) groups[group] = [];
      groups[group].push({ leagueName });
    }
    // stable sort
    for (const g of Object.keys(groups)) {
      groups[g] = groups[g].slice().sort((a, b) => a.leagueName.localeCompare(b.leagueName));
    }
    return groups;
  }, [leagueRows]);

  function setFinalist(group, leagueName, idx, value) {
    setDoc((prev) => {
      const next = structuredClone(prev);
      if (!next.finalists) next.finalists = { byGroup: {} };
      if (!next.finalists.byGroup) next.finalists.byGroup = {};
      if (!next.finalists.byGroup[group]) next.finalists.byGroup[group] = {};
      if (!next.finalists.byGroup[group][leagueName]) {
        next.finalists.byGroup[group][leagueName] = [
          { ownerName: "", choice: "bank" },
          { ownerName: "", choice: "bank" },
        ];
      }
      next.finalists.byGroup[group][leagueName][idx] = {
        ...next.finalists.byGroup[group][leagueName][idx],
        ownerName: value,
      };
      return next;
    });
  }

  function setChoice(group, leagueName, ownerName, choice) {
    setDoc((prev) => {
      const next = structuredClone(prev);
      const arr = next.finalists?.byGroup?.[group]?.[leagueName];
      if (!Array.isArray(arr)) return prev;
      const i = arr.findIndex((x) => safeStr(x?.ownerName).trim() === ownerName);
      if (i === -1) return prev;
      arr[i] = { ...arr[i], choice };
      return next;
    });
  }

  async function saveDoc(patchReason = "") {
    setSaving(true);
    setError("");
    try {
      const payload = structuredClone(doc);
      if (payload.finalists) payload.finalists.savedAt = new Date().toISOString();
      if (patchReason) payload._lastAction = patchReason;
      await apiFetch(`/api/admin/dynasty-wagers?season=${encodeURIComponent(season)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function resolveWeek17() {
    setSaving(true);
    setError("");
    try {
      const url = doc?.source?.leaderboardUrl || LEADERBOARD_URL_BY_SEASON(season);
      const res = await fetch(url, { cache: "no-store" });
      const lb = await res.json();
      const pts = getWeekPointsFromLeaderboard(lb, season, Number(doc?.settings?.week17 ?? 17));

      const next = structuredClone(doc);
      next.source.leaderboardUrl = url;
      next.source.lastFetchedAt = new Date().toISOString();
      next.week17 = next.week17 || {};
      next.week17.points = pts;
      next.week17.resolvedAt = new Date().toISOString();
      next.week17.results = { ...next.week17.results, ...computeResults(next) };
      setDoc(next);

      // Persist immediately so public updates.
      await apiFetch(`/api/admin/dynasty-wagers?season=${encodeURIComponent(season)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch (e) {
      setError(e?.message || "Resolve failed");
    } finally {
      setSaving(false);
    }
  }

  const hasFinalists = useMemo(() => {
    const byGroup = doc?.finalists?.byGroup || {};
    for (const g of Object.keys(byGroup)) {
      for (const l of Object.keys(byGroup[g] || {})) {
        const arr = safeArray(byGroup[g][l]);
        const filled = arr.filter((x) => safeStr(x?.ownerName).trim()).length;
        if (filled >= 2) return true;
      }
    }
    return false;
  }, [doc]);

  const finalistsFlat = useMemo(() => {
    const out = [];
    const byGroup = doc?.finalists?.byGroup || {};
    for (const group of Object.keys(byGroup)) {
      const byLeague = byGroup[group] || {};
      for (const leagueName of Object.keys(byLeague)) {
        const arr = safeArray(byLeague[leagueName]);
        for (const f of arr) {
          const ownerName = safeStr(f?.ownerName).trim();
          if (!ownerName) continue;
          out.push({ group, leagueName, ownerName, choice: safeStr(f?.choice || "bank"), key: entryKey({ group, leagueName, ownerName }) });
        }
      }
    }
    return out.sort((a, b) => (a.group + a.leagueName + a.ownerName).localeCompare(b.group + b.leagueName + b.ownerName));
  }, [doc]);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading Dynasty wager tracker…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/wager-trackers" className="btn btn-secondary">
            ← Wager Trackers
          </Link>
          <Link href="/dynasty/wagers" className="btn btn-outline" prefetch={false}>
            View Public Page
          </Link>
        </div>
        <div className="text-xs text-muted">
          Season <span className="text-white font-semibold">{season}</span>
          {doc?.updatedAt ? (
            <span className="ml-3">Last saved: {new Date(doc.updatedAt).toLocaleString()}</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-white">Empire Warning</h2>
        <p className="mt-2 text-sm text-muted">{doc?.settings?.empireWarning}</p>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Step 1 · Select Finalists (Week 16)</h2>
            <p className="mt-1 text-sm text-muted">Top 2 per league (by record) — enter the two finalists per league.</p>
          </div>
          <PrimaryButton disabled={saving} onClick={() => saveDoc("save-finalists")}>
            Save Finalists
          </PrimaryButton>
        </div>

        <div className="mt-4 space-y-6">
          {Object.keys(leaguesByGroup).length === 0 ? (
            <p className="text-sm text-muted">No Dynasty leagues found for this season.</p>
          ) : (
            Object.keys(leaguesByGroup)
              .sort((a, b) => a.localeCompare(b))
              .map((group) => (
                <div key={group} className="rounded-2xl border border-subtle bg-panel/40 p-4">
                  <h3 className="text-sm font-semibold text-white">{group}</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {leaguesByGroup[group].map((l) => {
                      const leagueName = l.leagueName;
                      const cur = doc?.finalists?.byGroup?.[group]?.[leagueName] || [
                        { ownerName: "", choice: "bank" },
                        { ownerName: "", choice: "bank" },
                      ];
                      return (
                        <div key={leagueName} className="rounded-xl border border-subtle bg-card-surface p-3">
                          <div className="text-sm font-semibold text-white">{leagueName}</div>
                          <div className="mt-2 grid grid-cols-1 gap-2">
                            <input
                              value={safeStr(cur?.[0]?.ownerName)}
                              onChange={(e) => setFinalist(group, leagueName, 0, e.target.value)}
                              placeholder="Finalist 1 name"
                              className="w-full rounded-xl border border-subtle bg-panel px-3 py-2 text-sm text-white placeholder:text-muted"
                            />
                            <input
                              value={safeStr(cur?.[1]?.ownerName)}
                              onChange={(e) => setFinalist(group, leagueName, 1, e.target.value)}
                              placeholder="Finalist 2 name"
                              className="w-full rounded-xl border border-subtle bg-panel px-3 py-2 text-sm text-white placeholder:text-muted"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Step 2 · Bank vs Wager (Before Week 17 kickoff)</h2>
            <p className="mt-1 text-sm text-muted">No reply = bank by default.</p>
          </div>
          <PrimaryButton disabled={!hasFinalists || saving} onClick={() => saveDoc("save-decisions")}>
            Save Decisions
          </PrimaryButton>
        </div>

        {!hasFinalists ? (
          <p className="mt-4 text-sm text-muted">Add finalists first.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {finalistsFlat.map((f) => {
              const choice = safeStr(f.choice).toLowerCase() === "wager" ? "wager" : "bank";
              return (
                <div key={f.key} className="rounded-xl border border-subtle bg-card-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{f.ownerName}</div>
                      <div className="mt-1 text-xs text-muted">
                        {f.group} · {f.leagueName}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <PrimaryButton
                        tone={choice === "bank" ? "success" : "muted"}
                        onClick={() => setChoice(f.group, f.leagueName, f.ownerName, "bank")}
                      >
                        Bank
                      </PrimaryButton>
                      <PrimaryButton
                        tone={choice === "wager" ? "accent" : "muted"}
                        onClick={() => setChoice(f.group, f.leagueName, f.ownerName, "wager")}
                      >
                        Wager
                      </PrimaryButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Step 3 · Resolve Week 17</h2>
            <p className="mt-1 text-sm text-muted">Fetch Week 17 points and compute payouts + callouts.</p>
          </div>
          <PrimaryButton disabled={!hasFinalists || saving} onClick={resolveWeek17}>
            Resolve Week 17
          </PrimaryButton>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-subtle bg-panel/40 p-4">
            <h3 className="text-sm font-semibold text-white">Bonuses</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li>🪙 Finalist credit: ${Number(doc?.settings?.finalistCredit ?? 50) || 50} each</li>
              <li>💰 Wager bonus: ${Number(doc?.settings?.wagerBonus ?? 200) || 200} (wagered only)</li>
              <li>🏆 Overall: ${Number(doc?.settings?.championshipBonuses?.first ?? 250) || 250} / ${Number(doc?.settings?.championshipBonuses?.second ?? 100) || 100} / ${Number(doc?.settings?.championshipBonuses?.third ?? 50) || 50}</li>
              <li>🏁 League winner bonus: +${Number(doc?.settings?.leagueWinnerBonus ?? 125) || 125}</li>
            </ul>
          </div>

          <div className="rounded-xl border border-subtle bg-panel/40 p-4">
            <h3 className="text-sm font-semibold text-white">Week 18 Heads-Up</h3>
            <p className="mt-2 text-sm text-muted">
              After Week 17, the <span className="text-white font-semibold">Heroes</span> champ faces the <span className="text-white font-semibold">Dragons</span> champ in Week 18.
            </p>
          </div>
        </div>

        {doc?.week17?.resolvedAt ? (
          <div className="mt-4 rounded-xl border border-subtle bg-card-surface p-4">
            <div className="text-xs text-muted">Resolved: {new Date(doc.week17.resolvedAt).toLocaleString()}</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-white">Wager Bonus Winner</h3>
                <p className="mt-1 text-sm text-muted">
                  {doc?.week17?.results?.wagerBonus?.winnerName
                    ? `${doc.week17.results.wagerBonus.winnerName} (${doc.week17.results.wagerBonus.pts} pts)`
                    : "—"}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Overall Top 3</h3>
                <p className="mt-1 text-sm text-muted">
                  1) {doc?.week17?.results?.overall?.first?.winnerName || "—"}
                  {doc?.week17?.results?.overall?.first?.winnerName ? ` (${doc.week17.results.overall.first.pts})` : ""}
                  <br />
                  2) {doc?.week17?.results?.overall?.second?.winnerName || "—"}
                  {doc?.week17?.results?.overall?.second?.winnerName ? ` (${doc.week17.results.overall.second.pts})` : ""}
                  <br />
                  3) {doc?.week17?.results?.overall?.third?.winnerName || "—"}
                  {doc?.week17?.results?.overall?.third?.winnerName ? ` (${doc.week17.results.overall.third.pts})` : ""}
                </p>
              </div>
            </div>

            {safeArray(doc?.week17?.results?.shouldHaveWagered).length ? (
              <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 p-4">
                <h3 className="text-sm font-semibold text-amber-100">Should have wagered 😬</h3>
                <p className="mt-1 text-sm text-amber-100/80">These banked finalists would have won the $200 wager bonus.</p>
                <ul className="mt-3 space-y-1 text-sm text-amber-100/90">
                  {doc.week17.results.shouldHaveWagered.map((m) => (
                    <li key={`${m.group}|${m.leagueName}|${m.ownerName}`}>• {m.ownerName} — {m.group} / {m.leagueName} ({m.pts} pts)</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Not resolved yet.</p>
        )}
      </Card>
    </div>
  );
}
