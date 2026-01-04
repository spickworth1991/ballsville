"use client";
import { adminR2Url } from "@/lib/r2Client";
import { useEffect, useMemo, useState } from "react";
import { safeArray, safeStr } from "@/lib/safe";
// NOTE: The Dynasty wagers JSON currently lives behind a public (no-auth) admin API.
// We fetch it directly so the public page works even if the manifest doesn't include this section.


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

function DecisionPill({ decision }) {
  const isWager = decision === "wager";
  return (
    <span
      className={
        isWager
          ? "inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200"
          : "inline-flex items-center gap-1 rounded-full border border-sky-300/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200"
      }
      title={isWager ? "Wagered" : "Banked"}
    >
      <span aria-hidden>{isWager ? "🎯" : "🏦"}</span>
      {isWager ? "Wager" : "Bank"}
    </span>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-subtle bg-card-surface shadow-xl backdrop-blur p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-muted">Details</div>
            <div className="mt-1 text-lg font-semibold text-white">{title}</div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-subtle bg-panel/40 px-3 py-2 text-xs font-semibold text-white hover:bg-panel/60"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function slugify(v) {
  const s = safeStr(v).trim().toLowerCase();
  // Keep this intentionally simple (no external deps)
  return s
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function leagueAnchorId(season, division, leagueName) {
  return `dw-${slugify(season)}-${slugify(division)}-${slugify(leagueName)}`;
}

function scrollToId(id) {
  if (typeof window === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    el.scrollIntoView();
  }
}

function normalizeDoc(doc) {
  const eligibilityByDivision = doc?.eligibility?.byDivision || {};
  const wk17 = doc?.week17 || {};
  const decisions = wk17?.decisions || {};
  const points = wk17?.points || {};
  const results = wk17?.results || {};
  const divisionAwards = results?.divisions || {};
  // Dynasty Week 17 is division-wide (all finalists in the division compete).
  // Any league-level winner/empire logic is not used on the public page.

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

        return {
          leagueName,
          entries,
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
      wouldHaveWon: Number(m?.wouldHaveWon ?? 0) || 0,
      key: safeStr(m?.key || "").trim(),
    })),
    divisionAwards,
    divisions,
  };
}

