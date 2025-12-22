// src/app/gauntlet/leg3/page.jsx
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { CURRENT_SEASON } from "@/lib/season";

const LEG3_YEAR = CURRENT_SEASON;

function formatDateTime(dt) {
  if (!dt) return "Never";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

// Public R2 base URL for Gauntlet JSONs
function getLeg3R2Base() {
  if (process.env.NEXT_PUBLIC_GAUNTLET_R2_PROXY_BASE) {
    return process.env.NEXT_PUBLIC_GAUNTLET_R2_PROXY_BASE; // e.g. "/r2"
  }

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    if (process.env.NEXT_PUBLIC_GAUNTLET_R2_PUBLIC_BASE)
      return process.env.NEXT_PUBLIC_GAUNTLET_R2_PUBLIC_BASE;
    if (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE)
      return process.env.NEXT_PUBLIC_R2_PUBLIC_BASE;
    return "https://pub-eec34f38e47f4ffbbc39af58bda1bcc2.r2.dev";
  }

  return "/r2";
}

function buildManifestUrl(year) {
  const base = getLeg3R2Base().replace(/\/$/, "");
  return `${base}/gauntlet/leg3/gauntlet_leg3_${year}.manifest.json`;
}

function buildKeyUrl(key) {
  const base = getLeg3R2Base().replace(/\/$/, "");
  const cleanKey = String(key || "").replace(/^\/+/, "");
  return `${base}/${cleanKey}`;
}

// Public, no-guard version
export default function GauntletLeg3PublicPage() {
  return <GauntletLeg3Inner />;
}

