
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { r2Url } from "@/lib/r2Url";
import { getSupabase } from "@/lib/supabaseClient";

const DEFAULT_SEASON = new Date().getFullYear();

function safeArray(v) {
  return Array.isArray(v) ? v : [];
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
function uid() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function slugifyTitle(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeLeagueStatus(s) {
  const raw = safeStr(s).trim();
  if (!raw) return "TBD";
  const up = raw.toUpperCase();
  if (up === "TBD") return "TBD";
  if (up === "DRAFTING") return "DRAFTING";
  if (up === "FILLING") return "FILLING";
  if (up === "FULL") return "FULL";
  return "TBD";
}

function badgeForStatus(status) {
  const s = normalizeLeagueStatus(status);
  if (s === "FULL") return "badge badge-success";
  if (s === "FILLING") return "badge badge-warn";
  if (s === "DRAFTING") return "badge badge-info";
  return "badge";
}

function computeOpenSlotsLabel(l) {
  const total = l?.total_teams;
  const open = l?.open_teams;
  if (typeof total !== "number" || typeof open !== "number") return "—";
  return `${open}/${total}`;
}

function deriveDivisionFields({ title, order, takenSlugs }) {
  const ord = Math.max(1, safeNum(order, 1));
  const baseSlug = slugifyTitle(title) || `division-${ord}`;
  let slug = baseSlug;
  if (takenSlugs) {
    let i = 2;
    while (takenSlugs.has(slug)) {
      slug = `${baseSlug}-${i}`;
      i += 1;
    }
    takenSlugs.add(slug);
  }
  return {
    order: ord,
    slug,
    code: `DIV${ord}`,
  };
}

function normalizeDivision(d, idx, takenSlugs) {
  const id = safeStr(d?.id || "").trim() || uid();
  const title = safeStr(d?.title || d?.division || "Division").trim() || "Division";
  const order = safeNum(d?.order ?? d?.display_order ?? idx + 1, idx + 1);
  const derived = deriveDivisionFields({ title, order, takenSlugs });

  const image_key = safeStr(d?.image_key || d?.division_image_key || "").trim() || null;
  const image_url =
    safeStr(d?.image_url || d?.division_image_url || d?.division_image_path || "").trim() || null;

  const leagues = safeArray(d?.leagues)
    .map((l, j) => {
      const lid = safeStr(l?.id || "").trim() || uid();
      const display_order = safeNum(l?.display_order ?? j + 1, j + 1);
      const sleeperId = safeStr(l?.sleeper_league_id || l?.leagueId || "").trim() || null;

      return {
        id: lid,
        display_order,
        // league name + sleeper id are pulled from Sleeper and should not be edited here.
        league_name: safeStr(l?.league_name || l?.name || "League"),
        league_url: safeStr(l?.league_url || l?.url || ""),
        league_status: normalizeLeagueStatus(l?.league_status || l?.status || "TBD"),
        sleeper_league_id: sleeperId,
        sleeper_url:
          safeStr(l?.sleeper_url || "").trim() ||
          (sleeperId ? `https://sleeper.com/leagues/${sleeperId}` : null),
        sleeper_status: safeStr(l?.sleeper_status || "").trim() || null,
        avatar_id: safeStr(l?.avatar_id || l?.avatarId || "").trim() || null,
        league_image_key: safeStr(l?.league_image_key || "").trim() || null,
        league_image_path: safeStr(l?.league_image_path || "").trim() || null,
        total_teams: l?.total_teams != null ? safeNum(l.total_teams, null) : null,
        filled_teams: l?.filled_teams != null ? safeNum(l.filled_teams, null) : null,
        open_teams: l?.open_teams != null ? safeNum(l.open_teams, null) : null,
        not_ready: safeBool(l?.not_ready, false),
        is_active: safeBool(l?.is_active, true),
      };
    })
    .sort((a, b) => a.display_order - b.display_order);

  return {
    id,
    title,
    ...derived,
    image_key,
    image_url,
    leagues,
  };
}

function normalizeDivisions(list) {
  const raw = safeArray(list);
  // ensure stable ordering first, then derive unique slugs
  const baseSorted = [...raw].sort((a, b) => safeNum(a?.order, 999) - safeNum(b?.order, 999));
  const taken = new Set();
  const normalized = baseSorted.map((d, i) => normalizeDivision(d, i, taken));
  normalized.sort((a, b) => a.order - b.order);
  // Re-stamp order to match current list (order drives DIV#).
  normalized.forEach((d, i) => {
    d.order = i + 1;
    d.code = `DIV${d.order}`;
  });
  // Re-derive slugs again (unique + consistent with order)
  const taken2 = new Set();
  return normalized.map((d) => {
    const derived = deriveDivisionFields({ title: d.title, order: d.order, takenSlugs: taken2 });
    return { ...d, ...derived };
  });
}

async function getAuthToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function fetchSleeperLeagueMeta(leagueId) {
  const id = safeStr(leagueId).trim();
  if (!id) return null;

  const leagueRes = await fetch(`https://api.sleeper.app/v1/league/${id}`);
  if (!leagueRes.ok) throw new Error(`Sleeper league fetch failed (${leagueRes.status})`);
  const league = await leagueRes.json();

  let users = [];
  try {
    const usersRes = await fetch(`https://api.sleeper.app/v1/league/${id}/users`);
    if (usersRes.ok) users = await usersRes.json();
  } catch {
    // ignore
  }

  const total = typeof league?.total_rosters === "number" ? league.total_rosters : null;
  const filled = Array.isArray(users) ? users.length : null;
  const open = typeof total === "number" && typeof filled === "number" ? Math.max(0, total - filled) : null;

  const sleeperStatus = safeStr(league?.status || "").trim() || null;
  const avatarId = safeStr(league?.avatar || "").trim() || null;

  return {
    name: safeStr(league?.name || ""),
    sleeper_status: sleeperStatus,
    avatar_id: avatarId,
    total_teams: total,
    filled_teams: filled,
    open_teams: open,
  };
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

function LeagueAvatar({ league }) {
  const path = league?.league_image_path;
  const key = league?.league_image_key;
  const avatarId = league?.avatar_id;
  const src = path ? r2Url(path) : key ? r2Url(key) : avatarId ? `https://sleepercdn.com/avatars/${avatarId}` : null;

  return (
    <div className="h-12 w-12 overflow-hidden rounded-2xl border border-subtle bg-black/30">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-white/40">—</div>
      )}
    </div>
  );
}

export default function BigGameAdminClient({ initialSeason }) {
  const [season, setSeason] = useState(safeNum(initialSeason, DEFAULT_SEASON));

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Page settings ("hero")
  const [page, setPage] = useState({ title: "", subtitle: "", intro: "" });

  // Divisions
  const [divisions, setDivisions] = useState([]);
  // Default to collapsed like the other modes
  const [openDivIds, setOpenDivIds] = useState(() => new Set());

  // Create Division (simple: title + order)
  const [newDivTitle, setNewDivTitle] = useState("");
  const [newDivOrder, setNewDivOrder] = useState(1);

  const msgTimer = useRef(null);
  const setToast = (m) => {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 3500);
  };

  const canRefresh = useMemo(() => {
    return divisions.some((d) => d.leagues.some((l) => l.sleeper_league_id));
  }, [divisions]);

  async function loadAll() {
    setLoading(true);
    try {
      const [divRes, pageRes] = await Promise.all([
        fetch(`/api/admin/big-game?season=${season}&type=divisions`, { cache: "no-store" }),
        fetch(`/api/admin/big-game?season=${season}&type=page`, { cache: "no-store" }),
      ]);

      const divJson = await divRes.json().catch(() => null);
      if (!divRes.ok || !divJson?.ok) throw new Error(divJson?.error || "Failed to load divisions");
      const norm = normalizeDivisions(divJson?.data?.divisions);
      setDivisions(norm);

      const pageJson = await pageRes.json().catch(() => null);
      if (!pageRes.ok || !pageJson?.ok) throw new Error(pageJson?.error || "Failed to load page settings");
      const p = pageJson?.data || {};
      setPage({
        title: safeStr(p.title || ""),
        subtitle: safeStr(p.subtitle || ""),
        intro: safeStr(p.intro || ""),
      });

      // Start collapsed (user can expand what they want)
      setOpenDivIds(new Set());
    } catch (e) {
      setToast({ type: "error", text: safeStr(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  async function savePage(nextPage) {
    const payload = {
      type: "page",
      data: {
        season,
        title: safeStr(nextPage?.title),
        subtitle: safeStr(nextPage?.subtitle),
        intro: safeStr(nextPage?.intro),
      },
    };

    const res = await fetch(`/api/admin/big-game?season=${season}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) throw new Error(j?.error || "Save page failed");
    setPage(payload.data);
  }

  async function saveDivisions(nextDivisions) {
    const payload = {
      type: "divisions",
      data: {
        season,
        divisions: normalizeDivisions(nextDivisions),
      },
    };

    const res = await fetch(`/api/admin/big-game?season=${season}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) throw new Error(j?.error || "Save divisions failed");
    setDivisions(payload.data.divisions);
  }

  async function saveAll() {
    setSaving(true);
    try {
      await savePage(page);
      await saveDivisions(divisions);
      setToast({ type: "ok", text: "Saved." });
    } catch (e) {
      setToast({ type: "error", text: safeStr(e?.message || e) });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  function toggleDivision(divId) {
    setOpenDivIds((prev) => {
      const n = new Set(prev);
      if (n.has(divId)) n.delete(divId);
      else n.add(divId);
      return n;
    });
  }

  function addDivision() {
    const titleRaw = String(newDivTitle || "").trim();
    const order = Math.max(1, safeNum(newDivOrder, divisions.length + 1));
    const title = titleRaw || `Division ${order}`;

    const next = [...divisions, { id: `DIV_${Date.now()}`, title, order, leagues: [] }];
    const normalized = normalizeDivisions(next);
    setDivisions(normalized);
    // Keep the newly created division collapsed by default (consistent with others)
    setOpenDivIds((prev) => new Set(prev));

    setNewDivTitle("");
    setNewDivOrder(Math.max(1, order + 1));
  }

  function removeDivision(divId) {
    const next = divisions.filter((d) => d.id !== divId);
    setDivisions(normalizeDivisions(next));
    setOpenDivIds((prev) => {
      const n = new Set(prev);
      n.delete(divId);
      return n;
    });
  }

  function moveDivision(divId, dir) {
    const idx = divisions.findIndex((d) => d.id === divId);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= divisions.length) return;

    const next = [...divisions];
    const [it] = next.splice(idx, 1);
    next.splice(j, 0, it);
    // order is derived from list position
    setDivisions(normalizeDivisions(next));
  }

  function updateDivision(divId, patch) {
    const next = divisions.map((d) => (d.id === divId ? { ...d, ...patch } : d));
    setDivisions(normalizeDivisions(next));
  }

  function updateLeague(divId, leagueRowId, patch) {
    setDivisions((prev) => {
      const next = prev.map((d) => {
        if (d.id !== divId) return d;
        const leagues = safeArray(d.leagues)
          .map((l) => (l.id === leagueRowId ? { ...l, ...patch } : l))
          .sort((a, b) => a.display_order - b.display_order);
        return { ...d, leagues };
      });
      return normalizeDivisions(next);
    });
  }

  function removeLeagueRow(divId, leagueRowId) {
    setDivisions((prev) => {
      const next = prev.map((d) => {
        if (d.id !== divId) return d;
        const leagues = safeArray(d.leagues).filter((l) => l.id !== leagueRowId);
        leagues.forEach((l, i) => (l.display_order = i + 1));
        return { ...d, leagues };
      });
      return normalizeDivisions(next);
    });
  }

  function moveLeagueRow(divId, leagueRowId, dir) {
    setDivisions((prev) => {
      const next = prev.map((d) => {
        if (d.id !== divId) return d;
        const idx = safeArray(d.leagues).findIndex((l) => l.id === leagueRowId);
        if (idx < 0) return d;
        const j = idx + dir;
        if (j < 0 || j >= d.leagues.length) return d;
        const leagues = [...d.leagues];
        const [it] = leagues.splice(idx, 1);
        leagues.splice(j, 0, it);
        leagues.forEach((l, i) => (l.display_order = i + 1));
        return { ...d, leagues };
      });
      return normalizeDivisions(next);
    });
  }

  async function refreshSleeper() {
    if (!canRefresh) return;
    setLoading(true);

    try {
      const token = await getAuthToken();
      const next = JSON.parse(JSON.stringify(divisions));

      for (const d of next) {
        for (const l of safeArray(d.leagues)) {
          if (!l?.sleeper_league_id) continue;
          try {
            const meta = await fetchSleeperLeagueMeta(l.sleeper_league_id);
            if (!meta) continue;

            // Status mapping (auto) — only manual flag is not_ready
            const sleeperStatus = safeStr(meta.sleeper_status || "").toLowerCase();
            let league_status = l.league_status;
            if (sleeperStatus === "drafting") league_status = "DRAFTING";
            else if (typeof meta.open_teams === "number") league_status = meta.open_teams <= 0 ? "FULL" : "FILLING";

            l.league_name = meta.name || l.league_name;
            l.sleeper_status = meta.sleeper_status;
            l.avatar_id = meta.avatar_id;
            l.total_teams = meta.total_teams;
            l.filled_teams = meta.filled_teams;
            l.open_teams = meta.open_teams;
            l.league_status = normalizeLeagueStatus(league_status);

            // Avatar upload to R2 (only if we have an avatar id)
            if (meta.avatar_id) {
              const file = await fetchAvatarFile(meta.avatar_id);
              if (file) {
                const uploaded = await uploadBigGameLeagueAvatar({
                  token,
                  season,
                  divisionSlug: d.slug,
                  leagueOrder: l.display_order,
                  file,
                });
                if (uploaded?.key) {
                  l.league_image_key = uploaded.key;
                  l.league_image_path = uploaded.url;
                }
              }
            }
          } catch {
            // keep going
          }
        }
      }

      const normalized = normalizeDivisions(next);
      setDivisions(normalized);
      await saveDivisions(normalized);
      setToast({ type: "ok", text: "Refreshed Sleeper status + counts." });
    } catch (e) {
      setToast({ type: "error", text: safeStr(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-2 md:px-0">
      {/* Header / actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-2xl font-semibold">BIG Game Admin</div>
          <div className="text-sm text-white/60">Page settings, divisions + leagues</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-white/70">Season</label>
          <input
            className="input w-28"
            type="number"
            value={season}
            onChange={(e) => setSeason(safeNum(e.target.value, DEFAULT_SEASON))}
          />

          <button className="btn" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
          <button className="btn btn-primary" onClick={saveAll} disabled={saving || loading}>
            Save
          </button>
          <button className="btn btn-accent" onClick={refreshSleeper} disabled={loading || !canRefresh}>
            Refresh Status + Counts
          </button>

          <Link className="btn" href={`/admin/big-game/add-leagues?season=${season}`}>
            Add Leagues
          </Link>
        </div>
      </div>

      {msg ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            msg.type === "error"
              ? "border-red-500/40 bg-red-500/10 text-red-100"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      {/* Page settings (Hero) */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div>
            <div className="font-semibold">Page Settings</div>
            <div className="text-xs text-white/50">These control the BIG Game admin/public hero content.</div>
          </div>
          <button
            className="btn"
            onClick={async () => {
              setSaving(true);
              try {
                await savePage(page);
                setToast({ type: "ok", text: "Page saved." });
              } catch (e) {
                setToast({ type: "error", text: safeStr(e?.message || e) });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || loading}
          >
            Save Page
          </button>
        </div>
        <div className="card-content grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Title</label>
            <input
              className="input w-full"
              value={page.title}
              onChange={(e) => setPage((p) => ({ ...p, title: e.target.value }))}
              placeholder="BIG Game"
            />
          </div>
          <div>
            <label className="label">Subtitle</label>
            <input
              className="input w-full"
              value={page.subtitle}
              onChange={(e) => setPage((p) => ({ ...p, subtitle: e.target.value }))}
              placeholder="Season overview"
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Intro</label>
            <textarea
              className="textarea w-full"
              rows={3}
              value={page.intro}
              onChange={(e) => setPage((p) => ({ ...p, intro: e.target.value }))}
              placeholder="Short description shown at the top of the BIG Game page."
            />
          </div>
        </div>
      </div>

      {/* Divisions */}
      <div className="card">
        <div className="card-header flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">Divisions</div>
            <div className="text-xs text-white/50">Divisions are collapsible. Slug + code are auto-derived from title + order.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input w-72"
              placeholder="Division title"
              value={newDivTitle}
              onChange={(e) => setNewDivTitle(e.target.value)}
            />
            <input
              className="input w-24"
              type="number"
              min={1}
              placeholder="Order"
              value={newDivOrder}
              onChange={(e) => setNewDivOrder(safeNum(e.target.value, 1))}
            />
            <button className="btn" onClick={addDivision}>
              + Create
            </button>
          </div>
        </div>

        <div className="card-content space-y-4">
          {loading ? <div className="text-sm text-white/60">Loading…</div> : null}
          {!loading && divisions.length === 0 ? <div className="text-sm text-white/60">No divisions yet.</div> : null}

          {divisions.map((d, idx) => {
            const isOpen = openDivIds.has(d.id);
            const leagueCount = safeArray(d.leagues).length;

            return (
              <div key={d.id} className="rounded-2xl border border-subtle bg-black/20">
                <div className="flex flex-col gap-3 border-b border-subtle p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <button className="icon-btn" onClick={() => toggleDivision(d.id)} title={isOpen ? "Collapse" : "Expand"}>
                      {isOpen ? "▾" : "▸"}
                    </button>

                    <div className="flex items-center gap-2">
                      <button className="icon-btn" onClick={() => moveDivision(d.id, -1)} disabled={idx === 0} title="Move up">
                        ↑
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => moveDivision(d.id, 1)}
                        disabled={idx === divisions.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <input
                        className="input w-full md:w-[28rem]"
                        value={d.title}
                        onChange={(e) => updateDivision(d.id, { title: e.target.value })}
                        placeholder="Division title"
                      />
                      <div className="text-xs text-white/50">
                        Division {d.order} · slug: <span className="font-mono">{d.slug}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/50">{leagueCount} leagues</span>
                    <button className="btn btn-danger" onClick={() => removeDivision(d.id)}>
                      Remove
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="p-4">
                    {leagueCount === 0 ? (
                      <div className="text-sm text-white/60">No leagues in this division yet.</div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {safeArray(d.leagues).map((l, j) => (
                          <div key={l.id} className="card bg-black/25">
                            <div className="card-content space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-3">
                                  <LeagueAvatar league={l} />
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold leading-snug">{safeStr(l.league_name) || "—"}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      {l.not_ready ? <span className={badgeForStatus("TBD")}>NOT READY</span> : null}
                                      <span className={badgeForStatus(l.league_status)}>{normalizeLeagueStatus(l.league_status)}</span>
                                      <span className="text-xs text-white/60">open: {computeOpenSlotsLabel(l)}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    className="icon-btn"
                                    onClick={() => moveLeagueRow(d.id, l.id, -1)}
                                    disabled={j === 0}
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    className="icon-btn"
                                    onClick={() => moveLeagueRow(d.id, l.id, 1)}
                                    disabled={j === d.leagues.length - 1}
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div>
                                  <div className="text-xs text-white/50">Sleeper League ID</div>
                                  <div className="mt-1 font-mono text-xs text-white/80 break-all">{safeStr(l.sleeper_league_id || "—")}</div>
                                  {l.sleeper_status ? (
                                    <div className="mt-1 text-xs text-white/50">sleeper: {l.sleeper_status}</div>
                                  ) : null}
                                </div>

                                <div>
                                  <label className="text-xs text-white/50">External Link (optional)</label>
                                  <input
                                    className="input mt-1 w-full"
                                    value={safeStr(l.league_url)}
                                    onChange={(e) => updateLeague(d.id, l.id, { league_url: e.target.value })}
                                    placeholder="External link"
                                  />
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-xs text-white/70">
                                      <input
                                        type="checkbox"
                                        checked={safeBool(l.is_active, true)}
                                        onChange={(e) => updateLeague(d.id, l.id, { is_active: e.target.checked })}
                                      />
                                      active
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-white/70">
                                      <input
                                        type="checkbox"
                                        checked={safeBool(l.not_ready, false)}
                                        onChange={(e) => updateLeague(d.id, l.id, { not_ready: e.target.checked })}
                                      />
                                      not ready
                                    </label>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {l.sleeper_league_id ? (
                                      <a
                                        className="text-xs text-accent hover:underline"
                                        href={`https://sleeper.com/leagues/${l.sleeper_league_id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Sleeper
                                      </a>
                                    ) : null}
                                    <button className="btn btn-danger" onClick={() => removeLeagueRow(d.id, l.id)}>
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                <div className="text-[11px] leading-snug text-white/45">
                                  Status + counts are auto (Sleeper). Only <span className="text-white/70">Not Ready</span> is manual.
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-white/50">
        Tip: <span className="font-semibold">Refresh Status + Counts</span> pulls the latest Sleeper status, team counts, and uploads the league avatar to R2 (so the BIG Game league directory can show images).
      </div>
    </div>
  );
}
