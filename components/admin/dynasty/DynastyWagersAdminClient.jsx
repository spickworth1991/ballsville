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
  };
}

export default function DynastyWagersAdminClient() {
  const [season, setSeason] = useState(() => new Date().getFullYear());
  const [doc, setDoc] = useState(() => buildEmptyState(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [step, setStep] = useState("import");

  const [leagueOrderIndex, setLeagueOrderIndex] = useState(() => new Map());

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

  async function handleImport() {
    setSaving(true);
    setErrorMsg("");
    setInfoMsg("");
    try {
      const lbUrl = LEADERBOARD_URL_BY_SEASON(season);
      const lbRes = await fetch(lbUrl, { cache: "no-store" });
      if (!lbRes.ok) throw new Error(`Failed to fetch leaderboards (${lbRes.status})`);
      const leaderboardsJson = await lbRes.json();

      // Prefer existing manual finalists list (if present) to avoid wrong inference.
      let finals = await importFinalistsFromR2Manual(season);
      if (!finals.length) finals = inferFinalistsFromLeaderboard(leaderboardsJson, season);

      const byDivision = {};
      for (const r of finals) {
        if (!byDivision[r.division]) byDivision[r.division] = [];
        byDivision[r.division].push({
          leagueName: r.leagueName,
          finalists: [r.finalist1, r.finalist2],
        });
      }

      const computedAt = nowIso();

      // Seed decisions + points
      const decisions = { ...(doc?.week17?.decisions || {}) };
      const pointsMap = getWeekPointsMapFromLeaderboard(leaderboardsJson, season, 17);

      const points = { ...(doc?.week17?.points || {}) };
      for (const div of Object.keys(byDivision)) {
        for (const league of safeArray(byDivision[div])) {
          const leagueName = safeStr(league?.leagueName).trim();
          const finalists = safeArray(league?.finalists);
          for (const ownerName of finalists) {
            const k = entryKey({ division: div, leagueName, ownerName });
            if (!decisions[k]) decisions[k] = { decision: "bank" };
            points[k] = Number(pointsMap?.[k] ?? 0) || 0;
          }
        }
      }

      const next = computeResults({
        ...doc,
        updatedAt: nowIso(),
        source: {
          ...doc.source,
          leaderboardUrl: lbUrl,
          lastFetchedAt: nowIso(),
        },
        eligibility: {
          ...doc.eligibility,
          computedAt,
          week: 17,
          byDivision,
        },
        week17: {
          ...doc.week17,
          week: 17,
          decisions,
          points,
          resolvedAt: nowIso(),
        },
      });

      await save(next, { setStepAfter: "decisions" }); // ✅ move into the next section
      setInfoMsg("Imported finalists + resolved Week 17 points.");
    } catch (e) {
      setErrorMsg(e?.message || "Import failed.");
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
              Import finalists (Top 2 per league) → set Bank/Wager → save → public page renders from R2.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton tone="muted" onClick={() => loadDoc(season)} disabled={loading || saving}>
              Reload
            </PrimaryButton>
            <PrimaryButton onClick={handleImport} disabled={loading || saving}>
              Import Finalists + Resolve Week 17
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
        <PrimaryButton tone={step === "import" ? "accent" : "muted"} onClick={() => setStep("import")}>
          1) Import
        </PrimaryButton>
        <PrimaryButton tone={step === "decisions" ? "accent" : "muted"} onClick={() => setStep("decisions")}>
          2) Decisions
        </PrimaryButton>
        <PrimaryButton tone={step === "results" ? "accent" : "muted"} onClick={() => setStep("results")}>
          3) Results
        </PrimaryButton>
      </div>

      {step === "import" && (
        <Card>
          <h2 className="text-lg font-semibold text-white">Import</h2>
          <p className="mt-2 text-sm text-muted">
            Imports Top 2 per league (finalists). If an existing manual finalists file exists at
            <span className="mx-1 font-mono text-xs">/r2/data/dynasty/wagering_{season}.json</span>
            it will be used; otherwise we infer from Week 17 leaderboard points.
          </p>
          <Divider />
          <ul className="text-sm text-muted list-disc pl-5 space-y-1">
            <li>Defaults to <b>Bank</b> if no decision is set.</li>
            <li>Week 17 points are pulled from the leaderboard JSON.</li>
            <li>After import we automatically move you into the Decisions section.</li>
          </ul>
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
              <PrimaryButton tone="accent2" onClick={() => save(doc, { setStepAfter: "results" })} disabled={saving}>
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
