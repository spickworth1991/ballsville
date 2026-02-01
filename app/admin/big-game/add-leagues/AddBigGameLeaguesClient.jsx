"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

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

async function getAuthToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function fetchAvatarFile(avatarId) {
  const id = safeStr(avatarId).trim();
  if (!id) return null;

  const candidates = [
    `https://sleepercdn.com/avatars/${id}`,
    `https://sleepercdn.com/avatars/${id}.png`,
    `https://sleepercdn.com/avatars/${id}.jpg`,
    `https://sleepercdn.com/avatars/${id}.jpeg`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const ct = safeStr(res.headers.get("content-type")).toLowerCase();
      let ext = "png";
      if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
      if (ct.includes("webp")) ext = "webp";
      return new File([blob], `avatar.${ext}`, { type: blob.type || ct || "image/png" });
    } catch {
      // ignore
    }
  }
  return null;
}

async function uploadBigGameLeagueAvatar({ token, season, divisionSlug, leagueOrder, file }) {
  if (!file) return null;

  const qs = new URLSearchParams({
    section: "biggame-league",
    season: String(season),
    divisionSlug: safeStr(divisionSlug),
    leagueOrder: String(leagueOrder),
  });

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`/api/admin/upload?${qs.toString()}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || `Upload failed (${res.status})`);
  return { key: json.key, url: json.url };
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
  return (Array.isArray(leagues) ? leagues : []).map((lg) => {
    const total = safeNum(lg?.total_rosters, null);
    const filled = safeNum(lg?.roster_count, null);
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

  const [divisionsData, setDivisionsData] = useState(null);
  const [targetDivision, setTargetDivision] = useState("");

  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sleeperLeagues, setSleeperLeagues] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const seasonNum = useMemo(() => safeNum(season, null), [season]);

  const divisions = useMemo(() => {
    const list = Array.isArray(divisionsData?.divisions) ? divisionsData.divisions : [];
    return list
      .map((d) => ({
        id: safeStr(d?.id || d?.division_id || ""),
        code: safeStr(d?.code || d?.division_code || d?.slug || ""),
        slug: safeStr(d?.slug || d?.division_slug || d?.code || ""),
        title: safeStr(d?.title || d?.division || "Division"),
      }))
      .filter((d) => d.slug);
  }, [divisionsData]);

  useEffect(() => {
    (async () => {
      try {
        if (!seasonNum) return;
        const res = await fetchJson(`/api/admin/big-game?season=${encodeURIComponent(String(seasonNum))}&type=divisions`);
        setDivisionsData(res?.data || null);
      } catch {
        setDivisionsData(null);
      }
    })();
  }, [seasonNum]);

  useEffect(() => {
    if (!targetDivision && divisions.length) setTargetDivision(divisions[0].slug);
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

  async function addSelectedToDivision() {
    setErrorMsg("");
    setInfoMsg("");
    setSaving(true);

    try {
      if (!seasonNum) throw new Error("Enter a valid season year.");
      if (!targetDivision) throw new Error("Pick a target division.");
      if (!selectedIds.size) throw new Error("Select at least one league.");

      const res = await fetchJson(`/api/admin/big-game?season=${encodeURIComponent(String(seasonNum))}&type=divisions`);
      const data = res?.data;
      if (!data) throw new Error("Could not load Big Game divisions.");
      const divisionsList = Array.isArray(data.divisions) ? data.divisions : [];

      const divIdx = divisionsList.findIndex((d) => safeStr(d.slug || d.division_slug || d.code || d.division_code) === targetDivision);
      if (divIdx < 0) throw new Error("Division not found.");

      const div = { ...divisionsList[divIdx] };
      const leagues = Array.isArray(div.leagues) ? [...div.leagues] : [];
      const existing = new Set(leagues.map((l) => safeStr(l.sleeper_league_id || l.sleeperLeagueId || l.league_id || l.id)).filter(Boolean));

      let nextOrder = leagues.reduce((m, l) => Math.max(m, safeNum(l.display_order ?? l.order, 0)), 0);

      const toAdd = sleeperLeagues
        .filter((lg) => selectedIds.has(lg.league_id))
        .filter((lg) => !existing.has(String(lg.league_id)))
        .map((lg) => {
          nextOrder += 1;
          const status = bigGameLeagueStatusFromSleeper({ sleeper_status: lg.status, open_teams: lg.open_teams, not_ready: false });
          return {
            id: crypto.randomUUID(),
            display_order: nextOrder,
            league_name: lg.name || "League",
            league_url: "",
            league_status: status,
            sleeper_league_id: String(lg.league_id),
            sleeper_url: `https://sleeper.com/leagues/${lg.league_id}`,
            sleeper_status: lg.status,
            avatar_id: lg.avatar || null,
            total_teams: lg.total_teams,
            filled_teams: lg.filled_teams,
            open_teams: lg.open_teams,
            not_ready: false,
            is_active: true,
          };
        });

      // Upload Sleeper league avatar to R2 immediately so the directory previews work
      // without requiring a separate "Refresh Status + Counts" run.
      try {
        const token = await getAuthToken();
        for (const row of toAdd) {
          if (!row?.avatar_id) continue;
          const file = await fetchAvatarFile(row.avatar_id);
          if (!file) continue;
          const uploaded = await uploadBigGameLeagueAvatar({
            token,
            season: seasonNum,
            divisionSlug: targetDivision,
            leagueOrder: row.display_order,
            file,
          });
          if (uploaded?.key) {
            row.league_image_key = uploaded.key;
            row.league_image_path = uploaded.url;
          }
        }
      } catch {
        // non-fatal — leagues can still be created; admin can refresh later
      }

      div.leagues = [...leagues, ...toAdd];
      divisionsList[divIdx] = div;

      const next = { ...data, season: seasonNum, divisions: divisionsList };

      await fetchJson(`/api/admin/big-game?season=${encodeURIComponent(String(seasonNum))}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "divisions", data: next }),
      });

      setSelectedIds(new Set());
      setInfoMsg(`Added ${toAdd.length} leagues. Back to Big Game admin to refresh status + set invite links.`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to add leagues.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section">
      <div className="container-site space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <h1 className="h2">BIG GAME — Add Leagues</h1>
            <p className="text-muted text-sm">Same flow as Redraft/Dynasty/Mini: pick a season + division, pull leagues from Sleeper, add them, then refresh status on the main admin.</p>
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

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card bg-card-surface border border-subtle p-4 space-y-3">
            <div className="text-sm font-semibold">Season + Division</div>

            <label className="space-y-1">
              <div className="text-xs text-muted">Season</div>
              <input className="input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2026" />
            </label>

            <label className="space-y-1">
              <div className="text-xs text-muted">Target division</div>
              <select className="input" value={targetDivision} onChange={(e) => setTargetDivision(e.target.value)}>
                {divisions.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.title} ({d.code || d.slug})
                  </option>
                ))}
                {!divisions.length && <option value="">No divisions found (create one first)</option>}
              </select>
            </label>
          </div>

          <div className="card bg-card-surface border border-subtle p-4 space-y-3 md:col-span-2">
            <div className="text-sm font-semibold">Sleeper username</div>

            <div className="flex gap-2 flex-wrap">
              <input className="input flex-1 min-w-[220px]" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Sleeper username" />
              <button className="btn btn-primary" disabled={loadingUser || !username.trim()} onClick={lookupSleeperUser}>
                {loadingUser ? "Searching…" : "Find user"}
              </button>
            </div>

            <div className="rounded-lg border border-subtle p-3">
              <div className="text-xs text-muted">User</div>
              <div className="font-semibold">{sleeperUser ? safeStr(sleeperUser?.display_name || sleeperUser?.username) : "—"}</div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-outline" disabled={loadingLeagues || !sleeperUser?.user_id || !String(season).trim()} onClick={loadSleeperLeagues}>
                {loadingLeagues ? "Loading…" : "Load leagues"}
              </button>
              <button className="btn btn-primary" disabled={saving || !selectedIds.size || !divisions.length} onClick={addSelectedToDivision}>
                {saving ? "Adding…" : `Add selected (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-card-surface border border-subtle p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <div className="text-sm font-semibold">Select leagues</div>
              <div className="text-xs text-muted">We’ll pull player counts on the Big Game admin “Refresh Status” step (this page only uses league metadata).</div>
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
                    const status = bigGameLeagueStatusFromSleeper({ sleeper_status: lg.status, open_teams: lg.open_teams, not_ready: false });
                    const teamsTxt =
                      lg.total_teams != null && lg.filled_teams != null ? `${lg.filled_teams}/${lg.total_teams}` : "—";

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
    </section>
  );
}
