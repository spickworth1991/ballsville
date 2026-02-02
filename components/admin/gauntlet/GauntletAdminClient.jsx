\
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

function extractSleeperLeagueIdFromUrl(url) {
  const u = safeStr(url).trim();
  if (!u) return null;
  const m = u.match(/sleeper\.com\/leagues\/(\d+)/i);
  return m?.[1] || null;
}

function deriveLegionFields({ title, order, takenSlugs }) {
  const ord = Math.max(1, safeNum(order, 1));
  const baseSlug = slugifyTitle(title) || `legion-${ord}`;
  let slug = baseSlug;
  if (takenSlugs) {
    let i = 2;
    while (takenSlugs.has(slug)) {
      slug = `${baseSlug}-${i}`;
      i += 1;
    }
    takenSlugs.add(slug);
  }
  return { order: ord, slug };
}

function normalizeLegion(legion, idx, takenSlugs) {
  const id = safeStr(legion?.id || "").trim() || uid();
  const title = safeStr(legion?.title || legion?.legion || "Legion").trim() || "Legion";
  const order = safeNum(legion?.order ?? legion?.legion_order ?? idx + 1, idx + 1);
  const derived = deriveLegionFields({ title, order, takenSlugs });

  const leagues = safeArray(legion?.leagues)
    .map((l, j) => normalizeLeague(l, j))
    .sort((a, b) => a.league_order - b.league_order);

  return {
    id,
    title,
    ...derived,
    leagues,
  };
}

function normalizeLeague(l, idx) {
  const id = safeStr(l?.id || "").trim() || uid();
  const league_order = safeNum(l?.league_order ?? l?.display_order ?? idx + 1, idx + 1);
  const league_url = safeStr(l?.league_url || l?.url || "").trim();
  const sleeper_league_id = safeStr(l?.sleeper_league_id || l?.leagueId || "").trim() || extractSleeperLeagueIdFromUrl(league_url);

  return {
    id,
    league_order,
    league_name: safeStr(l?.league_name || l?.name || "League").trim() || "League",
    league_url,
    league_status: normalizeLeagueStatus(l?.league_status || l?.status || "TBD"),

    sleeper_league_id: sleeper_league_id || null,
    sleeper_status: safeStr(l?.sleeper_status || "").trim() || null,
    avatar_id: safeStr(l?.avatar_id || l?.avatarId || "").trim() || null,

    league_image_key: safeStr(l?.league_image_key || "").trim() || null,
    league_image_path: safeStr(l?.league_image_path || l?.league_image_url || "").trim() || null,

    total_teams: l?.total_teams != null ? safeNum(l.total_teams, null) : null,
    filled_teams: l?.filled_teams != null ? safeNum(l.filled_teams, null) : null,
    open_teams: l?.open_teams != null ? safeNum(l.open_teams, null) : null,

    not_ready: safeBool(l?.not_ready, false),
  };
}

function normalizeLegions(list) {
  const raw = safeArray(list);
  const baseSorted = [...raw].sort((a, b) => safeNum(a?.order, 999) - safeNum(b?.order, 999));
  const taken = new Set();
  const normalized = baseSorted.map((l, i) => normalizeLegion(l, i, taken));
  normalized.sort((a, b) => a.order - b.order);

  // Stamp order to match list position (order drives Legion # in UI)
  normalized.forEach((l, i) => {
    l.order = i + 1;
  });

  // Re-derive slugs for uniqueness + consistency after order changes
  const taken2 = new Set();
  return normalized.map((l) => {
    const derived = deriveLegionFields({ title: l.title, order: l.order, takenSlugs: taken2 });
    return { ...l, ...derived };
  });
}

/**
 * GAUNTLET stores a flat array of rows with a "legion header" row followed by league rows.
 * We keep that data model for saving, but present a nested UI (Legions -> Leagues).
 */
