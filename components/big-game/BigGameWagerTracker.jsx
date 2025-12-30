"use client";

import { useEffect, useMemo, useState } from "react";
// import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function fmtMoney(n) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return "$0";
  return `$${x.toFixed(0)}`;
}

// Owner names can appear in multiple leagues.
// Any wager/eligibility/points must be keyed by the roster instance (division + leagueName + ownerName).
function entryKey(p) {
  const division = safeStr(p?.division || "").trim();
  const leagueName = safeStr(p?.leagueName || "").trim();
  const ownerName = safeStr(p?.ownerName || "").trim();
  return `${division}|||${leagueName}|||${ownerName}`;
}

function Card({ children }) {
  return <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm backdrop-blur p-5">{children}</div>;
}
function SmallBadge({ children }) {
  return (
    <span className="inline-flex text-[11px] uppercase tracking-[0.25em] text-muted rounded-full border border-subtle bg-panel/60 px-3 py-1">
      {children}
    </span>
  );
}

function Coin({ amount, title }) {
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center rounded-full border border-subtle bg-panel/70 text-foreground shadow-sm"
      style={{ width: 30, height: 30, fontSize: 11, fontWeight: 800 }}
    >
      ${amount}
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

function buildLeagueOrderIndex(bigGameMeta) {
  const rows = safeArray(bigGameMeta?.rows);
  const map = new Map();
  for (const r of rows) {
    const div = safeStr(r?.theme_name).trim();
    const leagueName = safeStr(r?.name).trim();
    if (!div || !leagueName) continue;
    const orderRaw = r?.display_order ?? r?.displayOrder ?? r?.league_order ?? r?.order;
    const orderNum = Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : 999999;
    map.set(`${div}|||${leagueName}`.toLowerCase(), orderNum);
  }
  return map;
}

function normalizeFromAdminDoc(doc, leagueOrderIndex) {
  // Admin doc shape: { eligibility, divisionWagers, championship, ... }
  const eligibilityByDivision = doc?.eligibility?.byDivision || {};
  const wagersByDivision = doc?.divisionWagers?.byDivision || {};

  const divisions = {};
  for (const div of Object.keys(eligibilityByDivision)) {
    const elig = safeArray(eligibilityByDivision[div]);
    const d = wagersByDivision?.[div] || {};
    const pot1 = d?.pot1 || {};
    const pot2 = d?.pot2 || {};

    const entries = elig
      .map((e) => {
        const leagueName = safeStr(e?.leagueName).trim();
        const ownerName = safeStr(e?.ownerName).trim();
        const k = entryKey({ division: div, leagueName, ownerName });
        const order = leagueOrderIndex?.get(`${div}|||${leagueName}`.toLowerCase()) ?? 999999;
        return {
          division: div,
          leagueName,
          ownerName,
          total: Number(e?.total ?? 0) || 0,
          order,
          k,
          pot1Entered: Boolean(pot1?.entrants?.[k] || pot1?.entrants?.[ownerName]),
          pot2Entered: Boolean(pot2?.entrants?.[k] || pot2?.entrants?.[ownerName]),
          wk16: Number(pot1?.points?.[k] ?? pot2?.points?.[k] ?? 0) || 0,
        };
      })
      .filter((e) => e.leagueName && e.ownerName)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.leagueName.localeCompare(b.leagueName);
      });

    divisions[div] = {
      entries,
      pot1: {
        pool: Number(pot1?.pool || 0),
        winner: safeStr(pot1?.winner).trim(),
        winnerKey: safeStr(pot1?.winnerKey).trim(),
        resolvedAt: safeStr(pot1?.resolvedAt).trim(),
      },
      pot2: {
        pool: Number(pot2?.pool || 0),
        winner: safeStr(pot2?.winner).trim(),
        winnerKey: safeStr(pot2?.winnerKey).trim(),
        resolvedAt: safeStr(pot2?.resolvedAt).trim(),
      },
    };

  }

  const champ = doc?.championship || {};
  const seeded = safeArray(champ?.byDivisionWinner).map((r) => {
    const ownerName = safeStr(r?.ownerName).trim();
    const division = safeStr(r?.division).trim();
    const k = safeStr(r?.entryKey).trim() || entryKey({ division, leagueName: r?.leagueName, ownerName });
    const wager = Number(r?.wager || 0) || 0;
    return {
      ownerName,
      division,
      entryKey: k,
      wager,
      wk17: Number(champ?.points?.[k] ?? 0) || 0,
    };
  });

  const bettors = seeded.filter((r) => r.wager > 0);
  const nonBettors = seeded.filter((r) => !(r.wager > 0));

  const pickWinner = (rows) => {
    let best = -Infinity;
    let win = null;
    for (const r of rows) {
      if (r.wk17 > best) {
        best = r.wk17;
        win = r;
      }
    }
    return win;
  };

  const bonus = Number(champ?.bonus ?? 0) || 0;

  // Main Pot = first $50 (everyone with wager>=50) + bonus
  // Side Pot 1 = second $50 (wager>=100)  -> entrants * $50
  // Side Pot 2 = third $50 (wager>=150)   -> entrants * $50
  const mainEntrants = bettors.filter((r) => r.wager >= 50);
  const side1Entrants = bettors.filter((r) => r.wager >= 100);
  const side2Entrants = bettors.filter((r) => r.wager >= 150);

  const mainWinnerRow = pickWinner(mainEntrants);
  const side1WinnerRow = pickWinner(side1Entrants);
  const side2WinnerRow = pickWinner(side2Entrants);

  const mainPotWagers = mainEntrants.length * 50;

    const mainWinnerPts = Number(mainWinnerRow?.wk17 ?? NaN);
    const side1WinnerPts = Number(side1WinnerRow?.wk17 ?? NaN);
    const side2WinnerPts = Number(side2WinnerRow?.wk17 ?? NaN);

    // Build the "real world" winners (who actually won each pot)
    const real = {
      main: { threshold: 50, winner: mainWinnerRow, winnerPts: mainWinnerPts },
      side1: { threshold: 100, winner: side1WinnerRow, winnerPts: side1WinnerPts },
      side2: { threshold: 150, winner: side2WinnerRow, winnerPts: side2WinnerPts },
    };

    // Counterfactual: evaluate each person individually as if THEY maxed to 150,
    // while everyone else’s wager remains unchanged.
    function evalIfMaxed(person) {
      const meKey = safeStr(person?.entryKey).trim();
      if (!meKey) return null;

      const mePts = Number(person?.wk17 ?? 0) || 0;

      // helper: would I be eligible for a pot if I maxed?
      const qualifies = (threshold) => threshold <= 150;

      // helper: would I beat the real winner (keeping everyone else same)?
      const beatsReal = (pot) => {
        const wPts = Number(pot?.winnerPts ?? NaN);
        if (!Number.isFinite(wPts)) return false; // pot not resolved / no winner
        return mePts > wPts;
      };

      const wins = {
        main: qualifies(50) && beatsReal(real.main),
        side1: qualifies(100) && beatsReal(real.side1),
        side2: qualifies(150) && beatsReal(real.side2),
      };

      return {
        ownerName: person.ownerName || "",
        division: person.division || "",
        entryKey: meKey,
        pts: mePts,
        maxWager: 150,
        wins, // {main, side1, side2}
        swept: Boolean(wins.main && wins.side1 && wins.side2),
      };
    }

    const hypotheticals = seeded
      .map(evalIfMaxed)
      .filter(Boolean)
      // Only show interesting cases: wins at least one pot they didn’t actually qualify for
      .filter((r) => r.wins.main || r.wins.side1 || r.wins.side2);

    // For the old UI fields (main/side1/side2), pick the "most interesting" single line per pot:
    // highest points among people who would win that pot if they maxed.
    function bestForPot(potKey) {
      const cand = hypotheticals.filter((h) => h.wins[potKey]);
      if (!cand.length) return null;
      cand.sort((a, b) => b.pts - a.pts || a.ownerName.localeCompare(b.ownerName));
      const best = cand[0];
      const threshold = potKey === "main" ? 50 : potKey === "side1" ? 100 : 150;
      const label = potKey === "main" ? "the Main Pot" : potKey === "side1" ? "Side Pot 1" : "Side Pot 2";
      return {
        label,
        threshold,
        ownerName: best.ownerName,
        division: best.division,
        pts: best.pts,
        wager: 0,
        entryKey: best.entryKey,
        maxWager: 150,
      };

    }

    const couldMain = bestForPot("main");
    const couldSide1 = bestForPot("side1");
    const couldSide2 = bestForPot("side2");

    // Sweep: show the highest scoring person who would sweep if they maxed
    const sweepers = hypotheticals.filter((h) => h.swept);
    sweepers.sort((a, b) => b.pts - a.pts || a.ownerName.localeCompare(b.ownerName));
    const couldSweepOwner = sweepers.length ? sweepers[0].ownerName : "";

    // Also include a full per-person breakdown so you can display JoeJoe “would win Side Pots but not Main”
    const perPerson = hypotheticals
      .slice()
      .sort((a, b) => b.pts - a.pts || a.ownerName.localeCompare(b.ownerName))
      .map((h) => ({
        entryKey: h.entryKey, // ✅ add this
        ownerName: h.ownerName,
        division: h.division,
        pts: h.pts,
        originalWager: Number(seeded.find((x) => x.entryKey === h.entryKey)?.wager ?? 0) || 0,
        wouldWin: {
          main: h.wins.main,
          side1: h.wins.side1,
          side2: h.wins.side2,
        },
        swept: h.swept,
        maxWager: 150,
      }));

      



