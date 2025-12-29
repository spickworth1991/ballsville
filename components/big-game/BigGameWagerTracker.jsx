"use client";

import { useEffect, useMemo, useState } from "react";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function entryKey(p) {
  const division = safeStr(p?.division || "").trim();
  const leagueName = safeStr(p?.leagueName || "").trim();
  const ownerName = safeStr(p?.ownerName || "").trim();
  return `${division}|||${leagueName}|||${ownerName}`;
}

function fmtMoney(n) {
  const x = typeof n === "number" ? n : parseFloat(n);
  if (Number.isNaN(x)) return "$0";
  return `$${x.toFixed(0)}`;
}

function Coin({ label, size = "md" }) {
  const cls =
    size === "sm"
      ? "h-7 w-7 text-[10px]"
      : size === "lg"
      ? "h-10 w-10 text-xs"
      : "h-8 w-8 text-[11px]";
  return (
    <div
      className={`inline-flex ${cls} items-center justify-center rounded-full border border-amber-200/25 bg-gradient-to-br from-amber-200/20 via-amber-100/10 to-amber-500/20 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.10)]`}
      title={label}
    >
      <span className="font-semibold tracking-wide">{label}</span>
    </div>
  );
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

export default function BigGameWagerTracker({ season }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr("");
      try {
        const url = `/r2/data/biggame/wagers_${encodeURIComponent(season)}.json`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load wager tracker (${res.status})`);
        const json = await res.json();
        if (!cancelled) setState(json);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load.");
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
  const champ = state?.championship || {};
  const champEntrantsAll = safeArray(champ?.byDivisionWinner);

  const derived = useMemo(() => {
    const entryFee = Number(state?.divisionWagers?.entryFee || 25);

    const byDiv = {};
    for (const div of Object.keys(eligibilityByDivision || {})) {
      const elig = safeArray(eligibilityByDivision[div]);
      const d = wagersByDivision?.[div] || {};
      const pot1 = d?.pot1 || {};
      const pot2 = d?.pot2 || {};

      const pot1Count = elig.filter((e) => Boolean(pot1?.entrants?.[entryKey(e)] || pot1?.entrants?.[safeStr(e?.ownerName).trim()])).length;
      const pot2Count = elig.filter((e) => Boolean(pot2?.entrants?.[entryKey(e)] || pot2?.entrants?.[safeStr(e?.ownerName).trim()])).length;

      byDiv[div] = {
        pot1Count,
        pot2Count,
        pot1Pool: pot1Count * entryFee,
        pot2Pool: pot2Count * entryFee,
      };
    }

    const points = champ?.points || {};
    const wouldHaveWonName = safeStr(champ?.wouldHaveWonName).trim();
    const wouldHaveWonKey = safeStr(champ?.wouldHaveWonKey).trim();
    const pots = champ?.pots || {};

    // fallback compute if older json doesn't have pots
    const fallbackPots = (() => {
      const thresholds = [50, 100, 150];
      const names = ["main", "side1", "side2"];
      const out = {};
      for (let i = 0; i < thresholds.length; i++) {
        const t = thresholds[i];
        const key = names[i];
        const entrants = champEntrantsAll.filter((r) => Number(r?.wager || 0) >= t);
        let winnerKey = "";
        let winnerName = "";
        let best = -Infinity;
        for (const r of entrants) {
          const k = safeStr(r?.entryKey).trim() || entryKey(r);
          const pts = Number(points?.[k] ?? 0);
          if (pts > best) {
            best = pts;
            winnerKey = k;
            winnerName = safeStr(r?.ownerName).trim();
          }
        }
        out[key] = {
          threshold: t,
          pool: entrants.length * 50,
          winnerKey,
          winner: winnerName,
        };
      }
      return out;
    })();

    return {
      entryFee,
      byDiv,
      champ: {
        wouldHaveWonName,
        wouldHaveWonKey,
        pots: {
          main: pots.main || fallbackPots.main,
          side1: pots.side1 || fallbackPots.side1,
          side2: pots.side2 || fallbackPots.side2,
        },
      },
    };
  }, [state, eligibilityByDivision, wagersByDivision, champ, champEntrantsAll]);

  if (loading) return <div className="text-sm text-muted">Loading wagers…</div>;
  if (err) return <div className="text-sm text-rose-200">{err}</div>;
  if (!state) return <div className="text-sm text-muted">No data.</div>;

  const champPoints = champ?.points || {};
  const champPots = derived.champ.pots;

  const champParticipants = champEntrantsAll.filter((r) => Number(r?.wager || 0) > 0);
  const nonBettorWouldHaveWon =
    derived.champ.wouldHaveWonName && !champParticipants.some((r) => safeStr(r?.ownerName).trim() === derived.champ.wouldHaveWonName);

  const potLabel = {
    main: "Main Pot",
    side1: "Side Pot 1",
    side2: "Side Pot 2",
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">Big Game Wagers</h1>
              <SmallBadge>Season {season}</SmallBadge>
              {state?.updatedAt ? <SmallBadge>Updated {new Date(state.updatedAt).toLocaleString()}</SmallBadge> : null}
            </div>
            <p className="text-sm text-muted">
              Division pots are <span className="text-foreground">{fmtMoney(derived.entryFee)}</span> per entry. Championship wagers are in
              <span className="text-foreground"> $50 increments</span>.
            </p>
          </div>
        </div>
      </Card>

      {/* Division Wagers */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold">Division Wagers</h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            <SmallBadge>Week 16</SmallBadge>
            {state?.divisionWagers?.resolvedAt ? <SmallBadge>Resolved {new Date(state.divisionWagers.resolvedAt).toLocaleString()}</SmallBadge> : null}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">Coins show which pots each league winner entered. Results show Week 16 pot winners.</p>

        <div className="mt-5 space-y-10">
          {Object.keys(eligibilityByDivision || {}).length === 0 ? (
            <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-center text-sm text-muted">No division wager data yet.</div>
          ) : (
            Object.keys(eligibilityByDivision)
              .sort((a, b) => a.localeCompare(b))
              .map((div) => {
                const elig = safeArray(eligibilityByDivision[div]);
                const d = wagersByDivision?.[div] || {};
                const pot1 = d?.pot1 || {};
                const pot2 = d?.pot2 || {};

                return (
                  <div key={div} className="rounded-2xl border border-subtle bg-panel/20 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{div}</h3>
                          <SmallBadge>{elig.length} eligible</SmallBadge>
                          <SmallBadge>
                            Pot 1 {derived.byDiv?.[div]?.pot1Count || 0} ({fmtMoney(derived.byDiv?.[div]?.pot1Pool || 0)})
                          </SmallBadge>
                          <SmallBadge>
                            Pot 2 {derived.byDiv?.[div]?.pot2Count || 0} ({fmtMoney(derived.byDiv?.[div]?.pot2Pool || 0)})
                          </SmallBadge>
                        </div>
                        <div className="text-xs text-muted">
                          Pot 1 winner: <span className="text-foreground">{safeStr(pot1?.winner) || "—"}</span> · Pot 2 winner:{" "}
                          <span className="text-foreground">{safeStr(pot2?.winner) || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-[0.25em] text-muted">
                            <th className="text-left py-2 pr-3">League</th>
                            <th className="text-left py-2 pr-3">Owner</th>
                            <th className="text-right py-2 pr-3">W1–15</th>
                            <th className="text-center py-2 px-2">Pot 1</th>
                            <th className="text-center py-2 px-2">Pot 2</th>
                            <th className="text-right py-2 pl-3">Wk16</th>
                          </tr>
                        </thead>
                        <tbody>
                          {elig.map((e) => {
                            const name = safeStr(e?.ownerName).trim();
                            const k = entryKey({ division: div, leagueName: e?.leagueName, ownerName: name });
                            const wk16 = pot1?.points?.[k] ?? pot2?.points?.[k];
                            const wk16Num = typeof wk16 === "number" ? wk16 : parseFloat(wk16);
                            const wk16Show = Number.isNaN(wk16Num) ? "" : wk16Num.toFixed(2);
                            const inPot1 = Boolean(pot1?.entrants?.[k] || pot1?.entrants?.[name]);
                            const inPot2 = Boolean(pot2?.entrants?.[k] || pot2?.entrants?.[name]);

                            return (
                              <tr key={`${div}:${e?.leagueName}:${name}`} className="border-t border-subtle/70">
                                <td className="py-2 pr-3 text-muted whitespace-nowrap">{safeStr(e?.leagueName)}</td>
                                <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{name}</td>
                                <td className="py-2 pr-3 text-right tabular-nums text-muted">{Number(e?.total || 0).toFixed(2)}</td>
                                <td className="py-2 px-2 text-center">{inPot1 ? <Coin label="$25" size="sm" /> : <span className="text-muted">—</span>}</td>
                                <td className="py-2 px-2 text-center">{inPot2 ? <Coin label="$25" size="sm" /> : <span className="text-muted">—</span>}</td>
                                <td className="py-2 pl-3 text-right tabular-nums text-muted">{wk16Show}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </Card>

      {/* Championship */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold">Championship Wagers</h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            <SmallBadge>Week 17</SmallBadge>
            {champ?.resolvedAt ? <SmallBadge>Resolved {new Date(champ.resolvedAt).toLocaleString()}</SmallBadge> : null}
          </div>
        </div>

        <p className="mt-2 text-sm text-muted">
          Only division winners who wager are eligible for the championship pots. Each $50 is its own pot layer.
        </p>

        {nonBettorWouldHaveWon ? (
          <div className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/5 px-4 py-3 text-sm text-amber-100">
            Fun note: <span className="font-semibold">{derived.champ.wouldHaveWonName}</span> would have won on points, but didn’t wager.
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {["main", "side1", "side2"].map((pot) => {
            const p = champPots?.[pot] || {};
            return (
              <div key={pot} className="rounded-2xl border border-subtle bg-panel/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-muted">{potLabel[pot]}</div>
                  <Coin label="$50" size="sm" />
                </div>
                <div className="mt-2 text-sm text-muted">Pool: <span className="text-foreground">{fmtMoney(p.pool || 0)}</span></div>
                <div className="mt-1 text-sm text-muted">Winner: <span className="text-foreground font-semibold">{safeStr(p.winner) || "—"}</span></div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.25em] text-muted">
                <th className="text-left py-2 pr-3">Division</th>
                <th className="text-left py-2 pr-3">Owner</th>
                <th className="text-left py-2 pr-3">Wager</th>
                <th className="text-right py-2 pr-3">Wk17</th>
                <th className="text-left py-2 pr-3">Won</th>
              </tr>
            </thead>
            <tbody>
              {champEntrantsAll.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-muted">
                    Championship entrants not set yet.
                  </td>
                </tr>
              ) : (
                champEntrantsAll
                  .slice()
                  .sort((a, b) => safeStr(a?.division).localeCompare(safeStr(b?.division)))
                  .map((r) => {
                    const name = safeStr(r?.ownerName).trim();
                    const div = safeStr(r?.division).trim();
                    const wager = Number(r?.wager || 0);
                    const k = safeStr(r?.entryKey).trim() || entryKey({ division: div, leagueName: r?.leagueName, ownerName: name });
                    const pts = champPoints?.[k];
                    const ptsNum = typeof pts === "number" ? pts : parseFloat(pts);

                    const won = [];
                    if (k && k === safeStr(champPots?.main?.winnerKey).trim()) won.push("Main");
                    if (k && k === safeStr(champPots?.side1?.winnerKey).trim()) won.push("Side1");
                    if (k && k === safeStr(champPots?.side2?.winnerKey).trim()) won.push("Side2");

                    return (
                      <tr key={k || `${div}:${name}`} className="border-t border-subtle/70">
                        <td className="py-2 pr-3 text-muted whitespace-nowrap">{div}</td>
                        <td className="py-2 pr-3 font-medium text-foreground whitespace-nowrap">{name}</td>
                        <td className="py-2 pr-3">
                          {wager <= 0 ? (
                            <span className="text-muted">No bet</span>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              {Array.from({ length: Math.min(3, Math.floor(wager / 50)) }).map((_, i) => (
                                <Coin key={i} label="$50" size="sm" />
                              ))}
                              <span className="text-muted tabular-nums">({fmtMoney(wager)})</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted">{Number.isNaN(ptsNum) ? "" : ptsNum.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-muted">{won.length ? won.join(", ") : "—"}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