function rowsToLegions(rows) {
  const r = safeArray(rows);

  // Sort by legion_order then league_order to make grouping deterministic
  const sorted = [...r].sort((a, b) => {
    const ao = safeNum(a?.legion_order ?? 999, 999);
    const bo = safeNum(b?.legion_order ?? 999, 999);
    if (ao !== bo) return ao - bo;
    const al = safeNum(a?.league_order ?? 999, 999);
    const bl = safeNum(b?.league_order ?? 999, 999);
    return al - bl;
  });

  const map = new Map(); // slug -> legion obj
  const orderSlugs = [];

  for (const row of sorted) {
    const isHeader = safeBool(row?.is_legion_header, false);
    const title = safeStr(row?.legion_title || row?.title || row?.legion || "").trim();
    const legion_order = safeNum(row?.legion_order, null);
    const legion_slug = safeStr(row?.legion_slug || "").trim() || (title ? slugifyTitle(title) : "");

    if (isHeader) {
      const slug = legion_slug || `legion-${legion_order || orderSlugs.length + 1}`;
      if (!map.has(slug)) {
        map.set(slug, {
          id: safeStr(row?.id || "").trim() || uid(),
          title: title || `Legion ${legion_order || orderSlugs.length + 1}`,
          order: Math.max(1, safeNum(legion_order, orderSlugs.length + 1)),
          slug,
          leagues: [],
        });
        orderSlugs.push(slug);
      }
      continue;
    }

    // League row
    if (!legion_slug) continue;
    if (!map.has(legion_slug)) {
      // If data is missing a header, auto-create a legion shell (won't break)
      map.set(legion_slug, {
        id: uid(),
        title: title || `Legion ${orderSlugs.length + 1}`,
        order: Math.max(1, safeNum(legion_order, orderSlugs.length + 1)),
        slug: legion_slug,
        leagues: [],
      });
      orderSlugs.push(legion_slug);
    }

    const legion = map.get(legion_slug);
    legion.leagues.push(normalizeLeague(row, legion.leagues.length));
  }

  const legions = orderSlugs.map((s) => map.get(s)).filter(Boolean);
  return normalizeLegions(legions);
}