function DynastyWagerTrackerInner({ season }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState(null);
  const [winnerModal, setWinnerModal] = useState(null);

  // Division accordion open state
  const [openDivisions, setOpenDivisions] = useState({});

  function openWinnerModal(payload) {
    if (!payload) return;
    setWinnerModal(payload);
  }

  function jumpToLeague(division, leagueName) {
    const div = safeStr(division).trim();
    const league = safeStr(leagueName).trim();
    if (!div || !league) return;

    // Ensure the division is open first (so the league block exists in layout)
    const divKey = `div-${slugify(season)}-${slugify(div)}`;
    setOpenDivisions((prev) => ({ ...prev, [divKey]: true }));

    const id = leagueAnchorId(season, div, league);
    setTimeout(() => scrollToId(id), 60);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const url = adminR2Url(`data/dynasty/wagers_${encodeURIComponent(season)}.json?v=${Date.now()}`);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          setDoc(null);
          return;
        }
        const json = await res.json();
        setDoc(json && typeof json === "object" ? json : null);
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
  }, [season]);

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
      {/* --- Week 17 bonuses/winners card stays as-is (unchanged) --- */}
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
                  {(() => {
                    const champ = d?.champ || d?.champion || {};
                    const second = d?.second || {};
                    const third = d?.third || {};
                    const wagerPot = d?.wagerPot || {};

                    function row(label, icon, obj, moneyKey = "bonus") {
                      const winner = safeStr(obj?.winner).trim();
                      const league = safeStr(obj?.leagueName || obj?.league || "").trim();
                      const pts = Number(obj?.pts ?? obj?.winnerPts ?? 0) || 0;
                      const payout = Number(obj?.[moneyKey] ?? obj?.payout ?? 0) || 0;

                      return (
                        <div className="rounded-xl border border-subtle bg-panel/30 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted">
                              {icon} {label}
                            </span>
                            <div className="text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openWinnerModal({
                                    label,
                                    icon,
                                    division: div,
                                    winner,
                                    league,
                                    pts,
                                    payout,
                                  })
                                }
                                className="text-white font-semibold hover:underline underline-offset-4"
                                disabled={!winner}
                                title={winner ? "View details" : ""}
                              >
                                {winner || "—"}
                              </button>
                              {Number.isFinite(payout) && payout > 0 ? (
                                <div className="text-[11px] text-muted">+{fmtMoney(payout)}</div>
                              ) : null}
                            </div>
                          </div>

                          {winner ? (
                            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
                              <div className="truncate">
                                {league ? (
                                  <>
                                    <span className="text-white/90">{league}</span>
                                    <span className="text-muted"> · </span>
                                  </>
                                ) : null}
                                <span>Week 17: </span>
                                <span className="text-white font-medium">{pts.toFixed(2)}</span>
                              </div>

                              {league ? (
                                <button
                                  type="button"
                                  onClick={() => jumpToLeague(div, league)}
                                  className="shrink-0 rounded-full border border-subtle bg-panel/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-panel/60"
                                >
                                  Jump
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <div className="mt-3 grid gap-2 text-sm">
                        {row("Champ", "🏆", champ)}
                        {row("2nd", "🥈", second)}
                        {row("3rd", "🥉", third)}

                        <div className="rounded-xl border border-subtle bg-panel/30 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted">🎯 Wager Pot</span>
                            <span className="text-white font-semibold">{fmtMoney(wagerPot?.total ?? 0)}</span>
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
                            <div className="truncate">
                              <span className="text-muted">Winner: </span>
                              <button
                                type="button"
                                onClick={() =>
                                  openWinnerModal({
                                    label: "Wager Winner",
                                    icon: "🎯",
                                    division: div,
                                    winner: safeStr(wagerPot?.winner).trim(),
                                    league: safeStr(wagerPot?.winnerLeague || "").trim(),
                                    pts: Number(wagerPot?.winnerPts ?? 0) || 0,
                                    payout: Number(wagerPot?.total ?? 0) || 0,
                                  })
                                }
                                className="text-white font-semibold hover:underline underline-offset-4"
                                disabled={!wagerPot?.winner}
                              >
                                {wagerPot?.winner || "—"}
                              </button>
                              {wagerPot?.winnerLeague ? <span className="text-muted"> · </span> : null}
                              {wagerPot?.winnerLeague ? (
                                <span className="text-white/90">{wagerPot?.winnerLeague}</span>
                              ) : null}
                            </div>

                            {wagerPot?.winnerLeague ? (
                              <button
                                type="button"
                                onClick={() => jumpToLeague(div, wagerPot?.winnerLeague)}
                                className="shrink-0 rounded-full border border-subtle bg-panel/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-panel/60"
                              >
                                Jump
                              </button>
                            ) : null}
                          </div>

                          {wagerPot?.winner ? (
                            <div className="mt-1 text-xs text-muted">
                              Week 17 (wagered):{" "}
                              <span className="text-white font-medium">
                                {Number(wagerPot?.winnerPts ?? 0).toFixed(2)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))
          )}

          <div className="rounded-2xl border border-subtle bg-panel/50 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-muted">How Week 17 Works</div>
            <div className="mt-2 text-sm text-muted">
              All finalists in each division compete together in Week 17. The top Week 17 scorers in the division earn
              <b> Champ</b>, <b>2nd</b>, and <b>3rd</b>. The <b>Wager Pot</b> is only among those who chose <b>Wager</b>.
            </div>
            <div className="mt-2 text-xs text-muted">(No league-level head-to-head winner in this format.)</div>
          </div>
        </div>
      </Card>

      {/* --- Week 18 card stays as-is (unchanged) --- */}
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
                  <div className="mt-1 text-sm text-muted">
                    Week 17: <span className="text-white font-medium">{Number(c.wk17 ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    Week 18:{" "}
                    <span className="text-white font-medium">{Number(view.week18.points?.[c.key] ?? 0).toFixed(2)}</span>
                  </div>
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

      {/* --- UPDATED SECTION: winner cards outside the collapse + "Click to see leagues" --- */}
      <Card>
        <h2 className="text-lg font-semibold text-white">Finalists by Division</h2>
        <p className="mt-2 text-sm text-muted">
          Winner cards stay visible. Click a division to expand the leagues.
        </p>

        <div className="mt-5 space-y-4">
          {Object.keys(view.divisions).length === 0 ? (
            <div className="text-sm text-muted">No divisions found.</div>
          ) : (
            Object.entries(view.divisions).map(([div, d]) => {
              const r = view.divisionAwards?.[div] || {};
              const champ = r?.champ || r?.champion || {};
              const second = r?.second || {};
              const third = r?.third || {};
              const wagerPot = r?.wagerPot || {};

              // --- ADDED: winner card payouts (back-compat safe) ---
              const champWon = Number(champ?.bonus ?? champ?.payout ?? 0) || 0;
              const secondWon = Number(second?.bonus ?? second?.payout ?? 0) || 0;
              const thirdWon = Number(third?.bonus ?? third?.payout ?? 0) || 0;
              const wagerWon = Number(wagerPot?.total ?? 0) || 0;

              const champKey = safeStr(champ?.winnerKey || champ?.key).trim();
              const secondKey = safeStr(second?.winnerKey || second?.key).trim();
              const thirdKey = safeStr(third?.winnerKey || third?.key).trim();
              const wagerKey = safeStr(wagerPot?.winnerKey || "").trim();

              function tagsForKey(k) {
                const tags = [];
                if (k && k === champKey) tags.push({ icon: "🏆", label: "Champ" });
                if (k && k === secondKey) tags.push({ icon: "🥈", label: "2nd" });
                if (k && k === thirdKey) tags.push({ icon: "🥉", label: "3rd" });
                if (k && k === wagerKey) tags.push({ icon: "🎯", label: "Wager Winner" });
                return tags;
              }

              const divId = `div-${slugify(season)}-${slugify(div)}`;
              const leagues = safeArray(d?.leagues);

              const allEntries = leagues.flatMap((l) => safeArray(l.entries));
              const totalFinalists = allEntries.length;
              const totalWager = allEntries.filter((x) => x.decision === "wager").length;
              const totalBank = totalFinalists - totalWager;

              return (
                <div key={div} className="rounded-2xl border border-subtle bg-panel/30 p-4">
                  {/* Division header + tags (above winner cards) */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted">Division</div>
                      <div className="mt-1 text-lg font-semibold text-white truncate">{div}</div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="rounded-full border border-subtle bg-panel/40 px-2 py-0.5">
                          🏟️ {leagues.length} leagues
                        </span>
                        <span className="rounded-full border border-subtle bg-panel/40 px-2 py-0.5">
                          👥 {totalFinalists} finalists
                        </span>
                        <span className="rounded-full border border-subtle bg-panel/40 px-2 py-0.5">
                          🎯 {totalWager} wager
                        </span>
                        <span className="rounded-full border border-subtle bg-panel/40 px-2 py-0.5">
                          🏦 {totalBank} bank
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Winner cards OUTSIDE the collapsible area (UPDATED: show "Won") */}
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-2xl border border-subtle bg-panel/40 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">🏆 Champ</span>
                        <span className="text-white font-semibold truncate">{champ?.winner || "—"}</span>
                      </div>
                      {champ?.leagueName ? (
                        <div className="mt-1 flex items-center justify-between text-xs text-muted">
                          <span className="truncate">{champ.leagueName}</span>
                          <span className="text-white font-medium">{Number(champ?.pts ?? 0).toFixed(2)}</span>
                        </div>
                      ) : null}
                      {champ?.winner && champWon > 0 ? (
                        <div className="mt-1 text-xs text-muted">
                          Won: <span className="text-white font-semibold">+{fmtMoney(champWon)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-subtle bg-panel/40 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">🎯 Wager Winner</span>
                        <span className="text-white font-semibold truncate">{wagerPot?.winner || "—"}</span>
                      </div>
                      {wagerPot?.winnerLeague ? (
                        <div className="mt-1 flex items-center justify-between text-xs text-muted">
                          <span className="truncate">{wagerPot.winnerLeague}</span>
                          <span className="text-white font-medium">{Number(wagerPot?.winnerPts ?? 0).toFixed(2)}</span>
                        </div>
                      ) : null}
                      {wagerPot?.winner && wagerWon > 0 ? (
                        <div className="mt-1 text-xs text-muted">
                          Won: <span className="text-white font-semibold">+{fmtMoney(wagerWon)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-subtle bg-panel/40 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">🥈 2nd</span>
                        <span className="text-white font-semibold truncate">{second?.winner || "—"}</span>
                      </div>
                      {second?.leagueName ? (
                        <div className="mt-1 flex items-center justify-between text-xs text-muted">
                          <span className="truncate">{second.leagueName}</span>
                          <span className="text-white font-medium">{Number(second?.pts ?? 0).toFixed(2)}</span>
                        </div>
                      ) : null}
                      {second?.winner && secondWon > 0 ? (
                        <div className="mt-1 text-xs text-muted">
                          Won: <span className="text-white font-semibold">+{fmtMoney(secondWon)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-subtle bg-panel/40 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">🥉 3rd</span>
                        <span className="text-white font-semibold truncate">{third?.winner || "—"}</span>
                      </div>
                      {third?.leagueName ? (
                        <div className="mt-1 flex items-center justify-between text-xs text-muted">
                          <span className="truncate">{third.leagueName}</span>
                          <span className="text-white font-medium">{Number(third?.pts ?? 0).toFixed(2)}</span>
                        </div>
                      ) : null}
                      {third?.winner && thirdWon > 0 ? (
                        <div className="mt-1 text-xs text-muted">
                          Won: <span className="text-white font-semibold">+{fmtMoney(thirdWon)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Collapsible leagues only */}
                  <details
                    open={!!openDivisions[divId]}
                    onToggle={(e) => {
                      const isOpen = e.currentTarget?.open === true;
                      setOpenDivisions((prev) => ({ ...prev, [divId]: isOpen }));
                    }}
                    className="group mt-3 rounded-2xl border border-subtle bg-card-surface"
                  >
                    <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-[0.22em] text-muted">Leagues</div>
                          <div className="mt-1 text-sm text-muted">Tap to expand / collapse this division’s leagues</div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-subtle bg-panel/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                            Click to see leagues
                          </span>
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5 text-muted transition-transform duration-200 group-open:rotate-180"
                            aria-hidden="true"
                          >
                            <path
                              fill="currentColor"
                              d="M12 15.5a1 1 0 0 1-.7-.29l-6-6a1 1 0 1 1 1.4-1.42L12 13.09l5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-.7.29Z"
                            />
                          </svg>
                        </div>
                      </div>
                    </summary>

                    <div className="px-4 pb-4 space-y-3">
                      {leagues.map((l) => {
                        const anchorId = leagueAnchorId(season, div, l.leagueName);
                        const sorted = safeArray(l.entries).slice().sort((a, b) => b.wk17 - a.wk17);

                        return (
                          <div
                            key={`${div}|||${l.leagueName}`}
                            id={anchorId}
                            className="rounded-2xl border border-subtle bg-panel/30 p-4"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-white font-semibold">{l.leagueName}</div>
                              <div className="text-[11px] text-muted">Finalists · Week 17 points</div>
                            </div>

                            <div className="mt-3 space-y-2">
                              {sorted.map((e) => {
                                const tags = tagsForKey(e.k);
                                return (
                                  <div key={e.k} className="rounded-2xl border border-subtle bg-card-surface p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-start gap-2">
                                          <div className="text-white font-semibold truncate">{e.ownerName}</div>
                                          {tags.length ? (
                                            <div className="flex flex-wrap gap-1 pt-0.5">
                                              {tags.map((t) => (
                                                <span
                                                  key={t.label}
                                                  title={t.label}
                                                  className="inline-flex items-center rounded-full border border-subtle bg-panel/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white"
                                                >
                                                  {t.icon}
                                                </span>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        <div className="text-white font-semibold">{e.wk17.toFixed(2)}</div>
                                        <div className="mt-1">
                                          <DecisionPill decision={e.decision} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              );
            })
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
                    {m.division} · {m.leagueName} · Week 17: {m.wk17.toFixed(2)}
                  </div>
                  {(() => {
                    const r = view.divisionAwards?.[m.division] || {};
                    const wagerPot = r?.wagerPot || {};
                    const wName = safeStr(wagerPot?.winner).trim();
                    const wPts = Number(wagerPot?.winnerPts ?? 0) || 0;

                    return (
                      <div className="mt-1 text-sm text-muted">
                        Would have won: <span className="text-white font-semibold">{fmtMoney(m.wouldHaveWon)}</span>
                        {wName ? (
                          <>
                            <span className="text-muted"> because </span>
                            <span className="text-white font-semibold">{wName}</span>
                            <span className="text-muted"> scored </span>
                            <span className="text-white font-semibold">{wPts.toFixed(2)}</span>
                            <span className="text-muted"> (Wager winner), and you scored </span>
                            <span className="text-white font-semibold">{m.wk17.toFixed(2)}</span>
                            <span className="text-muted"> while banking.</span>
                          </>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={Boolean(winnerModal)}
        title={winnerModal ? `${winnerModal.icon || ""} ${winnerModal.label || ""}`.trim() : ""}
        onClose={() => setWinnerModal(null)}
      >
        {winnerModal ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-muted">Division</div>
              <div className="mt-1 text-white font-semibold">{winnerModal.division || "—"}</div>
            </div>

            <div className="rounded-2xl border border-subtle bg-panel/40 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-muted">Winner</div>
              <div className="mt-1 text-white font-semibold">{winnerModal.winner || "—"}</div>
              {winnerModal.league ? (
                <div className="mt-1 text-xs text-muted">
                  League: <span className="text-white/90">{winnerModal.league}</span>
                </div>
              ) : null}
              {Number.isFinite(Number(winnerModal.pts)) ? (
                <div className="mt-1 text-xs text-muted">
                  Week 17 Points:{" "}
                  <span className="text-white font-medium">{Number(winnerModal.pts).toFixed(2)}</span>
                </div>
              ) : null}
              {Number.isFinite(Number(winnerModal.payout)) && Number(winnerModal.payout) > 0 ? (
                <div className="mt-1 text-xs text-muted">
                  Payout: <span className="text-white font-medium">{fmtMoney(Number(winnerModal.payout))}</span>
                </div>
              ) : null}
            </div>

            {winnerModal.league && winnerModal.division ? (
              <button
                type="button"
                onClick={() => {
                  const div = winnerModal.division;
                  const league = winnerModal.league;
                  setWinnerModal(null);
                  jumpToLeague(div, league);
                }}
                className="w-full rounded-2xl border border-subtle bg-panel/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-panel/60"
              >
                Jump to league
              </button>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default function DynastyWagerTracker({ season }) {
  return <DynastyWagerTrackerInner season={season} />;
}