return {
  updatedAt: safeStr(doc?.updatedAt).trim(),
  divisionResolvedAt: safeStr(doc?.divisionWagers?.resolvedAt).trim(),
  championship: {
    resolvedAt: safeStr(champ?.resolvedAt).trim(),
    bettors,
    nonBettors,

    mainPot: {
      wagers: mainPotWagers,
      bonus,
      total: mainPotWagers + bonus,
      winner: mainWinnerRow?.ownerName || "",
      winnerKey: safeStr(mainWinnerRow?.entryKey).trim(),
      winnerDivision: mainWinnerRow?.division || "",
      winnerPts: Number(mainWinnerRow?.wk17 ?? 0) || 0,
    },


    sidePots: [
      {
        label: "Side Pot 1",
        threshold: 100,
        entrants: side1Entrants,
        pool: side1Entrants.length * 50,
        winner: side1WinnerRow?.ownerName || "",
        winnerKey: safeStr(side1WinnerRow?.entryKey).trim(),
        winnerDivision: side1WinnerRow?.division || "",
        winnerPts: Number(side1WinnerRow?.wk17 ?? 0) || 0,
      },
      {
        label: "Side Pot 2",
        threshold: 150,
        entrants: side2Entrants,
        pool: side2Entrants.length * 50,
        winner: side2WinnerRow?.ownerName || "",
        winnerKey: safeStr(side2WinnerRow?.entryKey).trim(),
        winnerDivision: side2WinnerRow?.division || "",
        winnerPts: Number(side2WinnerRow?.wk17 ?? 0) || 0,
      },
    ],


        couldHaveWon: {
          sweepOwner: couldSweepOwner,
          main: couldMain,
          side1: couldSide1,
          side2: couldSide2,
          perPerson,
        },

  },
  
  divisions,
};
}

