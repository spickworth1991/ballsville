"use client";

import { useEffect, useMemo, useState } from "react";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return safeStr(iso);
  return d.toLocaleString();
}

function computeDivisionSummary(div) {
  const eligible = safeArray(div?.eligible);
  const pot1 = div?.pot1 || {};
  const pot2 = div?.pot2 || {};

  const p1Entries = pot1?.entries && typeof pot1.entries === "object" ? pot1.entries : {};
  const p2Entries = pot2?.entries && typeof pot2.entries === "object" ? pot2.entries : {};

  const p1Entrants = Object.keys(p1Entries).filter((k) => p1Entries[k]);
  const p2Entrants = Object.keys(p2Entries).filter((k) => p2Entries[k]);

  const p1Fee = Number(pot1.entryFee || 25);
  const p2Fee = Number(pot2.entryFee || 25);

  const p1Pool = p1Entrants.length * p1Fee;
  const p2Pool = p2Entrants.length * p2Fee;

  return {
    eligibleCount: eligible.length,
    p1Entrants,
    p2Entrants,
    p1Pool,
    p2Pool,
    p1Winner: safeStr(pot1.winner),
    p2Winner: safeStr(pot2.winner),
    p1ResolvedAt: safeStr(pot1.resolvedAt),
    p2ResolvedAt: safeStr(pot2.resolvedAt),
    week16Points: pot1.weekPoints || pot2.weekPoints || {},
  };
}

