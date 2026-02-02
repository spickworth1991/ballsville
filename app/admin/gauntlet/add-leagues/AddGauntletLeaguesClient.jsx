"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";
import { safeStr } from "@/lib/safe";

const DEFAULT_SEASON = CURRENT_SEASON;

function safeNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSleeperStatus(raw) {
  const s = safeStr(raw).trim().toLowerCase();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "predraft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "inseason" || s === "in-season") return "inseason";
  if (s === "complete") return "complete";
  return s || "predraft";
}

function gauntletStatusFromSleeper({ sleeperStatus, openTeams, notReady }) {
  if (notReady) return "TBD";
  const s = normalizeSleeperStatus(sleeperStatus);
  if (s === "drafting") return "DRAFTING";
  if (safeNum(openTeams, 0) <= 0) return "FULL";
  return "FILLING";
}

async function sleeperUserLeagues(userId, season) {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(String(season))}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Sleeper user leagues failed (${res.status})`);
  return res.json();
}

async function sleeperUser(username) {
  const res = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper user lookup failed (${res.status})`);
  return res.json();
}

async function sleeperLeagueInfo(leagueId) {
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(String(leagueId))}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper league request failed (${res.status})`);
  return res.json();
}

async function sleeperLeagueRosters(leagueId) {
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(String(leagueId))}/rosters`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper rosters request failed (${res.status})`);
  return res.json();
}

function computeFillCounts(league, rosters) {
  const totalTeams = Number(league?.total_rosters) || (Array.isArray(rosters) ? rosters.length : 0);
  const filledTeams = Array.isArray(rosters) ? rosters.filter((r) => r && r.owner_id).length : 0;
  const openTeams = Math.max(0, totalTeams - filledTeams);
  return { totalTeams, filledTeams, openTeams };
}

async function fetchAvatarFile(avatarId) {
  const a = safeStr(avatarId).trim();
  if (!a) return null;
  const url = `https://sleepercdn.com/avatars/${encodeURIComponent(a)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const blob = await res.blob();
  const type = blob.type || "image/png";
  return new File([blob], `${a}.png`, { type });
}

async function getAccessToken() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function readApiError(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      return j?.error || j?.message || JSON.stringify(j);
    }
  } catch {
    // ignore
  }
  return res.text();
}

