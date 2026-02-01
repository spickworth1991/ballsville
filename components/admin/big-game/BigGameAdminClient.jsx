"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function asStr(v, fallback = "") {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}
function asNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${t ? ` — ${t}` : ""}`);
  }
  return res.json();
}

async function apiJson(path, init) {
  // Canonical route only. (Stop double-fetching /big-game + /biggame.)
  return fetchJson(path, init);
}

function normalizeSleeperStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "pre_draft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "inseason") return "in_season";
  if (s === "complete") return "complete";
  return s || null;
}

function leagueStatusFromSleeper({ sleeper_status, open_teams, not_ready }) {
  if (not_ready) return "TBD";
  const st = normalizeSleeperStatus(sleeper_status);
  if (st === "drafting") return "DRAFTING";
  if (typeof open_teams === "number" && Number.isFinite(open_teams)) {
    return open_teams <= 0 ? "FULL" : "FILLING";
  }
  return "TBD";
}

function computeDivisionStatusAuto(div) {
  const leagues = Array.isArray(div?.leagues) ? div.leagues : [];
  const active = leagues.filter((l) => l?.is_active !== false);
  if (!active.length) return "TBD";
  if (active.some((l) => String(l?.league_status || "").toUpperCase() === "DRAFTING")) return "DRAFTING";
  if (active.every((l) => String(l?.league_status || "").toUpperCase() === "FULL")) return "FULL";
  return "TBD";
}

async function sleeperLeague(leagueId) {
  const id = encodeURIComponent(String(leagueId || "").trim());
  if (!id) return null;
  return fetchJson(`https://api.sleeper.app/v1/league/${id}`);
}

async function sleeperRosters(leagueId) {
  const id = encodeURIComponent(String(leagueId || "").trim());
  if (!id) return [];
  return fetchJson(`https://api.sleeper.app/v1/league/${id}/rosters`);
}

