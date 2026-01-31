// components/admin/dynasty/DynastyAdminClient.jsx
"use client";

import { safeStr } from "@/lib/safe";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

const R2_KEY = "data/dynasty/leagues.json";

const DEFAULT_PAGE_EDITABLE = {
  hero: {
    promoImageKey: "",
    promoImageUrl: "",
    updatesHtml: "<p>Updates will show here.</p>",
  },
};

const STATUS_OPTIONS = ["FULL & ACTIVE", "CURRENTLY FILLING", "DRAFTING", "ORPHAN OPEN", "TBD"];

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

function normalizeRow(r, idx = 0) {
  const id = safeStr(r?.id) || newId("dyn");
  const year = safeNum(r?.year, new Date().getFullYear());
  const theme_name = safeStr(r?.theme_name || r?.kind || "Untitled Theme").trim();
  const theme_blurb = safeStr(r?.theme_blurb).trim();

  const display_order = safeNum(r?.display_order, idx + 1);

  const rawStatus = safeStr(r?.status);
  const mappedStatus = rawStatus === "INACTIVE" ? "TBD" : rawStatus; // backward compat
  const status = STATUS_OPTIONS.includes(mappedStatus) ? mappedStatus : "FULL & ACTIVE";
  const isOrphanByStatus = status.toUpperCase().includes("ORPHAN");

  return {
    id,
    year,
    theme_name,
    theme_blurb,

    // league fields
    name: safeStr(r?.name).trim(),
    status,
    sleeper_url: safeStr(r?.sleeper_url).trim(),
    fill_note: safeStr(r?.fill_note).trim(),
    display_order,
    is_active: r?.is_active !== false,

    // images
    imageKey: safeStr(r?.imageKey).trim(),
    image_url: safeStr(r?.image_url).trim(),
    pendingImageFile: null,
    pendingImagePreviewUrl: "",

    // division/theme image
    theme_imageKey: safeStr(r?.theme_imageKey || r?.theme_image_key).trim(),
    theme_image_url: safeStr(r?.theme_image_url).trim(),
    pendingThemeImageFile: null,
    pendingThemeImagePreviewUrl: "",

    // theme stub marker
    is_theme_stub: r?.is_theme_stub === true,

    // backward compat only
    is_orphan: isOrphanByStatus,
  };
}

