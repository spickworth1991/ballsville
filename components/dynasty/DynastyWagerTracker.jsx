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
  const group = safeStr(p?.group || "").trim();
  const leagueName = safeStr(p?.leagueName || "").trim();
  const ownerName = safeStr(p?.ownerName || "").trim();
  return `${group}|||${leagueName}|||${ownerName}`;
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

function normalizeDoc(doc, season) {
  const base = {
    season: Number(season),
    updatedAt: safeStr(doc?.updatedAt).trim(),
    settings: {
      finalistCredit: Number(doc?.settings?.finalistCredit ?? 50) || 50,
      wagerBonus: Number(doc?.settings?.wagerBonus ?? 200) || 200,
      championshipBonuses: {
        first: Number(doc?.settings?.championshipBonuses?.first ?? 250) || 250,
        second: Number(doc?.settings?.championshipBonuses?.second ?? 100) || 100,
        third: Number(doc?.settings?.championshipBonuses?.third ?? 50) || 50,
      },
      leagueWinnerBonus: Number(doc?.settings?.leagueWinnerBonus ?? 125) || 125,
      empireWarning: safeStr(doc?.settings?.empireWarning).trim(),
    },
    finalists: {},
    week17: {
      resolvedAt: safeStr(doc?.week17?.resolvedAt).trim(),
      points: doc?.week17?.points || {},
      results: doc?.week17?.results || {},
    },
  };

  const byGroup = doc?.finalists?.byGroup || {};
  const finalists = {};
  for (const group of Object.keys(byGroup)) {
    const byLeague = byGroup[group] || {};
    finalists[group] = {};
    for (const leagueName of Object.keys(byLeague)) {
      const arr = safeArray(byLeague[leagueName]);
      finalists[group][leagueName] = arr
        .map((f) => {
          const ownerName = safeStr(f?.ownerName).trim();
          if (!ownerName) return null;
          const key = entryKey({ group, leagueName, ownerName });
          return {
            ownerName,
            choice: safeStr(f?.choice || "bank").toLowerCase() === "wager" ? "wager" : "bank",
            key,
            pts: Number(base.week17.points?.[key] ?? 0) || 0,
          };
        })
        .filter(Boolean);
    }
  }
  base.finalists = finalists;

  return base;
}

function fmtMoney(n) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return "$0";
  return `$${x.toFixed(0)}`;
}

function FinalistRow({ f, showPts }) {
  const bank = f.choice !== "wager";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-panel/40 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">{f.ownerName}</div>
        <div className="mt-0.5 text-xs text-muted">{bank ? "Bank" : "Wager"}</div>
      </div>
      <div className="flex items-center gap-2">
        {showPts ? <span className="text-sm font-semibold text-white tabular-nums">{f.pts.toFixed(2)}</span> : null}
        {bank ? (
          <span className="rounded-full border border-subtle bg-panel px-2 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-muted">
            BANK
          </span>
        ) : (
          <span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-accent">
            WAGER
          </span>
        )}
      </div>
    </div>
  );
}

