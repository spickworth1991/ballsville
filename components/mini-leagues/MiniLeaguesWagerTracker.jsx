"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { safeArray, safeStr } from "@/lib/safe";


// Owner names can appear in multiple leagues.
// Any wager/eligibility/points must be keyed by the roster instance (division + leagueName + ownerName).
function entryKey(p) {
  const division = safeStr(p?.division || "").trim();
  const leagueName = safeStr(p?.leagueName || "").trim();
  const ownerName = safeStr(p?.ownerName || "").trim();
  return `${division}|||${leagueName}|||${ownerName}`;
}

function fmtMoney(n) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return "$0";
  return `$${x.toFixed(0)}`;
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
function WinnerTag({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
      {children}
    </span>
  );
}

function normalizeDoc(doc) {
  const eligibilityByDivision = doc?.eligibility?.byDivision || {};
  const wk15 = doc?.week15 || {};
  const decisions = wk15?.decisions || {};
  const points = wk15?.points || {};
  const results = wk15?.results || {};

  const divisions = {};
  for (const div of Object.keys(eligibilityByDivision)) {
    const raw = safeArray(eligibilityByDivision[div]);
    const entries = raw
      .map((e) => {
        const leagueName = safeStr(e?.leagueName).trim();
        const ownerName = safeStr(e?.ownerName).trim();
        const k = entryKey({ division: div, leagueName, ownerName });
        const d = decisions?.[k] || {};
        return {
          division: div,
          leagueName,
          ownerName,
          total: Number(e?.total ?? 0) || 0,
          k,
          decision: safeStr(d?.decision || "").trim() || "pending",
          wk15: Number(points?.[k] ?? 0) || 0,
        };
      })
      .filter((e) => e.leagueName && e.ownerName);

    divisions[div] = {
      entries,
      divisionBonus: {
        winner: safeStr(results?.divisionBonus?.[div]?.winner || "").trim(),
        winnerKey: safeStr(results?.divisionBonus?.[div]?.winnerKey || "").trim(),
        pts: Number(results?.divisionBonus?.[div]?.pts ?? 0) || 0,
        bonus: Number(results?.divisionBonus?.[div]?.bonus ?? 0) || 0,
      },
    };
  }

  const wagerPot = results?.wagerPot || {};
  const champ = results?.championship || {};
  const wagerMisses = safeArray(results?.wagerMisses);

  return {
    updatedAt: safeStr(doc?.updatedAt).trim(),
    computedAt: safeStr(doc?.eligibility?.computedAt).trim(),
    week15ResolvedAt: safeStr(wk15?.resolvedAt).trim(),
    coin: Number(wk15?.coin ?? 30) || 30,
    divisionBonusAmount: Number(wk15?.divisionBonus ?? 30) || 30,
    champBonusAmount: Number(wk15?.champBonus ?? 100) || 100,
    wagerBonusAmount: Number(wk15?.wagerBonus ?? 60) || 60,
    wagerPot: {
      pool: Number(wagerPot?.pool ?? 0) || 0,
      bonus: Number(wagerPot?.bonus ?? 0) || 0,
      total: Number(wagerPot?.total ?? 0) || 0,
      winner: safeStr(wagerPot?.winner || "").trim(),
      winnerDivision: safeStr(wagerPot?.winnerDivision || "").trim(),
      winnerPts: Number(wagerPot?.winnerPts ?? 0) || 0,
    },
    championship: {
      winner: safeStr(champ?.winner || "").trim(),
      winnerDivision: safeStr(champ?.winnerDivision || "").trim(),
      winnerPts: Number(champ?.winnerPts ?? 0) || 0,
      bonus: Number(champ?.bonus ?? 0) || 0,
    },
    wagerMisses: wagerMisses.map((m) => ({
      ownerName: safeStr(m?.ownerName).trim(),
      division: safeStr(m?.division).trim(),
      leagueName: safeStr(m?.leagueName).trim(),
      wk15: Number(m?.wk15 ?? 0) || 0,
      key: safeStr(m?.key || m?.winnerKey || "").trim(),
    })),
    divisions,
  };
}

function buildWagersUrl(season, version) {
  return `/r2/data/mini-leagues/wagers_${encodeURIComponent(season)}.json?v=${version}`;
}

