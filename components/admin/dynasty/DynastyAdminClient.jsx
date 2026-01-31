"use client";

import { safeStr } from "@/lib/safe";
import { CURRENT_SEASON } from "@/lib/season";
import { getSupabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const R2_KEY = "data/dynasty/leagues.json";
const DEFAULT_PAGE_SEASON = CURRENT_SEASON;

// Keep consistent with Redraft: status comes from Sleeper unless overridden by admin checkboxes.
// Stored values: pre_draft | drafting | in_season | complete | tbd | orphan_open

function statusLabel(s) {
  const v = safeStr(s).trim().toLowerCase();
  if (v === "tbd") return "TBD";
  if (v === "orphan_open") return "ORPHAN OPEN";
  if (v === "pre_draft") return "CURRENTLY FILLING";
  if (v === "drafting") return "DRAFTING";
  if (v === "in_season") return "IN SEASON";
  if (v === "complete") return "COMPLETE";
  return v ? v.toUpperCase() : "TBD";
}

function statusPillClasses(s) {
  const v = safeStr(s).trim().toLowerCase();
  if (v === "orphan_open") return "bg-danger/15 text-danger border-danger/30";
  if (v === "drafting") return "bg-accent/15 text-accent border-accent/30";
  if (v === "pre_draft") return "bg-primary/15 text-primary border-primary/30";
  if (v === "in_season") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (v === "complete") return "bg-white/10 text-muted border-white/10";
  return "bg-white/10 text-muted border-white/10";
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function safeNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeRevoke(url) {
  try {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  } catch {}
}

function slugify(input) {
  return safeStr(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function newId(prefix = "dyn") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeStatus(raw) {
  const s = safeStr(raw).trim();
  const up = s.toUpperCase();
  const low = s.toLowerCase();

  // Already modern values
  if (["pre_draft", "drafting", "in_season", "complete", "tbd", "orphan_open"].includes(low)) return low;

  // Back-compat legacy labels
  if (up === "INACTIVE" || up === "TBD") return "tbd";
  if (up === "ORPHAN OPEN") return "orphan_open";
  if (up === "CURRENTLY FILLING") return "pre_draft";
  if (up === "DRAFTING") return "drafting";
  if (up === "FULL & ACTIVE") return "in_season";

  return "tbd";
}

function normalizeRow(r, idx = 0) {
  const id = safeStr(r?.id) || newId("dyn");
  const year = safeNum(r?.year, new Date().getFullYear());
  const theme_name = safeStr(r?.theme_name || r?.kind || "Untitled Theme").trim();
  const display_order = safeNum(r?.display_order ?? r?.order, idx + 1);

  // Base status pulled from Sleeper (or last refresh). This is NOT affected by the override checkboxes.
  // We persist it so an admin can toggle Orphan/Not Ready off and still land back on the real Sleeper state.
  const fetched_status = normalizeStatus(r?.fetched_status ?? r?.sleeper_status ?? r?.status);

  // Override checkboxes (admin controlled). These are the source of truth for orphan/not-ready.
  // Do NOT infer orphanOpen from status; otherwise unchecking will "snap back" on normalize.
  const orphanOpen = Boolean(r?.orphanOpen) || Boolean(r?.is_orphan);

  // Single source of truth for "ready": if notReady true, the public page should treat it as TBD.
  const notReady = Boolean(r?.notReady) || r?.is_active === false;

  return {
    id,
    year,
    theme_name,
    theme_blurb: safeStr(r?.theme_blurb).trim(),

    name: safeStr(r?.name).trim(),
    league_id: safeStr(r?.league_id || r?.leagueId || r?.sleeper_league_id).trim(),
    // Keep `status` as the base Sleeper status; the public page derives the *effective* status using overrides.
    status: fetched_status,
    fetched_status,
    sleeper_url: safeStr(r?.sleeper_url).trim(), // invite link (optional)

    // league avatar (auto imported from Sleeper)
    avatar: safeStr(r?.avatar).trim(),
    imageKey: safeStr(r?.imageKey).trim(),
    image_url: safeStr(r?.image_url).trim(),

    // theme/division image
    theme_imageKey: safeStr(r?.theme_imageKey || r?.theme_image_key).trim(),
    theme_image_url: safeStr(r?.theme_image_url).trim(),
    pendingThemeImageFile: null,
    pendingThemeImagePreviewUrl: "",

    display_order,
    notReady,

    orphanOpen,

    // backward compat
    is_orphan: orphanOpen,
    is_active: !notReady,

    is_theme_stub: Boolean(r?.is_theme_stub),
  };
}

function groupByYearAndTheme(rows) {
  const map = new Map();
  for (const row of rows) {
    const year = Number(row.year) || new Date().getFullYear();
    const theme = (row.theme_name || "Untitled Theme").trim();
    const key = `${year}::${theme}`;
    if (!map.has(key)) {
      map.set(key, { key, year, theme_name: theme, leagues: [] });
    }
    if (!row.is_theme_stub) map.get(key).leagues.push(row);
  }

  for (const g of map.values()) {
    g.leagues.sort((a, b) => {
      const ao = a.display_order ?? 9999;
      const bo = b.display_order ?? 9999;
      if (ao !== bo) return ao - bo;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return a.theme_name.localeCompare(b.theme_name);
  });
}

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

export default function DynastyAdminClient() {
  const router = useRouter();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingKey, setRefreshingKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // accordion open/closed
  const [openThemes, setOpenThemes] = useState(() => new Set());

  // quick create (theme only)
  const [quickOpen, setQuickOpen] = useState(false);
  const [quick, setQuick] = useState({
    year: new Date().getFullYear(),
    theme_name: "",
    theme_blurb: "",
  });

  const pageSeason = DEFAULT_PAGE_SEASON;

  const groups = useMemo(() => groupByYearAndTheme(rows), [rows]);

  async function loadFromR2() {
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);
    try {
      const bust = `v=${Date.now()}`;
      const res = await fetch(`/r2/${R2_KEY}?${bust}`, { cache: "no-store" });
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      setRows(list.map(normalizeRow));
    } catch (e) {
      setErrorMsg(e?.message || "Failed to load Dynasty data from R2.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFromR2();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme(themeKey) {
    setOpenThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeKey)) next.delete(themeKey);
      else next.add(themeKey);
      return next;
    });
  }

  function updateThemeMeta(groupKey, patch) {
    const [yearStr, themeName] = groupKey.split("::");
    const year = Number(yearStr);
    setRows((prev) =>
      prev.map((r) => {
        if (Number(r.year) !== year) return r;
        if ((r.theme_name || "").trim() !== (themeName || "").trim()) return r;
        return { ...r, ...patch };
      })
    );
  }

  function updateLeague(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function deleteLeague(id) {
    if (!window.confirm("Delete this league row?")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function deleteTheme(group) {
    const ok = window.prompt(
      'Type BALLSVILLE to delete this entire theme (this removes ALL leagues under it):'
    );
    if ((ok || "").trim().toLowerCase() !== "ballsville") return;
    setRows((prev) =>
      prev.filter(
        (r) => !(Number(r.year) === Number(group.year) && (r.theme_name || "").trim() === (group.theme_name || "").trim())
      )
    );
    setOpenThemes((prev) => {
      const next = new Set(prev);
      next.delete(group.key);
      return next;
    });
    setInfoMsg(`Theme "${group.theme_name}" removed locally. Click "Save to R2" to publish.`);
  }

  function addLeague(group) {
    const id = newId("dyn");
    const next = normalizeRow(
      {
        id,
        year: group.year,
        theme_name: group.theme_name,
        theme_blurb: (group.leagues?.[0]?.theme_blurb || "").trim(),
        name: "",
        status: "TBD",
        sleeper_url: "",
        imageKey: "",
        image_url: "",
        display_order: (group.leagues?.length || 0) + 1,
        notReady: true,
      },
      0
    );
    setRows((prev) => [...prev, next]);
  }

  function moveLeagueWithinTheme(group, leagueId, dir) {
    const ordered = [...group.leagues].sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
    const idx = ordered.findIndex((x) => x.id === leagueId);
    if (idx < 0) return;
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= ordered.length) return;

    const a = ordered[idx];
    const b = ordered[swapWith];

    // swap display_order values
    updateLeague(a.id, { display_order: b.display_order ?? idx + 1 });
    updateLeague(b.id, { display_order: a.display_order ?? swapWith + 1 });
  }

  // League avatars are pulled from Sleeper during "Add leagues" and "Refresh statuses".
  // Manual per-league image uploads are no longer needed.

  async function uploadDynastyDivisionImage({ year, divisionSlug, file, token }) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("section", "dynasty-division");
    fd.append("season", String(year));
    fd.append("divisionSlug", String(divisionSlug));

    const res = await fetch(`/api/admin/upload`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out?.ok) throw new Error(out?.error || "Upload failed");
    return out.key;
  }

  async function uploadLeagueAvatar({ year, leagueId, file, token }) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("section", "dynasty-league");
    fd.append("season", String(year));
    fd.append("leagueId", String(leagueId));

    const res = await fetch(`/api/admin/upload`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out?.ok) throw new Error(out?.error || "Upload failed");
    return out.key;
  }

  async function fetchAvatarFile(avatarId, fallbackName = "avatar") {
    const id = safeStr(avatarId).trim();
    if (!id) return null;
    const url = `https://sleepercdn.com/avatars/${id}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type?.includes("png") ? "png" : blob.type?.includes("webp") ? "webp" : "jpg";
    const safeName = safeStr(fallbackName).trim() || "league";
    return new File([blob], `${safeName}.${ext}`, { type: blob.type || "image/jpeg" });
  }

  async function fetchSleeperLeague(leagueId) {
    const id = safeStr(leagueId).trim();
    if (!id) return null;
    const res = await fetch(`https://api.sleeper.app/v1/league/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }

  function stageDivisionImage({ year, themeName, file }) {
    const previewUrl = file ? URL.createObjectURL(file) : "";

    setRows((prev) => {
      let used = false;
      return prev.map((r) => {
        if (used) return r;
        if (Number(r?.year) !== Number(year)) return r;
        if (safeStr(r?.theme_name).trim() !== safeStr(themeName).trim()) return r;

        safeRevoke(r.pendingThemeImagePreviewUrl);
        used = true;
        return {
          ...r,
          pendingThemeImageFile: file || null,
          pendingThemeImagePreviewUrl: previewUrl,
        };
      });
    });
  }

  function clearStagedDivisionImage({ year, themeName }) {
    setRows((prev) => {
      let cleared = false;
      return prev.map((r) => {
        if (cleared) return r;
        if (Number(r?.year) !== Number(year)) return r;
        if (safeStr(r?.theme_name).trim() !== safeStr(themeName).trim()) return r;

        safeRevoke(r.pendingThemeImagePreviewUrl);
        cleared = true;
        return {
          ...r,
          pendingThemeImageFile: null,
          pendingThemeImagePreviewUrl: "",
        };
      });
    });
  }

  async function saveAllToR2(nextRows = rows) {
    setErrorMsg("");
    setInfoMsg("");
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session token. Please sign in again.");

      // clone
      const staged = nextRows.map((r) => ({ ...r }));

      // 0) Upload any staged DIVISION images first (theme cards)
      const divKeys = new Map();
      for (let i = 0; i < staged.length; i++) {
        const r = staged[i];
        if (!r?.pendingThemeImageFile) continue;
        const themeName = safeStr(r?.theme_name).trim() || "Dynasty";
        const divSlug = slugify(themeName);
        const key = `${Number(r.year)}::${divSlug}`;
        if (!divKeys.has(key)) divKeys.set(key, { year: Number(r.year), divSlug, themeName, repIndex: i });
      }

      for (const entry of divKeys.values()) {
        const rep = staged[entry.repIndex];
        const uploadedKey = await uploadDynastyDivisionImage({
          year: entry.year,
          divisionSlug: entry.divSlug,
          file: rep.pendingThemeImageFile,
          token,
        });

        // apply the theme image to all rows in that year/theme
        for (let j = 0; j < staged.length; j++) {
          const r = staged[j];
          const themeName = safeStr(r?.theme_name).trim() || "Dynasty";
          if (Number(r.year) !== entry.year) continue;
          if (themeName !== entry.themeName) continue;
          r.theme_imageKey = uploadedKey;
          r.theme_image_url = "";
        }

        safeRevoke(rep.pendingThemeImagePreviewUrl);
        rep.pendingThemeImageFile = null;
        rep.pendingThemeImagePreviewUrl = "";
      }

      // Normalize + stable sort (and drop any transient props)
      const clean = staged.map(normalizeRow);

      clean.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.theme_name !== b.theme_name) return a.theme_name.localeCompare(b.theme_name);
        return (a.display_order ?? 9999) - (b.display_order ?? 9999);
      });

      const payload = {
        updatedAt: nowIso(),
        rows: clean,
      };

      const res = await fetch(`/api/admin/dynasty`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) throw new Error(out?.error || `Save failed (${res.status})`);

      setRows(clean);
      setInfoMsg("Saved Dynasty leagues to R2.");
    } catch (e) {
      setErrorMsg(e?.message || "Failed to save Dynasty data.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshThemeFromSleeper(groupKey) {
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;

    setErrorMsg("");
    setInfoMsg("");
    setRefreshingKey(groupKey);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const isTargetRow = (r) => r.year === group.year && r.theme_name === group.theme_name && !r.theme_stub;
      const list = rows.filter(isTargetRow);
      if (list.length === 0) {
        setInfoMsg("No leagues found to refresh.");
        return;
      }

      const next = rows.map((r) => ({ ...r }));
      const idxById = new Map(next.map((r, i) => [r.id, i]));

      for (const r of list) {
        const leagueId = safeStr(r.league_id).trim();
        if (!leagueId) continue;

        // If admin is overriding, don't overwrite.
        if (r.notReady || r.orphanOpen) continue;

        const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}`, {
          cache: "no-store",
        });
        if (!res.ok) continue;
        const lg = await res.json();

        const i = idxById.get(r.id);
        if (i == null) continue;

        next[i].name = safeStr(lg?.name).trim() || next[i].name;
        next[i].status = normalizeStatus(lg?.status) || next[i].status;
        next[i].avatar = safeStr(lg?.avatar).trim() || next[i].avatar;

        // If avatar changed or image missing, fetch + upload.
        const avatarId = safeStr(lg?.avatar).trim();
        if (avatarId && (avatarId !== safeStr(r.avatar).trim() || !safeStr(r.imageKey).trim())) {
          const file = await fetchAvatarFile(avatarId, `league_${leagueId}`);
          if (file) {
            const key = await uploadLeagueAvatar({ year: r.year, leagueId, file, token });
            if (key) next[i].imageKey = key;
          }
        }
      }

      setRows(next);
      setInfoMsg("Statuses refreshed from Sleeper.");
    } catch (err) {
      setErrorMsg(err?.message || "Failed to refresh");
    } finally {
      setRefreshingKey("");
    }
  }

  async function handleQuickCreate(e) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    const year = Number(quick.year) || new Date().getFullYear();
    const theme_name = String(quick.theme_name || "").trim();
    const theme_blurb = String(quick.theme_blurb || "").trim();

    if (theme_name.length < 2) {
      setErrorMsg("Theme name must be at least 2 characters.");
      return;
    }

    // Create a Theme stub row (kept in R2 so the theme exists even if no leagues added yet).
    const stubId = `theme_stub_${year}_${slugify(theme_name)}`;

    const stub = normalizeRow(
      {
        id: stubId,
        year,
        theme_name,
        theme_blurb,
        name: "",
        status: "TBD",
        sleeper_url: "",
        display_order: 1,
        notReady: true,
        is_theme_stub: true,
      },
      0
    );

    setRows((prev) => [...prev, stub]);
    setQuickOpen(false);
    setQuick({ year: new Date().getFullYear(), theme_name: "", theme_blurb: "" });

    // Go straight into Sleeper flow.
    router.push(`/admin/dynasty/add-leagues?year=${encodeURIComponent(String(year))}&theme=${encodeURIComponent(theme_name)}`);
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading Dynasty leagues…</p>;
  }

  return (
    <section className="space-y-6">
      {(errorMsg || infoMsg) && (
        <div className="space-y-1 text-sm">
          {errorMsg && <p className="text-danger">{errorMsg}</p>}
          {infoMsg && !errorMsg && <p className="text-accent">{infoMsg}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-subtle bg-card-surface p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Dynasty data source: R2</p>
          <p className="text-xs text-muted">Reads/writes: /r2/{R2_KEY}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/constitution/dynasty" className="btn btn-outline text-sm">
            Edit Dynasty Constitution
          </Link>
          <button className="btn btn-primary text-sm" type="button" onClick={() => saveAllToR2()} disabled={saving}>
            {saving ? "Saving…" : "Save to R2"}
          </button>
        </div>
      </div>

      {/* Quick create */}
      <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-primary">New season theme</h2>
            <p className="text-xs text-muted max-w-prose">
              Create a theme (year + theme name). After you create it, you’ll pick leagues from Sleeper to populate the theme.
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setQuickOpen(true)}>
            New Year / Theme
          </button>
        </div>

        {quickOpen && (
          <form onSubmit={handleQuickCreate} className="mt-4 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted">Year</span>
                <input className="input" value={quick.year} onChange={(e) => setQuick((q) => ({ ...q, year: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Theme name</span>
                <input className="input" value={quick.theme_name} onChange={(e) => setQuick((q) => ({ ...q, theme_name: e.target.value }))} />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs text-muted">Theme blurb (optional)</span>
              <input className="input" value={quick.theme_blurb} onChange={(e) => setQuick((q) => ({ ...q, theme_blurb: e.target.value }))} />
            </label>

            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={String(quick.theme_name || "").trim().length < 2}>
                Create & Pick Leagues
              </button>
              <button className="btn btn-outline" type="button" onClick={() => setQuickOpen(false)}>
                Close
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Themes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Existing themes &amp; leagues</h2>

        {groups.length === 0 ? (
          <p className="text-sm text-muted">No Dynasty themes in R2 yet. Click “New Year / Theme”.</p>
        ) : (
          groups.map((group) => {
            const open = openThemes.has(group.key);
            const blurb = (group.leagues?.[0]?.theme_blurb || "").trim();

            // representative row for theme images
            const rep = group.leagues?.[0] || rows.find((r) => Number(r.year) === Number(group.year) && safeStr(r.theme_name).trim() === safeStr(group.theme_name).trim()) || {};
            const themeImg =
              rep.pendingThemeImagePreviewUrl ||
              (rep.theme_imageKey ? `/r2/${rep.theme_imageKey}` : rep.theme_image_url || "");

            return (
              <div key={group.key} className="rounded-2xl border border-subtle bg-card-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleTheme(group.key)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-subtle"
                >
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold truncate">
                      {group.theme_name} · {group.year}
                    </p>
                    <p className="text-xs text-muted truncate">{group.leagues.length} leagues</p>
                  </div>
                  <span className="text-xs text-muted">{open ? "Hide" : "Edit"} →</span>
                </button>

                {open && (
                  <div className="p-5 space-y-4">
                    {/* Theme meta */}
                    <div className="rounded-2xl border border-subtle bg-panel p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 rounded-xl border border-subtle bg-subtle-surface overflow-hidden shrink-0">
                            {themeImg ? (
                              <img src={themeImg} alt={group.theme_name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full grid place-items-center text-xs text-muted">No img</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">Theme card image</p>
                            <p className="text-xs text-muted truncate">Used on the public Dynasty page for this theme.</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="btn btn-outline text-xs cursor-pointer">
                            Choose
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                stageDivisionImage({ year: group.year, themeName: group.theme_name, file });
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="text-xs text-muted hover:text-fg underline"
                            onClick={() => clearStagedDivisionImage({ year: group.year, themeName: group.theme_name })}
                          >
                            clear
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs text-muted">Theme name</span>
                          <input
                            className="input"
                            value={group.theme_name}
                            onChange={(e) => updateThemeMeta(group.key, { theme_name: e.target.value })}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs text-muted">Theme blurb (optional)</span>
                          <input className="input" value={blurb} onChange={(e) => updateThemeMeta(group.key, { theme_blurb: e.target.value })} />
                        </label>
                      </div>

                      <p className="text-[11px] text-muted">
                        Recommended: square (512×512+). WebP/PNG/JPG. Upload happens when you click “Save to R2”.
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/dynasty/add-leagues?year=${encodeURIComponent(String(group.year))}&theme=${encodeURIComponent(group.theme_name)}`}
                          className="btn btn-outline text-sm"
                          title="Add leagues from Sleeper"
                        >
                          Add leagues (from Sleeper)
                        </Link>
                        <button className="btn btn-outline text-sm" type="button" onClick={() => addLeague(group)}>
                          + Add league (manual)
                        </button>
                        <button
                          className="btn btn-outline text-sm"
                          type="button"
                          onClick={() => refreshThemeFromSleeper(group.key)}
                          disabled={refreshingKey === group.key || saving}
                        >
                          {refreshingKey === group.key ? "Refreshing…" : "Refresh statuses"}
                        </button>
                        <button className="btn btn-outline text-sm" type="button" onClick={() => deleteTheme(group)}>
                          Delete theme
                        </button>
                      </div>
                    </div>

                    {/* League cards (redraft-style) */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.leagues
                        .slice()
                        .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999))
                        .map((lg) => {
                          const disabled = Boolean(lg?.notReady);
                          const previewSrc = lg.imageKey ? `/r2/${lg.imageKey}` : lg.image_url || "";

                          return (
                            <div
                              key={lg.id}
                              className={
                                "rounded-2xl border border-subtle bg-card-surface p-4 space-y-3 " +
                                (disabled ? "opacity-80" : "")
                              }
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="h-12 w-12 rounded-xl border border-subtle bg-panel overflow-hidden shrink-0">
                                    {previewSrc ? (
                                      <img src={previewSrc} alt={lg.name || "League"} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="h-full w-full grid place-items-center text-xs text-muted">No img</div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs text-muted">League</p>
                                    <p className="text-sm font-semibold truncate">{safeStr(lg.name) || "(unnamed)"}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    className="btn btn-outline text-xs px-2"
                                    onClick={() => moveLeagueWithinTheme(group, lg.id, "up")}
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline text-xs px-2"
                                    onClick={() => moveLeagueWithinTheme(group, lg.id, "down")}
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                </div>
                              </div>

                              <div className="grid gap-2">
                                <label className="space-y-1">
                                  <span className="text-xs text-muted">Name</span>
                                  <input className="input" value={lg.name} readOnly />
                                </label>

                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="space-y-1">
                                    <span className="text-xs text-muted">Order</span>
                                    <input
                                      className="input"
                                      value={lg.display_order ?? ""}
                                      onChange={(e) => updateLeague(lg.id, { display_order: safeNum(e.target.value, null) })}
                                    />
                                  </label>
                                  <div className="space-y-1">
                                    <span className="text-xs text-muted">Status</span>
                                    <div>
                                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-fg">
                                        {statusLabel(lg.notReady ? "tbd" : lg.orphanOpen ? "orphan_open" : lg.status)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <label className="space-y-1">
                                  <span className="text-xs text-muted">Invite link (optional)</span>
                                  <input
                                    className="input"
                                    value={lg.sleeper_url}
                                    onChange={(e) => updateLeague(lg.id, { sleeper_url: e.target.value })}
                                    placeholder="https://sleeper.app/i/…"
                                  />
                                </label>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-xs text-muted">
                                      <input
                                        type="checkbox"
                                        checked={lg.notReady}
                                        onChange={(e) => updateLeague(lg.id, { notReady: e.target.checked, is_active: !e.target.checked })}
                                      />
                                      League not ready
                                    </label>

                                    <label className="flex items-center gap-2 text-xs text-muted">
                                      <input
                                        type="checkbox"
                                        checked={!!lg.orphanOpen}
                                  onChange={(e) =>
                                    updateLeague(lg.id, {
                                      orphanOpen: e.target.checked,
                                      // Keep the persisted field in sync so it does not snap back on normalize/save.
                                      is_orphan: e.target.checked,
                                    })
                                  }
                                      />
                                      Orphan
                                    </label>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <button className="btn btn-outline text-xs" type="button" onClick={() => deleteLeague(lg.id)}>
                                    Delete
                                  </button>
                                  <span className="text-[11px] text-muted truncate">{lg.imageKey ? "Avatar saved" : ""}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