function DynastyWagerTrackerInner({ doc, season }) {
  const d = useMemo(() => normalizeDoc(doc, season), [doc, season]);

  const groups = Object.keys(d.finalists || {}).sort((a, b) => a.localeCompare(b));
  const resolved = Boolean(d.week17.resolvedAt);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <SmallBadge>How it works</SmallBadge>
            <p className="mt-3 text-sm text-muted">
              Top 2 teams per league receive a <span className="text-white font-semibold">{fmtMoney(d.settings.finalistCredit)}</span> credit.
              Each finalist chooses to <span className="text-white font-semibold">Wager</span> or <span className="text-white font-semibold">Bank</span> before Week 17 kickoff.
              No reply = Bank by default.
            </p>
            <p className="mt-3 text-sm text-muted">
              Bonuses (Week 17): <span className="text-white font-semibold">{fmtMoney(d.settings.wagerBonus)}</span> wager bonus (wagered only),
              <span className="text-white font-semibold"> {fmtMoney(d.settings.championshipBonuses.first)}</span> / <span className="text-white font-semibold">{fmtMoney(d.settings.championshipBonuses.second)}</span> /
              <span className="text-white font-semibold"> {fmtMoney(d.settings.championshipBonuses.third)}</span> overall top 3, and
              league winner gets +<span className="text-white font-semibold">{fmtMoney(d.settings.leagueWinnerBonus)}</span>.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-100">Empire Warning</div>
            <p className="mt-2 text-sm text-amber-100/85">{d.settings.empireWarning}</p>
          </div>
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Finalists have not been posted yet.</p>
        </Card>
      ) : (
        groups.map((group) => {
          const leagues = Object.keys(d.finalists[group] || {}).sort((a, b) => a.localeCompare(b));
          const champ = d.week17?.results?.groupChamps?.[group];
          return (
            <Card key={group}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <SmallBadge>{group}</SmallBadge>
                  <h2 className="mt-3 text-lg font-semibold text-white">Finalists</h2>
                </div>
                {resolved && champ?.winnerName ? (
                  <div className="flex items-center gap-2">
                    <WinnerTag>CHAMP</WinnerTag>
                    <span className="text-sm font-semibold text-white">{champ.winnerName}</span>
                    <span className="text-sm text-muted">({Number(champ.pts ?? 0).toFixed(2)})</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {leagues.map((leagueName) => {
                  const arr = safeArray(d.finalists?.[group]?.[leagueName]);
                  if (!arr.length) return null;
                  const lw = d.week17?.results?.leagueWinners?.[`${group}|||${leagueName}`];
                  return (
                    <div key={leagueName} className="rounded-2xl border border-subtle bg-panel/30 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white">{leagueName}</div>
                        {resolved && lw?.winnerName ? <WinnerTag>+{fmtMoney(lw.bonus)}</WinnerTag> : null}
                      </div>
                      <div className="mt-3 space-y-2">
                        {arr.map((f) => (
                          <FinalistRow key={f.key} f={f} showPts={resolved} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <SmallBadge>Week 17 Results</SmallBadge>
            <h2 className="mt-3 text-lg font-semibold text-white">Bonuses</h2>
          </div>
          {resolved ? (
            <div className="text-xs text-muted">Resolved: {new Date(d.week17.resolvedAt).toLocaleString()}</div>
          ) : (
            <div className="text-xs text-muted">Not resolved yet.</div>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-subtle bg-panel/30 p-4">
            <div className="text-sm font-semibold text-white">Wager Bonus</div>
            <p className="mt-2 text-sm text-muted">
              Winner (wagered only): <span className="text-white font-semibold">{d.week17?.results?.wagerBonus?.winnerName || "—"}</span>
              {d.week17?.results?.wagerBonus?.winnerName ? ` (${Number(d.week17.results.wagerBonus.pts ?? 0).toFixed(2)})` : ""}
            </p>
            <p className="mt-2 text-sm text-muted">Bonus: {fmtMoney(d.week17?.results?.wagerBonus?.bonus ?? d.settings.wagerBonus)}</p>
          </div>

          <div className="rounded-2xl border border-subtle bg-panel/30 p-4">
            <div className="text-sm font-semibold text-white">Overall (All Finalists)</div>
            <div className="mt-2 text-sm text-muted space-y-1">
              <div>
                1st: <span className="text-white font-semibold">{d.week17?.results?.overall?.first?.winnerName || "—"}</span>
                {d.week17?.results?.overall?.first?.winnerName ? ` (${Number(d.week17.results.overall.first.pts ?? 0).toFixed(2)})` : ""} · {fmtMoney(
                  d.week17?.results?.overall?.first?.bonus ?? d.settings.championshipBonuses.first
                )}
              </div>
              <div>
                2nd: <span className="text-white font-semibold">{d.week17?.results?.overall?.second?.winnerName || "—"}</span>
                {d.week17?.results?.overall?.second?.winnerName ? ` (${Number(d.week17.results.overall.second.pts ?? 0).toFixed(2)})` : ""} · {fmtMoney(
                  d.week17?.results?.overall?.second?.bonus ?? d.settings.championshipBonuses.second
                )}
              </div>
              <div>
                3rd: <span className="text-white font-semibold">{d.week17?.results?.overall?.third?.winnerName || "—"}</span>
                {d.week17?.results?.overall?.third?.winnerName ? ` (${Number(d.week17.results.overall.third.pts ?? 0).toFixed(2)})` : ""} · {fmtMoney(
                  d.week17?.results?.overall?.third?.bonus ?? d.settings.championshipBonuses.third
                )}
              </div>
            </div>
          </div>
        </div>

        {safeArray(d.week17?.results?.shouldHaveWagered).length ? (
          <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
            <div className="text-sm font-semibold text-amber-100">Should have wagered 😬</div>
            <p className="mt-1 text-sm text-amber-100/85">These banked finalists would have won the {fmtMoney(d.settings.wagerBonus)} wager bonus.</p>
            <ul className="mt-3 space-y-1 text-sm text-amber-100/90">
              {d.week17.results.shouldHaveWagered.map((m) => (
                <li key={`${m.group}|${m.leagueName}|${m.ownerName}`}>• {m.ownerName} — {m.group} / {m.leagueName} ({Number(m.pts ?? 0).toFixed(2)} pts)</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function buildWagersUrl(season, version) {
  return `/r2/data/dynasty/wagers_${encodeURIComponent(season)}.json?v=${version}`;
}

export default function DynastyWagerTracker({ season, version }) {
  const s = String(season);

  if (version == null) {
    return (
      <SectionManifestGate section="dynasty-wagers" season={s} pollMs={0}>
        <DynastyWagerTracker season={season} />
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

  const view = useMemo(() => rawDoc || {}, [rawDoc]);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted">Loading Dynasty wagers…</p>
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

  return <DynastyWagerTrackerInner doc={view} season={season} />;
}
