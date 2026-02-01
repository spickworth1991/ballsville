// components/admin/big-game/BigGameAdminClient.jsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const DIVISION_STATUS_OPTIONS = ["FULL", "TBD", "DRAFTING"];
const LEAGUE_STATUS_OPTIONS = ["FULL", "FILLING", "TBD", "DRAFTING"];

// =====================================================
// Sleeper-backed status + counts (optional per league)
// =====================================================
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
  // If we can't compute slots, keep non-drafting as TBD (safe default)
  return "TBD";
}

// Division status rule (exactly as you requested)
function deriveDivisionStatusFromLeagueRows(leagues) {
  const list = Array.isArray(leagues) ? leagues : [];
  const statuses = list
    .filter((r) => !r?.is_division_header)
    .map((r) => (r?.not_ready ? "TBD" : String(r?.league_status || "").toUpperCase().trim()))
    .filter(Boolean);

  if (statuses.some((s) => s === "DRAFTING")) return "DRAFTING";
  if (statuses.length > 0 && statuses.every((s) => s === "FULL")) return "FULL";
  return "TBD";
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function safeBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function normalizeRow(r, idx, season) {
  const year = safeNum(r?.year || season, season);

  // Division
  const id = safeStr(r?.id || r?.row_id || "").trim() || crypto.randomUUID();
  const division = safeStr(r?.division || "").trim();
  const division_code = safeStr(r?.division_code || "").trim();
  const division_slug = safeStr(r?.division_slug || division_code || "").trim();
  const is_division_header = safeBool(r?.is_division_header, false);
  const division_status = DIVISION_STATUS_OPTIONS.includes(safeStr(r?.division_status)) ? safeStr(r?.division_status) : "TBD";
  const division_image_key = safeStr(r?.division_image_key || "");
  const division_image_path = safeStr(r?.division_image_path || "");

  // League
  const display_order = safeNum(r?.display_order, null);
  const league_name = safeStr(r?.league_name || "").trim();
  const league_url = safeStr(r?.league_url || "").trim();
  const league_status = LEAGUE_STATUS_OPTIONS.includes(safeStr(r?.league_status)) ? safeStr(r?.league_status) : "TBD";
  const league_image_key = safeStr(r?.league_image_key || "");
  const league_image_path = safeStr(r?.league_image_path || "");
  const spots_available = r?.spots_available != null ? safeNum(r.spots_available, null) : null;

  // Sleeper-backed (optional)
  const sleeper_league_id = safeStr(r?.sleeper_league_id || r?.leagueId || r?.league_id || "").trim() || null;
  const sleeper_status = safeStr(r?.sleeper_status || r?.sleeperStatus || "").trim() || null;
  const avatar_id = safeStr(r?.avatar_id || r?.avatarId || "").trim() || null;
  const sleeper_url = safeStr(r?.sleeper_url || r?.sleeperUrl || "").trim() || null;
  const total_teams = r?.total_teams != null ? safeNum(r.total_teams, null) : null;
  const filled_teams = r?.filled_teams != null ? safeNum(r.filled_teams, null) : null;
  const open_teams = r?.open_teams != null ? safeNum(r.open_teams, null) : null;
  const not_ready = safeBool(r?.not_ready, false);

  const is_active = safeBool(r?.is_active, true);

  return {
    year,
    id,

    division,
    division_code,
    division_slug,
    is_division_header,
    division_status,
    division_image_key,
    division_image_path,

    display_order,
    league_name,
    league_url,
    league_status,
    league_image_key,
    league_image_path,
    spots_available,

    sleeper_league_id,
    sleeper_url,
    sleeper_status,
    avatar_id,
    total_teams,
    filled_teams,
    open_teams,
    not_ready,

    is_active,
  };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${t ? ` — ${t}` : ""}`);
  }
  return res.json();
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
  return fetchJson(`https://api.sleeper.app/v1/user/${uid}/leagues/nfl/${y}`);
}

async function sleeperLeagueInfo(leagueId) {
  const id = encodeURIComponent(String(leagueId || "").trim());
  if (!id) return null;
  return fetchJson(`https://api.sleeper.app/v1/league/${id}`);
}

async function sleeperLeagueRosters(leagueId) {
  const id = encodeURIComponent(String(leagueId || "").trim());
  if (!id) return [];
  return fetchJson(`https://api.sleeper.app/v1/league/${id}/rosters`);
}

export default function BigGameAdminClient({ initialData, initialSeason }) {
  const initialSeasonNum = safeNum(initialSeason, new Date().getFullYear());

  const [currentSeason, setCurrentSeason] = useState(initialSeasonNum);
  const [heroSeason, setHeroSeason] = useState(initialData?.config?.heroSeason || initialSeasonNum);
  const [pageTitle, setPageTitle] = useState(initialData?.config?.pageTitle || "The BIG Game");
  const [subtitle, setSubtitle] = useState(initialData?.config?.subtitle || "");
  const [intro, setIntro] = useState(initialData?.config?.intro || "");
  const [ctaText, setCtaText] = useState(initialData?.config?.ctaText || "");
  const [ctaUrl, setCtaUrl] = useState(initialData?.config?.ctaUrl || "");

  const [rows, setRows] = useState(() => (Array.isArray(initialData?.rows) ? initialData.rows : []).map((r, idx) => normalizeRow(r, idx, initialSeasonNum)));
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [infoMsg, setInfoMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputsRef = useRef({});

  const seasons = useMemo(() => {
    const set = new Set(rows.map((r) => Number(r.year)));
    set.add(Number(currentSeason));
    return [...set].filter((n) => Number.isFinite(n)).sort((a, b) => b - a);
  }, [rows, currentSeason]);

  const divisionGroups = useMemo(() => {
    const season = Number(currentSeason);
    const list = rows.filter((r) => Number(r.year) === season);

    const map = new Map();
    for (const r of list) {
      const slug = r.division_slug || r.division_code || "unknown";
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug).push(r);
    }

    const groups = [...map.entries()].map(([slug, arr]) => {
      const header = arr.find((x) => x.is_division_header) || arr[0] || {};
      const leagues = arr.filter((x) => !x.is_division_header).sort((a, b) => safeNum(a.display_order, 0) - safeNum(b.display_order, 0));
      return {
        slug,
        header,
        rows: [header, ...leagues].filter(Boolean),
        leagues,
      };
    });

    return groups.sort((a, b) => safeStr(a.header?.division).localeCompare(safeStr(b.header?.division)));
  }, [rows, currentSeason]);

  async function savePageConfig() {
    setErrorMsg("");
    setInfoMsg("");
    setSaving(true);

    try {
      const season = Number(currentSeason);
      const payload = {
        season,
        config: {
          heroSeason: Number(heroSeason),
          pageTitle: safeStr(pageTitle),
          subtitle: safeStr(subtitle),
          intro: safeStr(intro),
          ctaText: safeStr(ctaText),
          ctaUrl: safeStr(ctaUrl),
        },
        rows: rows.filter((r) => Number(r.year) === season),
      };

      await fetchJson(`/api/admin/biggame?season=${encodeURIComponent(String(season))}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setInfoMsg("Saved page config.");
    } catch (e) {
      setErrorMsg(e?.message || "Failed to save page config.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAllToR2(nextRows, nextSeason) {
    const payload = {
      season: Number(nextSeason),
      config: {
        heroSeason: Number(heroSeason),
        pageTitle: safeStr(pageTitle),
        subtitle: safeStr(subtitle),
        intro: safeStr(intro),
        ctaText: safeStr(ctaText),
        ctaUrl: safeStr(ctaUrl),
      },
      rows: nextRows,
    };

    await fetchJson(`/api/admin/biggame?season=${encodeURIComponent(String(nextSeason))}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const updated = await fetchJson(`/api/admin/biggame?season=${encodeURIComponent(String(nextSeason))}`);
    const normalized = (Array.isArray(updated?.rows) ? updated.rows : []).map((r, idx) => normalizeRow(r, idx, nextSeason));
    setRows((prev) => {
      const keep = prev.filter((r) => Number(r.year) !== Number(nextSeason));
      return [...keep, ...normalized];
    });
  }

  async function refreshStatusesAndCounts() {
    setErrorMsg("");
    setInfoMsg("");
    setRefreshing(true);

    try {
      const season = Number(currentSeason);

      // clone current season rows
      let nextRows = rows
        .filter((r) => Number(r.year) === season)
        .map((r) => ({ ...r }));

      // refresh each league with sleeper id
      for (let i = 0; i < nextRows.length; i++) {
        const r = nextRows[i];
        if (r.is_division_header) continue;

        const leagueId = safeStr(r.sleeper_league_id || "").trim();
        if (!leagueId) continue;

        try {
          const league = await sleeperLeagueInfo(leagueId);
          const rosters = await sleeperLeagueRosters(leagueId);
          const totalTeams = safeNum(league?.total_rosters, null);
          const filledTeams = Array.isArray(rosters) ? rosters.length : null;
          const openTeams = totalTeams != null && filledTeams != null ? Math.max(0, totalTeams - filledTeams) : null;

          const sleeperStatus = normalizeSleeperStatus(league?.status);
          const derivedStatus = bigGameLeagueStatusFromSleeper({
            sleeper_status: sleeperStatus,
            open_teams: typeof openTeams === "number" ? openTeams : null,
            not_ready: !!r.not_ready,
          });

          nextRows[i] = {
            ...r,
            league_name: r.league_name || safeStr(league?.name || ""),
            sleeper_status: sleeperStatus || null,
            sleeper_url: `https://sleeper.com/leagues/${leagueId}`,
            avatar_id: league?.avatar || r.avatar_id || null,
            total_teams: totalTeams,
            filled_teams: filledTeams,
            open_teams: openTeams,
            spots_available: typeof openTeams === "number" ? openTeams : r.spots_available,
            league_status: derivedStatus,
          };
        } catch {
          // ignore individual failures
        }
      }

      // derive division status across groups
      const byDiv = new Map();
      for (const r of nextRows) {
        const slug = safeStr(r.division_slug || r.division_code || "");
        if (!slug) continue;
        if (!byDiv.has(slug)) byDiv.set(slug, []);
        byDiv.get(slug).push(r);
      }
      nextRows = nextRows.map((r) => {
        const slug = safeStr(r.division_slug || r.division_code || "");
        const group = byDiv.get(slug) || [];
        const status = deriveDivisionStatusFromLeagueRows(group.filter((x) => !x.is_division_header));
        return {
          ...r,
          division_status: status,
          ...(r.not_ready ? { league_status: "TBD" } : null),
        };
      });

      await saveAllToR2(nextRows, season);
      setInfoMsg("Refreshed Sleeper status + counts and saved.");
    } catch (e) {
      setErrorMsg(e?.message || "Failed to refresh statuses.");
    } finally {
      setRefreshing(false);
    }
  }

  function updateRow(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addDivision() {
    const season = Number(currentSeason);
    const newId = crypto.randomUUID();
    setRows((prev) => [
      ...prev,
      normalizeRow(
        {
          year: season,
          id: newId,
          is_division_header: true,
          division: "New Division",
          division_code: `DIV${Math.floor(Math.random() * 1000)}`,
          division_slug: "",
          division_status: "TBD",
          is_active: true,
        },
        prev.length,
        season
      ),
    ]);
  }

  function addLeagueToDivision(division_slug) {
    const season = Number(currentSeason);
    const newId = crypto.randomUUID();
    setRows((prev) => [
      ...prev,
      normalizeRow(
        {
          year: season,
          id: newId,
          is_division_header: false,
          division_slug,
          league_name: "New League",
          league_url: "",
          league_status: "TBD",
          is_active: true,
        },
        prev.length,
        season
      ),
    ]);
  }

  async function handleSaveSeason() {
    setErrorMsg("");
    setInfoMsg("");
    setSaving(true);

    try {
      const nextSeason = Number(currentSeason);

      const updated = rows
        .map((r, idx) => normalizeRow(r, idx, nextSeason))
        .filter((r) => Number(r.year) === Number(nextSeason));

      // Derive Division Status automatically:
      // - TBD whenever there isn't a league drafting
      // - If even one league is drafting -> DRAFTING
      // - If ALL leagues are FULL -> FULL
      const byDiv = new Map();
      for (const r of updated) {
        const slug = safeStr(r.division_slug || r.division_code || "");
        if (!slug) continue;
        if (!byDiv.has(slug)) byDiv.set(slug, []);
        byDiv.get(slug).push(r);
      }

      const clean = updated.map((r) => {
        const slug = safeStr(r.division_slug || r.division_code || "");
        const group = byDiv.get(slug) || [];
        const leaguesOnly = group.filter((x) => !x.is_division_header);
        const derived = deriveDivisionStatusFromLeagueRows(leaguesOnly);
        return {
          ...r,
          division_status: derived,
          ...(r.not_ready ? { league_status: "TBD" } : null),
        };
      });

      // ensure stable ordering
      clean.sort((a, b) => {
        const da = safeStr(a.division_slug || a.division_code);
        const db = safeStr(b.division_slug || b.division_code);
        if (da !== db) return da.localeCompare(db);
        const ha = a.is_division_header ? 0 : 1;
        const hb = b.is_division_header ? 0 : 1;
        if (ha !== hb) return ha - hb;
        return safeNum(a.display_order, 0) - safeNum(b.display_order, 0);
      });

      await saveAllToR2(clean, nextSeason);
      setInfoMsg(`Saved Big Game season ${nextSeason}.`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to save season.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {(errorMsg || infoMsg) && (
        <div className={`rounded-xl border p-3 text-sm ${errorMsg ? "border-red-500/40 bg-red-500/10" : "border-cyan-500/40 bg-cyan-500/10"}`}>
          {errorMsg || infoMsg}
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="text-lg font-semibold">Big Game Page Settings</div>
            <div className="text-xs text-muted">These settings control the Big Game landing page copy.</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              prefetch={false}
              href={`/admin/big-game/add-leagues?season=${encodeURIComponent(String(heroSeason))}`}
              className="btn btn-outline text-sm"
              title="Add leagues from Sleeper (search username → pick leagues)"
            >
              Add Leagues
            </Link>

            <button
              className="btn btn-outline text-sm"
              onClick={refreshStatusesAndCounts}
              disabled={saving || refreshing}
              title="Refresh league status + team counts from Sleeper (requires Sleeper League ID on each row)"
            >
              {refreshing ? "Refreshing…" : "Refresh Status + Counts"}
            </button>

            <button className="btn text-sm" onClick={savePageConfig} disabled={saving}>
              {saving ? "Saving…" : "Save Page Config"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-muted">Hero season</div>
            <select className="input" value={heroSeason} onChange={(e) => setHeroSeason(Number(e.target.value))}>
              {seasons.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs text-muted">Season you are editing</div>
            <select className="input" value={currentSeason} onChange={(e) => setCurrentSeason(Number(e.target.value))}>
              {seasons.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-muted">Page title</div>
            <input className="input" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} />
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-muted">Subtitle</div>
            <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-muted">Intro</div>
            <textarea className="input min-h-[90px]" value={intro} onChange={(e) => setIntro(e.target.value)} />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-muted">CTA Text</div>
            <input className="input" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-muted">CTA URL</div>
            <input className="input" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="space-y-1">
          <div className="text-lg font-semibold">Divisions</div>
          <div className="text-xs text-muted">
            Division status is automatic: <span className="font-semibold">TBD</span> unless any league is drafting;{" "}
            <span className="font-semibold">FULL</span> only when all leagues are full.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-outline" onClick={addDivision}>
            Add Division
          </button>
          <button className="btn" onClick={handleSaveSeason} disabled={saving}>
            {saving ? "Saving…" : `Save Season ${currentSeason}`}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {divisionGroups.map((g) => {
          const header = g.header || {};
          const derivedDivisionStatus = deriveDivisionStatusFromLeagueRows(g.leagues || []);

          return (
            <div key={g.slug} className="card p-4 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{safeStr(header.division || "Division")}</div>
                  <div className="text-xs text-muted">Code: {safeStr(header.division_code || g.slug)}</div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-2 rounded-full border border-subtle px-3 py-1 text-xs">
                    <span className="text-muted">Status</span>
                    <span className="font-semibold">{derivedDivisionStatus}</span>
                  </div>

                  <button className="btn btn-outline text-sm" onClick={() => addLeagueToDivision(g.slug)}>
                    Add League
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <div className="text-xs text-muted">Division name</div>
                  <input className="input" value={safeStr(header.division)} onChange={(e) => updateRow(header.id, { division: e.target.value })} />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-muted">Division code</div>
                  <input
                    className="input"
                    value={safeStr(header.division_code)}
                    onChange={(e) => updateRow(header.id, { division_code: e.target.value, division_slug: e.target.value })}
                  />
                </label>

                <label className="flex items-center gap-2 text-sm mt-6">
                  <input type="checkbox" checked={header.is_active !== false} onChange={(e) => updateRow(header.id, { is_active: e.target.checked })} />
                  Active
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-subtle">
                      <th className="py-2 pr-3 w-[70px]">#</th>
                      <th className="py-2 pr-3 w-[260px]">Name</th>
                      <th className="py-2 pr-3 w-[180px]">Sleeper League ID</th>
                      <th className="py-2 pr-3 w-[140px]">Status</th>
                      <th className="py-2 pr-3 w-[160px]">Counts</th>
                      <th className="py-2 pr-3 w-[110px]">Not Ready</th>
                      <th className="py-2 pr-3">Join URL (invite)</th>
                      <th className="py-2 pr-3 w-[90px]">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.leagues.map((lg, idx) => {
                      const counts =
                        lg.total_teams != null && lg.filled_teams != null
                          ? `${lg.filled_teams}/${lg.total_teams} (${lg.open_teams ?? "?"} open)`
                          : lg.spots_available != null
                          ? `${lg.spots_available} open`
                          : "—";

                      return (
                        <tr key={lg.id} className="border-b border-subtle">
                          <td className="py-2 pr-3">
                            <input
                              className="input w-[70px]"
                              value={lg.display_order ?? idx + 1}
                              onChange={(e) => updateRow(lg.id, { display_order: safeNum(e.target.value, idx + 1) })}
                            />
                          </td>

                          <td className="py-2 pr-3">
                            <input className="input w-full" value={safeStr(lg.league_name)} onChange={(e) => updateRow(lg.id, { league_name: e.target.value })} />
                          </td>

                          <td className="py-2 pr-3">
                            <input
                              className="input w-full font-mono text-xs"
                              value={safeStr(lg.sleeper_league_id || "")}
                              onChange={(e) => updateRow(lg.id, { sleeper_league_id: e.target.value.trim(), sleeper_url: e.target.value.trim() ? `https://sleeper.com/leagues/${e.target.value.trim()}` : "" })}
                              placeholder="123456789012345678"
                            />
                          </td>

                          <td className="py-2 pr-3">
                            <select
                              className="input w-full"
                              value={safeStr(lg.league_status)}
                              disabled={!!lg.sleeper_league_id && lg.not_ready !== true}
                              onChange={(e) => updateRow(lg.id, { league_status: e.target.value })}
                              title={lg.sleeper_league_id ? "Auto from Sleeper (use Not Ready to force TBD)" : "Manual"}
                            >
                              {LEAGUE_STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2 pr-3 text-xs">{counts}</td>

                          <td className="py-2 pr-3">
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={lg.not_ready === true}
                                onChange={(e) => updateRow(lg.id, { not_ready: e.target.checked, league_status: e.target.checked ? "TBD" : lg.league_status })}
                              />
                              <span className="text-xs text-muted">TBD</span>
                            </label>
                          </td>

                          <td className="py-2 pr-3">
                            <input className="input w-full" value={safeStr(lg.league_url)} onChange={(e) => updateRow(lg.id, { league_url: e.target.value })} placeholder="Sleeper invite link" />
                            {lg.sleeper_url ? (
                              <div className="mt-1 text-xs text-muted">
                                Sleeper page:{" "}
                                <a className="underline" href={lg.sleeper_url} target="_blank" rel="noreferrer">
                                  open
                                </a>
                              </div>
                            ) : null}
                          </td>

                          <td className="py-2 pr-3">
                            <input type="checkbox" checked={lg.is_active !== false} onChange={(e) => updateRow(lg.id, { is_active: e.target.checked })} />
                          </td>
                        </tr>
                      );
                    })}
                    {!g.leagues.length && (
                      <tr>
                        <td colSpan={8} className="py-4 text-sm text-muted">
                          No leagues yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-muted">
                Tip: after using <span className="font-semibold">Add Leagues</span>, come back here to paste invite links into “Join URL (invite)” for each league.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