async function apiGET(season, type = "leagues") {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/gauntlet?season=${encodeURIComponent(String(season))}&type=${encodeURIComponent(type)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function apiPUT(season, payload, type = "leagues") {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/gauntlet?season=${encodeURIComponent(String(season))}&type=${encodeURIComponent(type)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const j = await res.json();
  if (j?.ok === false) throw new Error(j?.error || "Request failed");
  return j;
}

async function uploadImage(file, { season, legionCode, leagueOrder }) {
  const token = await getAccessToken();
  const fd = new FormData();
  fd.append("file", file);
  fd.append("section", "gauntlet-league");
  fd.append("season", String(season));
  fd.append("legionCode", String(legionCode));
  fd.append("leagueOrder", String(leagueOrder));

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const j = await res.json();
  if (!j?.ok) throw new Error(j?.error || "Upload failed");
  return j;
}

function nextOrderForLegion(rows, legionSlug) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => !r?.is_legion_header && safeStr(r?.legion_slug) === legionSlug);
  const max = Math.max(0, ...list.map((r) => safeNum(r?.league_order, 0)));
  return max + 1;
}

export default function AddGauntletLeaguesClient() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [username, setUsername] = useState("");
  const [legionSlug, setLegionSlug] = useState("");
  const [legions, setLegions] = useState([]);
  const [existingRows, setExistingRows] = useState([]);

  const [loadingLegions, setLoadingLegions] = useState(true);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  async function loadGauntlet() {
    setError("");
    setInfo("");
    setLoadingLegions(true);
    try {
      const j = await apiGET(season, "leagues");
      const rows = Array.isArray(j?.rows) ? j.rows : [];
      setExistingRows(rows);
      const hdrs = rows
        .filter((r) => r && r.is_legion_header)
        .slice()
        .sort((a, b) => safeNum(a?.legion_order, 9999) - safeNum(b?.legion_order, 9999));
      setLegions(hdrs);
      setLegionSlug((prev) => prev || safeStr(hdrs?.[0]?.legion_slug));
    } catch (e) {
      setLegions([]);
      setLegionSlug("");
      setExistingRows([]);
      setError(e?.message || "Failed to load gauntlet data.");
    } finally {
      setLoadingLegions(false);
    }
  }

  useEffect(() => {
    loadGauntlet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const pickedCount = selected.size;

  const alreadyAddedIds = useMemo(() => {
    const s = new Set();
    for (const r of existingRows) {
      if (r && !r.is_legion_header && r.league_id) s.add(String(r.league_id));
    }
    return s;
  }, [existingRows]);

  async function runSearch() {
    setError("");
    setInfo("");
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    try {
      const u = await sleeperUser(username.trim());
      const leagues = await sleeperUserLeagues(u?.user_id, season);
      const list = (Array.isArray(leagues) ? leagues : [])
        .map((l) => ({
          league_id: String(l?.league_id || ""),
          name: safeStr(l?.name),
          avatar: safeStr(l?.avatar),
          season: safeNum(season, DEFAULT_SEASON),
          status: normalizeSleeperStatus(l?.status),
          total_rosters: safeNum(l?.total_rosters, 0),
        }))
        .filter((l) => l.league_id && l.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      setResults(list);
      setInfo(list.length ? `Found ${list.length} leagues.` : "No leagues found for that user/season.");
    } catch (e) {
      setError(e?.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function addSelected() {
    setError("");
    setInfo("");
    if (!legionSlug) {
      setError("Pick a legion first.");
      return;
    }
    if (!pickedCount) {
      setError("Select at least one league.");
      return;
    }

    setAdding(true);
    try {
      // Pull latest before we write.
      const j = await apiGET(season, "leagues");
      const rows = Array.isArray(j?.rows) ? j.rows : [];

      let order = nextOrderForLegion(rows, legionSlug);
      const picked = results.filter((r) => selected.has(r.league_id));

      for (const item of picked) {
        if (alreadyAddedIds.has(item.league_id)) continue;

        // Fetch canonical league + rosters for fill counts
        const league = await sleeperLeagueInfo(item.league_id);
        const rosters = await sleeperLeagueRosters(item.league_id);
        const { totalTeams, filledTeams, openTeams } = computeFillCounts(league, rosters);

        const sleeper_status = normalizeSleeperStatus(league?.status);
        const league_status = gauntletStatusFromSleeper({ sleeperStatus: sleeper_status, openTeams, notReady: false });

        // Upload avatar as league image (if possible)
        let league_image_key = "";
        let league_image_path = "";
        const avatarFile = await fetchAvatarFile(league?.avatar || item.avatar);
        if (avatarFile) {
          const up = await uploadImage(avatarFile, { season, legionCode: legionSlug, leagueOrder: order });
          league_image_key = safeStr(up?.key);
          league_image_path = safeStr(up?.url);
        }

        rows.push({
          season,
          is_legion_header: false,
          legion_slug: legionSlug,
          league_order: order,
          league_id: String(item.league_id),
          league_name: safeStr(league?.name || item.name),
          league_url: "",
          sleeper_status,
          league_status,
          total_teams: totalTeams,
          filled_teams: filledTeams,
          open_teams: openTeams,
          avatar: safeStr(league?.avatar || item.avatar),
          league_image_key,
          league_image_path,
          notReady: false,
          is_active: true,
        });

        order += 1;
      }

      await apiPUT(season, { season, rows }, "leagues");
      setInfo("Added leagues and saved.");
      setSelected(new Set());
      await loadGauntlet();
    } catch (e) {
      setError(e?.message || "Failed to add leagues.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Season</label>
            <input className="input w-[120px]" value={String(season)} onChange={(e) => setSeason(safeNum(e.target.value, DEFAULT_SEASON))} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Sleeper Username</label>
            <input className="input w-[240px]" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="sticky_picky" />
          </div>
          <button className="btn btn-primary" onClick={runSearch} disabled={searching || !username.trim()}>
            {searching ? "Searching…" : "Find Leagues"}
          </button>
        </div>

        <Link className="btn btn-outline" href={`/admin/gauntlet?season=${encodeURIComponent(String(season))}`}>Back to Gauntlet Admin</Link>
      </div>

      {error ? (
        <div className="card bg-card-surface border border-danger/30 p-4">
          <p className="text-danger">{error}</p>
        </div>
      ) : null}
      {info ? (
        <div className="card bg-card-surface border border-emerald-500/30 p-4">
          <p className="text-emerald-300">{info}</p>
        </div>
      ) : null}

      <div className="card bg-card-surface border border-subtle p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-fg">Assign to Legion</h2>
            <p className="text-sm text-muted">Choose the legion that the selected leagues should belong to.</p>
          </div>

          <div className="min-w-[260px]">
            <label className="block text-xs text-muted mb-1">Legion</label>
            <select
              className="select w-full"
              value={legionSlug}
              onChange={(e) => setLegionSlug(e.target.value)}
              disabled={loadingLegions || !legions.length}
            >
              {legions.length ? (
                legions.map((l) => (
                  <option key={safeStr(l?.legion_slug)} value={safeStr(l?.legion_slug)}>
                    {safeStr(l?.legion_name) || safeStr(l?.legion_slug)}
                  </option>
                ))
              ) : (
                <option value="">No legions found</option>
              )}
            </select>
          </div>
        </div>

        {!legions.length ? (
          <div className="rounded-2xl border border-subtle bg-black/20 p-4 text-sm text-muted">
            You don’t have any legions yet. Go back to Gauntlet Admin and add a legion first.
          </div>
        ) : null}
      </div>

      <div className="card bg-card-surface border border-subtle p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-fg">Results</h2>
            <p className="text-sm text-muted">Pick leagues to add. Already-added leagues are disabled.</p>
          </div>
          <button className="btn btn-primary" onClick={addSelected} disabled={adding || !pickedCount || !legionSlug}>
            {adding ? "Adding…" : `Add Selected (${pickedCount})`}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {results.map((r) => {
            const disabled = alreadyAddedIds.has(r.league_id);
            const checked = selected.has(r.league_id);
            const avatarUrl = r.avatar ? `https://sleepercdn.com/avatars/${encodeURIComponent(r.avatar)}` : "";
            return (
              <label
                key={r.league_id}
                className={`rounded-2xl border p-4 flex gap-3 cursor-pointer ${disabled ? "border-white/10 bg-black/10 opacity-60 cursor-not-allowed" : "border-subtle bg-black/20 hover:bg-black/30"}`}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(r.league_id);
                      else next.delete(r.league_id);
                      return next;
                    });
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-fg truncate">{r.name}</div>
                      <div className="text-xs text-muted mt-1">ID: {r.league_id}</div>
                    </div>
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="h-10 w-10 rounded-xl border border-white/10 object-cover" />
                    ) : null}
                  </div>
                  {disabled ? (
                    <div className="mt-2 text-xs text-amber-200">Already added</div>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