function legionsToRows(legions) {
  const norm = normalizeLegions(legions);

  const rows = [];
  for (const l of norm) {
    rows.push({
      id: l.id,
      is_legion_header: true,
      legion_title: l.title,
      legion_slug: l.slug,
      legion_order: l.order,
      league_order: 0,
    });

    const leagues = safeArray(l.leagues)
      .map((x, i) => ({ ...normalizeLeague(x, i), league_order: i + 1 }))
      .sort((a, b) => a.league_order - b.league_order);

    for (const league of leagues) {
      rows.push({
        id: league.id,
        is_legion_header: false,
        legion_title: l.title,
        legion_slug: l.slug,
        legion_order: l.order,

        league_order: league.league_order,
        league_name: league.league_name,
        league_url: league.league_url,
        league_status: normalizeLeagueStatus(league.league_status),

        sleeper_league_id: league.sleeper_league_id,
        sleeper_status: league.sleeper_status,
        avatar_id: league.avatar_id,

        league_image_key: league.league_image_key,
        league_image_path: league.league_image_path,

        total_teams: league.total_teams,
        filled_teams: league.filled_teams,
        open_teams: league.open_teams,

        not_ready: safeBool(league.not_ready, false),
        is_active: true, // legacy; other modes don't need it here
      });
    }
  }
  return rows;
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

  // IMPORTANT: use /rosters (not /users) for team counts.
  // /users can include co-owners and will over-count.
  let rosters = [];
  try {
    const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${id}/rosters`);
    if (rostersRes.ok) rosters = await rostersRes.json();
  } catch {
    // ignore
  }

  const total = typeof league?.total_rosters === "number" ? league.total_rosters : null;
  const filled = Array.isArray(rosters) ? rosters.filter((r) => safeStr(r?.owner_id).trim()).length : null;
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

async function uploadGauntletLeagueAvatar({ token, season, legionSlug, leagueOrder, file }) {
  if (!file) return null;

  const qs = new URLSearchParams({
    section: "gauntlet-league",
    season: String(season),
    legionSlug: safeStr(legionSlug),
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

  const src = path
    ? r2Url(path)
    : key
      ? r2Url(key)
      : avatarId
        ? `https://sleepercdn.com/avatars/${avatarId}`
        : null;

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

export default function GauntletAdminClient({ initialSeason }) {
  const [season, setSeason] = useState(safeNum(initialSeason, DEFAULT_SEASON));

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [legions, setLegions] = useState([]);
  // Default to collapsed, like the other modes
  const [openLegionIds, setOpenLegionIds] = useState(() => new Set());

  // Create Legion (simple: title + order)
  const [newLegionTitle, setNewLegionTitle] = useState("");
  const [newLegionOrder, setNewLegionOrder] = useState(1);

  const msgTimer = useRef(null);
  const setToast = (m) => {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 3500);
  };

  const canRefresh = useMemo(() => {
    return legions.some((g) => safeArray(g.leagues).some((l) => l.sleeper_league_id || extractSleeperLeagueIdFromUrl(l.league_url)));
  }, [legions]);

  async function loadAll() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gauntlet?season=${season}&type=leagues`, { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Failed to load");

      const rows = safeArray(j?.data?.leagues);
      const nested = rowsToLegions(rows);
      setLegions(nested);

      // Start collapsed
      setOpenLegionIds(new Set());
    } catch (e) {
      setToast({ type: "error", text: safeStr(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  async function saveAll(nextLegions = legions) {
    setSaving(true);
    try {
      const payload = {
        type: "leagues",
        data: {
          season,
          leagues: legionsToRows(nextLegions),
        },
      };

      const res = await fetch(`/api/admin/gauntlet?season=${season}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Save failed");

      setLegions(rowsToLegions(payload.data.leagues));
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

  function toggleLegion(legionId) {
    setOpenLegionIds((prev) => {
      const n = new Set(prev);
      if (n.has(legionId)) n.delete(legionId);
      else n.add(legionId);
      return n;
    });
  }

  function addLegion() {
    const titleRaw = String(newLegionTitle || "").trim();
    const order = Math.max(1, safeNum(newLegionOrder, legions.length + 1));
    const title = titleRaw || `Legion ${order}`;

    const next = normalizeLegions([...legions, { id: `LEGION_${Date.now()}`, title, order, leagues: [] }]);
    setLegions(next);

    // keep collapsed by default
    setOpenLegionIds((prev) => new Set(prev));

    setNewLegionTitle("");
    setNewLegionOrder(Math.max(1, order + 1));
  }

  function removeLegion(legionId) {
    setLegions(normalizeLegions(legions.filter((g) => g.id !== legionId)));
    setOpenLegionIds((prev) => {
      const n = new Set(prev);
      n.delete(legionId);
      return n;
    });
  }

  function moveLegion(legionId, dir) {
    const idx = legions.findIndex((g) => g.id === legionId);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= legions.length) return;
    const next = [...legions];
    const [it] = next.splice(idx, 1);
    next.splice(j, 0, it);
    setLegions(normalizeLegions(next));
  }

  function setLegionOrder(legionId, desiredOrder) {
    const target = Math.max(1, safeNum(desiredOrder, 1));
    const idx = legions.findIndex((g) => g.id === legionId);
    if (idx < 0) return;

    const next = [...legions];
    const [it] = next.splice(idx, 1);
    const insertAt = Math.min(Math.max(0, target - 1), next.length);
    next.splice(insertAt, 0, it);
    setLegions(normalizeLegions(next));
  }

  function updateLegion(legionId, patch) {
    const next = legions.map((g) => (g.id === legionId ? { ...g, ...patch } : g));
    setLegions(normalizeLegions(next));
  }

  function updateLeague(legionId, leagueId, patch) {
    setLegions((prev) => {
      const next = prev.map((g) => {
        if (g.id !== legionId) return g;
        const leagues = safeArray(g.leagues)
          .map((l) => (l.id === leagueId ? { ...l, ...patch } : l))
          .sort((a, b) => a.league_order - b.league_order);
        return { ...g, leagues };
      });
      return normalizeLegions(next);
    });
  }

  function removeLeague(legionId, leagueId) {
    setLegions((prev) => {
      const next = prev.map((g) => {
        if (g.id !== legionId) return g;
        const leagues = safeArray(g.leagues).filter((l) => l.id !== leagueId);
        leagues.forEach((l, i) => (l.league_order = i + 1));
        return { ...g, leagues };
      });
      return normalizeLegions(next);
    });
  }

  function moveLeague(legionId, leagueId, dir) {
    setLegions((prev) => {
      const next = prev.map((g) => {
        if (g.id !== legionId) return g;
        const idx = safeArray(g.leagues).findIndex((l) => l.id === leagueId);
        if (idx < 0) return g;
        const j = idx + dir;
        if (j < 0 || j >= g.leagues.length) return g;
        const leagues = [...g.leagues];
        const [it] = leagues.splice(idx, 1);
        leagues.splice(j, 0, it);
        leagues.forEach((l, i) => (l.league_order = i + 1));
        return { ...g, leagues };
      });
      return normalizeLegions(next);
    });
  }

  async function refreshSleeper() {
    if (!canRefresh) return;
    setLoading(true);

    try {
      const token = await getAuthToken();
      const next = JSON.parse(JSON.stringify(legions));

      for (const g of next) {
        for (const l of safeArray(g.leagues)) {
          const sleeperId = l.sleeper_league_id || extractSleeperLeagueIdFromUrl(l.league_url);
          if (!sleeperId) continue;

          l.sleeper_league_id = sleeperId;

          try {
            const meta = await fetchSleeperLeagueMeta(sleeperId);
            if (!meta) continue;

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

            // Upload Sleeper avatar to R2 for public directory
            if (meta.avatar_id) {
              const file = await fetchAvatarFile(meta.avatar_id);
              if (file) {
                const uploaded = await uploadGauntletLeagueAvatar({
                  token,
                  season,
                  legionSlug: g.slug,
                  leagueOrder: l.league_order,
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

      const normalized = normalizeLegions(next);
      setLegions(normalized);
      await saveAll(normalized);
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
          <div className="text-2xl font-semibold">Gauntlet Admin</div>
          <div className="text-sm text-white/60">Legions + leagues (Sleeper sync, counts, and images)</div>
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
          <button className="btn btn-primary" onClick={() => saveAll()} disabled={saving || loading}>
            Save
          </button>
          <button className="btn btn-accent" onClick={refreshSleeper} disabled={loading || !canRefresh}>
            Refresh Status + Counts
          </button>

          <Link className="btn" href={`/gauntlet?season=${season}`} target="_blank">
            View
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

      {/* Legions */}
      <div className="card">
        <div className="card-header px-4 py-8 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold">Legions</div>
            <div className="text-xs text-white/50">Legions are collapsible. Slug is auto-derived from title + order.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input w-72"
              placeholder="Legion title"
              value={newLegionTitle}
              onChange={(e) => setNewLegionTitle(e.target.value)}
            />
            <input
              className="input w-24"
              type="number"
              min={1}
              placeholder="Order"
              value={newLegionOrder}
              onChange={(e) => setNewLegionOrder(safeNum(e.target.value, 1))}
            />
            <button className="btn" onClick={addLegion}>
              + Create
            </button>
          </div>
        </div>

        <div className="card-content px-4 py-8 space-y-5">
          {loading ? <div className="text-sm text-white/60">Loading…</div> : null}
          {!loading && legions.length === 0 ? <div className="text-sm text-white/60">No legions yet.</div> : null}

          {legions.map((g, idx) => {
            const isOpen = openLegionIds.has(g.id);
            const leagueCount = safeArray(g.leagues).length;

            return (
              <div key={g.id} className="rounded-2xl border border-subtle bg-black/20">
                <div className="flex flex-col gap-3 border-b border-subtle p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <button
                      className="icon-btn"
                      onClick={() => toggleLegion(g.id)}
                      title={isOpen ? "Collapse" : "Expand"}
                    >
                      {isOpen ? "▾" : "▸"}
                    </button>

                    <div className="flex items-center gap-2">
                      <button className="icon-btn" onClick={() => moveLegion(g.id, -1)} disabled={idx === 0} title="Move up">
                        ↑
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => moveLegion(g.id, 1)}
                        disabled={idx === legions.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-xs text-white/50">order</div>
                      <input
                        className="input w-20"
                        type="number"
                        min={1}
                        value={safeNum(g.order, idx + 1)}
                        onChange={(e) => setLegionOrder(g.id, e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <input
                        className="input w-full md:w-[28rem]"
                        value={g.title}
                        onChange={(e) => updateLegion(g.id, { title: e.target.value })}
                        placeholder="Legion title"
                      />
                      <div className="text-xs text-white/50">
                        Legion {g.order} · slug: <span className="font-mono">{g.slug}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-white/50">{leagueCount} leagues</span>
                    <button className="btn btn-danger" onClick={() => removeLegion(g.id)}>
                      Remove
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="p-4">
                    {leagueCount === 0 ? (
                      <div className="text-sm text-white/60">No leagues in this legion yet.</div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                        {safeArray(g.leagues).map((l, j) => (
                          <div key={l.id} className="card bg-black/25">
                            <div className="card-content px-4 py-8">
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
                                    onClick={() => moveLeague(g.id, l.id, -1)}
                                    disabled={j === 0}
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    className="icon-btn"
                                    onClick={() => moveLeague(g.id, l.id, 1)}
                                    disabled={j === g.leagues.length - 1}
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
                                  <label className="text-xs text-white/50">League URL (Sleeper / external)</label>
                                  <input
                                    className="input mt-1 w-full"
                                    value={safeStr(l.league_url)}
                                    onChange={(e) => updateLeague(g.id, l.id, { league_url: e.target.value, sleeper_league_id: extractSleeperLeagueIdFromUrl(e.target.value) || l.sleeper_league_id })}
                                    placeholder="https://sleeper.com/leagues/..."
                                  />
                                  <div className="mt-1 text-[11px] text-white/45">
                                    If this is a Sleeper league URL, the Sleeper ID will be auto-detected.
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <label className="flex items-center gap-2 text-xs text-white/70">
                                    <input
                                      type="checkbox"
                                      checked={safeBool(l.not_ready, false)}
                                      onChange={(e) => updateLeague(g.id, l.id, { not_ready: e.target.checked })}
                                    />
                                    not ready
                                  </label>

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
                                    <button className="btn btn-danger" onClick={() => removeLeague(g.id, l.id)}>
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
        Tip: <span className="font-semibold">Refresh Status + Counts</span> pulls the latest Sleeper status, team counts, and uploads the league avatar to R2 (so the Gauntlet league directory can show images).
      </div>
    </div>
  );
}