function DivisionCard({ name, div }) {
  const s = useMemo(() => computeDivisionSummary(div), [div]);

  return (
    <div className="card bg-card-surface border border-subtle rounded-2xl shadow-md overflow-hidden">
      <div className="p-5 border-b border-subtle flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Division</div>
          <div className="text-base font-semibold text-foreground">{name}</div>
        </div>
        <div className="text-xs text-muted">
          <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1">
            Eligible: <span className="text-foreground font-semibold">{s.eligibleCount}</span>
          </span>
        </div>
      </div>

      <div className="p-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-foreground">Wager 1</div>
            <div className="text-xs text-muted">Pool: <span className="text-foreground font-semibold">{fmtMoney(s.p1Pool)}</span></div>
          </div>
          <div className="mt-2 text-xs text-muted">
            Entrants: <span className="text-foreground font-semibold">{s.p1Entrants.length}</span>
          </div>
          <div className="mt-2 text-sm">
            {s.p1Winner ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1">
                <span className="text-emerald-200 text-[11px] uppercase tracking-[0.2em]">Winner</span>
                <span className="text-foreground font-semibold">{s.p1Winner}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-xs text-muted">
                Pending
              </div>
            )}
          </div>
          {s.p1ResolvedAt ? <div className="mt-2 text-[11px] text-muted">Resolved: {fmtISO(s.p1ResolvedAt)}</div> : null}
        </div>

        <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-foreground">Wager 2</div>
            <div className="text-xs text-muted">Pool: <span className="text-foreground font-semibold">{fmtMoney(s.p2Pool)}</span></div>
          </div>
          <div className="mt-2 text-xs text-muted">
            Entrants: <span className="text-foreground font-semibold">{s.p2Entrants.length}</span>
          </div>
          <div className="mt-2 text-sm">
            {s.p2Winner ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1">
                <span className="text-emerald-200 text-[11px] uppercase tracking-[0.2em]">Winner</span>
                <span className="text-foreground font-semibold">{s.p2Winner}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-xs text-muted">
                Pending
              </div>
            )}
          </div>
          {s.p2ResolvedAt ? <div className="mt-2 text-[11px] text-muted">Resolved: {fmtISO(s.p2ResolvedAt)}</div> : null}
        </div>
      </div>

      {safeArray(div?.eligible)?.length ? (
        <div className="px-5 pb-5">
          <div className="rounded-2xl border border-subtle bg-card-surface/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Eligible league winners (Week 15 total)</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {safeArray(div.eligible)
                .slice()
                .sort((a, b) => safeStr(b?.leagueName).localeCompare(safeStr(a?.leagueName)))
                .map((e, idx) => (
                  <div key={`${safeStr(e?.ownerName)}:${idx}`} className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-panel/40 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{safeStr(e?.ownerName)}</div>
                      <div className="text-[11px] text-muted truncate">{safeStr(e?.leagueName)}</div>
                    </div>
                    <div className="text-xs text-muted shrink-0">{Number(e?.week15Total || 0).toFixed(2)}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChampionshipCard({ champ }) {
  // Support both the older public doc shape and the newer admin-driven shape.
  const seeded = safeArray(champ?.byDivisionWinner);
  const entrants = seeded.length
    ? seeded
        .map((r) => ({
          ownerName: safeStr(r?.ownerName),
          division: safeStr(r?.division),
          entryKey: safeStr(r?.entryKey),
          wager: Number(r?.wager || 0),
        }))
        .filter((r) => r.ownerName)
    : safeArray(champ?.entrants);

  const pointsByOwner =
    champ?.pointsByOwner && typeof champ.pointsByOwner === "object" ? champ.pointsByOwner : {};
  const wagersByOwner =
    champ?.wagersByOwner && typeof champ.wagersByOwner === "object" ? champ.wagersByOwner : {};

  // If we're on the new doc shape, derive points/wagers maps from keyed data.
  const keyedPoints = champ?.points && typeof champ.points === "object" ? champ.points : {};
  const derivedPointsByOwner = {};
  const derivedWagersByOwner = {};
  if (seeded.length) {
    for (const r of entrants) {
      const k = safeStr(r.entryKey).trim();
      derivedPointsByOwner[r.ownerName] = Number(keyedPoints[k] || 0);
      derivedWagersByOwner[r.ownerName] = Number(r.wager || 0);
    }
  }

  const rowsAll = entrants
    .map((e) => {
      const ownerName = safeStr(e?.ownerName);
      return {
        ownerName,
        division: safeStr(e?.division),
        wager: Number((seeded.length ? derivedWagersByOwner : wagersByOwner)[ownerName] || 0),
        points: Number((seeded.length ? derivedPointsByOwner : pointsByOwner)[ownerName] || 0),
      };
    })
    .sort((a, b) => b.wager - a.wager || b.points - a.points || a.ownerName.localeCompare(b.ownerName));

  // Only bettors are actually in the championship.
  const rows = rowsAll.filter((r) => Number(r.wager) > 0);

  const bonus = Number.isFinite(Number(champ?.bonus)) ? Number(champ.bonus) : 0;

  // Per-$50 pots (Main Pot = first $50; Side Pot 1 = second $50; Side Pot 2 = third $50)
  const computedPots = (() => {
    const main = rows.filter((r) => r.wager >= 50);
    const side1 = rows.filter((r) => r.wager >= 100);
    const side2 = rows.filter((r) => r.wager >= 150);

    const pickWinner = (list) =>
      list.reduce((best, r) => (r.points > (best?.points ?? -Infinity) ? r : best), null);

    const mainWin = pickWinner(main);
    const side1Win = pickWinner(side1);
    const side2Win = pickWinner(side2);

    return {
      main: {
        entrants: main.length,
        pool: main.length * 50 + bonus,
        winner: safeStr(champ?.pots?.main?.winner) || safeStr(champ?.winner) || safeStr(mainWin?.ownerName),
        winnerDivision: safeStr(champ?.pots?.main?.winnerDivision) || safeStr(mainWin?.division),
      },
      side1: {
        entrants: side1.length,
        pool: side1.length * 50,
        winner: safeStr(champ?.pots?.side1?.winner) || safeStr(side1Win?.ownerName),
        winnerDivision: safeStr(champ?.pots?.side1?.winnerDivision) || safeStr(side1Win?.division),
      },
      side2: {
        entrants: side2.length,
        pool: side2.length * 50,
        winner: safeStr(champ?.pots?.side2?.winner) || safeStr(side2Win?.ownerName),
        winnerDivision: safeStr(champ?.pots?.side2?.winnerDivision) || safeStr(side2Win?.division),
      },
    };
  })();

  const pots = computedPots;
  const winner = safeStr(pots?.main?.winner).trim();

  // Total pool (all pots + bonus, if present)
  const poolTotal = Number.isFinite(Number(champ?.pool))
    ? Number(champ.pool)
    : Number(pots.main.pool || 0) + Number(pots.side1.pool || 0) + Number(pots.side2.pool || 0);

  // Wagers-only (bonus excluded). Some older docs stored this directly.
  const poolWagers = Number.isFinite(Number(champ?.poolWagers))
    ? Number(champ.poolWagers)
    : Math.max(0, Number(pots.main.pool || 0) - bonus) + Number(pots.side1.pool || 0) + Number(pots.side2.pool || 0);

  // Fun: show if a non-bettor would have won on points.
  const bestAll = rowsAll.reduce(
    (best, r) => (r.points > (best?.points ?? -Infinity) ? r : best),
    null
  );
  const bestBettor = rows.reduce(
    (best, r) => (r.points > (best?.points ?? -Infinity) ? r : best),
    null
  );
  const funWouldHaveWon =
    (champ?.wouldHaveWonNoBet && safeStr(champ.wouldHaveWonNoBet?.ownerName)) ||
    (bestAll && bestBettor && bestAll.ownerName !== bestBettor.ownerName);

  return (
    <div className="card bg-card-surface border border-subtle rounded-2xl shadow-md overflow-hidden">
      <div className="p-5 border-b border-subtle flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Big Game Championship Wager</div>
          <div className="text-base font-semibold text-foreground">Week 17</div>
        </div>
        <div className="text-xs text-muted">
          <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1">
            Total Pool: <span className="text-foreground font-semibold">{fmtMoney(poolTotal)}</span>
          </span>
          {bonus > 0 ? (
            <span className="ml-2 hidden sm:inline text-[11px] uppercase tracking-[0.18em] text-muted">
              (Main {fmtMoney((pots?.main?.pool || 0))} · Side 1 {fmtMoney((pots?.side1?.pool || 0))} · Side 2 {fmtMoney((pots?.side2?.pool || 0))})
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        {winner ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1">
            <span className="text-emerald-200 text-[11px] uppercase tracking-[0.2em]">Main Pot Winner</span>
            <span className="text-foreground font-semibold">{winner}</span>
          </div>
        ) : (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-xs text-muted">
            Pending
          </div>
        )}

        {/* Side pot winners */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-xs text-muted">
            Main Pot: <span className="text-foreground font-semibold">{safeStr(pots?.main?.winner) || "—"}</span>
            <span className="text-muted">({fmtMoney(pots?.main?.pool || 0)})</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-xs text-muted">
            Side Pot 1: <span className="text-foreground font-semibold">{safeStr(pots?.side1?.winner) || "—"}</span>
            <span className="text-muted">({fmtMoney(pots?.side1?.pool || 0)})</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-xs text-muted">
            Side Pot 2: <span className="text-foreground font-semibold">{safeStr(pots?.side2?.winner) || "—"}</span>
            <span className="text-muted">({fmtMoney(pots?.side2?.pool || 0)})</span>
          </span>
        </div>

        {funWouldHaveWon ? (
          <div className="mb-4 rounded-xl border border-subtle bg-panel/40 px-4 py-3 text-xs text-muted">
            Fun: <span className="text-foreground font-semibold">{bestAll.ownerName}</span> would have won on points
            ({Number(bestAll.points).toFixed(2)}) if they had placed a wager.
          </div>
        ) : null}

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.18em] text-muted">
                  <th className="text-left py-2 pr-4">Owner</th>
                  <th className="text-left py-2 pr-4">Division</th>
                  <th className="text-right py-2 pr-4">Wager</th>
                  <th className="text-right py-2">Week 17</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {rows.map((r) => (
                  <tr key={r.ownerName} className="text-sm">
                    <td className="py-3 pr-4 font-semibold text-foreground">{r.ownerName}</td>
                    <td className="py-3 pr-4 text-muted">{r.division || "—"}</td>
                    <td className="py-3 pr-4 text-right text-muted">{fmtMoney(r.wager)}</td>
                    <td className="py-3 text-right text-foreground">{Number(r.points).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-muted">No entrants yet.</div>
        )}

        {champ?.resolvedAt ? <div className="mt-3 text-[11px] text-muted">Resolved: {fmtISO(champ.resolvedAt)}</div> : null}
      </div>
    </div>
  );
}

function TrackerInner({ version = "0", manifest = null, season = CURRENT_SEASON }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!manifest) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    async function run() {
      setErr("");
      setLoading(true);

      const v = String(version || "0");
      const cacheKeyV = `biggame:wagers:${season}:v`;
      const cacheKeyD = `biggame:wagers:${season}:data`;

      try {
        const cachedV = sessionStorage.getItem(cacheKeyV);
        if (cachedV && cachedV === v) {
          const cached = sessionStorage.getItem(cacheKeyD);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (!cancelled && parsed) {
              setData(parsed);
              setLoading(false);
              return;
            }
          }
        }
      } catch {
        // ignore
      }

      try {
        const res = await fetch(`/r2/data/biggame/wagers_${season}.json?v=${encodeURIComponent(v)}`, { cache: "default" });
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const j = await res.json();
        if (cancelled) return;
        setData(j);
        try {
          sessionStorage.setItem(cacheKeyV, v);
          sessionStorage.setItem(cacheKeyD, JSON.stringify(j));
        } catch {
          // ignore
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load wager tracker.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [version, manifest, season]);

  const divisions = useMemo(() => {
    const d = data?.divisions && typeof data.divisions === "object" ? data.divisions : {};
    const entries = Object.entries(d);
    entries.sort((a, b) => safeStr(a[0]).localeCompare(safeStr(b[0])));
    return entries;
  }, [data]);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-subtle bg-card-surface backdrop-blur p-6 text-center space-y-2 shadow-sm">
        <p className="inline-flex mx-auto text-xs uppercase tracking-[0.35em] text-accent rounded-full border border-subtle bg-panel/60 px-3 py-1">
          BIG GAME
        </p>
        <h2 className="text-2xl sm:text-3xl font-semibold">Wager Tracker</h2>
        <p className="text-sm text-muted">League winners (Week 15) choose to enter Wager 1 and/or Wager 2. Week 16 decides divisional winners. Divisional winners can wager for the Big Game championship in Week 17.</p>
        {data?.updatedAt ? <p className="text-[11px] text-muted">Last updated: {fmtISO(data.updatedAt)}</p> : null}
      </header>

      {loading ? (
        <div className="text-center text-sm text-muted">Loading…</div>
      ) : err ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100 text-center">
          {err}
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-center text-sm text-muted">
          Wager tracker is not available yet.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            {divisions.map(([name, div]) => (
              <DivisionCard key={name} name={name} div={div} />
            ))}
          </div>

          {data?.championship ? <ChampionshipCard champ={data.championship} /> : null}

          
        </div>
      )}
    </section>
  );
}

export default function BigGameWagerTracker({ season = CURRENT_SEASON }) {
  return (
    <SectionManifestGate section="biggame-wagers" season={season}>
      <TrackerInner season={season} />
    </SectionManifestGate>
  );
}
