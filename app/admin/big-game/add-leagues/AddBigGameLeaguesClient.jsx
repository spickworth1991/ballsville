// app/admin/big-game/add-leagues/AddBigGameLeaguesClient.jsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v, fallback = null) {
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

function normalizeSleeperStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "pre_draft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "inseason") return "in_season";
  if (s === "complete") return "complete";
  return s || null;
}

function bigGameLeagueStatusFromSleeper({ sleeper_status, open_teams, not_ready }) {
  if (not_ready) return "TBD";
  const st = normalizeSleeperStatus(sleeper_status);
  if (st === "drafting") return "DRAFTING";
  if (typeof open_teams === "number" && Number.isFinite(open_teams)) {
    return open_teams <= 0 ? "FULL" : "FILLING";
  }
  return "TBD";
}

async function sleeperUserByUsername(username) {
  const u = encodeURIComponent(String(username || "").trim());
  if (!u) return null;
  return fetchJson(`https://api.sleeper.app/v1/user/${u}`);
}

async function sleeperLeaguesForUserYear(userId, year) {
  const uid = encodeURIComponent(String(userId || "").trim());
  const y = encodeURIComponent(String(year));
  if (!uid || !y) return [];
  const leagues = await fetchJson(`https://api.sleeper.app/v1/user/${uid}/leagues/nfl/${y}`);

  // attach counts via rosters length + total_rosters per league
  // (Sleeper doesn't return rosters here, so we do a lightweight roster call per selected later in admin refresh.
  // For this page we compute open teams from league total_rosters and roster_count field if present, else null.)
  return (Array.isArray(leagues) ? leagues : []).map((lg) => {
    const total = safeNum(lg?.total_rosters, null);
    const filled = safeNum(lg?.roster_count, null); // sometimes present; if not, stays null
    const open = total != null && filled != null ? Math.max(0, total - filled) : null;
    return {
      league_id: lg?.league_id,
      name: lg?.name,
      status: lg?.status,
      avatar: lg?.avatar,
      total_teams: total,
      filled_teams: filled,
      open_teams: open,
    };
  });
}

