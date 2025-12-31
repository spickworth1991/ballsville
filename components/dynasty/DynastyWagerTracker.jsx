"use client";

import { useEffect, useMemo, useState } from "react";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";

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
  const wk17 = doc?.week17 || {};
  const decisions = wk17?.decisions || {};
  const points = wk17?.points || {};
  const results = wk17?.results || {};
  const divisionAwards = results?.divisions || {};
  const leagueWinners = results?.leagueWinners || {};

  const wk18 = doc?.week18 || {};
  const showdown = wk18?.showdown || {};

  const divisions = {};
  for (const div of Object.keys(eligibilityByDivision)) {
    const raw = safeArray(eligibilityByDivision[div]);
    const leagues = raw
      .map((l) => {
        const leagueName = safeStr(l?.leagueName).trim();
        const finalists = safeArray(l?.finalists).map((x) => safeStr(x).trim()).filter(Boolean);
        const entries = finalists.map((ownerName) => {
          const k = entryKey({ division: div, leagueName, ownerName });
          const d = decisions?.[k] || {};
          return {
            division: div,
            leagueName,
            ownerName,
            k,
            decision: safeStr(d?.decision || "").trim() || "bank",
            wk17: Number(points?.[k] ?? 0) || 0,
          };
        });

        const leagueRes = leagueWinners?.[`${div}|||${leagueName}`] || {};

        return {
          leagueName,
          entries,
          leagueWinner: {
            winner: safeStr(leagueRes?.winner || "").trim(),
            winnerKey: safeStr(leagueRes?.winnerKey || "").trim(),
            pts: Number(leagueRes?.pts ?? 0) || 0,
            bonus: Number(leagueRes?.bonus ?? 0) || 0,
            empire: !!leagueRes?.empire,
            empireBonus: Number(leagueRes?.empireBonus ?? 0) || 0,
          },
        };
      })
      .filter((l) => l.leagueName && l.entries.length);

    divisions[div] = { leagues };
  }

  const overall = results?.overall || {};
  const wagerBonus = results?.wagerBonus || {};
  const wagerMisses = safeArray(results?.wagerMisses);

  return {
    updatedAt: safeStr(doc?.updatedAt).trim(),
    computedAt: safeStr(doc?.eligibility?.computedAt).trim(),
    week17ResolvedAt: safeStr(wk17?.resolvedAt).trim(),
    rules: {
      credit: Number(wk17?.credit ?? 50) || 50,
      wagerBonus: Number(wk17?.wagerBonus ?? 200) || 200,
      champBonus: Number(wk17?.champBonus ?? 250) || 250,
      champBonus2: Number(wk17?.champBonus2 ?? 100) || 100,
      champBonus3: Number(wk17?.champBonus3 ?? 50) || 50,
      leagueWinBonus: Number(wk17?.leagueWinBonus ?? 125) || 125,
      empireBonus: Number(wk17?.empireBonus ?? 225) || 225,
    },
    divisionAwards,
    overall: {
      first: {
        winner: safeStr(overall?.first?.winner || "").trim(),
        division: safeStr(overall?.first?.winnerDivision || "").trim(),
        league: safeStr(overall?.first?.winnerLeague || "").trim(),
        pts: Number(overall?.first?.winnerPts ?? 0) || 0,
        bonus: Number(overall?.first?.bonus ?? 0) || 0,
      },
      second: {
        winner: safeStr(overall?.second?.winner || "").trim(),
        division: safeStr(overall?.second?.winnerDivision || "").trim(),
        league: safeStr(overall?.second?.winnerLeague || "").trim(),
        pts: Number(overall?.second?.winnerPts ?? 0) || 0,
        bonus: Number(overall?.second?.bonus ?? 0) || 0,
      },
      third: {
        winner: safeStr(overall?.third?.winner || "").trim(),
        division: safeStr(overall?.third?.winnerDivision || "").trim(),
        league: safeStr(overall?.third?.winnerLeague || "").trim(),
        pts: Number(overall?.third?.winnerPts ?? 0) || 0,
        bonus: Number(overall?.third?.bonus ?? 0) || 0,
      },
    },
    wagerBonus: {
      winner: safeStr(wagerBonus?.winner || "").trim(),
      winnerDivision: safeStr(wagerBonus?.winnerDivision || "").trim(),
      winnerLeague: safeStr(wagerBonus?.winnerLeague || "").trim(),
      winnerPts: Number(wagerBonus?.winnerPts ?? 0) || 0,
      bonus: Number(wagerBonus?.bonus ?? 0) || 0,
      entrants: Number(wagerBonus?.entrants ?? 0) || 0,
    },
    week18: {
      resolvedAt: safeStr(wk18?.resolvedAt).trim(),
      champions: showdown?.champions || {},
      result: showdown?.result || {},
      points: wk18?.points || {},
    },
    wagerMisses: wagerMisses.map((m) => ({
      ownerName: safeStr(m?.ownerName).trim(),
      division: safeStr(m?.division).trim(),
      leagueName: safeStr(m?.leagueName).trim(),
      wk17: Number(m?.wk17 ?? 0) || 0,
      key: safeStr(m?.key || "").trim(),
    })),
    divisionAwards,
    divisions,
  };
}