function GauntletLeg3Inner() {
  const [forceWeek17Preview, setForceWeek17Preview] = useState(false);

  const [payloadMeta, setPayloadMeta] = useState(null);
  const [divisionsData, setDivisionsData] = useState({});
  const [divisionLoading, setDivisionLoading] = useState({});
  const [grand, setGrand] = useState(null);
  const [expandedGods, setExpandedGods] = useState(() => ({}));
  const [expandAllGods, setExpandAllGods] = useState(false);

  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("matchups");
  const [roundFilter, setRoundFilter] = useState("1");

  async function hardReloadAll(jsonFromManifest) {
    const divisions = jsonFromManifest?.divisions || {};
    const grandKey = jsonFromManifest?.grand?.key || null;

    setRefreshing(true);
    const names = Object.keys(divisions);

    await Promise.all(
      names.map((name) =>
        loadDivision(name, {
          hard: true,
          divisionsMetaOverride: divisions,
        })
      )
    );

    if (grandKey) {
      await loadGrand(grandKey, { hard: true });
    }

    setRefreshing(false);
  }

  // Auto-select current round based on manifest currentBracketWeek (13–16 => R1–R4)
  useEffect(() => {
    const w = payloadMeta?.currentBracketWeek;
    if (!w) return;
    if (w >= 13 && w <= 16) {
      const round = w - 12;
      setRoundFilter(String(round));
    }
  }, [payloadMeta?.currentBracketWeek]);

  async function loadManifest({ hard = false } = {}) {
    setError("");
    if (!hard) setLoading(true);

    try {
      const url = buildManifestUrl(LEG3_YEAR);
      const res = await fetch(url, { cache: hard ? "no-store" : "default" });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to load Gauntlet Leg 3 manifest (${res.status}) ${text || ""}`.trim()
        );
      }

      const json = await res.json();

      setPayloadMeta({
        name: json.name || `Ballsville Gauntlet – Leg 3 (${json.year || LEG3_YEAR})`,
        year: json.year || LEG3_YEAR,
        currentBracketWeek: json.currentBracketWeek || null,
        finalizedThroughWeek: json.finalizedThroughWeek ?? null,
        divisionsMeta: json.divisions || {},
        grandMeta: json.grand || null,
        missingSeedLeaguesSummary: json.missingSeedLeaguesSummary || [],
      });

      setUpdatedAt(json.updatedAt || null);

      if (json.grand?.key) {
        void loadGrand(json.grand.key, { hard: false });
      }
    } catch (err) {
      console.error("Error loading Gauntlet Leg 3 manifest:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unexpected error loading Gauntlet Leg 3 manifest."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const previewGrandStandings = useMemo(() => {
    // Only build this list when you explicitly want preview behavior.
    if (!forceWeek17Preview) return [];

    const rows = [];

    // Try to extract "best available" teams from each god.
    for (const [divisionName, divisionData] of Object.entries(divisionsData || {})) {
      const gods = Array.isArray(divisionData?.gods) ? divisionData.gods : [];

      for (const god of gods) {
        const godIndex = god?.index ?? null;
        const godName = god?.godName ?? (godIndex != null ? `God ${godIndex}` : "God ?");
        const bracketRounds = Array.isArray(god?.bracketRounds) ? god.bracketRounds : [];
        const pairings = Array.isArray(god?.pairings) ? god.pairings : [];

        // Collect candidate teams from bracket rounds (best source)
        const candidates = [];

        for (const r of bracketRounds) {
          const results = Array.isArray(r?.results) ? r.results : [];
          for (const m of results) {
            const a = m?.teamA || null;
            const b = m?.teamB || null;
            if (a) candidates.push(a);
            if (b) candidates.push(b);
          }
        }

        // Fallback: if no bracket rounds exist yet, use initial pairings
        if (candidates.length === 0 && pairings.length) {
          for (const p of pairings) {
            const a = p?.teamA || null;
            const b = p?.teamB || null;
            if (a) candidates.push(a);
            if (b) candidates.push(b);
          }
        }

        // Pick a "leader" for this god based on the best total we can find.
        // Prefer leg3Total if present; fallback to sum of leg3Weekly; fallback to 0.
        function getLeg3Total(t) {
          const direct = t?.leg3Total;
          if (typeof direct === "number") return direct;

          const weekly = t?.leg3Weekly;
          if (weekly && typeof weekly === "object") {
            // sum numeric week values
            let sum = 0;
            for (const v of Object.values(weekly)) {
              const n = Number(v);
              if (!Number.isNaN(n)) sum += n;
            }
            return sum;
          }

          return 0;
        }

        let best = null;
        let bestTotal = -Infinity;

        for (const t of candidates) {
          const total = getLeg3Total(t);
          if (total > bestTotal) {
            bestTotal = total;
            best = t;
          }
        }

        if (!best) continue;

        rows.push({
          // match the fields your Week 17 table expects
          division: divisionName,
          godIndex,
          godName,

          ownerName: best.ownerName ?? best.username ?? "Unknown",
          side: best.side ?? null,
          leagueName: best.leagueName ?? god?.lightLeagueName ?? god?.darkLeagueName ?? "",

          leagueId: best.leagueId ?? best.league_id ?? `${divisionName}-${godIndex}-L`,
          rosterId: best.rosterId ?? best.roster_id ?? `${divisionName}-${godIndex}-R`,

          week17Score: 0,
          leg3Total: Number(bestTotal || 0),
        });
      }
    }

    // De-dupe (in case the same team shows up multiple times)
    const seen = new Set();
    const deduped = [];
    for (const r of rows) {
      const k = `${r.leagueId}::${r.rosterId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(r);
    }

    // Sort by Leg 3 total desc and assign ranks
    deduped.sort((a, b) => Number(b.leg3Total || 0) - Number(a.leg3Total || 0));
    return deduped.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [forceWeek17Preview, divisionsData]);


  function godKey(divisionName, godIndex) {
    return `${divisionName}::${godIndex}`;
  }

  function isGodOpen(divisionName, godIndex) {
    if (expandAllGods) return true;
    return !!expandedGods[godKey(divisionName, godIndex)];
  }

  function toggleGodOpen(divisionName, godIndex) {
    const k = godKey(divisionName, godIndex);
    setExpandedGods((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function loadGrand(grandKey, { hard = false } = {}) {
    try {
      const url = buildKeyUrl(grandKey);
      const res = await fetch(url, { cache: hard ? "no-store" : "default" });
      if (!res.ok) return;
      const json = await res.json();
      setGrand(json);
    } catch (err) {
      console.error("Error loading Gauntlet Grand Championship JSON:", err);
    }
  }

  async function loadDivision(
    divisionName,
    { hard = false, divisionsMetaOverride } = {}
  ) {
    const metaMap = divisionsMetaOverride || payloadMeta?.divisionsMeta;
    if (!metaMap?.[divisionName]) return;
    if (!hard && divisionsData[divisionName]) return;

    const meta = metaMap[divisionName];
    const key = meta.key;
    if (!key) return;

    setDivisionLoading((prev) => ({ ...prev, [divisionName]: true }));

    try {
      const url = buildKeyUrl(key);
      const res = await fetch(url, { cache: hard ? "no-store" : "default" });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to load division JSON for ${divisionName} (${res.status}) ${text || ""}`.trim()
        );
      }

      const json = await res.json();
      setDivisionsData((prev) => ({ ...prev, [divisionName]: json }));
    } catch (err) {
      console.error(`Error loading division ${divisionName}:`, err);
      setError(
        err instanceof Error ? err.message : `Unexpected error loading ${divisionName} data.`
      );
    } finally {
      setDivisionLoading((prev) => ({ ...prev, [divisionName]: false }));
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setDivisionsData({});
    setDivisionLoading({});
    setGrand(null);
    await loadManifest({ hard: true });
  }

  useEffect(() => {
    loadManifest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!payloadMeta?.divisionsMeta) return;
    const divisionNames = Object.keys(payloadMeta.divisionsMeta);
    if (!divisionNames.length) return;

    divisionNames.forEach((name) => void loadDivision(name, { hard: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadMeta]);

  // 30s polling
  useEffect(() => {
    if (!payloadMeta) return;

    let cancelled = false;

    async function checkForUpdate() {
      try {
        if (typeof document !== "undefined" && document.hidden) return;

        const url = buildManifestUrl(LEG3_YEAR) + `?t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;

        const json = await res.json();
        const newUpdatedAt = json.updatedAt || null;

        if (!cancelled && newUpdatedAt && newUpdatedAt !== updatedAt) {
          setPayloadMeta({
            name: json.name || `Ballsville Gauntlet – Leg 3 (${json.year || LEG3_YEAR})`,
            year: json.year || LEG3_YEAR,
            currentBracketWeek: json.currentBracketWeek || null,
            finalizedThroughWeek: json.finalizedThroughWeek ?? null,
            divisionsMeta: json.divisions || {},
            grandMeta: json.grand || null,
            missingSeedLeaguesSummary: json.missingSeedLeaguesSummary || [],
          });
          setUpdatedAt(newUpdatedAt);

          void hardReloadAll(json);
        }
      } catch (err) {
        console.error("Poll exception (gauntlet_leg3 manifest):", err);
      }
    }

    const intervalId = setInterval(checkForUpdate, 30_000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [payloadMeta, updatedAt]);
  const finalizedThroughWeek = payloadMeta?.finalizedThroughWeek ?? null;
  const week16Finalized =
  forceWeek17Preview || (finalizedThroughWeek != null && Number(finalizedThroughWeek) >= 16);


  const divisionsMeta = payloadMeta?.divisionsMeta || {};
  const realGrandStandings = Array.isArray(grand?.standings) ? grand.standings : [];
  const realGrandParticipants = Array.isArray(grand?.participants)
    ? grand.participants
    : realGrandStandings;

  // ✅ If preview mode is ON and the real list is empty, fake it from current data.
  const grandStandings = (forceWeek17Preview && realGrandStandings.length === 0)
    ? previewGrandStandings
    : realGrandStandings;

  const grandParticipants = (forceWeek17Preview && realGrandParticipants.length === 0)
    ? previewGrandStandings
    : realGrandParticipants;


  const hasWeek17Scores =
    grandParticipants.length > 0 &&
    grandParticipants.some((p) => typeof p.week17Score === "number" && p.week17Score !== 0);
  function SideBadge({ side }) {
    if (!side) return null;

    const label = String(side).toLowerCase();
    const pretty = label === "light" ? "Light" : label === "dark" ? "Dark" : side;

    const isLight = label === "light";
    const cls = isLight
      ? "border-[color:var(--color-primary)]/50 bg-[color:var(--color-primary)]/12 text-[color:var(--color-primary)]"
      : "border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/12 text-[color:var(--color-accent)]";

    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] leading-none ${cls}`}>
        {pretty}
      </span>
    );
  }

  return (
    <section className="section">
      <div className="container-site max-w-6xl space-y-6">
        {/* HERO */}
        <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
            <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            <div className="absolute top-10 right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <span className="badge">Gauntlet</span>
              <h1 className="h1 mt-3">Gauntlet Leg 3 — Bracket & Matchups</h1>
              <p className="lead mt-3 text-muted">
                Romans, Greeks, and Egyptians — Leg 3 playoff bracket + Week 17 Grand Championship.
              </p>

              <p className="mt-3 text-xs text-muted">
                Last updated: <span className="font-mono">{formatDateTime(updatedAt)}</span>
                {refreshing && (
                  <span className="ml-2 inline-flex items-center rounded-full border border-subtle bg-subtle-surface px-2 py-0.5 text-[0.65rem] text-muted">
                    Updating…
                  </span>
                )}
              </p>

              <p className="mt-1 text-[0.65rem] text-muted">
                Auto-refreshes every ~30 seconds while this tab is open.
              </p>
            </div>

            <div className="relative flex flex-wrap items-center justify-start md:justify-end gap-2">
              {error && (
                <div className="text-xs text-danger max-w-md">
                  {error}
                </div>
              )}

              {/* <button
                type="button"
                onClick={() => setForceWeek17Preview((v) => !v)}
                className={`btn ${forceWeek17Preview ? "btn-primary" : "btn-outline"}`}
                title="Preview Week 17 layout even if Week 16 isn't finalized yet"
              >
                {forceWeek17Preview ? "Week 17 Preview: ON" : "Week 17 Preview"}
              </button> */}


              <button
                type="button"
                onClick={handleRefresh}
                className="btn btn-outline"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setExpandAllGods((v) => !v)}
                className={`btn ${expandAllGods ? "btn-primary" : "btn-outline"}`}
              >
                {expandAllGods ? "Keep All Expanded" : "Expand All"}
              </button>

              <button
                type="button"
                onClick={() => setExpandedGods({})}
                className="btn btn-outline"
              >
                Collapse All
              </button>
            </div>
          </div>
        </header>

        {/* Loading / empty */}
        {loading ? (
          <div className="bg-card-surface border border-subtle rounded-2xl p-6 text-center shadow-sm">
            <p className="text-muted">Loading Gauntlet Leg 3…</p>
          </div>
        ) : !payloadMeta ? (
          <div className="bg-card-surface border border-subtle rounded-2xl p-6 text-center shadow-sm">
            <p className="text-muted">No Gauntlet Leg 3 data found yet.</p>
          </div>
        ) : (
          <main className="space-y-6">
            {/* SUMMARY + VIEW TOGGLES */}
            <section className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="h3">{payloadMeta.name}</h2>
                  <p className="mt-2 text-sm text-muted">
                    Year: <span className="font-mono text-primary">{payloadMeta.year}</span>
                    {payloadMeta.currentBracketWeek && (
                      <>
                        <span className="mx-2 text-muted">•</span>
                        Current bracket week:{" "}
                        <span className="font-mono text-accent">
                          {payloadMeta.currentBracketWeek}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Precomputed from Sleeper and shown for your viewing pleasure.
                  </p>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-3">
                  {/* Matchups vs Bracket */}
                  <div className="inline-flex items-center rounded-full border border-subtle bg-subtle-surface p-1 text-xs shadow-inner">
                    <button
                      type="button"
                      onClick={() => setViewMode("matchups")}
                      className={`px-3 py-1.5 rounded-full transition ${
                        viewMode === "matchups"
                          ? "bg-primary text-white font-semibold shadow"
                          : "text-muted hover:text-fg"
                      }`}
                    >
                      Matchups
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("bracket")}
                      className={`px-3 py-1.5 rounded-full transition ${
                        viewMode === "bracket"
                          ? "bg-primary text-white font-semibold shadow"
                          : "text-muted hover:text-fg"
                      }`}
                    >
                      Bracket
                    </button>
                  </div>

                  {viewMode === "matchups" && (
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="hidden sm:inline">Round:</span>
                      <div className="inline-flex items-center rounded-full border border-subtle bg-subtle-surface p-1 shadow-inner">
                        {["1", "2", "3", "4"].map((r) => {
                          const week = 12 + Number(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setRoundFilter(r)}
                              className={`px-2 py-1 rounded-full transition ${
                                roundFilter === r
                                  ? "bg-[color:var(--color-accent)] text-white font-semibold shadow"
                                  : "text-muted hover:text-fg"
                              }`}
                            >
                              R{r}
                              <span className="ml-1 hidden text-[0.65rem] text-muted sm:inline">
                                (W{week})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* LEGIONS */}
            <section className="space-y-6">
              {Object.entries(divisionsMeta).map(([divisionName, divisionMeta]) => {
                const divisionData = divisionsData[divisionName] || null;
                const isDivLoading = !!divisionLoading[divisionName];

                return (
                  <DivisionCard
                    key={divisionName}
                    divisionName={divisionName}
                    divisionMeta={divisionMeta}
                    divisionData={divisionData}
                    isLoading={isDivLoading}
                    viewMode={viewMode}
                    roundFilter={roundFilter}
                    finalizedThroughWeek={finalizedThroughWeek}
                    isGodOpen={isGodOpen}
                    toggleGodOpen={toggleGodOpen}
                  />
                );
              })}

              {Object.keys(divisionsMeta).length === 0 && (
                <div className="bg-card-surface border border-subtle rounded-2xl p-6 text-sm text-muted shadow-sm">
                  No Legions discovered in the manifest yet.
                </div>
              )}
            </section>

            {/* GRAND CHAMPIONSHIP — Week 17 */}
            <section className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="h3">Grand Championship — Week 17</h2>
                  <p className="mt-1 text-sm text-muted">
                    All God champions (Romans, Greeks, Egyptians) battle in Week 17 Best Ball.
                  </p>
                </div>

                {grand && week16Finalized && (
                  <div className="text-xs text-muted">
                    Week: <span className="font-mono text-primary">{grand.week}</span>
                    <span className="mx-2 text-muted">•</span>
                    Participants: <span className="font-mono">{grandParticipants.length}</span>
                  </div>
                )}
              </div>

              {/* ✅ Hide Week 17 standings until Week 16 is finalized */}
              {!week16Finalized ? (
                <div className="rounded-xl border border-subtle bg-subtle-surface px-4 py-3 text-sm text-muted">
                  Week 17 will populate once Week 16 is finalized.
                </div>
              ) : !grand || grandParticipants.length === 0 ? (
                <div className="rounded-xl border border-subtle bg-subtle-surface px-4 py-3 text-sm text-muted">
                  {forceWeek17Preview
                    ? "Preview mode: showing a simulated Week 17 field based on current best Leg 3 totals (not official champions)."
                    : "Grand Championship standings will appear here once the God champions have been determined."}
                </div>

              ) : (
                <>
                  {!hasWeek17Scores && (
                    <div className="rounded-xl border border-subtle bg-subtle-surface px-4 py-3 text-sm text-muted">
                      Week 17 scores haven’t posted yet — showing the qualified God champions (scores pending).
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-2xl border border-subtle bg-subtle-surface">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-subtle text-[0.7rem] uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2 text-center">Rank</th>
                          <th className="px-3 py-2">Legion</th>
                          <th className="px-3 py-2">God</th>
                          <th className="px-3 py-2">Owner</th>
                          <th className="px-3 py-2">Side</th>
                          <th className="px-3 py-2">League</th>
                          <th className="px-3 py-2 text-right">Wk 17 Score</th>
                          <th className="px-3 py-2 text-right">Leg 3 Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle text-[0.75rem]">
                        {grandStandings.map((p) => {
                        const side = p?.side ?? p?.bracketSide ?? p?.seedSide ?? null;

                        return (
                          <tr key={`${p.leagueId}-${p.rosterId}`}>
                            <td className="px-3 py-2 text-center font-mono text-primary">{p.rank}</td>
                            <td className="px-3 py-2">{p.division}</td>
                            <td className="px-3 py-2">{p.godName || `God ${p.godIndex ?? "?"}`}</td>

                            <td className="px-3 py-2">
                              <div className="truncate max-w-[160px]">{p.ownerName}</div>
                            </td>

                            <td className="px-3 py-2">
                              <SideBadge side={side} />
                            </td>

                            <td className="px-3 py-2">
                              <div className="truncate max-w-[260px] text-muted">{p.leagueName}</div>
                            </td>

                            <td className="px-3 py-2 text-right font-mono">
                              {Number(p.week17Score || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {Number(p.leg3Total || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}

                      </tbody>
                    </table>

                    <p className="px-3 py-2 text-[0.65rem] text-muted">
                      {hasWeek17Scores
                        ? "Ties are broken by total Leg 3 score, then by better seed."
                        : "Week 17 sorting will update automatically once scores post."}
                    </p>
                  </div>
                </>
              )}
            </section>


          </main>
        )}
      </div>
    </section>
  );
}

/* ================== Division wrapper ================== */

function DivisionCard({
  divisionName,
  divisionMeta,
  divisionData,
  isLoading,
  viewMode,
  roundFilter,
  finalizedThroughWeek,
  isGodOpen,
  toggleGodOpen,
}) {

  const gods = Array.isArray(divisionData?.gods) ? divisionData.gods : [];

  return (
    <div className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="h3">{divisionName}</h3>
          <p className="text-sm text-muted">
            4 Gods per Legion — bracket winners feed the Week 17 Grand Championship.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="badge">
            {divisionMeta.godsCount ?? gods.length ?? 0} Gods
          </span>

          {isLoading && !divisionData && (
            <span className="flex items-center gap-2 text-xs text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-subtle border-t-[color:var(--color-primary)]" />
              Loading…
            </span>
          )}
        </div>
      </div>

      {!divisionData ? (
        <div className="rounded-xl border border-subtle bg-subtle-surface p-4 text-center text-sm text-muted">
          {isLoading ? "Legion data is loading from R2…" : "No Legion data has been generated yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {gods.map((god) => (
            <GodCard
              key={god.index}
              god={god}
              divisionName={divisionName}
              isOpen={isGodOpen(divisionName, god.index)}
              onToggle={() => toggleGodOpen(divisionName, god.index)}
              viewMode={viewMode}
              roundFilter={roundFilter}
              finalizedThroughWeek={finalizedThroughWeek}
            />
          ))}

          {gods.length === 0 && (
            <div className="rounded-xl border border-subtle bg-subtle-surface p-4 text-center text-sm text-muted">
              No Gods built for this Legion yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================== Child Components ================== */

function GodCard({ god, divisionName, isOpen, onToggle, viewMode, roundFilter, finalizedThroughWeek }) {

  const cardRef = useRef(null);

  const pairings = Array.isArray(god?.pairings) ? god.pairings : [];
  const bracketRounds = Array.isArray(god?.bracketRounds) ? god.bracketRounds : [];
  const champion = god?.champion || null;
  const championTeam = champion?.winnerTeam || null;

  const hasWeek16Score =
    championTeam &&
    championTeam.leg3Weekly &&
    typeof championTeam.leg3Weekly[16] === "number" &&
    championTeam.leg3Weekly[16] !== 0;

  const desiredIndex = Math.max(0, (parseInt(roundFilter || "1", 10) || 1) - 1);
  const selectedRound =
    bracketRounds[desiredIndex] && Array.isArray(bracketRounds[desiredIndex].results)
      ? bracketRounds[desiredIndex]
      : null;

  let matchupRows = [];

  if (
    viewMode === "matchups" &&
    selectedRound &&
    Array.isArray(selectedRound.results) &&
    selectedRound.results.length
  ) {
    matchupRows = selectedRound.results.map((m) => {
      const teamA = m.teamA || {};
      const teamB = m.teamB || {};

      const scoreA = typeof m.scoreA === "number" ? m.scoreA : Number(m.scoreA || 0);
      const scoreB = typeof m.scoreB === "number" ? m.scoreB : Number(m.scoreB || 0);

      // ✅ normalize rosterId types (prevents subtle number/string mismatches)
      const winnerId = m?.winner?.rosterId != null ? Number(m.winner.rosterId) : null;
      const rosterA = teamA?.rosterId != null ? Number(teamA.rosterId) : null;
      const rosterB = teamB?.rosterId != null ? Number(teamB.rosterId) : null;

      const teamAIsWinner = winnerId != null && rosterA != null && winnerId === rosterA;
      const teamBIsWinner = winnerId != null && rosterB != null && winnerId === rosterB;


      const isPlayed =
        typeof scoreA === "number" &&
        typeof scoreB === "number" &&
        (scoreA !== 0 || scoreB !== 0);

      return {
        match: m.matchIndex,
        round: selectedRound.roundNumber,
        week: selectedRound.week,

        teamAName: teamA.ownerName,
        teamBName: teamB.ownerName,
        teamASeed: teamA.seed,
        teamBSeed: teamB.seed,
        teamASide: teamA.side || null,
        teamBSide: teamB.side || null,

        scoreA: Number(scoreA || 0),
        scoreB: Number(scoreB || 0),

        winnerRosterId: winnerId,

        // ✅ add these so the table can reliably compare winner ids
        teamARosterId: rosterA,
        teamBRosterId: rosterB,

        teamAIsWinner,
        teamBIsWinner,
        isPlayed,

        lineupA: m.lineupA || null,
        lineupB: m.lineupB || null,
      };


    });
  } else if (
    viewMode === "matchups" &&
    (!selectedRound || !selectedRound.results?.length) &&
    (roundFilter === "1" || !roundFilter) &&
    pairings.length > 0
  ) {
    matchupRows = pairings.map((p) => {
      const teamA = p.teamA || {};
      const teamB = p.teamB || {};

      const aLight = teamA.side === "light";
      const bLight = teamB.side === "light";

      let lightTeam = teamA;
      let darkTeam = teamB;

      if (!aLight && bLight) {
        lightTeam = teamB;
        darkTeam = teamA;
      }

      return {
        match: p.matchIndex,
        round: 1,
        week: 13,
        lightOwnerName: lightTeam.ownerName,
        darkOwnerName: darkTeam.ownerName,
        lightSeed: lightTeam.seed,
        darkSeed: darkTeam.seed,
        lightScore: 0,
        darkScore: 0,
        lightIsWinner: false,
        darkIsWinner: false,
        isPlayed: false,
        lightLineup: null,
        darkLineup: null,
      };
    });
  }

  const hasBracketContent =
    viewMode === "matchups" ? matchupRows.length > 0 : bracketRounds.length > 0;

  return (
    <div ref={cardRef} className="rounded-2xl border border-subtle bg-subtle-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[color:var(--color-card)]/50 transition"
      >
        <div>
          <div className="text-sm font-semibold">God {god.index}</div>
          <div className="mt-1 text-[0.75rem] text-muted">
            <span className="font-semibold text-primary">Light</span>:{" "}
            <span className="text-fg">{god.lightLeagueName}</span>
            <span className="mx-2 text-muted">•</span>
            <span className="font-semibold text-[color:var(--color-accent)]">Dark</span>:{" "}
            <span className="text-fg">{god.darkLeagueName}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {hasWeek16Score && championTeam && (
            <div className="inline-flex items-center gap-2 rounded-full border border-subtle bg-subtle-surface px-3 py-1 text-[0.75rem]">
              <span>🏆</span>
              <span className="font-semibold truncate max-w-[180px]">{championTeam.ownerName}</span>
            </div>
          )}

          <span className="flex items-center text-[0.75rem] text-muted">
            {isOpen ? "Hide" : "Show"}{" "}
            <span className="ml-1 text-xs">{isOpen ? "▴" : "▾"}</span>
          </span>
        </div>
      </button>

      <div
        className={`overflow-hidden border-t border-subtle transition-all duration-300 ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4">
          {hasBracketContent ? (
            viewMode === "matchups" ? (
              <GodMatchupsTable
                rows={matchupRows}
                roundFilter={roundFilter}
                finalizedThroughWeek={finalizedThroughWeek}
              />
            ) : (
              <GodBracket rounds={bracketRounds} finalizedThroughWeek={finalizedThroughWeek} />
            )
          ) : (
            <div className="text-sm text-muted">No bracket data for this God yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======== Matchups table + breakdown (logic unchanged, restyled) ======== */

function GodMatchupsTable({ rows, roundFilter, finalizedThroughWeek }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const meta = safeRows[0] || null;

  const [expandedMatch, setExpandedMatch] = useState(null);
  const containerRef = useRef(null);

  const expandedRow =
    expandedMatch != null ? safeRows.find((r) => r.match === expandedMatch) : null;

  useEffect(() => {
    if (expandedMatch == null) return;
    function handleClickOutside(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setExpandedMatch(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expandedMatch]);

  // Small badge (uses your existing .badge class)
    // Small badge (uses your existing .badge class)
  function SideBadge({ side }) {
    if (!side) return null;
    const label = String(side).toLowerCase();
    const pretty = label === "light" ? "Light" : label === "dark" ? "Dark" : side;

    const isLight = label === "light";
    const cls = isLight
      ? "border-[color:var(--color-primary)]/50 bg-[color:var(--color-primary)]/12 text-[color:var(--color-primary)]"
      : "border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/12 text-[color:var(--color-accent)]";

    return (
      <span
        className={`ml-2 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[0.6rem] leading-none ${cls}`}
      >
        {pretty}
      </span>
    );
  }


  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-2xl border border-subtle bg-card-surface text-[0.8rem]"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2 text-xs text-muted">
        <span>
          {meta ? `Round ${meta.round} • Week ${meta.week}` : `Round ${roundFilter || "?"}`}
        </span>

        {expandedRow && (
          <button
            type="button"
            onClick={() => setExpandedMatch(null)}
            className="text-xs underline underline-offset-4 decoration-accent hover:text-accent"
          >
            Close matchup breakdown
          </button>
        )}
      </div>

      {/* ✅ Use Team A / Team B labels + side badges */}
      <div className="grid grid-cols-5 border-y border-subtle bg-subtle-surface px-4 py-2 text-[0.7rem] uppercase tracking-wide text-muted">
        <span className="text-center">Match</span>
        <span className="text-center">Team A</span>
        <span className="text-center">A Score</span>
        <span className="text-center">B Score</span>
        <span className="text-center">Team B</span>
      </div>

      <div className="divide-y divide-subtle">
        {safeRows.map((m) => {
          const aScore =
        typeof m.scoreA === "number" ? m.scoreA : typeof m.lightScore === "number" ? m.lightScore : 0;
      const bScore =
        typeof m.scoreB === "number" ? m.scoreB : typeof m.darkScore === "number" ? m.darkScore : 0;

      const played = Number(aScore || 0) !== 0 || Number(bScore || 0) !== 0;
      const tied = played && Number(aScore || 0) === Number(bScore || 0);
      const isExpanded = expandedMatch === m.match;
      // ✅ Support both row shapes:
      const aName = m.teamAName ?? m.lightOwnerName ?? "?";
      const bName = m.teamBName ?? m.darkOwnerName ?? "?";

      const aSeed = m.teamASeed ?? m.lightSeed;
      const bSeed = m.teamBSeed ?? m.darkSeed;
      const aSide = m.teamASide ?? "light"; // fallback rows are always light/dark
      const bSide = m.teamBSide ?? "dark";

      // ✅ only lock winners/losers when the matchup week is finalized
const matchupWeek = Number(m.week ?? meta?.week ?? 0);
const weekFinalized =
  finalizedThroughWeek != null &&
  Number(finalizedThroughWeek) >= matchupWeek &&
  matchupWeek > 0;

// Prefer explicit winnerRosterId if we can compare it to both roster ids
// Prefer explicit winnerRosterId ONLY if it cleanly matches exactly one side
const winnerRosterId = m.winnerRosterId != null ? Number(m.winnerRosterId) : null;

// ids we added in matchupRows
const rosterAId = m.teamARosterId != null ? Number(m.teamARosterId) : null;
const rosterBId = m.teamBRosterId != null ? Number(m.teamBRosterId) : null;

let aIsWinner = false;
let bIsWinner = false;

// ✅ Explicit winner is only valid if:
// - both roster ids exist
// - roster ids are different
// - winnerRosterId matches ONE of them (not both, not neither)
const explicitWinnerValid =
  winnerRosterId != null &&
  rosterAId != null &&
  rosterBId != null &&
  rosterAId !== rosterBId &&
  (winnerRosterId === rosterAId || winnerRosterId === rosterBId);

if (explicitWinnerValid) {
  aIsWinner = winnerRosterId === rosterAId;
  bIsWinner = winnerRosterId === rosterBId;
} else if (weekFinalized && played && !tied) {
  // ✅ score fallback ONLY once the week is finalized
  aIsWinner = Number(aScore || 0) > Number(bScore || 0);
  bIsWinner = Number(bScore || 0) > Number(aScore || 0);
}

// Winner is "decided" only when:
// - explicit winner is valid OR
// - finalized + played + not tied (score fallback)
const winnerDecided =
  explicitWinnerValid || (weekFinalized && played && !tied);


// ✅ eliminate ONLY when decided AND finalized
const teamALost = winnerDecided && weekFinalized && played && !tied && !aIsWinner;
const teamBLost = winnerDecided && weekFinalized && played && !tied && !bIsWinner;

          return (
            <div key={m.match} className="last:border-b-0">
              <button
                type="button"
                onClick={() => setExpandedMatch((prev) => (prev === m.match ? null : m.match))}
                className={`grid grid-cols-5 px-4 py-3 items-center w-full text-left transition ${
                  isExpanded ? "bg-subtle-surface" : "hover:bg-subtle-surface/60"
                }`}
              >
                <div className="text-center font-mono text-muted">{m.match}</div>

                <div className="text-center">
                  <div
                    className={`truncate inline-flex items-center justify-center max-w-full ${
                      aIsWinner
                        ? "text-[color:var(--color-success)] font-semibold"
                        : teamALost
                        ? "text-danger line-through"
                        : "text-fg"
                    }`}
                  >
                    <span className="truncate">{aName}</span>
                    <SideBadge side={aSide} />
                  </div>

                  {typeof aSeed === "number" && (
                    <div className="text-[0.7rem] text-primary">Seed {aSeed}</div>
                  )}
                  {teamALost && <div className="text-[0.7rem] text-danger">Eliminated</div>}
                </div>

                <div className="text-center font-mono text-fg">{Number(aScore || 0).toFixed(2)}</div>
                <div className="text-center font-mono text-fg">{Number(bScore || 0).toFixed(2)}</div>

                <div className="text-center">
                  <div
                    className={`truncate inline-flex items-center justify-center max-w-full ${
                      bIsWinner
                        ? "text-[color:var(--color-success)] font-semibold"
                        : teamBLost
                        ? "text-danger line-through"
                        : "text-fg"
                    }`}
                  >
                    <span className="truncate">{bName}</span>
                    <SideBadge side={bSide} />
                  </div>

                  {typeof bSeed === "number" && (
                    <div className="text-[0.7rem] text-accent">Seed {bSeed}</div>
                  )}
                  {teamBLost && <div className="text-[0.7rem] text-danger">Eliminated</div>}
                </div>
              </button>

              {isExpanded && <MatchupBreakdown row={m} />}
            </div>
          );
        })}

        {safeRows.length === 0 && (
          <div className="px-4 py-4 text-center text-sm text-muted">
            No matchups for this round yet.
          </div>
        )}
      </div>
    </div>
  );
}


function InjuryTag({ status, injury_status }) {
  const raw = (injury_status || status || "").toString().toLowerCase();
  if (!raw) return null;

  if (raw.includes("question")) {
    return (
      <span className="ml-1 inline-flex items-center rounded-full border border-yellow-400/60 bg-yellow-400/10 px-1.5 py-0.5 text-[0.65rem] text-yellow-300">
        Q
      </span>
    );
  }
  if (raw === "ir" || raw.includes("injured reserve")) {
    return (
      <span className="ml-1 inline-flex items-center rounded-full border border-red-500/70 bg-red-500/10 px-1.5 py-0.5 text-[0.65rem] text-red-300">
        IR
      </span>
    );
  }
  if (raw.includes("out")) {
    return (
      <span className="ml-1 inline-flex items-center rounded-full border border-red-500/70 bg-red-500/10 px-1.5 py-0.5 text-[0.65rem] text-red-300">
        OUT
      </span>
    );
  }
  return null;
}

function LineupSide({ title, seed, lineup, isWinner, isPlayed }) {
  if (!lineup) return <div className="text-sm text-muted">No lineup data yet.</div>;

  const slotsOrder = ["QB", "RB", "WR", "TE", "FLEX", "SF"];

  const startersBySlot = slotsOrder.map((slot) => ({
    slot,
    players: (lineup.starters || []).filter((p) => p.slot === slot).sort((a, b) => b.points - a.points),
  }));

  const benchSorted = (lineup.bench || []).slice().sort((a, b) => b.points - a.points);

  const total =
    lineup.total ??
    lineup.starters?.reduce((sum, p) => sum + Number(p.points || 0), 0);

  const totalClass = !isPlayed
    ? "text-muted"
    : isWinner
    ? "text-[color:var(--color-success)]"
    : "text-danger";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold">
          {title}
          {typeof seed === "number" && <span className="ml-2 text-xs text-muted">Seed {seed}</span>}
        </div>
        <div className={`text-xs font-mono ${totalClass}`}>{Number(total || 0).toFixed(2)} pts</div>
      </div>

      <div className="rounded-2xl border border-subtle bg-subtle-surface p-3">
        <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          Starters
        </div>
        <div className="space-y-2">
          {startersBySlot.map(({ slot, players }) =>
            players.length ? (
              <div key={slot}>
                <div className="text-xs font-semibold text-muted">{slot}</div>
                <div className="mt-1 space-y-1">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-subtle bg-card-surface px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {p.name}
                          <InjuryTag status={p.status} injury_status={p.injury_status} />
                        </span>
                        <span className="text-xs text-muted">
                          {p.team || "FA"} • {p.pos}
                        </span>
                      </div>
                      <span className="text-sm font-mono">{Number(p.points || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-subtle bg-subtle-surface p-3">
        <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          Bench
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {benchSorted.length === 0 && <div className="text-xs text-muted">No bench players recorded.</div>}
          {benchSorted.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-subtle bg-card-surface px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm">
                  {p.name}
                  <InjuryTag status={p.status} injury_status={p.injury_status} />
                </span>
                <span className="text-xs text-muted">
                  {p.team || "FA"} • {p.pos}
                </span>
              </div>
              <span className="text-xs font-mono text-muted">
                {Number(p.points || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchupBreakdown({ row }) {
  const { lightLineup, darkLineup, week } = row || {};

  if (!lightLineup && !darkLineup) {
    return (
      <div className="border-t border-subtle bg-subtle-surface px-4 py-4 text-sm text-muted">
        Lineup breakdown will appear here once Week {week} Best Ball scores are available.
      </div>
    );
  }

  return (
    <div className="border-t border-subtle bg-subtle-surface px-4 py-4">
      <div className="mb-3 text-xs text-muted">
        Matchup breakdown for{" "}
        <span className="font-mono text-primary">
          Week {week} • Match {row.match}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LineupSide
          title={row.lightOwnerName || "Light"}
          seed={row.lightSeed}
          lineup={lightLineup}
          isWinner={row.lightIsWinner}
          isPlayed={row.isPlayed}
        />
        <LineupSide
          title={row.darkOwnerName || "Dark"}
          seed={row.darkSeed}
          lineup={darkLineup}
          isWinner={row.darkIsWinner}
          isPlayed={row.isPlayed}
        />
      </div>
    </div>
  );
}

/* ======== Bracket view (kept logic, lightly restyled wrapper) ======== */

function GodBracket({ rounds, finalizedThroughWeek }) {
  const safeRounds = Array.isArray(rounds) ? rounds : [];
  if (!safeRounds.length) {
    return (
      <div className="rounded-2xl border border-subtle bg-subtle-surface px-4 py-3 text-sm text-muted">
        Bracket rounds will appear here as Leg 3 weeks complete.
      </div>
    );
  }

  const firstRound = safeRounds[0];
  const firstRoundMatches = Array.isArray(firstRound.results) ? firstRound.results.length : 0;

  if (!firstRoundMatches) {
    return (
      <div className="rounded-2xl border border-subtle bg-subtle-surface px-4 py-3 text-sm text-muted">
        Bracket rounds will appear here as Leg 3 weeks complete.
      </div>
    );
  }

  const UNITS_PER_MATCH = 4;
  const totalRows = 1 + firstRoundMatches * UNITS_PER_MATCH;

  return (
    <div className="overflow-x-auto text-xs">
      <div
        className="inline-grid gap-x-4"
        style={{
          gridTemplateColumns: `repeat(${safeRounds.length}, minmax(180px, 1fr))`,
          gridTemplateRows: `repeat(${totalRows}, minmax(0, auto))`,
        }}
      >
        {safeRounds.map((round, roundIdx) => {
          const results = Array.isArray(round.results) ? round.results : [];
          const col = roundIdx + 1;
          const r = roundIdx + 1;
          const blockSize = Math.pow(2, r - 1);

          return (
            <div key={round.roundNumber} className="contents">
              <div
                className="mb-2 text-center font-semibold"
                style={{ gridColumn: col, gridRow: 1 }}
              >
                R{round.roundNumber} <span className="text-muted">(W{round.week})</span>
              </div>

              {results.map((match, matchIdx) => {
                const m = matchIdx + 1;
                const startIndex = 1 + (m - 1) * blockSize;
                const endIndex = startIndex + blockSize - 1;
                const centerIndex = (startIndex + endIndex) / 2;
                const centerSubRow =
                  2 + (centerIndex - 1) * UNITS_PER_MATCH + UNITS_PER_MATCH / 2;

                const rowSpan = UNITS_PER_MATCH;
                const rowStart = Math.round(centerSubRow - rowSpan / 2);

                return (
                  <div
                    key={match.matchIndex}
                    style={{
                      gridColumn: col,
                      gridRow: `${rowStart} / span ${rowSpan}`,
                    }}
                  >
                    <BracketMatchCard
                      match={match}
                      roundWeek={round.week}
                      finalizedThroughWeek={finalizedThroughWeek}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatchCard({ match, roundWeek, finalizedThroughWeek }) {
  const teamA = match?.teamA || {};
  const teamB = match?.teamB || {};

  // normalize ids
  const rosterA = teamA?.rosterId != null ? Number(teamA.rosterId) : null;
  const rosterB = teamB?.rosterId != null ? Number(teamB.rosterId) : null;

  const scoreA = Number(match?.scoreA ?? 0);
  const scoreB = Number(match?.scoreB ?? 0);

  const played = scoreA !== 0 || scoreB !== 0;

  // ✅ gate elimination/winner-deciding by finalizedThroughWeek
  const matchupWeek = Number(roundWeek ?? match?.week ?? 0);
  const weekFinalized =
    finalizedThroughWeek != null &&
    matchupWeek > 0 &&
    Number(finalizedThroughWeek) >= matchupWeek;

  // explicit winner (from JSON) — may be present early, so only honor it once finalized
  const winnerRosterId =
    match?.winner?.rosterId != null ? Number(match.winner.rosterId) : null;

  const explicitWinnerValid =
    winnerRosterId != null &&
    rosterA != null &&
    rosterB != null &&
    rosterA !== rosterB &&
    (winnerRosterId === rosterA || winnerRosterId === rosterB);

  let teamAIsWinner = false;
  let teamBIsWinner = false;

  if (weekFinalized) {
    // ✅ Only decide a winner once the week is finalized
    if (explicitWinnerValid) {
      teamAIsWinner = winnerRosterId === rosterA;
      teamBIsWinner = winnerRosterId === rosterB;
    } else if (played && scoreA !== scoreB) {
      teamAIsWinner = scoreA > scoreB;
      teamBIsWinner = scoreB > scoreA;
    } else if (played && scoreA === scoreB) {
      // tiebreak: lower seed wins
      const seedA = Number(teamA.seed ?? 999);
      const seedB = Number(teamB.seed ?? 999);
      if (seedA < seedB) teamAIsWinner = true;
      else if (seedB < seedA) teamBIsWinner = true;
      else {
        // final fallback: name
        const nameA = String(teamA.ownerName || "");
        const nameB = String(teamB.ownerName || "");
        if (nameA.localeCompare(nameB) <= 0) teamAIsWinner = true;
        else teamBIsWinner = true;
      }
    }
  }

  const winnerDecided = weekFinalized && (teamAIsWinner || teamBIsWinner);
  const teamALost = winnerDecided && played && !teamAIsWinner;
  const teamBLost = winnerDecided && played && !teamBIsWinner;

  return (
    <div className="relative rounded-2xl border border-subtle bg-card-surface px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-[0.7rem] text-muted">
        <span>Match {match.matchIndex}</span>
        <span className="font-mono">
          W{matchupWeek || "?"}
          
        </span>
      </div>

      <div className="space-y-1">
        <div
          className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1 border ${
            teamAIsWinner
              ? "border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/10"
              : "border-subtle bg-subtle-surface"
          } ${teamALost ? "text-danger line-through" : ""}`}
        >
          <span className="truncate max-w-[120px]">{teamA.ownerName ?? "?"}</span>
          <span className="flex items-center gap-2 text-[0.7rem]">
            <span className="text-muted">S{teamA.seed ?? "?"}</span>
            <span className="font-mono">{scoreA.toFixed(2)}</span>
          </span>
        </div>

        <div
          className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1 border ${
            teamBIsWinner
              ? "border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/10"
              : "border-subtle bg-subtle-surface"
          } ${teamBLost ? "text-danger line-through" : ""}`}
        >
          <span className="truncate max-w-[120px]">{teamB.ownerName ?? "?"}</span>
          <span className="flex items-center gap-2 text-[0.7rem]">
            <span className="text-muted">S{teamB.seed ?? "?"}</span>
            <span className="font-mono">{scoreB.toFixed(2)}</span>
          </span>
        </div>
      </div>

      {winnerDecided && (
        <div className="mt-2 text-[0.7rem] text-[color:var(--color-success)]">
          Advances →
        </div>
      )}
    </div>
  );
}