export default function AddBigGameLeaguesClient({ initialSeason }) {
  const [season, setSeason] = useState(safeStr(initialSeason || ""));
  const [username, setUsername] = useState("");
  const [sleeperUser, setSleeperUser] = useState(null);

  const [bigGameData, setBigGameData] = useState(null);
  const [targetDivision, setTargetDivision] = useState("");

  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sleeperLeagues, setSleeperLeagues] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [forceNotReady, setForceNotReady] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const seasonNum = useMemo(() => {
    const n = safeNum(season, null);
    return n == null ? null : Number(n);
  }, [season]);

  const divisions = useMemo(() => {
    const rows = Array.isArray(bigGameData?.rows) ? bigGameData.rows : [];
    const headers = rows.filter((r) => r?.is_division_header);
    return headers
      .map((h) => ({
        division: safeStr(h?.division || "Division"),
        division_code: safeStr(h?.division_code || h?.division_slug || ""),
        division_slug: safeStr(h?.division_slug || h?.division_code || ""),
      }))
      .filter((d) => d.division_slug);
  }, [bigGameData]);

  useEffect(() => {
    (async () => {
      try {
        if (!seasonNum) return;
        const data = await fetchJson(`/api/admin/biggame?season=${encodeURIComponent(String(seasonNum))}`);
        setBigGameData(data);
      } catch (e) {
        setBigGameData(null);
      }
    })();
  }, [seasonNum]);

  useEffect(() => {
    if (!targetDivision && divisions.length) setTargetDivision(divisions[0].division_slug);
  }, [divisions, targetDivision]);

  function toggleSelected(leagueId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leagueId)) next.delete(leagueId);
      else next.add(leagueId);
      return next;
    });
  }

  async function lookupSleeperUser() {
    setErrorMsg("");
    setInfoMsg("");
    setLoadingUser(true);
    setSleeperUser(null);
    setSleeperLeagues([]);
    setSelectedIds(new Set());

    try {
      const u = await sleeperUserByUsername(username);
      setSleeperUser(u);
      setInfoMsg("User loaded. Now load leagues for the season.");
    } catch (e) {
      setErrorMsg(e?.message || "User lookup failed.");
    } finally {
      setLoadingUser(false);
    }
  }

  async function loadSleeperLeagues() {
    setErrorMsg("");
    setInfoMsg("");
    setLoadingLeagues(true);
    setSleeperLeagues([]);
    setSelectedIds(new Set());

    try {
      if (!sleeperUser?.user_id) throw new Error("No Sleeper user loaded yet.");
      if (!seasonNum) throw new Error("Enter a valid season year.");
      const leagues = await sleeperLeaguesForUserYear(sleeperUser.user_id, seasonNum);
      setSleeperLeagues(leagues.filter((x) => x.league_id));
      setInfoMsg(`Loaded ${leagues.length} leagues.`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to load leagues.");
    } finally {
      setLoadingLeagues(false);
    }
  }

  async function addSelectedToBigGame() {
    setErrorMsg("");
    setInfoMsg("");
    setSaving(true);

    try {
      if (!seasonNum) throw new Error("Enter a valid season year.");
      if (!bigGameData) throw new Error("Could not load Big Game data for that season.");
      if (!targetDivision) throw new Error("Pick a target division (create one first in Big Game admin).");
      if (!selectedIds.size) throw new Error("Select at least one league.");

      const rows = Array.isArray(bigGameData?.rows) ? bigGameData.rows : [];
      const existingIds = new Set(rows.map((r) => safeStr(r?.sleeper_league_id || "").trim()).filter(Boolean));

      const targetHeader = rows.find((r) => r?.is_division_header && safeStr(r?.division_slug || r?.division_code) === targetDivision);
      const division = safeStr(targetHeader?.division || "Division");
      const division_code = safeStr(targetHeader?.division_code || targetDivision);

      // next display_order
      const existingInDiv = rows.filter((r) => !r?.is_division_header && safeStr(r?.division_slug || r?.division_code) === targetDivision);
      const maxOrder = existingInDiv.reduce((m, r) => Math.max(m, safeNum(r?.display_order, 0)), 0);

      let order = maxOrder;
      const toAdd = sleeperLeagues
        .filter((lg) => selectedIds.has(lg.league_id))
        .filter((lg) => !existingIds.has(String(lg.league_id)))
        .map((lg) => {
          order += 1;

          const notReady = forceNotReady;
          const status = bigGameLeagueStatusFromSleeper({
            sleeper_status: lg.status,
            open_teams: lg.open_teams,
            not_ready: notReady,
          });

          return {
            year: seasonNum,
            id: crypto.randomUUID(),

            division,
            division_code,
            division_slug: targetDivision,
            is_division_header: false,

            display_order: order,

            league_name: lg.name || "League",
            league_url: "", // invite is still manual for Big Game
            league_status: status,

            sleeper_league_id: String(lg.league_id),
            sleeper_url: `https://sleeper.com/leagues/${lg.league_id}`,
            sleeper_status: lg.status,
            avatar_id: lg.avatar || null,

            total_teams: lg.total_teams,
            filled_teams: lg.filled_teams,
            open_teams: lg.open_teams,

            not_ready: notReady,
            is_active: true,
          };
        });

      const nextRows = [...rows, ...toAdd];
      const payload = {
        ...(bigGameData || {}),
        season: seasonNum,
        rows: nextRows,
      };

      await fetchJson(`/api/admin/biggame?season=${encodeURIComponent(String(seasonNum))}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const updated = await fetchJson(`/api/admin/biggame?season=${encodeURIComponent(String(seasonNum))}`);
      setBigGameData(updated);
      setSelectedIds(new Set());
      setInfoMsg(`Added ${toAdd.length} leagues to ${targetDivision}. Back to Big Game admin to set invite links.`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to add leagues.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Add Leagues from Sleeper</h1>
          <p className="text-sm text-muted">Search a Sleeper username, load their leagues for a season, then add selected leagues to a Big Game division.</p>
        </div>
        <Link prefetch={false} href={`/admin/big-game?season=${encodeURIComponent(String(season || ""))}`} className="btn btn-outline">
          Back to Big Game Admin
        </Link>
      </div>

      {(errorMsg || infoMsg) && (
        <div className={`rounded-xl border p-3 text-sm ${errorMsg ? "border-red-500/40 bg-red-500/10" : "border-cyan-500/40 bg-cyan-500/10"}`}>
          {errorMsg || infoMsg}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="card p-4 space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Step 1: Pick season + division</div>
            <div className="text-xs text-muted">Divisions come from the Big Game admin data for that season.</div>
          </div>

          <label className="space-y-1">
            <div className="text-xs text-muted">Season (year)</div>
            <input className="input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026" />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-muted">Target division</div>
            <select className="input" value={targetDivision} onChange={(e) => setTargetDivision(e.target.value)}>
              {divisions.map((d) => (
                <option key={d.division_code} value={d.division_slug}>
                  {d.division} ({d.division_code})
                </option>
              ))}
              {!divisions.length && <option value="">No divisions found (create one first)</option>}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={forceNotReady} onChange={(e) => setForceNotReady(e.target.checked)} />
            Mark added leagues as “Not Ready” (forces TBD)
          </label>
        </div>

        <div className="card p-4 space-y-3 md:col-span-2">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Step 2: Sleeper username</div>
            <div className="text-xs text-muted">We use this username to load their leagues for the selected season.</div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <input className="input flex-1 min-w-[220px]" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Sleeper username" />
            <button className="btn" disabled={loadingUser || !username.trim()} onClick={lookupSleeperUser}>
              {loadingUser ? "Searching…" : "Find user"}
            </button>
          </div>

          <div className="rounded-lg border border-subtle p-3">
            <div className="text-xs text-muted">User</div>
            <div className="font-semibold">{sleeperUser ? safeStr(sleeperUser?.display_name || sleeperUser?.username) : "—"}</div>
            {sleeperUser?.user_id && <div className="text-xs text-muted">ID: {sleeperUser.user_id}</div>}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-outline" disabled={loadingLeagues || !sleeperUser?.user_id || !String(season).trim()} onClick={loadSleeperLeagues}>
              {loadingLeagues ? "Loading leagues…" : "Load leagues"}
            </button>

            <button
              className="btn"
              disabled={saving || !selectedIds.size || !divisions.length}
              onClick={addSelectedToBigGame}
              title="Adds selected leagues to the chosen division. You'll still set invite links manually on the Big Game admin page."
            >
              {saving ? "Adding…" : `Add selected (${selectedIds.size})`}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="text-sm font-semibold">Step 3: Select leagues</div>
            <div className="text-xs text-muted">
              Counts are computed from Sleeper metadata where possible. Big Game invite links are still manual, so you’ll set them back on the main admin.
            </div>
          </div>
          <div className="text-xs text-muted">Loaded: {sleeperLeagues.length}</div>
        </div>

        {!sleeperLeagues.length ? (
          <div className="text-sm text-muted">No leagues loaded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-subtle">
                  <th className="py-2 pr-3">Add</th>
                  <th className="py-2 pr-3">League</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Teams</th>
                  <th className="py-2 pr-3">League ID</th>
                </tr>
              </thead>
              <tbody>
                {sleeperLeagues.map((lg) => {
                  const checked = selectedIds.has(lg.league_id);
                  const status = bigGameLeagueStatusFromSleeper({ sleeper_status: lg.status, open_teams: lg.open_teams, not_ready: forceNotReady });
                  const teamsTxt =
                    lg.total_teams != null && lg.filled_teams != null
                      ? `${lg.filled_teams}/${lg.total_teams} (${lg.open_teams ?? "?"} open)`
                      : "—";

                  return (
                    <tr key={lg.league_id} className="border-b border-subtle">
                      <td className="py-2 pr-3">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelected(lg.league_id)} />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-semibold">{lg.name || "(Untitled)"}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center rounded-full border border-subtle px-2 py-0.5 text-xs">{status}</span>
                      </td>
                      <td className="py-2 pr-3">{teamsTxt}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{lg.league_id}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