function DynastyWagerTrackerInner({ season, version, dataKey }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/r2/${dataKey}?v=${version}`, { cache: "no-store" });
        if (!res.ok) {
          setDoc(null);
          return;
        }
        const json = await res.json();
        if (!mounted) return;
        setDoc(json);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load Dynasty wager tracker data.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [season, version, dataKey]);

  const view = useMemo(() => (doc ? normalizeDoc(doc) : null), [doc]);

  if (loading) {
    return (
      <Card>
        <div className="text-sm text-muted">Loading Dynasty wager tracker…</div>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <div className="text-sm text-rose-200">{error}</div>
      </Card>
    );
  }
  if (!view) {
    return (
      <Card>
        <div className="text-sm text-muted">No Dynasty wager tracker data found for {season} yet.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SmallBadge>Week 17</SmallBadge>
            <h2 className="mt-3 text-xl font-semibold text-white">Bonuses & Winners</h2>
            <p className="mt-2 text-sm text-muted">
              Finalists each start with a {fmtMoney(view.rules.credit)} credit. Banked by default if not declared.
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            <div>Updated: {view.updatedAt ? new Date(view.updatedAt).toLocaleString() : "—"}</div>
            <div>Resolved: {view.week17ResolvedAt ? new Date(view.week17ResolvedAt).toLocaleString() : "—"}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {Object.entries(view.divisionAwards || {}).length === 0 ? (
            <div className="text-sm text-muted">Division awards will appear once Week 17 is resolved.</div>
          ) : (
            Object.entries(view.divisionAwards)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([div, d]) => (
                <div key={div} className="rounded-2xl border border-subtle bg-panel/50 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted">{div} — Week 17 Awards</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">🏆 Champ</span>
                      <span className="text-white font-medium">{d?.champion?.winner || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">🥈 2nd</span>
                      <span className="text-white font-medium">{d?.second?.winner || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">🥉 3rd</span>
                      <span className="text-white font-medium">{d?.third?.winner || "—"}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-subtle flex items-center justify-between">
                      <span className="text-muted">🎯 Wager Pot</span>
                      <span className="text-white font-semibold">{fmtMoney(d?.wagerPot?.total ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Wager Winner</span>
                      <span className="text-white font-medium">{d?.wagerPot?.winner || "—"}</span>
                    </div>
                  </div>
                </div>
              ))
          )}

          <div className="rounded-2xl border border-subtle bg-panel/50 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-muted">League Winner Bonus</div>
            <div className="mt-2 text-lg font-semibold text-white">{fmtMoney(view.rules.leagueWinBonus)}</div>
            <div className="mt-2 text-sm text-muted">Awarded per league to the higher Week 17 scorer.</div>
            <div className="mt-1 text-xs text-muted">Empire toggle is tracked per league (manual).</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SmallBadge>Week 18</SmallBadge>
            <h2 className="mt-3 text-xl font-semibold text-white">Heroes vs Dragons Showdown</h2>
            <p className="mt-2 text-sm text-muted">
              Division champs (highest Week 17 scorer in each division) face off in Week 18.
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            <div>Resolved: {view.week18.resolvedAt ? new Date(view.week18.resolvedAt).toLocaleString() : "—"}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {Object.keys(view.week18.champions || {}).length === 0 ? (
            <div className="text-sm text-muted">Division champs will appear after Week 17 is resolved.</div>
          ) : (
            Object.entries(view.week18.champions)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([div, c]) => (
                <div key={div} className="rounded-2xl border border-subtle bg-panel/50 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted">Champion · {div}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{c.ownerName}</div>
                  <div className="mt-1 text-sm text-muted">Week 17: <span className="text-white font-medium">{Number(c.wk17 ?? 0).toFixed(2)}</span></div>
                  <div className="mt-1 text-sm text-muted">Week 18: <span className="text-white font-medium">{Number(view.week18.points?.[c.key] ?? 0).toFixed(2)}</span></div>
                </div>
              ))
          )}
        </div>

        {view.week18.result?.winner ? (
          <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4">
            <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Winner</div>
            <div className="mt-1 text-white font-semibold">{view.week18.result.winner}</div>
            <div className="mt-1 text-sm text-muted">
              {view.week18.result.tie
                ? "Tie"
                : `${Number(view.week18.result.winnerPts ?? 0).toFixed(2)} vs ${Number(view.week18.result.loserPts ?? 0).toFixed(2)}`}
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white">Finalists by Division</h2>
        <p className="mt-2 text-sm text-muted">Wager vs Bank is shown per finalist. Week 17 points drive all payouts.</p>

        <div className="mt-5 space-y-6">
          {Object.keys(view.divisions).length === 0 ? (
            <div className="text-sm text-muted">No divisions found.</div>
          ) : (
            Object.entries(view.divisions).map(([div, d]) => (
              <div key={div} className="rounded-2xl border border-subtle bg-panel/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Division</div>
                    <div className="mt-1 text-lg font-semibold text-white">{div}</div>
                  </div>
                  {view.divisionAwards?.[div]?.champion?.winner ? <WinnerTag>Division Champ</WinnerTag> : null}
                </div>

                <div className="mt-4 space-y-4">
                  {safeArray(d?.leagues).map((l) => (
                    <div key={`${div}|||${l.leagueName}`} className="rounded-2xl border border-subtle bg-card-surface p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-white font-semibold">{l.leagueName}</div>
                        {l.leagueWinner?.winner ? (
                          <div className="text-xs text-muted">
                            League Winner Bonus: <span className="text-white font-semibold">{safeStr(l.leagueWinner.winner)}</span>
                            {l.leagueWinner.empire ? (
                              <span className="ml-2 inline-flex items-center rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                                Empire +{fmtMoney(l.leagueWinner.empireBonus || view.rules.empireBonus)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-xs text-muted">League Winner Bonus: —</div>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {safeArray(l.entries).map((e) => (
                          <div key={e.k} className="rounded-xl border border-subtle bg-panel/40 p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-white font-semibold">{e.ownerName}</div>
                              <div
                                className={
                                  e.decision === "wager"
                                    ? "text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200"
                                    : "text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200"
                                }
                              >
                                {e.decision === "wager" ? "Wager" : "Bank"}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-muted">Week 17: <span className="text-white font-medium">{e.wk17.toFixed(2)}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white">Who should have wagered?</h2>
        <p className="mt-2 text-sm text-muted">
          Banked finalists who scored at least as many Week 17 points as the highest scorer among those who wagered.
        </p>

        <div className="mt-4">
          {view.wagerMisses.length === 0 ? (
            <div className="text-sm text-muted">No misses detected (or no one wagered yet).</div>
          ) : (
            <div className="space-y-2">
              {view.wagerMisses.slice(0, 25).map((m, idx) => (
                <div key={`${m.key || idx}`} className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3">
                  <div className="text-white font-semibold">{m.ownerName}</div>
                  <div className="mt-1 text-sm text-muted">
                    {m.division} · {m.leagueName} · {m.wk17.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function DynastyWagerTracker({ season }) {
  const section = "dynasty-wagers";
  const dataKey = `data/dynasty/wagers_${season}.json`;

  return (
    <SectionManifestGate section={section} season={season}>
      <DynastyWagerTrackerInner season={season} dataKey={dataKey} />
    </SectionManifestGate>
  );
}
