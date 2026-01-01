"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";
import { safeStr } from "@/lib/safe";

const R2_KEY_FOR = (season) => `data/biggame/leagues_${season}.json`;

const DEFAULT_PAGE_EDITABLE = {
  hero: {
    promoImageKey: "",
    promoImageUrl: "",
    updatesHtml: "<p>Updates will show here.</p>",
  },
};

const DIVISION_STATUS_OPTIONS = ["FULL", "FILLING", "TBD", "DRAFTING"];
const LEAGUE_STATUS_OPTIONS = ["FULL", "FILLING", "TBD", "DRAFTING"];

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

function slugify(input) {
  return safeStr(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function newId(prefix = "bg") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function safeRevoke(url) {
  try {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  } catch {}
}

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

function normalizeRow(r, idx = 0, season = CURRENT_SEASON) {
  const year = safeNum(r?.year, season);
  const isHeader = !!r?.is_division_header;

  // Division
  const division_name = safeStr(r?.division_name).trim();
  const division_slug = safeStr(r?.division_slug).trim() || slugify(division_name) || `division-${idx + 1}`;
  const division_status = DIVISION_STATUS_OPTIONS.includes(safeStr(r?.division_status)) ? safeStr(r?.division_status) : "FULL";
  const division_order = safeNum(r?.division_order, null);

  const division_image_key = safeStr(r?.division_image_key || "").trim();
  const division_image_path = safeStr(r?.division_image_path || "").trim();

  // League
  const display_order = safeNum(r?.display_order, null);
  const league_name = safeStr(r?.league_name || "").trim();
  const league_url = safeStr(r?.league_url || "").trim();
  const league_status = LEAGUE_STATUS_OPTIONS.includes(safeStr(r?.league_status)) ? safeStr(r?.league_status) : "FULL";
  const spots_available = safeNum(r?.spots_available, null);

  const league_image_key = safeStr(r?.league_image_key || "").trim();
  const league_image_path = safeStr(r?.league_image_path || "").trim();

  return {
    id: safeStr(r?.id) || newId("bg"),
    year,

    division_name,
    division_slug,
    division_status,
    division_order,
    division_blurb: safeStr(r?.division_blurb || "").trim(),

    division_image_key: division_image_key || "",
    division_image_path: division_image_path || "",

    league_name,
    league_url,
    league_status,
    league_image_key: league_image_key || "",
    league_image_path: league_image_path || "",

    display_order,
    spots_available,

    is_active: r?.is_active !== false,
    is_division_header: isHeader,

    // local-only
    _pending_division_file: null,
    _pending_division_preview: "",
    _pending_league_file: null,
    _pending_league_preview: "",
  };
}

function groupByDivision(rows) {
  const map = new Map();

  for (const r of rows) {
    const year = Number(r.year) || CURRENT_SEASON;
    const div = safeStr(r.division_slug || slugify(r.division_name) || "").trim();
    if (!div) continue;
    const key = `${year}::${div}`;
    if (!map.has(key)) map.set(key, { key, year, division_slug: div, rows: [] });
    map.get(key).rows.push(r);
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    // ensure header first
    g.rows.sort((a, b) => {
      if (!!a.is_division_header !== !!b.is_division_header) return a.is_division_header ? -1 : 1;
      const ao = a.display_order ?? 999;
      const bo = b.display_order ?? 999;
      if (ao !== bo) return ao - bo;
      return safeStr(a.league_name).localeCompare(safeStr(b.league_name));
    });

    const header = g.rows.find((x) => x.is_division_header) || null;
    g.header = header;
    g.leagues = g.rows.filter((x) => !x.is_division_header);

    // division order/name for sorting
    g.division_name = safeStr(header?.division_name || g.rows[0]?.division_name || g.division_slug);
    g.division_order = safeNum(header?.division_order, null);
  }

  groups.sort((a, b) => {
    // year desc
    if (a.year !== b.year) return b.year - a.year;

    // division_order asc if present
    const ao = a.division_order;
    const bo = b.division_order;
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    if (Number.isFinite(ao) && !Number.isFinite(bo)) return -1;
    if (!Number.isFinite(ao) && Number.isFinite(bo)) return 1;

    return safeStr(a.division_name).localeCompare(safeStr(b.division_name));
  });

  return groups;
}

function uniqueYearsFromRows(rows) {
  const set = new Set();
  for (const r of rows) {
    const y = Number(r?.year);
    if (Number.isFinite(y)) set.add(y);
  }
  return Array.from(set).sort((a, b) => b - a);
}

async function uploadBigGameImage({ file, section, season, divisionSlug, leagueOrder, token }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("section", section);
  fd.append("season", String(season));
  fd.append("divisionSlug", String(divisionSlug));
  if (leagueOrder != null) fd.append("leagueOrder", String(leagueOrder));

  const res = await fetch(`/api/admin/upload`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: fd,
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out?.ok) throw new Error(out?.error || `Upload failed (${res.status})`);
  return out;
}

export default function BigGameAdminClient() {
  const [rows, setRows] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE_EDITABLE);
  const [pageSaving, setPageSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [open, setOpen] = useState(() => new Set());
  // local-only drafts so inputs can be typed without triggering immediate mutations
  // key: `${year}::${division_slug}` => string
  const [divisionYearDraft, setDivisionYearDraft] = useState(() => ({}));

  const [pageLoading, setPageLoading] = useState(true);

  const groups = useMemo(() => groupByDivision(rows), [rows]);

  async function loadPageConfig(nextSeason) {
    setPageLoading(true);
    setErrorMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/biggame?season=${nextSeason}&type=page`, {
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
          promoImageKey: hero.promoImageKey || "",
          promoImageUrl: hero.promoImageUrl || "",
          updatesHtml: hero.updatesHtml ?? DEFAULT_PAGE_EDITABLE.hero.updatesHtml,
        },
      });
    } catch {
      setPageCfg(DEFAULT_PAGE_EDITABLE);
    } finally {
      setPageLoading(false);
    }
  }

  async function savePageConfig(nextSeason) {
    setErrorMsg("");
    setInfoMsg("");
    setPageSaving(true);
    try {
      const token = await getAccessToken();
      const payload = { type: "page", data: pageCfg };
      const res = await fetch(`/api/admin/biggame?season=${nextSeason}&type=page`, {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
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

  useEffect(() => {
    let cancelled = false;

    async function loadAllYears() {
      setErrorMsg("");
      setInfoMsg("");
      setLoading(true);

      try {
        // Auto-discover existing year files around CURRENT_SEASON.
        // No code change needed each year.
        const candidates = [];
        for (let y = CURRENT_SEASON - 1; y <= CURRENT_SEASON + 1; y++) candidates.push(y);

        const loadedRows = [];
        const foundYears = [];

        for (const y of candidates) {
          const bust = `v=${Date.now()}`;
          const res = await fetch(`/r2/${R2_KEY_FOR(y)}?${bust}`, { cache: "no-store" });
          if (!res.ok) continue;

          const data = await res.json().catch(() => null);
          if (!data) continue;

          const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
          if (!list.length) continue;

          foundYears.push(y);
          loadedRows.push(...list.map((r, idx) => normalizeRow(r, idx, y)));
        }

        if (cancelled) return;

        foundYears.sort((a, b) => b - a);

        setRows(loadedRows);
        setYears(foundYears);

        const heroYear = foundYears[0] ?? CURRENT_SEASON;
        await loadPageConfig(heroYear);
      } catch (e) {
        if (!cancelled) setErrorMsg(e?.message || "Failed to load Big Game data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAllYears();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadOwnerUpdatesImage(file) {
    const token = await getAccessToken();
    if (!token) throw new Error("Not logged in.");

    const targetSeason = years?.[0] ?? CURRENT_SEASON;

    const out = await uploadBigGameImage({
      file,
      section: "biggame-updates",
      season: targetSeason,
      divisionSlug: "updates",
      token,
    });

    setPageCfg((p) => ({
      ...p,
      hero: {
        ...p.hero,
        promoImageKey: safeStr(out.key || ""),
        promoImageUrl: safeStr(out.publicUrl || ""),
      },
    }));
  }

  async function saveAllToR2(nextRows, nextSeason) {
    setErrorMsg("");
    setInfoMsg("");
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session token. Please sign in again.");

      // Upload pending images first
      const updated = [];
      for (const r of nextRows) {
        if (Number(r.year) !== Number(nextSeason)) {
          updated.push(r);
          continue;
        }

        const divSlug = safeStr(r.division_slug || slugify(r.division_name) || "").trim();
        let next = { ...r, division_slug: divSlug };

        if (r.is_division_header && r._pending_division_file && divSlug) {
          const out = await uploadBigGameImage({
            file: r._pending_division_file,
            section: "biggame-division",
            season: nextSeason,
            divisionSlug: divSlug,
            token,
          });
          safeRevoke(next._pending_division_preview);
          next = {
            ...next,
            division_image_key: out.key,
            _pending_division_file: null,
            _pending_division_preview: "",
          };
        }

        if (!r.is_division_header && r._pending_league_file && divSlug && Number.isFinite(Number(r.display_order))) {
          const out = await uploadBigGameImage({
            file: r._pending_league_file,
            section: "biggame-league",
            season: nextSeason,
            divisionSlug: divSlug,
            leagueOrder: Number(r.display_order),
            token,
          });
          safeRevoke(next._pending_league_preview);
          next = {
            ...next,
            league_image_key: out.key,
            _pending_league_file: null,
            _pending_league_preview: "",
          };
        }

        updated.push(next);
      }

      // Normalize & stable sort
      const clean = updated
        .map((r, idx) => normalizeRow(r, idx, nextSeason))
        .filter((r) => Number(r.year) === Number(nextSeason));

      clean.sort((a, b) => {
        // division order/name
        const ao = a.division_order ?? 9999;
        const bo = b.division_order ?? 9999;
        if (ao !== bo) return ao - bo;
        const an = safeStr(a.division_name).toLowerCase();
        const bn = safeStr(b.division_name).toLowerCase();
        if (an !== bn) return an.localeCompare(bn);
        if (!!a.is_division_header !== !!b.is_division_header) return a.is_division_header ? -1 : 1;
        return (a.display_order ?? 999) - (b.display_order ?? 999);
      });

      const payload = { updatedAt: nowIso(), rows: clean };

      const res = await fetch(`/api/admin/biggame?season=${encodeURIComponent(String(nextSeason))}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) throw new Error(out?.error || `Save failed (${res.status})`);

      // Keep rows from other seasons in memory so we can do cross-season edits/copies.
      const others = updated.filter((r) => Number(r.year) !== Number(nextSeason));
      setRows([...others, ...clean]);

      // keep years list fresh
      const nextYears = uniqueYearsFromRows([...others, ...clean]);
      setYears(nextYears.length ? nextYears : years);

      setInfoMsg(`Saved Big Game divisions to R2 (season ${nextSeason}).`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to save Big Game data.");
    } finally {
      setSaving(false);
    }
  }

  async function importFromSupabase() {
    setErrorMsg("");
    setInfoMsg("");
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available.");

      const pickYear = safeNum(window.prompt("Import which year from Supabase?", String(years?.[0] ?? CURRENT_SEASON)), null);
      if (!Number.isFinite(pickYear)) return;

      const { data, error } = await supabase
        .from("biggame_leagues")
        .select("*")
        .eq("year", pickYear)
        .order("division_order", { ascending: true })
        .order("is_division_header", { ascending: false })
        .order("display_order", { ascending: true });

      if (error) throw error;

      const imported = (data || []).map((r, idx) =>
        normalizeRow(
          {
            ...r,
            division_slug: slugify(r?.division_name || ""),
            // keep existing supabase image paths as fallback
            division_image_key: "",
            league_image_key: "",
          },
          idx,
          pickYear
        )
      );

      // merge into existing rows (don’t nuke other years)
      setRows((prev) => {
        const others = prev.filter((r) => Number(r.year) !== Number(pickYear));
        return [...others, ...imported];
      });

      setYears((prev) => {
        const next = new Set(prev);
        next.add(pickYear);
        return Array.from(next).sort((a, b) => b - a);
      });

      setInfoMsg(`Imported ${imported.length} rows from Supabase (year ${pickYear}). Review, then click “Save Season ${pickYear}”.`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to import from Supabase.");
    }
  }

  function toggleGroup(k) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function upsertRow(rowId, patch) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function setDivisionHeader(group, patch) {
    if (group.header?.id) {
      upsertRow(group.header.id, patch);
      return;
    }

    // create missing header row
    const header = normalizeRow(
      {
        id: newId("bg"),
        year: group.year,
        division_name: group.division_name,
        division_slug: group.division_slug,
        division_status: "FULL",
        division_order: group.division_order,
        division_blurb: "",
        is_division_header: true,
        is_active: true,
      },
      0,
      group.year
    );

    setRows((prev) => [...prev, { ...header, ...patch }]);
  }

  function addDivision() {
    const baseName = window.prompt("Division name?") || "";
    const name = baseName.trim();
    if (!name) return;

    const y = safeNum(window.prompt("Year for this new division?", String(years?.[0] ?? CURRENT_SEASON)), null);
    if (!Number.isFinite(y)) return;

    const divSlug = slugify(name);

    // header
    const header = normalizeRow(
      {
        id: newId("bg"),
        year: y,
        division_name: name,
        division_slug: divSlug,
        division_status: "FILLING",
        division_order: null,
        is_division_header: true,
        is_active: true,
      },
      0,
      y
    );

    // 8 leagues
    const leagues = Array.from({ length: 8 }).map((_, i) =>
      normalizeRow(
        {
          id: newId("bg"),
          year: y,
          division_name: name,
          division_slug: divSlug,
          division_status: header.division_status,
          league_name: "",
          league_url: "",
          league_status: header.division_status,
          display_order: i + 1,
          is_division_header: false,
          is_active: true,
        },
        i,
        y
      )
    );

    setRows((prev) => [...prev, header, ...leagues]);
    setYears((prev) => {
      const next = new Set(prev);
      next.add(y);
      return Array.from(next).sort((a, b) => b - a);
    });
    setInfoMsg(`Added division "${name}" locally for year ${y}. Click “Save Season ${y}” to publish.`);
  }

  function deleteDivision(group) {
    const ok = window.prompt('Type BALLSVILLE to delete this entire division (header + leagues):');
    if ((ok || "").trim().toLowerCase() !== "ballsville") return;

    setRows((prev) => prev.filter((r) => !(Number(r.year) === Number(group.year) && safeStr(r.division_slug) === safeStr(group.division_slug))));
    setOpen((prev) => {
      const next = new Set(prev);
      next.delete(group.key);
      return next;
    });

    setInfoMsg(`Division "${group.division_name}" removed locally. Click “Save Season ${group.year}” to publish.`);
  }

  function deleteLeague(leagueRow) {
    if (!leagueRow?.id) return;
    if (!window.confirm("Delete this league row?")) return;
    safeRevoke(leagueRow._pending_league_preview);
    setRows((prev) => prev.filter((r) => r.id !== leagueRow.id));
  }

  function rolloverDivisionToYear(group, targetYearRaw) {
    const y = safeNum(targetYearRaw, null);
    if (!Number.isFinite(y)) return;
    if (Number(y) === Number(group.year)) return;

    const ok = window.confirm(
      `Change division year from ${group.year} to ${y}?\n\nThis will clear Sleeper URLs for all leagues in this division.\n\nYou can review, then click “Save Season ${y}” to publish.`
    );
    if (!ok) return;

    const oldKey = group.key;
    const newKey = `${y}::${safeStr(group.division_slug)}`;

    setRows((prev) =>
      prev.map((r) => {
        if (Number(r.year) !== Number(group.year)) return r;
        if (safeStr(r.division_slug) !== safeStr(group.division_slug)) return r;
        if (!r.is_division_header) {
          return { ...r, year: y, league_url: "" };
        }
        return { ...r, year: y };
      })
    );

    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(oldKey)) {
        next.delete(oldKey);
        next.add(newKey);
      }
      return next;
    });

    setDivisionYearDraft((prev) => {
      const next = { ...prev };
      delete next[oldKey];
      next[newKey] = String(y);
      return next;
    });

    setYears((prev) => {
      const next = new Set(prev);
      next.add(y);
      return Array.from(next).sort((a, b) => b - a);
    });

    setInfoMsg(`Rolled division "${group.division_name}" to year ${y} locally (Sleeper URLs cleared). Click “Save Season ${y}” to publish.`);
  }

  const yearSections = useMemo(() => {
    const fromRows = uniqueYearsFromRows(rows);
    const base = years?.length ? years : fromRows;
    return base.length ? base : [CURRENT_SEASON];
  }, [rows, years]);

  const heroSeason = yearSections?.[0] ?? CURRENT_SEASON;

  if (loading) {
    return <p className="text-sm text-muted">Loading Big Game divisions…</p>;
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
          <p className="text-sm font-semibold">Big Game data source: R2</p>
          <p className="text-xs text-muted">Per-season writes: /r2/{R2_KEY_FOR("{YEAR}")}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          

          <button className="btn btn-primary text-sm" type="button" onClick={addDivision} disabled={saving}>
            + Add division
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-subtle bg-card-surface p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Owner Updates (Hero)</p>
            <p className="text-xs text-muted">This image + text renders in the hero section on the public Big Game page (season {heroSeason}).</p>
          </div>
          <button className="btn btn-primary text-sm" type="button" onClick={() => savePageConfig(heroSeason)} disabled={pageSaving || pageLoading}>
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

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Divisions</h2>

        {groups.length === 0 ? (
          <p className="text-sm text-muted">No Big Game rows in R2 yet. Use  “Add division”.</p>
        ) : (
          yearSections.map((yr) => {
            const yearGroups = groups.filter((g) => Number(g.year) === Number(yr));
            if (!yearGroups.length) return null;

            return (
              <div key={yr} className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-base font-semibold">Season {yr}</h3>
                  <button className="btn btn-primary text-sm" type="button" onClick={() => saveAllToR2(rows, yr)} disabled={saving}>
                    {saving ? "Saving…" : `Save Season ${yr} to R2`}
                  </button>
                </div>

                <div className="space-y-3">
                  {yearGroups.map((g) => {
                    const isOpen = open.has(g.key);
                    const header = g.header;

                    const divisionImageSrc = header?._pending_division_preview
                      ? header._pending_division_preview
                      : header?.division_image_key
                      ? `/r2/${header.division_image_key}`
                      : header?.division_image_path
                      ? header.division_image_path
                      : "";

                    return (
                      <div key={g.key} className="rounded-2xl border border-subtle bg-card-surface overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.key)}
                          className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-subtle"
                        >
                          <div className="min-w-0 text-left">
                            <p className="text-sm font-semibold truncate">
                              {g.division_name} · {g.year}
                            </p>
                            <p className="text-xs text-muted truncate">{g.leagues.length} leagues</p>
                          </div>
                          <span className="text-xs text-muted">{isOpen ? "Hide" : "Edit"} →</span>
                        </button>

                        {isOpen && (
                          <div className="p-5 space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="space-y-1">
                                <span className="text-xs text-muted">Division name</span>
                                <input
                                  className="input"
                                  value={safeStr(header?.division_name || g.division_name)}
                                  onChange={(e) => {
                                    const nextName = e.target.value;
                                    setRows((prev) =>
                                      prev.map((r) => {
                                        if (Number(r.year) !== Number(g.year)) return r;
                                        if (safeStr(r.division_slug) !== safeStr(g.division_slug)) return r;
                                        return {
                                          ...r,
                                          division_name: nextName,
                                          division_slug: slugify(nextName) || r.division_slug,
                                        };
                                      })
                                    );
                                  }}
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-muted">Division order (small numbers show first)</span>
                                <input
                                  className="input w-28"
                                  value={safeStr(header?.division_order ?? "")}
                                  onChange={(e) => {
                                    const nextOrder = safeNum(e.target.value, null);
                                    setRows((prev) =>
                                      prev.map((r) => {
                                        if (Number(r.year) !== Number(g.year)) return r;
                                        if (safeStr(r.division_slug) !== safeStr(g.division_slug)) return r;
                                        return { ...r, division_order: nextOrder };
                                      })
                                    );
                                  }}
                                />
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-muted">Rollover year</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    className="input w-28"
                                    value={safeStr(divisionYearDraft[g.key] ?? header?.year ?? g.year)}
                                    onChange={(e) => setDivisionYearDraft((prev) => ({ ...prev, [g.key]: e.target.value }))}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-outline text-xs"
                                    onClick={() => rolloverDivisionToYear(g, divisionYearDraft[g.key] ?? header?.year ?? g.year)}
                                  >
                                    Rollover
                                  </button>
                                </div>
                                <span className="text-[11px] text-muted">
                                  Rollover sets the division year and clears Sleeper URLs. Nothing saves until you click “Save Season {g.year}”.
                                </span>
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-muted">Division status</span>
                                <select
                                  className="input"
                                  value={safeStr(header?.division_status || "FULL")}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setRows((prev) =>
                                      prev.map((r) => {
                                        if (Number(r.year) !== Number(g.year)) return r;
                                        if (safeStr(r.division_slug) !== safeStr(g.division_slug)) return r;
                                        return { ...r, division_status: v };
                                      })
                                    );
                                  }}
                                >
                                  {DIVISION_STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="space-y-1">
                                <span className="text-xs text-muted">Division blurb (optional)</span>
                                <input className="input" value={safeStr(header?.division_blurb || "")} onChange={(e) => setDivisionHeader(g, { division_blurb: e.target.value })} />
                              </label>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-3">
                                <label className="btn btn-outline text-xs cursor-pointer">
                                  Upload division image
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const preview = URL.createObjectURL(file);

                                      const headerId = header?.id;
                                      if (!headerId) {
                                        setDivisionHeader(g, { _pending_division_file: file, _pending_division_preview: preview });
                                      } else {
                                        setRows((prev) =>
                                          prev.map((r) => {
                                            if (r.id !== headerId) return r;
                                            safeRevoke(r._pending_division_preview);
                                            return { ...r, _pending_division_file: file, _pending_division_preview: preview };
                                          })
                                        );
                                      }

                                      e.target.value = "";
                                    }}
                                  />
                                </label>

                                {divisionImageSrc ? (
                                  <img src={divisionImageSrc} alt="Division preview" className="h-12 w-20 object-cover rounded-lg border border-subtle" />
                                ) : (
                                  <span className="text-xs text-muted">No image</span>
                                )}

                                <span className="text-[11px] text-muted">
                                  {header?.division_image_key
                                    ? `R2: ${safeStr(header.division_image_key).split("/").slice(-1)[0]}`
                                    : header?.division_image_path
                                    ? "URL"
                                    : "—"}
                                </span>
                              </div>

                              <button className="btn btn-outline text-sm" type="button" onClick={() => deleteDivision(g)}>
                                Delete division
                              </button>

                              <button
                                className="btn btn-outline text-sm"
                                type="button"
                                onClick={() => {
                                  const y = window.prompt("Rollover this division to what year?", String(Number(g.year) + 1));
                                  if (!y) return;
                                  setDivisionYearDraft((prev) => ({ ...prev, [g.key]: y }));
                                  rolloverDivisionToYear(g, y);
                                }}
                              >
                                Rollover to year
                              </button>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-subtle">
                              <table className="min-w-[980px] w-full text-sm">
                                <thead className="bg-subtle-surface">
                                  <tr className="text-left">
                                    <th className="px-3 py-2 w-[70px]">#</th>
                                    <th className="px-3 py-2 w-[280px]">Name</th>
                                    <th className="px-3 py-2 w-[140px]">Status</th>
                                    <th className="px-3 py-2">Sleeper URL</th>
                                    <th className="px-3 py-2 w-[220px]">Image</th>
                                    <th className="px-3 py-2 w-[140px]">Spots</th>
                                    <th className="px-3 py-2 w-[70px]">Active</th>
                                    <th className="px-3 py-2 w-[90px]"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.leagues
                                    .slice()
                                    .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
                                    .map((lg) => {
                                      const leagueImg = lg._pending_league_preview
                                        ? lg._pending_league_preview
                                        : lg.league_image_key
                                        ? `/r2/${lg.league_image_key}`
                                        : lg.league_image_path
                                        ? lg.league_image_path
                                        : "";

                                      return (
                                        <tr key={lg.id} className="border-t border-subtle">
                                          <td className="px-3 py-2">
                                            <input
                                              className="input w-16"
                                              value={safeStr(lg.display_order ?? "")}
                                              onChange={(e) => upsertRow(lg.id, { display_order: safeNum(e.target.value, null) })}
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <input className="input w-72" value={safeStr(lg.league_name)} onChange={(e) => upsertRow(lg.id, { league_name: e.target.value })} />
                                          </td>
                                          <td className="px-3 py-2">
                                            <select className="input w-36" value={safeStr(lg.league_status || "FULL")} onChange={(e) => upsertRow(lg.id, { league_status: e.target.value })}>
                                              {LEAGUE_STATUS_OPTIONS.map((s) => (
                                                <option key={s} value={s}>
                                                  {s}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="px-3 py-2">
                                            <input className="input w-[320px]" value={safeStr(lg.league_url)} onChange={(e) => upsertRow(lg.id, { league_url: e.target.value })} />
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                              <label className="btn btn-outline text-xs cursor-pointer">
                                                Upload
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const preview = URL.createObjectURL(file);
                                                    setRows((prev) =>
                                                      prev.map((r) => {
                                                        if (r.id !== lg.id) return r;
                                                        safeRevoke(r._pending_league_preview);
                                                        return { ...r, _pending_league_file: file, _pending_league_preview: preview };
                                                      })
                                                    );
                                                    e.target.value = "";
                                                  }}
                                                />
                                              </label>

                                              {leagueImg ? (
                                                <img src={leagueImg} alt="League preview" className="h-10 w-16 object-cover rounded-lg border border-subtle" />
                                              ) : (
                                                <span className="text-xs text-muted">No image</span>
                                              )}

                                              <span className="text-[11px] text-muted truncate max-w-[120px]">
                                                {lg.league_image_key ? `R2: ${safeStr(lg.league_image_key).split("/").slice(-1)[0]}` : lg.league_image_path ? "URL" : "—"}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            <input className="input w-24" value={safeStr(lg.spots_available ?? "")} onChange={(e) => upsertRow(lg.id, { spots_available: safeNum(e.target.value, null) })} />
                                          </td>
                                          <td className="px-3 py-2">
                                            <input type="checkbox" checked={lg.is_active !== false} onChange={(e) => upsertRow(lg.id, { is_active: e.target.checked })} />
                                          </td>
                                          <td className="px-3 py-2">
                                            <button className="btn btn-outline text-xs" type="button" onClick={() => deleteLeague(lg)}>
                                              Delete
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>

                            <div className="flex justify-end">
                              <button className="btn btn-primary" type="button" onClick={() => saveAllToR2(rows, g.year)} disabled={saving}>
                                {saving ? "Saving…" : `Save Season ${g.year} to R2`}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}