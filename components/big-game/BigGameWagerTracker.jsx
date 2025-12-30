"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
        resolvedAt: safeStr(pot1?.resolvedAt).trim(),
      },
      pot2: {
        pool: Number(pot2?.pool || 0),
        winner: safeStr(pot2?.winner).trim(),
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

  const wouldHaveWonRow = pickWinner(seeded);

// Hypothetical “if they bet enough to qualify” winners for each pot threshold
function wouldHaveWonForThreshold(threshold) {
  if (!wouldHaveWonRow) {
    return {
      threshold,
      ownerName: "",
      division: "",
      pts: 0,
      wager: 0,
      qualified: false,
    };
  }
  const wager = Number(wouldHaveWonRow.wager ?? 0) || 0;
  return {
    threshold,
    ownerName: wouldHaveWonRow.ownerName || "",
    division: wouldHaveWonRow.division || "",
    pts: Number(wouldHaveWonRow.wk17 ?? 0) || 0,
    wager,
    qualified: wager >= threshold,
  };
}

const wouldHaveWonMain = wouldHaveWonForThreshold(50);
const wouldHaveWonSide1 = wouldHaveWonForThreshold(100);
const wouldHaveWonSide2 = wouldHaveWonForThreshold(150);

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
        winnerDivision: side1WinnerRow?.division || "",
        winnerPts: Number(side1WinnerRow?.wk17 ?? 0) || 0,
      },
      {
        label: "Side Pot 2",
        threshold: 150,
        entrants: side2Entrants,
        pool: side2Entrants.length * 50,
        winner: side2WinnerRow?.ownerName || "",
        winnerDivision: side2WinnerRow?.division || "",
        winnerPts: Number(side2WinnerRow?.wk17 ?? 0) || 0,
      },
    ],

    wouldHaveWon: {
      ownerName: wouldHaveWonMain.ownerName,
      division: wouldHaveWonMain.division,
      pts: wouldHaveWonMain.pts,
      didNotBet: Boolean(wouldHaveWonRow && !(Number(wouldHaveWonRow.wager ?? 0) > 0)),
      // NEW: side-pot hypotheticals
      sidePotsIfBet: [wouldHaveWonSide1, wouldHaveWonSide2],
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
    main: safeStr(normalized?.championship?.mainPot?.winner).trim(),
    side1: safeStr(normalized?.championship?.sidePots?.[0]?.winner).trim(),
    side2: safeStr(normalized?.championship?.sidePots?.[1]?.winner).trim(),
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

          <div className="flex flex-wrap gap-2">
            <Link
              href="/big-game"
              className="inline-flex items-center justify-center rounded-xl border border-subtle bg-panel px-4 py-2 text-xs font-semibold tracking-[0.15em] uppercase text-foreground hover:border-accent/40 transition"
            >
              ← Big Game
            </Link>
          </div>
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
              {normalized.championship.wouldHaveWon?.didNotBet ? (
              <div className="mt-3 rounded-xl border border-subtle bg-panel/60 px-4 py-3 text-sm">
                <span className="text-muted">Fun fact:</span>{" "}
                <span className="text-foreground font-semibold">{normalized.championship.wouldHaveWon.ownerName}</span>{" "}
                {normalized.championship.wouldHaveWon.division ? (
                  <span className="text-muted">({normalized.championship.wouldHaveWon.division})</span>
                ) : null}{" "}
                <span className="text-muted">would have won the main pot with</span>{" "}
                <span className="text-foreground font-semibold">{normalized.championship.wouldHaveWon.pts.toFixed(2)}</span>{" "}
                <span className="text-muted">— but didn’t bet.</span>

                {safeArray(normalized.championship.wouldHaveWon?.sidePotsIfBet)
                  .filter((p) => p && p.ownerName && !p.qualified)
                  .length ? (
                  <div className="mt-2 text-xs text-muted">
                    Also, if they had bet enough to qualify:
                    <div className="mt-1 flex flex-col gap-1">
                      {safeArray(normalized.championship.wouldHaveWon?.sidePotsIfBet)
                        .filter((p) => p && p.ownerName && !p.qualified)
                        .map((p) => (
                          <div key={p.threshold}>
                            • <span className="text-foreground font-semibold">{p.ownerName}</span>{" "}
                            <span className="text-muted">
                              would’ve won Side Pot {p.threshold === 100 ? "1" : "2"} ({fmtMoney(p.threshold)} threshold) with{" "}
                              <span className="text-foreground font-semibold">{Number(p.pts || 0).toFixed(2)}</span> pts
                              {Number.isFinite(Number(p.wager)) ? ` (they wagered ${fmtMoney(p.wager)}).` : "."}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

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
                        if (champResolved && champWinners.main && r.ownerName === champWinners.main) tags.push("Main Pot");
                        if (champResolved && champWinners.side1 && r.ownerName === champWinners.side1) tags.push("Side Pot 1");
                        if (champResolved && champWinners.side2 && r.ownerName === champWinners.side2) tags.push("Side Pot 2");

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
                              if (divResolved && pot1Winner && e.ownerName === pot1Winner) tags.push("Pot 1 Winner");
                              if (divResolved && pot2Winner && e.ownerName === pot2Winner) tags.push("Pot 2 Winner");

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