function groupByYearAndTheme(rows) {
  const map = new Map();

  for (const row of rows) {
    const year = Number(row.year) || new Date().getFullYear();
    const theme = safeStr(row.theme_name || "Untitled Theme").trim() || "Untitled Theme";
    const key = `${year}::${theme}`;

    if (!map.has(key)) map.set(key, { key, year, theme_name: theme, leagues: [] });

    if (!row.is_theme_stub) map.get(key).leagues.push(row);
  }

  for (const [, g] of map.entries()) {
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
  const pageSeason = CURRENT_SEASON;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // page config (Owner Updates hero)
  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE_EDITABLE);
  const [pageSaving, setPageSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // accordion open/closed
  const [openThemes, setOpenThemes] = useState(() => new Set());

  // quick create (theme only)
  const [quickOpen, setQuickOpen] = useState(false);
  const [quick, setQuick] = useState(() => ({
    year: pageSeason,
    theme_name: "",
    theme_blurb: "",
  }));

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

  async function loadPageConfig(season = pageSeason) {
    setPageLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPageCfg(DEFAULT_PAGE_EDITABLE);
        return;
      }
      const res = await fetch(`/api/admin/dynasty?season=${encodeURIComponent(String(season))}&type=page`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) {
        setPageCfg(DEFAULT_PAGE_EDITABLE);
        return;
      }
      const hero = out?.data?.hero || {};
      setPageCfg({
        hero: {
          promoImageKey: safeStr(hero.promoImageKey || ""),
          promoImageUrl: safeStr(hero.promoImageUrl || ""),
          updatesHtml: hero.updatesHtml ?? DEFAULT_PAGE_EDITABLE.hero.updatesHtml,
        },
      });
    } catch {
      setPageCfg(DEFAULT_PAGE_EDITABLE);
    } finally {
      setPageLoading(false);
    }
  }

  async function savePageConfig(season = pageSeason) {
    setErrorMsg("");
    setInfoMsg("");
    setPageSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in.");
      const res = await fetch(`/api/admin/dynasty?season=${encodeURIComponent(String(season))}&type=page`, {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "page", data: pageCfg }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) throw new Error(out?.error || `Save failed (${res.status})`);
      setInfoMsg("Owner Updates saved.");
    } catch (e) {
      setErrorMsg(e?.message || "Failed to save Owner Updates.");
    } finally {
      setPageSaving(false);
    }
  }

  async function uploadOwnerUpdatesImage(file) {
    const token = await getAccessToken();
    if (!token) throw new Error("Not logged in.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("section", "dynasty-updates");
    fd.append("season", String(pageSeason));
    const res = await fetch(`/api/admin/upload`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out?.ok) throw new Error(out?.error || "Upload failed");
    setPageCfg((p) => ({
      ...p,
      hero: { ...p.hero, promoImageKey: safeStr(out.key || ""), promoImageUrl: safeStr(out.publicUrl || "") },
    }));
  }

  useEffect(() => {
    loadFromR2();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPageConfig(pageSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSeason]);

  async function uploadDynastyImage({ year, id, file, token }) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("section", "dynasty-league");
    fd.append("season", String(year));
    fd.append("leagueId", String(id));

    const res = await fetch(`/api/admin/upload`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out?.ok) throw new Error(out?.error || "Upload failed");
    return out.key;
  }

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
        return { ...r, pendingThemeImageFile: file || null, pendingThemeImagePreviewUrl: previewUrl };
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
        return { ...r, pendingThemeImageFile: null, pendingThemeImagePreviewUrl: "" };
      });
    });
  }

  function toggleTheme(themeKey) {
    setOpenThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeKey)) next.delete(themeKey);
      else next.add(themeKey);
      return next;
    });
  }

  function updateThemeMeta(group, patch) {
    setRows((prev) =>
      prev.map((r) => {
        if (Number(r.year) !== Number(group.year)) return r;
        if (safeStr(r.theme_name).trim() !== safeStr(group.theme_name).trim()) return r;
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
    const ok = window.prompt('Type BALLSVILLE to delete this entire theme (this removes ALL leagues under it):');
    if ((ok || "").trim().toLowerCase() !== "ballsville") return;
    setRows((prev) =>
      prev.filter(
        (r) =>
          !(
            Number(r.year) === Number(group.year) &&
            safeStr(r.theme_name).trim() === safeStr(group.theme_name).trim()
          )
      )
    );
    setOpenThemes((prev) => {
      const next = new Set(prev);
      next.delete(group.key);
      return next;
    });
    setInfoMsg(`Theme "${group.theme_name}" removed locally. Click "Save to R2" to publish.`);
  }

  function addManualLeagueRow(group) {
    const id = newId("dyn");
    const next = normalizeRow(
      {
        id,
        year: group.year,
        theme_name: group.theme_name,
        theme_blurb: safeStr(group.leagues?.[0]?.theme_blurb || "").trim(),
        name: "",
        status: "CURRENTLY FILLING",
        sleeper_url: "",
        imageKey: "",
        image_url: "",
        fill_note: "",
        display_order: (group.leagues?.length || 0) + 1,
        is_active: true,
      },
      0
    );
    setRows((prev) => [...prev, next]);
  }

  async function saveAllToR2(nextRows = rows) {
    setErrorMsg("");
    setInfoMsg("");
    setSaving(true);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session token. Please sign in again.");

      const staged = nextRows.map((r) => ({ ...r }));

      // 0) upload division images once per (year, theme)
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

        for (let j = 0; j < staged.length; j++) {
          const r = staged[j];
          if (Number(r.year) !== entry.year) continue;
          if (safeStr(r.theme_name).trim() !== entry.themeName) continue;
          r.theme_imageKey = uploadedKey;
          r.theme_image_url = "";
        }

        safeRevoke(rep.pendingThemeImagePreviewUrl);
        rep.pendingThemeImageFile = null;
        rep.pendingThemeImagePreviewUrl = "";
      }

      // 1) upload league images
      for (let i = 0; i < staged.length; i++) {
        const r = staged[i];
        if (!r?.pendingImageFile) continue;

        const key = await uploadDynastyImage({
          year: r.year,
          id: r.id,
          file: r.pendingImageFile,
          token,
        });

        safeRevoke(r.pendingImagePreviewUrl);

        staged[i] = {
          ...r,
          imageKey: key,
          pendingImageFile: null,
          pendingImagePreviewUrl: "",
        };
      }

      // 2) normalize + stable sort
      const clean = staged.map(normalizeRow);

      clean.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.theme_name !== b.theme_name) return a.theme_name.localeCompare(b.theme_name);
        return (a.display_order ?? 9999) - (b.display_order ?? 9999);
      });

      const payload = { updatedAt: nowIso(), rows: clean };

      const res = await fetch(`/api/admin/dynasty`, {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
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

  async function handleQuickCreate(e) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    const year = Number(quick.year) || pageSeason;
    const theme_name = safeStr(quick.theme_name).trim();
    const theme_blurb = safeStr(quick.theme_blurb).trim();

    if (theme_name.length < 2) {
      setErrorMsg("Theme name must be at least 2 characters.");
      return;
    }

    const stubId = `theme_stub_${year}_${slugify(theme_name)}`;

    setRows((prev) => [
      ...prev,
      normalizeRow(
        {
          id: stubId,
          year,
          theme_name,
          theme_blurb,
          name: "",
          status: "TBD",
          sleeper_url: "",
          is_active: false,
          is_theme_stub: true,
          display_order: 1,
        },
        0
      ),
    ]);

    setInfoMsg(`Theme created: ${theme_name}. Now use "Add leagues (from Sleeper)" inside the theme.`);
    setQuick((s) => ({ ...s, theme_name: "", theme_blurb: "" }));
    setQuickOpen(false);
  }

  if (loading) return <p className="text-sm text-muted">Loading Dynasty leagues…</p>;

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

      {/* Owner Updates (Hero) */}
      <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-primary">Owner Updates (Hero)</h2>
            <p className="text-xs text-muted max-w-prose">This image + text renders in the hero section on the public Dynasty page.</p>
          </div>

          <button className="btn btn-primary" type="button" onClick={() => savePageConfig(pageSeason)} disabled={pageSaving || pageLoading}>
            {pageSaving ? "Saving…" : "Save Owner Updates"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-muted">Promo image</p>
            <div className="rounded-xl border border-subtle bg-black/20 overflow-hidden">
              {pageCfg.hero.promoImageKey ? (
                <img src={`/r2/${pageCfg.hero.promoImageKey}`} alt="Owner promo" className="w-full h-auto block" loading="lazy" />
              ) : (
                <div className="p-6 text-sm text-muted">No image uploaded.</div>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              className="input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await uploadOwnerUpdatesImage(file);
                  setInfoMsg("Image uploaded. Click Save Owner Updates to publish.");
                } catch (err) {
                  setErrorMsg(err?.message || "Upload failed.");
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted">Updates HTML</p>
            <textarea
              className="input min-h-[180px]"
              value={pageCfg.hero.updatesHtml}
              onChange={(e) => setPageCfg((p) => ({ ...p, hero: { ...p.hero, updatesHtml: e.target.value } }))}
              placeholder="<p>Type your updates here…</p>"
            />
            <p className="text-xs text-muted">Tip: keep it short (1–4 lines) so the hero stays clean.</p>
          </div>
        </div>
      </div>

      {/* Quick create */}
      <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-primary">New Year / Theme</h2>
            <p className="text-xs text-muted max-w-prose">
              Creates the Theme container first. Then add leagues from Sleeper inside the theme.
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
              <button className="btn btn-primary" type="submit">
                Create Theme
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
          <p className="text-sm text-muted">No Dynasty rows in R2 yet. Click “New Year / Theme”.</p>
        ) : (
          groups.map((group) => {
            const open = openThemes.has(group.key);
            const blurb = safeStr(group.leagues?.[0]?.theme_blurb || "").trim();

            const rep =
              group.leagues?.[0] ||
              rows.find(
                (r) =>
                  r.is_theme_stub &&
                  Number(r.year) === Number(group.year) &&
                  safeStr(r.theme_name).trim() === safeStr(group.theme_name).trim()
              ) ||
              {};

            const themeImg =
              rep.pendingThemeImagePreviewUrl ||
              (rep.theme_imageKey ? `/r2/${rep.theme_imageKey}` : rep.theme_image_url || "");
            const fallback = rep.imageKey ? `/r2/${rep.imageKey}` : rep.image_url || "";
            const shown = themeImg || fallback;

            const themeNameOk = safeStr(group.theme_name).trim().length >= 2;
            const addHref = `/admin/dynasty/add-leagues?year=${encodeURIComponent(String(group.year))}&theme=${encodeURIComponent(group.theme_name)}`;

            return (
              <div key={group.key} className="rounded-2xl border border-subtle bg-card-surface overflow-hidden">
                <button type="button" onClick={() => toggleTheme(group.key)} className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-subtle">
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
                    <div className="rounded-2xl border border-subtle bg-panel p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 rounded-xl border border-subtle bg-subtle-surface overflow-hidden shrink-0">
                            {shown ? (
                              <img src={shown} alt={group.theme_name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full grid place-items-center text-xs text-muted">No img</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">Division image</p>
                            <p className="text-xs text-muted truncate">Shows on the public Dynasty page on the division card.</p>
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
                          <button type="button" className="text-xs text-muted hover:text-fg underline" onClick={() => clearStagedDivisionImage({ year: group.year, themeName: group.theme_name })}>
                            clear
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted">Recommended: square (512×512+). WebP/PNG/JPG. Upload happens when you click “Save to R2”.</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs text-muted">Theme name</span>
                        <input className="input" value={group.theme_name} onChange={(e) => updateThemeMeta(group, { theme_name: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-muted">Theme blurb</span>
                        <input className="input" value={blurb} onChange={(e) => updateThemeMeta(group, { theme_blurb: e.target.value })} />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={addHref}
                        className={"btn btn-outline text-sm " + (!themeNameOk ? "opacity-60 pointer-events-none" : "")}
                        title={!themeNameOk ? "Theme name must be at least 2 characters" : "Add leagues from Sleeper"}
                      >
                        Add leagues (from Sleeper)
                      </Link>

                      <button className="btn btn-outline text-sm" type="button" onClick={() => addManualLeagueRow(group)}>
                        + Add manual league row
                      </button>

                      <button className="btn btn-outline text-sm" type="button" onClick={() => deleteTheme(group)}>
                        Delete theme
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-subtle">
                      <table className="min-w-[980px] w-full text-sm">
                        <thead className="bg-subtle-surface">
                          <tr className="text-left">
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Sleeper URL</th>
                            <th className="px-3 py-2">Image</th>
                            <th className="px-3 py-2">Fill note</th>
                            <th className="px-3 py-2">Active</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.leagues
                            .slice()
                            .sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999))
                            .map((lg) => (
                              <tr key={lg.id} className="border-t border-subtle">
                                <td className="px-3 py-2">
                                  <input className="input w-[68px]" value={lg.display_order ?? ""} onChange={(e) => updateLeague(lg.id, { display_order: safeNum(e.target.value, null) })} />
                                </td>
                                <td className="px-3 py-2">
                                  <input className="input w-[180px] max-w-[180px]" value={lg.name} onChange={(e) => updateLeague(lg.id, { name: e.target.value })} />
                                </td>
                                <td className="px-3 py-2">
                                  <select className="input" value={lg.status} onChange={(e) => updateLeague(lg.id, { status: e.target.value })}>
                                    {STATUS_OPTIONS.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <input className="input w-[260px] max-w-[260px]" value={lg.sleeper_url} onChange={(e) => updateLeague(lg.id, { sleeper_url: e.target.value })} />
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-col gap-2">
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
                                            const previewUrl = URL.createObjectURL(file);
                                            safeRevoke(lg.pendingImagePreviewUrl);
                                            updateLeague(lg.id, { pendingImageFile: file, pendingImagePreviewUrl: previewUrl });
                                            e.target.value = "";
                                          }}
                                        />
                                      </label>

                                      <button
                                        type="button"
                                        className="text-xs text-muted hover:text-fg underline"
                                        onClick={() => {
                                          safeRevoke(lg.pendingImagePreviewUrl);
                                          updateLeague(lg.id, { pendingImageFile: null, pendingImagePreviewUrl: "" });
                                        }}
                                      >
                                        clear
                                      </button>

                                      <span className="text-[11px] text-muted truncate max-w-[160px]">
                                        {lg.pendingImageFile ? "Staged" : lg.imageKey ? "R2" : lg.image_url ? "URL" : "—"}
                                      </span>
                                    </div>

                                    {(() => {
                                      const previewSrc = lg.pendingImagePreviewUrl || (lg.imageKey ? `/r2/${lg.imageKey}` : lg.image_url || "");
                                      if (!previewSrc) return null;
                                      return (
                                        <div className="relative w-[140px] aspect-[16/9] rounded-xl overflow-hidden border border-subtle bg-black/20">
                                          <img src={previewSrc} alt="Preview" className="w-full h-full object-cover" />
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <input className="input w-[260px] max-w-[260px]" value={lg.fill_note} onChange={(e) => updateLeague(lg.id, { fill_note: e.target.value })} />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="checkbox" checked={lg.is_active !== false} onChange={(e) => updateLeague(lg.id, { is_active: e.target.checked })} />
                                </td>
                                <td className="px-3 py-2">
                                  <button className="btn btn-outline text-xs" type="button" onClick={() => deleteLeague(lg.id)}>
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
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