export default function MiniLeaguesWagerTracker({ season, version }) {
  const s = String(season);

  if (version == null) {
    return (
      <SectionManifestGate section="mini-leagues-wagers" season={s} pollMs={0}>
        <MiniLeaguesWagerTracker season={season} />
      </SectionManifestGate>
    );
  }

  const [rawDoc, setRawDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(buildWagersUrl(s, version), { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setRawDoc(data);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [s, version]);

  const view = useMemo(() => normalizeDoc(rawDoc || {}), [rawDoc]);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading wager tracker…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-rose-200">Couldn’t load wager tracker.</p>
        <p className="mt-2 text-xs text-muted">{String(error)}</p>
      </Card>
    );
  }

  const divisionNames = Object.keys(view.divisions || {}).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SmallBadge>Mini Leagues</SmallBadge>
              <SmallBadge>Season {s}</SmallBadge>
            </div>
            <p className="mt-3 text-sm text-muted">
              League winners after Week 14 earn a {fmtMoney(view.coin)} coin. They can <b>keep</b> it and chase the
              Division (+{fmtMoney(view.divisionBonusAmount)}) and Championship (+{fmtMoney(view.champBonusAmount)}) bonuses,
              or <b>wager</b> it for the pooled pot + a +{fmtMoney(view.wagerBonusAmount)} wager bonus.
            </p>
          </div>

          <div className="text-xs text-muted">
            <div>Updated: {view.updatedAt ? new Date(view.updatedAt).toLocaleString() : "—"}</div>
            <div>Resolved: {view.week15ResolvedAt ? new Date(view.week15ResolvedAt).toLocaleString() : "—"}</div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Wager Pot</h2>
            {view.wagerPot.winner ? <WinnerTag>Winner</WinnerTag> : <SmallBadge>Pending</SmallBadge>}
          </div>
          <div className="mt-3 text-sm text-muted space-y-1">
            <div>Pool: <span className="text-foreground font-semibold">{fmtMoney(view.wagerPot.pool)}</span></div>
            <div>Wager Bonus: <span className="text-foreground font-semibold">{fmtMoney(view.wagerPot.bonus)}</span></div>
            <div>Total Paid: <span className="text-foreground font-semibold">{fmtMoney(view.wagerPot.total)}</span></div>
          </div>
          <div className="mt-4">
            {view.wagerPot.winner ? (
              <p className="text-sm text-foreground">
                <b>{view.wagerPot.winner}</b> ({view.wagerPot.winnerDivision || "—"}) — {view.wagerPot.winnerPts} pts
              </p>
            ) : (
              <p className="text-sm text-muted">Waiting for Week 15 results.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Championship Bonus</h2>
            {view.championship.winner ? <WinnerTag>Winner</WinnerTag> : <SmallBadge>Pending</SmallBadge>}
          </div>
          <div className="mt-3 text-sm text-muted">
            Bonus: <span className="text-foreground font-semibold">{fmtMoney(view.championship.bonus || view.champBonusAmount)}</span>
          </div>
          <div className="mt-4">
            {view.championship.winner ? (
              <p className="text-sm text-foreground">
                <b>{view.championship.winner}</b> ({view.championship.winnerDivision || "—"}) — {view.championship.winnerPts} pts
              </p>
            ) : (
              <p className="text-sm text-muted">Waiting for Week 15 results.</p>
            )}
          </div>
        </Card>
      </div>

      {view.wagerMisses.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Who should have wagered?</h2>
            <SmallBadge>Week 15</SmallBadge>
          </div>
          <p className="mt-3 text-sm text-muted">
            These managers chose <b>Keep</b> but scored enough to beat (or tie) the best wager score — meaning they could’ve won the pooled pot + {fmtMoney(view.wagerBonusAmount)}.
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
                {view.wagerMisses.map((m) => (
                  <tr key={m.key} className="border-t border-subtle">
                    <td className="py-2 pr-4 text-muted">{m.division}</td>
                    <td className="py-2 pr-4 text-muted">{m.leagueName}</td>
                    <td className="py-2 pr-4 text-foreground">{m.ownerName}</td>
                    <td className="py-2 text-right text-foreground font-semibold">{m.wk15}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {divisionNames.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No Week 14 eligibility has been imported yet.</p>
            <p className="mt-3 text-xs text-muted">
              If you’re an admin, go to <Link className="underline hover:text-white" href="/admin/mini-leagues/wagers">/admin/mini-leagues/wagers</Link>.
            </p>
          </Card>
        ) : (
          divisionNames.map((div) => {
            const d = view.divisions[div];
            const entries = safeArray(d?.entries);
            const winner = d?.divisionBonus?.winner;
            const winnerPts = d?.divisionBonus?.pts;
            const winnerBonus = d?.divisionBonus?.bonus;

            return (
              <Card key={div}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{div}</h3>
                    <p className="text-xs text-muted">Week 14 league winners (coins) and Week 15 status.</p>
                  </div>
                  <div className="text-right">
                    {winner ? (
                      <div className="space-y-1">
                        <WinnerTag>Division Bonus</WinnerTag>
                        <div className="text-sm text-foreground">
                          <b>{winner}</b> — {winnerPts} pts (+{fmtMoney(winnerBonus || view.divisionBonusAmount)})
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
                      {entries.map((e) => (
                        <tr key={e.k}>
                          <td className="py-2 pr-4 text-foreground">{e.leagueName}</td>
                          <td className="py-2 pr-4 text-foreground">{e.ownerName}</td>
                          <td className="py-2 pr-4 text-right text-muted">{e.total}</td>
                          <td className="py-2 pr-4 text-center">
                            <span
                              className={
                                e.decision === "wager"
                                  ? "inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
                                  : e.decision === "keep"
                                  ? "inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200"
                                  : "inline-flex rounded-full border border-subtle bg-panel/60 px-2 py-0.5 text-[11px] font-semibold text-muted"
                              }
                            >
                              {e.decision}
                            </span>
                          </td>
                          <td className="py-2 text-right text-foreground">{e.wk15}</td>
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
    </div>
  );
}