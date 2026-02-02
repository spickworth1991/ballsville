"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";
import { safeStr } from "@/lib/safe";
import { r2Url } from "@/lib/r2Url";

const DEFAULT_SEASON = CURRENT_SEASON;

// ==============================
// GAUNTLET ADMIN RULES (match other gamemodes)
// - League name: NOT editable (comes from Sleeper)
// - League status/counts: derived from Sleeper on refresh, stored in JSON
// - Admin-only overrides:
//    - notReady => forces status to TBD + disables click-through
//    - is_active=false => hides from public pages
// - Legion name + image are still editable (not from Sleeper)
// ==============================

function safeNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function slugify(input) {
  return safeStr(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function newId(prefix = "g") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeSleeperStatus(raw) {
  const s = safeStr(raw).trim().toLowerCase();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "predraft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "inseason" || s === "in-season") return "inseason";
  if (s === "complete") return "complete";
  return s || "predraft";
}

// Public-facing labels (keep legacy): TBD / DRAFTING / FULL / FILLING
function gauntletStatusFromSleeper({ sleeperStatus, openTeams, notReady }) {
  if (notReady) return "TBD";
  const s = normalizeSleeperStatus(sleeperStatus);
  if (s === "drafting") return "DRAFTING";
  if (safeNum(openTeams, 0) <= 0) return "FULL";
  return "FILLING";
}

function statusPillClasses(label) {
  const v = safeStr(label).trim().toUpperCase();
  if (v === "FULL") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (v === "FILLING") return "bg-primary/15 text-primary border-primary/30";
  if (v === "DRAFTING") return "bg-accent/15 text-accent border-accent/30";
  return "bg-white/10 text-muted border-white/10";
}

function resolveImageSrc(pathOrKey) {
  const raw = safeStr(pathOrKey).trim();
  if (!raw) return "";

  // If stored as /r2/<key>, route through r2Url() so localhost works.
  if (raw.startsWith("/r2/")) return r2Url(raw.replace(/^\/r2\//, ""));
  // If stored as a raw key (media/...), also route through r2Url.
  if (!raw.startsWith("http") && !raw.startsWith("/")) return r2Url(raw);
  return raw;
}

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return "";
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
  const j = await res.json();
  return j;
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

async function uploadImage(file, { section, season, legionCode, leagueOrder }) {
  const token = await getAccessToken();
  const fd = new FormData();
  fd.append("file", file);
  fd.append("section", section);
  fd.append("season", String(season));
  if (legionCode) fd.append("legionCode", String(legionCode));
  if (leagueOrder != null) fd.append("leagueOrder", String(leagueOrder));

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const j = await res.json();
  if (!j?.ok) throw new Error(j?.error || "Upload failed");
  return j; // { ok, key, url }
}

async function sleeperLeagueInfo(leagueId) {
  const id = safeStr(leagueId).trim();
  if (!id) throw new Error("Missing league id");
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper league request failed (${res.status})`);
  return res.json();
}

async function sleeperLeagueRosters(leagueId) {
  const id = safeStr(leagueId).trim();
  if (!id) throw new Error("Missing league id");
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(id)}/rosters`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper rosters request failed (${res.status})`);
  return res.json();
}

function computeFillCounts(league, rosters) {
  const totalTeams = Number(league?.total_rosters) || (Array.isArray(rosters) ? rosters.length : 0);
  const filledTeams = Array.isArray(rosters) ? rosters.filter((r) => r && r.owner_id).length : 0;
  const openTeams = Math.max(0, totalTeams - filledTeams);
  return { totalTeams, filledTeams, openTeams };
}

function normalizeRow(r, idx = 0, season = DEFAULT_SEASON) {
  const isHeader = Boolean(r?.is_legion_header);

  if (isHeader) {
    const legion_name = safeStr(r?.legion_name || "New Legion").trim();
    const legion_slug = safeStr(r?.legion_slug || slugify(legion_name) || newId("leg")).trim();
    return {
      __key: safeStr(r?.__key) || newId("leg"),
      season: safeNum(r?.season, season),
      is_legion_header: true,

      legion_name,
      legion_slug,
      legion_blurb: safeStr(r?.legion_blurb || "").trim(),
      legion_order: safeNum(r?.legion_order, idx + 1),
      legion_image_key: safeStr(r?.legion_image_key || "").trim(),
      legion_image_path: safeStr(r?.legion_image_path || "").trim(),
      is_active: typeof r?.is_active === "boolean" ? r.is_active : true,
    };
  }

  const league_id = safeStr(r?.league_id || r?.leagueId || "").trim();
  const league_name = safeStr(r?.league_name || r?.name || "").trim();
  const sleeper_status = normalizeSleeperStatus(r?.sleeper_status || r?.sleeperStatus || r?.league_sleeper_status);
  const total_teams = safeNum(r?.total_teams ?? r?.totalTeams, null);
  const filled_teams = safeNum(r?.filled_teams ?? r?.filledTeams, null);
  const open_teams = safeNum(r?.open_teams ?? r?.openTeams, null);
  const notReady = Boolean(r?.notReady);

  const league_status = safeStr(r?.league_status).trim() || gauntletStatusFromSleeper({
    sleeperStatus: sleeper_status,
    openTeams: open_teams,
    notReady,
  });

  return {
    __key: safeStr(r?.__key) || newId("l"),
    season: safeNum(r?.season, season),
    is_legion_header: false,

    legion_slug: safeStr(r?.legion_slug || "").trim(),
    league_order: safeNum(r?.league_order ?? r?.order, idx + 1),

    league_id,
    league_name,
    league_url: safeStr(r?.league_url || r?.sleeper_url || "").trim(),

    sleeper_status,
    league_status,
    total_teams,
    filled_teams,
    open_teams,

    avatar: safeStr(r?.avatar || "").trim(),
    league_image_key: safeStr(r?.league_image_key || r?.imageKey || "").trim(),
    league_image_path: safeStr(r?.league_image_path || r?.image_url || "").trim(),

    notReady,
    is_active: typeof r?.is_active === "boolean" ? r.is_active : true,
  };
}

function groupLegions(rows) {
  const headers = rows
    .filter((r) => r?.is_legion_header)
    .slice()
    .sort((a, b) => safeNum(a.legion_order, 9999) - safeNum(b.legion_order, 9999));

  const bySlug = new Map();
  for (const r of rows) {
    if (r?.is_legion_header) continue;
    const slug = safeStr(r?.legion_slug).trim();
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(r);
  }

  for (const [slug, list] of bySlug.entries()) {
    list.sort((a, b) => safeNum(a.league_order, 9999) - safeNum(b.league_order, 9999));
    bySlug.set(slug, list);
  }

  return { headers, bySlug };
}

function deriveLegionStatus(leagues) {
  const eligible = (Array.isArray(leagues) ? leagues : []).filter((l) => l && l.is_active !== false);
  if (!eligible.length) return "TBD";
  const labels = eligible.map((l) => safeStr(l.league_status).toUpperCase() || "TBD");
  if (labels.includes("DRAFTING")) return "DRAFTING";
  if (labels.every((x) => x === "FULL")) return "FULL";
  if (labels.includes("FILLING")) return "FILLING";
  return "TBD";
}

export default function GauntletAdminClient({ defaultSeason = DEFAULT_SEASON }) {
  const [season, setSeason] = useState(defaultSeason);
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [openLegions, setOpenLegions] = useState(() => new Set());

  const fileRef = useRef(null);
  const [uploadCtx, setUploadCtx] = useState(null);

  const { headers, bySlug } = useMemo(() => groupLegions(rows), [rows]);

  async function load() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const j = await apiGET(season, "leagues");
      const list = Array.isArray(j?.rows) ? j.rows : [];
      const normalized = list.map((r, idx) => normalizeRow(r, idx, season));
      setRows(normalized);
      setUpdatedAt(safeStr(j?.updated_at || j?.updatedAt || ""));

      // Start collapsed by default. Preserve any user toggles already in state.
      setOpenLegions((prev) => (prev && prev.size ? prev : new Set()));
    } catch (e) {
      setRows([]);
      setError(e?.message || "Failed to load gauntlet data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  function patchRows(mutator) {
    setRows((prev) => mutator(prev.slice()));
  }

  function updateLegion(legionSlug, patch) {
    patchRows((next) =>
      next.map((r) => (r.is_legion_header && r.legion_slug === legionSlug ? { ...r, ...patch } : r))
    );
  }

  function updateLeague(legionSlug, leagueKey, patch) {
    patchRows((next) =>
      next.map((r) => {
        if (r.is_legion_header) return r;
        if (r.legion_slug !== legionSlug) return r;
        if (r.__key !== leagueKey) return r;
        return { ...r, ...patch };
      })
    );
  }

  function addLegion() {
    const name = "New Legion";
    const slug = slugify(name) || newId("leg");
    const maxOrder = Math.max(0, ...headers.map((h) => safeNum(h.legion_order, 0)));
    patchRows((next) => {
      next.push(
        normalizeRow(
          {
            is_legion_header: true,
            season,
            legion_name: name,
            legion_slug: slug,
            legion_order: maxOrder + 1,
            is_active: true,
          },
          next.length,
          season
        )
      );
      return next;
    });
    setOpenLegions((prev) => new Set([...prev, slug]));
  }

  function deleteLegion(legionSlug) {
    patchRows((next) => next.filter((r) => !(r.legion_slug === legionSlug)));
    setOpenLegions((prev) => {
      const n = new Set(prev);
      n.delete(legionSlug);
      return n;
    });
  }

  function deleteLeague(legionSlug, leagueKey) {
    patchRows((next) => next.filter((r) => !(r.legion_slug === legionSlug && !r.is_legion_header && r.__key === leagueKey)));
  }

  async function saveAll() {
    setError("");
    setInfo("");
    setSaving(true);
    try {
      const payloadRows = rows.map((r) => ({ ...r }));
      // Strip transient / internal fields
      for (const r of payloadRows) {
        delete r.__key;
      }
      await apiPUT(season, { season, rows: payloadRows, updated_at: nowIso() }, "leagues");
      setInfo("Saved.");
      await load();
    } catch (e) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshSleeperForAll() {
    setError("");
    setInfo("");
    setRefreshing(true);
    try {
      // Refresh ONLY league rows with a league_id.
      const leagueRows = rows.filter((r) => !r.is_legion_header && safeStr(r.league_id).trim());
      if (!leagueRows.length) {
        setInfo("No leagues with Sleeper IDs yet.");
        return;
      }

      const updated = [];
      for (const r of leagueRows) {
        const league = await sleeperLeagueInfo(r.league_id);
        const rosters = await sleeperLeagueRosters(r.league_id);
        const { totalTeams, filledTeams, openTeams } = computeFillCounts(league, rosters);
        const sleeper_status = normalizeSleeperStatus(league?.status);
        const league_status = gauntletStatusFromSleeper({ sleeperStatus: sleeper_status, openTeams, notReady: r.notReady });

        updated.push({
          __key: r.__key,
          league_name: safeStr(league?.name || r.league_name),
          avatar: safeStr(league?.avatar || r.avatar),
          sleeper_status,
          total_teams: totalTeams,
          filled_teams: filledTeams,
          open_teams: openTeams,
          league_status,
        });
      }

      patchRows((next) =>
        next.map((r) => {
          if (r.is_legion_header) return r;
          const patch = updated.find((x) => x.__key === r.__key);
          return patch ? { ...r, ...patch } : r;
        })
      );

      // Persist immediately (matches redraft/dynasty behavior so refresh isn't just visual)
      const payloadRows = rows
        .map((r) => {
          const patch = updated.find((x) => x.__key === r.__key);
          const merged = patch ? { ...r, ...patch } : r;
          return { ...merged };
        })
        .map((r) => {
          const c = { ...r };
          delete c.__key;
          return c;
        });

      await apiPUT(season, { season, rows: payloadRows, updated_at: nowIso() }, "leagues");
      setInfo("Refreshed Sleeper status + counts and saved.");
      await load();
    } catch (e) {
      setError(e?.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  function openUpload(ctx) {
    setUploadCtx(ctx);
    if (fileRef.current) fileRef.current.click();
  }

  async function onFilePicked(e) {
    const file = e?.target?.files?.[0];
    e.target.value = "";
    if (!file || !uploadCtx) return;
    setError("");
    setInfo("");
    try {
      if (uploadCtx.kind === "legion") {
        const out = await uploadImage(file, {
          section: "gauntlet-legion",
          season,
          legionCode: uploadCtx.legionSlug,
        });
        updateLegion(uploadCtx.legionSlug, { legion_image_key: safeStr(out.key), legion_image_path: safeStr(out.url) });
        setInfo("Image uploaded. Click Save All to publish.");
      }

      if (uploadCtx.kind === "league") {
        const out = await uploadImage(file, {
          section: "gauntlet-league",
          season,
          legionCode: uploadCtx.legionSlug,
          leagueOrder: uploadCtx.leagueOrder,
        });
        updateLeague(uploadCtx.legionSlug, uploadCtx.leagueKey, {
          league_image_key: safeStr(out.key),
          league_image_path: safeStr(out.url),
        });
        setInfo("Image uploaded. Click Save All to publish.");
      }
    } catch (err) {
      setError(err?.message || "Upload failed.");
    } finally {
      setUploadCtx(null);
    }
  }

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-outline" onClick={addLegion}>
          + Add Legion
        </button>

        <Link
          prefetch={false}
          href={`/admin/gauntlet/add-leagues?season=${encodeURIComponent(String(season))}`}
          className="btn btn-outline"
        >
          + Add leagues from Sleeper
        </Link>

        <button className="btn btn-outline" onClick={refreshSleeperForAll} disabled={refreshing || loading}>
          {refreshing ? "Refreshing…" : "Refresh Status + Counts"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-muted">Season</label>
        <input
          className="input w-[110px]"
          value={String(season)}
          onChange={(e) => setSeason(safeNum(e.target.value, DEFAULT_SEASON))}
        />
        <button className="btn btn-primary" onClick={saveAll} disabled={saving || loading}>
          {saving ? "Saving…" : "Save All"}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="card bg-card-surface border border-subtle p-5">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toolbar}

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

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />

      <div className="space-y-4">
        {headers.map((h) => {
          const legionSlug = h.legion_slug;
          const leagues = bySlug.get(legionSlug) || [];
          const legionOpenTeams = leagues
            .filter((l) => l && l.is_active !== false && !l.notReady)
            .reduce((sum, l) => sum + safeNum(l.open_teams, 0), 0);
          const legionStatus = deriveLegionStatus(leagues);

          const isOpen = openLegions.has(legionSlug);

          return (
            <div key={legionSlug} className="card bg-card-surface border border-subtle p-4 sm:p-5">
              {/* Legion header */}
              <button
                type="button"
                className="w-full flex items-start justify-between gap-4 text-left"
                onClick={() => {
                  setOpenLegions((prev) => {
                    const next = new Set(prev);
                    if (next.has(legionSlug)) next.delete(legionSlug);
                    else next.add(legionSlug);
                    return next;
                  });
                }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-fg truncate">{h.legion_name}</h3>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClasses(legionStatus)}`}>
                      {legionStatus}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-subtle bg-card-subtle px-2.5 py-1 text-xs font-semibold text-fg">
                      Open spots: {legionOpenTeams}
                    </span>
                    {h.is_active === false ? (
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted line-clamp-2">{h.legion_blurb || ""}</p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {h.legion_image_key || h.legion_image_path ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-subtle bg-black/20">
                      <Image
                        src={resolveImageSrc(h.legion_image_path || h.legion_image_key) || "/photos/ballsville_logo.png"}
                        alt={h.legion_name || "Legion"}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  ) : null}
                  <span className="text-xs text-muted">{isOpen ? "Hide" : "Edit"}</span>
                </div>
              </button>

              {/* Legion editor */}
              {isOpen ? (
                <div className="mt-4 border-t border-subtle pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                      <label className="block text-xs text-muted mb-1">Legion Name</label>
                      <input
                        className="input w-full"
                        value={h.legion_name}
                        onChange={(e) => {
                          const nextName = e.target.value;
                          updateLegion(legionSlug, {
                            legion_name: nextName,
                            // keep slug stable once set
                          });
                        }}
                      />
                      <p className="mt-1 text-[11px] text-muted">Slug: <span className="text-fg font-semibold">{legionSlug}</span></p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs text-muted mb-1">Order</label>
                      <input
                        className="input w-full"
                        value={String(h.legion_order ?? "")}
                        onChange={(e) => updateLegion(legionSlug, { legion_order: safeNum(e.target.value, 1) })}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs text-muted mb-1">Visibility</label>
                      <div className="flex items-center gap-3 h-[42px]">
                        <label className="inline-flex items-center gap-2 text-sm text-fg">
                          <input
                            type="checkbox"
                            checked={h.is_active !== false}
                            onChange={(e) => updateLegion(legionSlug, { is_active: e.target.checked })}
                          />
                          Active
                        </label>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => openUpload({ kind: "legion", legionSlug })}
                        >
                          Upload Image
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2 flex items-end justify-end">
                      <button className="btn btn-outline btn-sm" onClick={() => deleteLegion(legionSlug)}>
                        Delete
                      </button>
                    </div>

                    <div className="md:col-span-12">
                      <label className="block text-xs text-muted mb-1">Legion Blurb</label>
                      <textarea
                        className="textarea w-full min-h-[84px]"
                        value={h.legion_blurb}
                        onChange={(e) => updateLegion(legionSlug, { legion_blurb: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Leagues */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="text-sm font-semibold text-fg">Leagues</h4>
                      <p className="text-xs text-muted">3 cards per row on desktop, 1 on mobile.</p>
                    </div>
                  </div>

                  {leagues.length ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {leagues
                        .slice()
                        .sort((a, b) => safeNum(a.league_order, 9999) - safeNum(b.league_order, 9999))
                        .map((l) => {
                          const status = safeStr(l.league_status).toUpperCase() || "TBD";
                          const pill = statusPillClasses(status);
                          const total = l.total_teams;
                          const filled = l.filled_teams;
                          const open = l.open_teams;
                          const countLabel = total != null && filled != null ? `${filled}/${total}` : "—";

                          return (
                            <div key={l.__key} className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                              <div className="flex items-start gap-3">
                                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-subtle bg-black/20">
                                  {l.league_image_path || l.league_image_key ? (
                                    <Image
                                      src={resolveImageSrc(l.league_image_path || l.league_image_key) || "/photos/ballsville_logo.png"}
                                      alt={l.league_name || "League"}
                                      fill
                                      className="object-cover"
                                      sizes="56px"
                                    />
                                  ) : (
                                    <Image
                                      src="/photos/ballsville_logo.png"
                                      alt="League"
                                      fill
                                      className="object-cover opacity-70"
                                      sizes="56px"
                                    />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-fg truncate">{l.league_name || "League"}</div>
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${pill}`}>
                                          {status}
                                        </span>
                                        <span className="inline-flex items-center rounded-full border border-subtle bg-card-surface px-2.5 py-1 text-[11px] font-semibold text-fg">
                                          {countLabel}
                                        </span>
                                        {open != null ? (
                                          <span className="inline-flex items-center rounded-full border border-subtle bg-card-surface px-2.5 py-1 text-[11px] font-semibold text-fg">
                                            Open: {open}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    </div>

                                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[11px] text-muted mb-1">Order</label>
                                      <input
                                        className="input w-full"
                                        value={String(l.league_order ?? "")}
                                        onChange={(e) => updateLeague(legionSlug, l.__key, { league_order: safeNum(e.target.value, 1) })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] text-muted mb-1">Invite URL</label>
                                      <input
                                        className="input w-full"
                                        value={l.league_url}
                                        onChange={(e) => updateLeague(legionSlug, l.__key, { league_url: e.target.value })}
                                        placeholder="https://sleeper.com/i/..."
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-4">
                                      <label className="inline-flex items-center gap-2 text-sm text-fg">
                                        <input
                                          type="checkbox"
                                          checked={l.is_active !== false}
                                          onChange={(e) => updateLeague(legionSlug, l.__key, { is_active: e.target.checked })}
                                        />
                                        Active
                                      </label>
                                      <label className="inline-flex items-center gap-2 text-sm text-fg">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(l.notReady)}
                                          onChange={(e) => {
                                            const notReady = e.target.checked;
                                            const league_status = gauntletStatusFromSleeper({
                                              sleeperStatus: l.sleeper_status,
                                              openTeams: l.open_teams,
                                              notReady,
                                            });
                                            updateLeague(legionSlug, l.__key, { notReady, league_status });
                                          }}
                                        />
                                        Not Ready
                                      </label>
                                    </div>

                                    <button className="btn btn-outline btn-sm" onClick={() => deleteLeague(legionSlug, l.__key)}>
                                      Delete
                                    </button>
                                  </div>

                                  <div className="mt-2 text-[11px] text-muted">
                                    Sleeper ID: <span className="text-fg font-semibold">{l.league_id || "—"}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                      <p className="text-sm text-muted">No leagues in this legion yet. Use “Add leagues from Sleeper”.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted">
        Last updated: <span className="text-fg font-semibold">{updatedAt || "—"}</span>
      </div>
    </div>
  );
}