function uid() {
  return (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`).toString();
}

export default function BigGameAdminClient({ initialSeason }) {
  const [season, setSeason] = useState(asStr(initialSeason || ""));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [divisions, setDivisions] = useState([]);

  const seasonNum = useMemo(() => {
    const n = asNum(season, 0);
    return n > 0 ? n : null;
  }, [season]);

  useEffect(() => {
    (async () => {
      setError("");
      setInfo("");
      if (!seasonNum) return;
      setLoading(true);
      try {
        const res = await apiJson(`/api/admin/big-game?season=${encodeURIComponent(String(seasonNum))}&type=divisions`);
        const data = res?.data || res;
        setDivisions(Array.isArray(data?.divisions) ? data.divisions : []);
      } catch (e) {
        setDivisions([]);
        setError(e?.message || "Failed to load BIG GAME data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [seasonNum]);

  function updateDivision(idx, patch) {
    setDivisions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function updateLeague(divIdx, leagueIdx, patch) {
    setDivisions((prev) => {
      const next = [...prev];
      const d = { ...(next[divIdx] || {}) };
      const leagues = Array.isArray(d.leagues) ? [...d.leagues] : [];
      leagues[leagueIdx] = { ...leagues[leagueIdx], ...patch };
      d.leagues = leagues;
      next[divIdx] = d;
      return next;
    });
  }

  function addDivision() {
    const code = `DIV-${String(divisions.length + 1).padStart(2, "0")}`;
    setDivisions((prev) => [
      ...prev,
      {
        division_id: uid(),
        division_code: code,
        division_slug: code.toLowerCase(),
        division: `Division ${prev.length + 1}`,
        division_status_mode: "AUTO",
        division_status: "TBD",
        display_order: prev.length + 1,
        image_key: "",
        image_url: "",
        leagues: [],
      },
    ]);
  }

  function removeDivision(idx) {
    setDivisions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addLeagueManually(divIdx) {
    setDivisions((prev) => {
      const next = [...prev];
      const d = { ...(next[divIdx] || {}) };
      const leagues = Array.isArray(d.leagues) ? [...d.leagues] : [];
      const maxOrder = leagues.reduce((m, l) => Math.max(m, asNum(l?.display_order, 0)), 0);
      leagues.push({
        id: uid(),
        display_order: maxOrder + 1,
        league_name: "New League",
        league_url: "",
        league_status: "TBD",
        spots_available: null,
        sleeper_league_id: "",
        sleeper_url: "",
        sleeper_status: null,
        avatar_id: null,
        total_teams: null,
        filled_teams: null,
        open_teams: null,
        not_ready: false,
        is_active: true,
      });
      d.leagues = leagues;
      next[divIdx] = d;
      return next;
    });
  }

  function removeLeague(divIdx, leagueIdx) {
    setDivisions((prev) => {
      const next = [...prev];
      const d = { ...(next[divIdx] || {}) };
      d.leagues = (Array.isArray(d.leagues) ? d.leagues : []).filter((_, i) => i !== leagueIdx);
      next[divIdx] = d;
      return next;
    });
  }

  async function saveAll() {
    setError("");
    setInfo("");
    if (!seasonNum) {
      setError("Enter a valid season.");
      return;
    }
    setSaving(true);
    try {
      // Recompute AUTO division statuses before save.
      const nextDivs = (divisions || []).map((d) => {
        const mode = String(d?.division_status_mode || "AUTO").toUpperCase();
        if (mode === "AUTO") {
          return { ...d, division_status: computeDivisionStatusAuto(d) };
        }
        return d;
      });

      await apiJson(`/api/admin/big-game?season=${encodeURIComponent(String(seasonNum))}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "divisions",
          data: {
            season: seasonNum,
            divisions: nextDivs,
          },
        }),
      });

      setDivisions(nextDivs);
      setInfo("Saved.");
    } catch (e) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshStatuses() {
    setError("");
    setInfo("");
    setRefreshing(true);
    try {
      const nextDivs = await Promise.all(
        (divisions || []).map(async (d) => {
          const leagues = Array.isArray(d.leagues) ? d.leagues : [];
          const nextLeagues = await Promise.all(
            leagues.map(async (l) => {
              const leagueId = asStr(l?.sleeper_league_id || "").trim();
              if (!leagueId) return l;

              try {
                const [lg, rosters] = await Promise.all([sleeperLeague(leagueId), sleeperRosters(leagueId)]);
                const total = asNum(lg?.total_rosters, null);
                const filled = Array.isArray(rosters) ? rosters.length : null;
                const open = total != null && filled != null ? Math.max(0, total - filled) : null;

                const sleeper_status = normalizeSleeperStatus(lg?.status);
                const avatar_id = asStr(lg?.avatar || "", "") || null;
                const sleeper_url = `https://sleeper.com/leagues/${leagueId}`;
                const not_ready = !!l?.not_ready;

                const league_status = leagueStatusFromSleeper({
                  sleeper_status,
                  open_teams: open,
                  not_ready,
                });

                return {
                  ...l,
                  league_name: asStr(l?.league_name || lg?.name || "League"),
                  sleeper_status,
                  avatar_id,
                  sleeper_url,
                  total_teams: total,
                  filled_teams: filled,
                  open_teams: open,
                  league_status,
                };
              } catch {
                return l;
              }
            })
          );

          const nextDiv = { ...d, leagues: nextLeagues };
          const mode = String(nextDiv?.division_status_mode || "AUTO").toUpperCase();
          if (mode === "AUTO") {
            nextDiv.division_status = computeDivisionStatusAuto(nextDiv);
          }
          return nextDiv;
        })
      );

      setDivisions(nextDivs);
      setInfo("Refreshed Sleeper status + player counts.");
    } catch (e) {
      setError(e?.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="section">
      <div className="container-site space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="h2">BIG GAME – Admin</h1>
            <p className="text-muted text-sm">Same workflow as Redraft/Dynasty/Mini-Leagues: edit divisions, refresh Sleeper status + player counts, then save.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link prefetch={false} href={`/admin/big-game/add-leagues?season=${encodeURIComponent(String(season || ""))}`} className="btn btn-outline">
              Add Leagues
            </Link>
            <button className="btn btn-outline" onClick={refreshStatuses} disabled={refreshing || loading || !divisions.length}>
              {refreshing ? "Refreshing…" : "Refresh Status"}
            </button>
            <button className="btn btn-primary" onClick={saveAll} disabled={saving || loading}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {(error || info) && (
          <div className={`card border p-4 text-sm ${error ? "border-red-500/40 bg-red-500/10" : "border-cyan-500/40 bg-cyan-500/10"}`}>
            {error || info}
          </div>
        )}

        <div className="card border border-subtle p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="space-y-1">
              <div className="text-xs text-muted">Season</div>
              <input className="input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026" />
            </label>
            <button className="btn btn-outline" onClick={addDivision}>
              + Add Division
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card border border-subtle p-6 text-center text-muted">Loading…</div>
        ) : !divisions.length ? (
          <div className="card border border-subtle p-6 text-center">
            <p className="text-muted">No divisions yet for this season.</p>
            <p className="text-xs text-muted mt-2">Click “Add Division”, then “Add Leagues”.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {divisions
              .slice()
              .sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0))
              .map((d, divIdx) => {
                const leagues = Array.isArray(d.leagues) ? d.leagues : [];
                const badge = String(d?.division_status || "TBD").toUpperCase();
                const mode = String(d?.division_status_mode || "AUTO").toUpperCase();

                return (
                  <div key={d.division_id || d.division_code || divIdx} className="card border border-subtle p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className="input max-w-[320px]"
                            value={asStr(d.division || "")}
                            onChange={(e) => updateDivision(divIdx, { division: e.target.value })}
                            placeholder="Division name"
                          />
                          <span className="inline-flex items-center rounded-full border border-subtle px-2 py-0.5 text-xs">{badge}</span>
                        </div>
                        <div className="text-xs text-muted">Code: {asStr(d.division_code || d.division_slug || "") || "—"}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-muted">Order</label>
                        <input
                          className="input w-[90px]"
                          value={asStr(d.display_order ?? "")}
                          onChange={(e) => updateDivision(divIdx, { display_order: asNum(e.target.value, 0) })}
                        />

                        <select
                          className="input w-[140px]"
                          value={mode}
                          onChange={(e) => {
                            const nextMode = e.target.value;
                            updateDivision(divIdx, {
                              division_status_mode: nextMode,
                              division_status: nextMode === "AUTO" ? computeDivisionStatusAuto(d) : asStr(d.division_status || "TBD"),
                            });
                          }}
                        >
                          <option value="AUTO">AUTO</option>
                          <option value="MANUAL">MANUAL</option>
                        </select>

                        {mode === "MANUAL" && (
                          <select
                            className="input w-[140px]"
                            value={badge}
                            onChange={(e) => updateDivision(divIdx, { division_status: e.target.value })}
                          >
                            <option value="TBD">TBD</option>
                            <option value="DRAFTING">DRAFTING</option>
                            <option value="FULL">FULL</option>
                            <option value="FILLING">FILLING</option>
                          </select>
                        )}

                        <button className="btn btn-outline" onClick={() => addLeagueManually(divIdx)}>
                          + League
                        </button>
                        <button className="btn btn-outline" onClick={() => removeDivision(divIdx)}>
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted border-b border-subtle">
                            <th className="py-2 pr-3">Order</th>
                            <th className="py-2 pr-3">League</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2 pr-3">Teams</th>
                            <th className="py-2 pr-3">Invite URL</th>
                            <th className="py-2 pr-3">Active</th>
                            <th className="py-2 pr-3">Not Ready</th>
                            <th className="py-2 pr-3">Sleeper ID</th>
                            <th className="py-2 pr-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {leagues
                            .slice()
                            .sort((a, b) => asNum(a?.display_order, 0) - asNum(b?.display_order, 0))
                            .map((l, leagueIdx) => {
                              const badgeL = String(l?.league_status || "TBD").toUpperCase();
                              const teamsTxt =
                                l?.total_teams != null && l?.filled_teams != null
                                  ? `${l.filled_teams}/${l.total_teams} (${l.open_teams ?? "?"} open)`
                                  : "—";
                              return (
                                <tr key={l?.id || `${divIdx}-${leagueIdx}`} className="border-b border-subtle">
                                  <td className="py-2 pr-3">
                                    <input
                                      className="input w-[90px]"
                                      value={asStr(l?.display_order ?? "")}
                                      onChange={(e) => updateLeague(divIdx, leagueIdx, { display_order: asNum(e.target.value, 0) })}
                                    />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input
                                      className="input min-w-[220px]"
                                      value={asStr(l?.league_name || "")}
                                      onChange={(e) => updateLeague(divIdx, leagueIdx, { league_name: e.target.value })}
                                    />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <span className="inline-flex items-center rounded-full border border-subtle px-2 py-0.5 text-xs">{badgeL}</span>
                                  </td>
                                  <td className="py-2 pr-3 whitespace-nowrap">{teamsTxt}</td>
                                  <td className="py-2 pr-3">
                                    <input
                                      className="input min-w-[260px]"
                                      value={asStr(l?.league_url || "")}
                                      onChange={(e) => updateLeague(divIdx, leagueIdx, { league_url: e.target.value })}
                                      placeholder="https://sleeper.com/i/..."
                                    />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input
                                      type="checkbox"
                                      checked={l?.is_active !== false}
                                      onChange={(e) => updateLeague(divIdx, leagueIdx, { is_active: e.target.checked })}
                                    />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input
                                      type="checkbox"
                                      checked={!!l?.not_ready}
                                      onChange={(e) => {
                                        const not_ready = e.target.checked;
                                        updateLeague(divIdx, leagueIdx, {
                                          not_ready,
                                          league_status: leagueStatusFromSleeper({
                                            sleeper_status: l?.sleeper_status,
                                            open_teams: l?.open_teams,
                                            not_ready,
                                          }),
                                        });
                                      }}
                                    />
                                  </td>
                                  <td className="py-2 pr-3 font-mono text-xs">{asStr(l?.sleeper_league_id || "") || "—"}</td>
                                  <td className="py-2 pr-3 text-right">
                                    <button className="btn btn-outline" onClick={() => removeLeague(divIdx, leagueIdx)}>
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </section>
  );
}