function TrackerInner({ season: seasonProp, version }) {
  const season = Number(seasonProp) || CURRENT_SEASON;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState(null);
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState("auto");
  const [openDivs, setOpenDivs] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const wagersUrl = `/r2/data/biggame/wagers_${encodeURIComponent(season)}.json?v=${encodeURIComponent(version || "")}`;
        const metaUrl = `/r2/data/biggame/leagues_${encodeURIComponent(season)}.json?v=${encodeURIComponent(version || "")}`;

        const [wagersRes, metaRes] = await Promise.all([
          fetch(wagersUrl, { cache: "no-store" }),
          fetch(metaUrl, { cache: "no-store" }).catch(() => null),
        ]);

        if (!wagersRes.ok) throw new Error(`Failed to load wager tracker (${wagersRes.status})`);
        const wagersJson = await wagersRes.json();
        const metaJson = metaRes && metaRes.ok ? await metaRes.json() : null;

        if (cancelled) return;
        setDoc(wagersJson);
        setMeta(metaJson);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load wager tracker.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [season, version]);

  const leagueOrderIndex = useMemo(() => buildLeagueOrderIndex(meta), [meta]);

  const normalized = useMemo(() => {
    if (!doc || typeof doc !== "object") return null;
    if (doc?.divisions && doc?.championship && !doc?.divisionWagers) {
      return {
        updatedAt: safeStr(doc?.updatedAt).trim(),
        divisionResolvedAt: safeStr(doc?.divisionResolvedAt).trim(),
        championship: doc.championship,
        divisions: doc.divisions,
      };
    }
    return normalizeFromAdminDoc(doc, leagueOrderIndex);
  }, [doc, leagueOrderIndex]);

  useEffect(() => {
    if (!normalized || tab !== "auto") return;
    const champResolved = Boolean(normalized?.championship?.resolvedAt);
    const divResolved = Boolean(normalized?.divisionResolvedAt);
    if (champResolved) setTab("championship");
    else if (divResolved) setTab("divisions");
    else setTab("divisions");
  }, [normalized, tab]);

  if (loading) {
    return <div className="text-sm text-muted">Loading wagers…</div>;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-subtle bg-panel/40 p-6">
        <div className="text-sm text-foreground">{error}</div>
        <div className="mt-2 text-xs text-muted">If you just sent wagers in, the tracker may not be published yet.</div>
      </div>
    );
  }

  const champResolved = Boolean(normalized?.championship?.resolvedAt);
  const divResolved = Boolean(normalized?.divisionResolvedAt);
  const nothingResolved = !champResolved && !divResolved;

  const divisions = normalized?.divisions || {};
  const divisionNames = Object.keys(divisions).sort((a, b) => a.localeCompare(b));

  const activeTab = tab === "auto" ? "divisions" : tab;

  const toggleDiv = (name) => {
    setOpenDivs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ✅ Championship winner lookup for table tags
  const champWinners = {
    mainKey: safeStr(normalized?.championship?.mainPot?.winnerKey).trim(),
    side1Key: safeStr(normalized?.championship?.sidePots?.[0]?.winnerKey).trim(),
    side2Key: safeStr(normalized?.championship?.sidePots?.[1]?.winnerKey).trim(),
  };


  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">Big Game Wagers</h1>
              <SmallBadge>Season {season}</SmallBadge>
              {normalized?.updatedAt ? <SmallBadge>Updated {new Date(normalized.updatedAt).toLocaleString()}</SmallBadge> : null}
            </div>
            <p className="text-sm text-muted">
              Division pots are ${""}
              <span className="text-foreground">$25</span> each. Championship wagers are ${""}
              <span className="text-foreground">$50 increments</span> with side pots at $50 / $100 / $150.
            </p>
          </div>

          {/* <div className="flex flex-wrap gap-2">
            <Link
              href="/big-game"
              className="inline-flex items-center justify-center rounded-xl border border-subtle bg-panel px-4 py-2 text-xs font-semibold tracking-[0.15em] uppercase text-foreground hover:border-accent/40 transition"
            >
              ← Big Game
            </Link>
          </div> */}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("championship")}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold tracking-[0.15em] uppercase transition ${
              activeTab === "championship" ? "border-accent/60 bg-accent/10 text-accent" : "border-subtle bg-panel text-muted hover:border-accent/40"
            }`}
          >
            Championship
            {champResolved ? " ✅" : ""}
          </button>
          <button
            type="button"
            onClick={() => setTab("divisions")}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold tracking-[0.15em] uppercase transition ${
              activeTab === "divisions" ? "border-accent/60 bg-accent/10 text-accent" : "border-subtle bg-panel text-muted hover:border-accent/40"
            }`}
          >
            Division Wagers
            {divResolved ? " ✅" : ""}
          </button>
        </div>

        {nothingResolved ? (
          <div className="mt-4 rounded-2xl border border-subtle bg-panel/40 p-4 text-sm text-muted">
            Wagers are still being sent in. Check back once Week 16 or Week 17 has been resolved.
          </div>
        ) : null}
      </Card>

      {activeTab === "championship" ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold">Championship</h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <SmallBadge>Week 17</SmallBadge>
              {champResolved ? <SmallBadge>Resolved {new Date(normalized.championship.resolvedAt).toLocaleString()}</SmallBadge> : <SmallBadge>Pending</SmallBadge>}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Main Pot</div>
              <div className="mt-2 text-sm text-muted">Wagers</div>
              <div className="text-lg font-semibold">{fmtMoney(normalized.championship.mainPot.wagers)}</div>
              <div className="mt-2 text-sm text-muted">Bonus</div>
              <div className="text-lg font-semibold">+{fmtMoney(normalized.championship.mainPot.bonus)}</div>
              <div className="mt-2 text-sm text-muted">Total</div>
              <div className="text-lg font-semibold">{fmtMoney(normalized.championship.mainPot.total)}</div>
            </div>

            <div className="rounded-2xl border border-subtle bg-panel/40 p-4 md:col-span-2">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Winner</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="text-lg font-semibold">{normalized.championship.mainPot.winner || "—"}</div>
                {normalized.championship.mainPot.winnerDivision ? <SmallBadge>{normalized.championship.mainPot.winnerDivision}</SmallBadge> : null}
                {champResolved ? <SmallBadge>{normalized.championship.mainPot.winnerPts.toFixed(2)} pts</SmallBadge> : null}
              </div>
              {(() => {
                const mw = normalized?.championship?.couldHaveWon || {};
                const sweepOwner = safeStr(mw?.sweepOwner).trim();

                const ppAll = safeArray(mw?.perPerson);

                const mainTotal = Number(normalized?.championship?.mainPot?.total ?? 0) || 0;
                const side1Pool = Number(normalized?.championship?.sidePots?.[0]?.pool ?? 0) || 0;
                const side2Pool = Number(normalized?.championship?.sidePots?.[1]?.pool ?? 0) || 0;

                const pots = [
                  { key: "main", label: "Main Pot", amount: mainTotal },
                  { key: "side1", label: "Side Pot 1", amount: side1Pool },
                  { key: "side2", label: "Side Pot 2", amount: side2Pool },
                ];

                const sumWins = (p) => {
                  let total = 0;
                  if (p?.wouldWin?.main) total += mainTotal;
                  if (p?.wouldWin?.side1) total += side1Pool;
                  if (p?.wouldWin?.side2) total += side2Pool;
                  return total;
                };

                const winParts = (p) => {
                  const parts = [];
                  if (p?.wouldWin?.main) parts.push(`Main Pot (${fmtMoney(mainTotal)})`);
                  if (p?.wouldWin?.side1) parts.push(`Side Pot 1 (${fmtMoney(side1Pool)})`);
                  if (p?.wouldWin?.side2) parts.push(`Side Pot 2 (${fmtMoney(side2Pool)})`);
                  return parts;
                };

                // Only show people who could win at least one pot by maxing
                const interesting = ppAll.filter((p) => p?.wouldWin?.main || p?.wouldWin?.side1 || p?.wouldWin?.side2);

                // ---- Special case: the ACTUAL Main Pot winner who could have added side pots by betting more
                const actualMainWinnerKey = safeStr(normalized?.championship?.mainPot?.winnerKey).trim();
                const actualMainWinnerName = safeStr(normalized?.championship?.mainPot?.winner).trim();

                const actualMainWinnerRow = actualMainWinnerKey ? ppAll.find((p) => safeStr(p?.entryKey).trim() === actualMainWinnerKey) : null;

                // If they already won main, we only care about side pots they could have also won by maxing.
                const mainWinnerCouldAddSide1 = Boolean(actualMainWinnerRow?.wouldWin?.side1);
                const mainWinnerCouldAddSide2 = Boolean(actualMainWinnerRow?.wouldWin?.side2);
                const mainWinnerMissed = (mainWinnerCouldAddSide1 ? side1Pool : 0) + (mainWinnerCouldAddSide2 ? side2Pool : 0);

                const mainWinnerWouldSweep =
                  Boolean(actualMainWinnerName) &&
                  (mainWinnerCouldAddSide1 && mainWinnerCouldAddSide2) &&
                  // they already won main in reality, so this is "sweep by maxing"
                  true;

                // For the "maxed individually" list, don't repeat the sweepOwner from the fun fact line
                const pp = sweepOwner ? interesting.filter((p) => safeStr(p?.ownerName).trim() !== sweepOwner) : interesting;

                const hasAny = Boolean(sweepOwner || pp.length || (actualMainWinnerName && mainWinnerMissed > 0));
                if (!hasAny) return null;

                return (
                  <div className="mt-3 rounded-xl border border-subtle bg-panel/60 px-4 py-3 text-sm">
                    {/* 1) Sweeper fun fact (single sentence only) */}
                    {sweepOwner ? (
                      <>
                        <span className="text-muted">Fun fact:</span>{" "}
                        <span className="text-foreground font-semibold">{sweepOwner}</span>{" "}
                        <span className="text-muted">would have</span>{" "}
                        <span className="text-foreground font-semibold">swept</span>{" "}
                        <span className="text-muted">
                          the championship pots (Main + Side Pot 1 + Side Pot 2) if they had maxed their bet — worth{" "}
                          <span className="text-foreground font-semibold">{fmtMoney(mainTotal + side1Pool + side2Pool)}</span>.
                        </span>
                      </>
                    ) : null}

                    {/* 2) Special message for the actual Main Pot winner who could’ve added side pots */}
                    {actualMainWinnerName && mainWinnerMissed > 0 ? (
                      <div className={`${sweepOwner ? "mt-3 pt-3 border-t border-subtle/60" : ""} text-xs text-muted`}>
                        {(() => {
                          const missedParts = [];
                          if (mainWinnerCouldAddSide1) missedParts.push(`Side Pot 1 (${fmtMoney(side1Pool)})`);
                          if (mainWinnerCouldAddSide2) missedParts.push(`Side Pot 2 (${fmtMoney(side2Pool)})`);

                          const missedLabel = missedParts.join(" + ");

                          return (
                            <>
                              <span className="text-foreground font-semibold">{actualMainWinnerName}</span>{" "}
                              <span className="text-muted">
                                only bet on the Main Pot and missed{" "}
                                <span className="text-foreground font-semibold">{missedLabel}</span>{" "}
                                ={" "}
                                <span className="text-foreground font-semibold">{fmtMoney(mainWinnerMissed)}</span>.{" "}
                                {mainWinnerWouldSweep ? (
                                  <>
                                    They would have <span className="text-foreground font-semibold">swept</span> by maxing to{" "}
                                    {fmtMoney(150)} (total possible{" "}
                                    <span className="text-foreground font-semibold">{fmtMoney(mainTotal + side1Pool + side2Pool)}</span>).
                                  </>
                                ) : (
                                  <>
                                    They could have added those by maxing to {fmtMoney(150)}.
                                  </>
                                )}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}


                    {/* 3) If these owners maxed individually (with $ amounts per pot + total) */}
                    {pp.length ? (
                      <div className={`${sweepOwner || (actualMainWinnerName && mainWinnerMissed > 0) ? "mt-3 pt-3 border-t border-subtle/60" : ""}`}>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-muted">If these owners maxed individually</div>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
                          {pp
                            .slice()
                            .sort((a, b) => sumWins(b) - sumWins(a) || Number(b?.pts || 0) - Number(a?.pts || 0) || safeStr(a?.ownerName).localeCompare(safeStr(b?.ownerName)))
                            .slice(0, 8)
                            .map((p) => {
                              const parts = winParts(p);
                              if (!parts.length) return null;

                              const totalCouldWin = sumWins(p);

                              return (
                                <div key={`${p.entryKey || ""}|||${p.ownerName}|||${p.division}|||${p.pts}`}>
                                  • <span className="text-foreground font-semibold">{p.ownerName}</span>{" "}
                                  {p.division ? <span className="text-muted">({p.division})</span> : null}{" "}
                                  <span className="text-muted">
                                    could have won{" "}
                                    <span className="text-foreground font-semibold">{parts.join(" + ")}</span>{" "}
                                    ={" "}
                                    <span className="text-foreground font-semibold">{fmtMoney(totalCouldWin)}</span>{" "}
                                    by maxing to {fmtMoney(p.maxWager)} (scored{" "}
                                  </span>
                                  <span className="text-foreground font-semibold">{Number(p.pts || 0).toFixed(2)}</span>{" "}
                                  <span className="text-muted">pts; originally wagered {fmtMoney(p.originalWager)}).</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}


            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {normalized.championship.sidePots.map((p) => (
              <div key={p.threshold} className="rounded-2xl border border-subtle bg-panel/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-muted">{p.label}</div>
                  <Coin amount={50} title="Each side pot is a $50 increment" />
                </div>
                <div className="mt-2 text-sm text-muted">Pool</div>
                <div className="text-lg font-semibold">{fmtMoney(p.pool)}</div>
                <div className="mt-2 text-sm text-muted">Winner</div>
                <div className="font-semibold">{p.winner || "—"}</div>
                {p.winnerDivision ? (
                  <div className="text-xs text-muted mt-1">
                    {p.winnerDivision}
                    {p.winner ? ` · ${p.winnerPts.toFixed(2)} pts` : ""}
                  </div>
                ) : null}
                <div className="mt-2 text-xs text-muted">Entrants: {p.entrants.length}</div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold">Wagers</h3>
              <div className="text-xs text-muted">Coins represent each $50 increment.</div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.25em] text-muted">
                    <th className="text-left py-2 pr-3">Division</th>
                    <th className="text-left py-2 pr-3">Owner</th>
                    <th className="text-left py-2 pr-3">Wager</th>
                    <th className="text-right py-2 pr-3">Wk17</th>
                  </tr>
                </thead>
                <tbody>
                  {normalized.championship.bettors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-sm text-muted">
                        No championship wagers yet.
                      </td>
                    </tr>
                  ) : (
                    [...normalized.championship.bettors]
                      .sort((a, b) => b.wager - a.wager || a.ownerName.localeCompare(b.ownerName))
                      .map((r) => {
                        const tags = [];
                        if (champResolved && champWinners.mainKey && r.entryKey === champWinners.mainKey) tags.push("Main Pot");
                        if (champResolved && champWinners.side1Key && r.entryKey === champWinners.side1Key) tags.push("Side Pot 1");
                        if (champResolved && champWinners.side2Key && r.entryKey === champWinners.side2Key) tags.push("Side Pot 2");


                        return (
                          <tr key={r.entryKey} className="border-t border-subtle/70">
                            <td className="py-2 pr-3 text-muted whitespace-nowrap">{r.division}</td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground whitespace-nowrap">{r.ownerName}</span>
                                {tags.length ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {tags.map((t) => (
                                      <WinnerTag key={t}>{t}</WinnerTag>
                                    ))}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="text-muted tabular-nums w-14">{fmtMoney(r.wager)}</div>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: Math.min(4, Math.floor(r.wager / 50)) }).map((_, i) => (
                                    <Coin key={i} amount={50} title="$50" />
                                  ))}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-muted">{champResolved ? r.wk17.toFixed(2) : ""}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {normalized.championship.nonBettors.length ? (
              <div className="mt-4 rounded-2xl border border-subtle bg-panel/20 p-4">
                <div className="text-xs text-muted">
                  Didn’t bet ({normalized.championship.nonBettors.length}): they still keep anything banked from Week 16.
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {normalized.championship.nonBettors
                    .slice()
                    .sort((a, b) => a.ownerName.localeCompare(b.ownerName))
                    .map((r) => (
                      <span key={r.entryKey} className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-xs">
                        <span className="text-foreground font-semibold">{r.ownerName}</span>
                        <span className="text-muted">{r.division}</span>
                        {champResolved ? <span className="text-muted">· {r.wk17.toFixed(2)} pts</span> : null}
                      </span>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold">Division Wagers</h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <SmallBadge>Week 16</SmallBadge>
              {divResolved ? <SmallBadge>Resolved {new Date(normalized.divisionResolvedAt).toLocaleString()}</SmallBadge> : <SmallBadge>Pending</SmallBadge>}
            </div>
          </div>

          <p className="mt-2 text-sm text-muted">
            Each league winner can enter Pot #1 and Pot #2 (each is $25). Coins show who entered and the winners are highlighted once Week 16 is resolved.
          </p>

          <div className="mt-5 space-y-4">
            {divisionNames.length === 0 ? (
              <div className="rounded-2xl border border-subtle bg-panel/40 p-6 text-center text-sm text-muted">No division wager data yet.</div>
            ) : (
              divisionNames.map((div) => {
                const d = divisions[div] || {};
                const entries = safeArray(d.entries);
                const isOpen = openDivs.has(div) || (!openDivs.size && divisionNames.length <= 3);

                const pot1Count = entries.filter((e) => e.pot1Entered).length;
                const pot2Count = entries.filter((e) => e.pot2Entered).length;

                const pot1Winner = safeStr(d?.pot1?.winner).trim();
                const pot2Winner = safeStr(d?.pot2?.winner).trim();

                return (
                  <div key={div} className="rounded-2xl border border-subtle bg-panel/20 p-4">
                    <button type="button" onClick={() => toggleDiv(div)} className="w-full text-left">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold">{div}</h3>
                            <SmallBadge>{entries.length} eligible</SmallBadge>
                            <SmallBadge>
                              Pot1 {pot1Count} ({fmtMoney(pot1Count * 25)})
                            </SmallBadge>
                            <SmallBadge>
                              Pot2 {pot2Count} ({fmtMoney(pot2Count * 25)})
                            </SmallBadge>
                          </div>
                          <div className="text-xs text-muted">
                            Pot1 winner: <span className="text-foreground">{pot1Winner || "—"}</span> · Pot2 winner:{" "}
                            <span className="text-foreground">{pot2Winner || "—"}</span>
                          </div>
                        </div>

                        <div className="text-xs text-muted">{isOpen ? "Hide" : "Show"}</div>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[11px] uppercase tracking-[0.25em] text-muted">
                              <th className="text-left py-2 pr-3">League</th>
                              <th className="text-left py-2 pr-3">Owner</th>
                              <th className="text-left py-2 pr-3">Bets</th>
                              <th className="text-right py-2 pr-3">Wk16</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((e) => {
                              const tags = [];
                              const pot1WinnerKey = safeStr(d?.pot1?.winnerKey).trim();
                              const pot2WinnerKey = safeStr(d?.pot2?.winnerKey).trim();

                              if (divResolved && pot1WinnerKey && e.k === pot1WinnerKey) tags.push("Pot 1 Winner");
                              if (divResolved && pot2WinnerKey && e.k === pot2WinnerKey) tags.push("Pot 2 Winner");


                              return (
                                <tr key={e.k} className="border-t border-subtle/70">
                                  <td className="py-2 pr-3 text-muted whitespace-nowrap">{e.leagueName}</td>
                                  <td className="py-2 pr-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-foreground whitespace-nowrap">{e.ownerName}</span>
                                      {tags.length ? (
                                        <span className="flex items-center gap-1 flex-wrap">
                                          {tags.map((t) => (
                                            <WinnerTag key={t}>{t}</WinnerTag>
                                          ))}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="py-2 pr-3">
                                    <div className="flex items-center gap-2">
                                      {e.pot1Entered ? <Coin amount={25} title="Pot #1" /> : <span className="text-muted">—</span>}
                                      {e.pot2Entered ? <Coin amount={25} title="Pot #2" /> : null}
                                    </div>
                                  </td>
                                  <td className="py-2 pr-3 text-right tabular-nums text-muted">{divResolved ? e.wk16.toFixed(2) : ""}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <div>
                        Pools: Pot1 {fmtMoney(d?.pot1?.pool || 0)} · Pot2 {fmtMoney(d?.pot2?.pool || 0)}
                      </div>
                      <div>Resolved: {d?.pot1?.resolvedAt ? new Date(d.pot1.resolvedAt).toLocaleString() : "—"}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function BigGameWagerTracker({ season }) {
  const s = Number(season) || CURRENT_SEASON;
  return (
    <SectionManifestGate section="biggame-wagers" season={s} pollMs={0}>
      {({ version }) => <TrackerInner season={s} version={version} />}
    </SectionManifestGate>
  );
}
