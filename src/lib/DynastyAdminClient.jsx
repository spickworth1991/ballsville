// src/lib/DynastyAdminClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

const STATUS_OPTIONS = [
  "FULL & ACTIVE",
  "CURRENTLY FILLING",
  "DRAFTING",
  "ORPHAN OPEN",
  "INACTIVE",
];

// Group rows by (year, theme_name)
function groupByYearAndTheme(rows) {
  const map = new Map();

  for (const row of rows) {
    const year = row.year;
    const theme = (row.theme_name || row.kind || "Untitled Theme").trim();
    const key = `${year}::${theme}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        year,
        theme_name: theme,
        leagues: [],
      });
    }
    map.get(key).leagues.push(row);
  }

  // Sort leagues inside each theme
  for (const [, group] of map.entries()) {
    group.leagues.sort((a, b) => {
      const da = a.display_order ?? 9999;
      const db = b.display_order ?? 9999;
      if (da !== db) return da - db;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  // Sort groups: newest year first, then theme name
  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return a.theme_name.localeCompare(b.theme_name);
  });
}

export default function DynastyAdminClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Quick create modal state (same behavior as before)
  const [quickOpen, setQuickOpen] = useState(false);
  const [quick, setQuick] = useState({
    year: new Date().getFullYear(),
    theme_name: "",
    theme_blurb: "",
    base_status: "CURRENTLY FILLING",
    base_fill_note: "",
    division_names: "",
  });
  const [quickSaving, setQuickSaving] = useState(false);

  // Accordion open/closed
  const [openThemes, setOpenThemes] = useState(() => new Set());

  // Draft edits
  const [themeDrafts, setThemeDrafts] = useState({});
  const [leagueDrafts, setLeagueDrafts] = useState({});
  const [newLeaguesByTheme, setNewLeaguesByTheme] = useState({});
  const [dirtyThemes, setDirtyThemes] = useState(() => new Set());
  const [savingThemeKey, setSavingThemeKey] = useState(null);

  // NEW: theme delete confirmation (Ballsville style)
  const [themeToDeleteKey, setThemeToDeleteKey] = useState(null);
  const [themeDeleteInput, setThemeDeleteInput] = useState("");
  const [deletingThemeKey, setDeletingThemeKey] = useState(null);

  const groups = useMemo(() => groupByYearAndTheme(rows), [rows]);

  function markThemeDirty(themeKey) {
    setDirtyThemes((prev) => {
      const next = new Set(prev);
      next.add(themeKey);
      return next;
    });
  }

  // Load all dynasty leagues
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErrorMsg("");
      setInfoMsg("");

      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error("Supabase client not available");

        const { data, error } = await supabase
          .from("dynasty_leagues")
          .select("*")
          .order("year", { ascending: false })
          .order("theme_name", { ascending: true })
          .order("display_order", { ascending: true });

        if (error) throw error;
        if (!cancelled) setRows(data || []);
      } catch (err) {
        console.error("Failed to load dynasty_leagues:", err);
        if (!cancelled) {
          setErrorMsg("Unable to load Dynasty leagues from Supabase.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadRows() {
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available");
      const { data, error } = await supabase
        .from("dynasty_leagues")
        .select("*")
        .order("year", { ascending: false })
        .order("theme_name", { ascending: true })
        .order("display_order", { ascending: true });
      if (error) throw error;
      setRows(data || []);
    } catch (err) {
      console.error("Failed to reload dynasty_leagues:", err);
      setErrorMsg("Unable to refresh Dynasty leagues from Supabase.");
    }
  }

  function resetThemeDraft(themeKey, leagues) {
    setThemeDrafts((prev) => {
      const copy = { ...prev };
      delete copy[themeKey];
      return copy;
    });
    setLeagueDrafts((prev) => {
      const copy = { ...prev };
      for (const lg of leagues) {
        delete copy[lg.id];
      }
      return copy;
    });
    setNewLeaguesByTheme((prev) => {
      const copy = { ...prev };
      delete copy[themeKey];
      return copy;
    });
    setDirtyThemes((prev) => {
      const next = new Set(prev);
      next.delete(themeKey);
      return next;
    });
  }

  function toggleTheme(themeKey, leagues = []) {
    setOpenThemes((prev) => {
      const isOpen = prev.has(themeKey);
      const next = new Set(prev);

      if (isOpen && dirtyThemes.has(themeKey)) {
        const discard = window.confirm(
          "You have unsaved changes in this theme.\n\nOK = Discard changes and collapse.\nCancel = Keep editing."
        );
        if (!discard) return prev;
        resetThemeDraft(themeKey, leagues);
      }

      if (isOpen) {
        next.delete(themeKey);
      } else {
        next.add(themeKey);
      }
      return next;
    });
  }

  function handleAddNewLeague(themeKey, group) {
    setNewLeaguesByTheme((prev) => {
      const existing = prev[themeKey] || [];
      const nextOrder =
        (group.leagues.length || 0) + existing.length + 1;

      const newLeague = {
        _localId: `${themeKey}::new::${Date.now()}::${existing.length}`,
        name: "",
        status: "CURRENTLY FILLING",
        sleeper_url: "",
        image_url: "",
        fill_note: "",
        note: "",
        display_order: nextOrder,
        is_active: true,
        is_orphan: false,
      };

      return {
        ...prev,
        [themeKey]: [...existing, newLeague],
      };
    });
    markThemeDirty(themeKey);
  }

  function handleRemoveNewLeague(themeKey, localId) {
    setNewLeaguesByTheme((prev) => {
      const list = prev[themeKey] || [];
      const filtered = list.filter((row) => row._localId !== localId);
      const copy = { ...prev };
      if (filtered.length === 0) delete copy[themeKey];
      else copy[themeKey] = filtered;
      return copy;
    });
  }

  async function handleDeleteLeague(id, themeKey, leagues) {
    if (!window.confirm("Delete this league entry from this theme?")) return;

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available");
      const { error } = await supabase
        .from("dynasty_leagues")
        .delete()
        .eq("id", id);
      if (error) throw error;

      await reloadRows();
      resetThemeDraft(themeKey, leagues);
      setInfoMsg("League deleted.");
    } catch (err) {
      console.error("Failed to delete league:", err);
      setErrorMsg("Failed to delete league. Check console for details.");
    }
  }

  // 🔹 THEME DELETE – now uses "ballsville" text confirm like Big Game
  async function handleDeleteTheme(themeKey, group) {
    const { year, theme_name, leagues } = group;

    setErrorMsg("");
    setInfoMsg("");

    if (themeDeleteInput.trim().toLowerCase() !== "ballsville") {
      setErrorMsg('To delete a theme, type "ballsville" exactly.');
      return;
    }

    setDeletingThemeKey(themeKey);

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from("dynasty_leagues")
        .delete()
        .match({ year, theme_name });

      if (error) throw error;

      // Clear local drafts and close accordion
      resetThemeDraft(themeKey, leagues);
      setOpenThemes((prev) => {
        const next = new Set(prev);
        next.delete(themeKey);
        return next;
      });

      await reloadRows();

      setInfoMsg(`Deleted theme "${theme_name}" for ${year}.`);
      setThemeToDeleteKey(null);
      setThemeDeleteInput("");
    } catch (err) {
      console.error("Failed to delete theme:", err);
      const msg =
        err?.message ||
        err?.error_description ||
        "Failed to delete theme. Check console for details.";
      setErrorMsg(msg);
    } finally {
      setDeletingThemeKey(null);
    }
  }

  async function handleSaveTheme(themeKey, group) {
    setErrorMsg("");
    setInfoMsg("");
    setSavingThemeKey(themeKey);

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available");

      const themeDraft = themeDrafts[themeKey] || {};
      const { year, leagues } = group;

      const first = leagues[0] || {};
      const currentThemeName =
        first.theme_name || first.kind || group.theme_name || "Untitled Theme";
      const currentBlurb = first.theme_blurb || "";

      const theme_name =
        (themeDraft.theme_name && themeDraft.theme_name.trim()) ||
        currentThemeName;
      const theme_blurb =
        (themeDraft.theme_blurb && themeDraft.theme_blurb.trim()) ||
        currentBlurb ||
        null;

      const existingPayloads = [];
      const newPayloads = [];

      // ---------- Existing leagues (have id) ----------
      for (const lg of leagues) {
        const draftLg = leagueDrafts[lg.id] || {};

        const name =
          (draftLg.name !== undefined ? draftLg.name : lg.name) || "";
        const status =
          draftLg.status !== undefined
            ? draftLg.status
            : lg.status || "FULL & ACTIVE";
        const sleeper_urlRaw =
          draftLg.sleeper_url !== undefined
            ? draftLg.sleeper_url
            : lg.sleeper_url || "";
        const image_urlRaw =
          draftLg.image_url !== undefined
            ? draftLg.image_url
            : lg.image_url || "";
        const fill_noteRaw =
          draftLg.fill_note !== undefined
            ? draftLg.fill_note
            : lg.fill_note || "";
        const noteRaw =
          draftLg.note !== undefined ? draftLg.note : lg.note || "";
        const display_orderRaw =
          draftLg.display_order !== undefined
            ? draftLg.display_order
            : lg.display_order ?? null;
        const is_active =
          draftLg.is_active !== undefined
            ? draftLg.is_active
            : lg.is_active ?? true;
        const is_orphan =
          draftLg.is_orphan !== undefined
            ? draftLg.is_orphan
            : lg.is_orphan ?? false;

        existingPayloads.push({
          id: lg.id, // ← existing row ID
          year,
          theme_name,
          theme_blurb,
          name: name.trim(),
          status,
          sleeper_url: sleeper_urlRaw.trim() || null,
          image_url: image_urlRaw.trim() || null,
          fill_note: fill_noteRaw.trim() || null,
          note: noteRaw.trim() || null,
          display_order:
            display_orderRaw === "" || display_orderRaw == null
              ? null
              : Number(display_orderRaw) || null,
          is_active: !!is_active,
          is_orphan: !!is_orphan || status === "ORPHAN OPEN",
        });
      }

      // ---------- New leagues (no id yet) ----------
      const newList = newLeaguesByTheme[themeKey] || [];
      for (const nl of newList) {
        const name = (nl.name || "").trim();
        const sleeper_url = (nl.sleeper_url || "").trim();

        // If completely empty, skip
        if (!name && !sleeper_url) continue;

        const status = nl.status || "FULL & ACTIVE";
        const image_url = (nl.image_url || "").trim();
        const fill_note = (nl.fill_note || "").trim();
        const note = (nl.note || "").trim();
        const display_order =
          nl.display_order === "" || nl.display_order == null
            ? null
            : Number(nl.display_order) || null;
        const is_active = nl.is_active ?? true;
        const is_orphan = nl.is_orphan ?? false;

        newPayloads.push({
          year,
          theme_name,
          theme_blurb,
          name,
          status,
          sleeper_url: sleeper_url || null,
          image_url: image_url || null,
          fill_note: fill_note || null,
          note: note || null,
          display_order,
          is_active: !!is_active,
          is_orphan: !!is_orphan || status === "ORPHAN OPEN",
        });
      }

      if (existingPayloads.length === 0 && newPayloads.length === 0) {
        setSavingThemeKey(null);
        return;
      }

      // ---------- Save existing first ----------
      if (existingPayloads.length > 0) {
        const { error: upsertError } = await supabase
          .from("dynasty_leagues")
          .upsert(existingPayloads)
          .select("*");
        if (upsertError) throw upsertError;
      }

      // ---------- Then insert brand-new rows (no id) ----------
      if (newPayloads.length > 0) {
        const { error: insertError } = await supabase
          .from("dynasty_leagues")
          .insert(newPayloads)
          .select("*");
        if (insertError) throw insertError;
      }

      await reloadRows();
      resetThemeDraft(themeKey, group.leagues);
      setInfoMsg(`Saved changes for ${year} – ${theme_name}.`);
    } catch (err) {
      console.error("Failed to save theme:", err);
      const msg =
        err?.message ||
        err?.error_description ||
        "Failed to save theme. Check console and Supabase table columns.";
      setErrorMsg(msg);
    } finally {
      setSavingThemeKey(null);
    }
  }

  // Quick-create season / theme (same logic as old page)
  async function handleQuickCreate(e) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available");

      const year = Number(quick.year) || new Date().getFullYear();
      const themeName = quick.theme_name.trim();
      const themeBlurb = quick.theme_blurb.trim() || null;
      const baseStatus = quick.base_status || "CURRENTLY FILLING";
      const baseFillNote = quick.base_fill_note.trim() || null;

      const names = quick.division_names
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!themeName) {
        alert("Please enter a theme name.");
        return;
      }
      if (names.length === 0) {
        alert("Please enter at least one league name (one per line).");
        return;
      }

      const rowsToInsert = names.map((name, idx) => ({
        name,
        year,
        theme_name: themeName,
        theme_blurb: themeBlurb,
        status: baseStatus,
        fill_note: baseFillNote,
        display_order: idx + 1,
        is_active: true,
        is_orphan: baseStatus === "ORPHAN OPEN",
      }));

      setQuickSaving(true);
      const { error } = await supabase
        .from("dynasty_leagues")
        .insert(rowsToInsert);
      if (error) throw error;

      setQuickOpen(false);
      setQuick({
        year: new Date().getFullYear(),
        theme_name: "",
        theme_blurb: "",
        base_status: "CURRENTLY FILLING",
        base_fill_note: "",
        division_names: "",
      });

      await reloadRows();
      setInfoMsg(
        `Created ${names.length} leagues under ${year} – ${themeName}.`
      );
    } catch (err) {
      console.error("Failed to quick-create season:", err);
      setErrorMsg("Failed to quick-create season. Check console for details.");
    } finally {
      setQuickSaving(false);
    }
  }

  // ---------- render ----------

  if (loading) {
    return <p className="text-sm text-muted">Loading Dynasty leagues…</p>;
  }

  return (
    <section className="space-y-8">
      {(errorMsg || infoMsg) && (
        <div className="space-y-1 text-sm">
          {errorMsg && <p className="text-danger">{errorMsg}</p>}
          {infoMsg && !errorMsg && <p className="text-accent">{infoMsg}</p>}
        </div>
      )}

      {/* QUICK CREATE CARD */}
      <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              Quick create season &amp; theme
            </h2>
            <p className="text-xs text-muted max-w-prose">
              Use this when you launch a new year of Dynasty – it will create
              all leagues for a theme at once, with the same status and theme
              description. You can edit leagues inside the theme accordion
              below.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setQuickOpen(true)}
          >
            New Year / Theme
          </button>
        </div>
      </div>

      {/* EXISTING THEMES / ACCORDIONS */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Existing themes &amp; leagues</h2>

        {groups.length === 0 ? (
          <p className="text-sm text-muted">
            No rows found in <code>dynasty_leagues</code> yet.
          </p>
        ) : (
          groups.map((group) => {
            const { key, year, theme_name, leagues } = group;
            const open = openThemes.has(key);
            const isDirty = dirtyThemes.has(key);

            // Theme-level drafts
            const draft = themeDrafts[key] || {};
            const currentBlurb = leagues[0]?.theme_blurb || "";
            const themeNameDraft = draft.theme_name ?? theme_name;
            const themeBlurbDraft = draft.theme_blurb ?? currentBlurb;

            // Status / orphan counts
            const statusCounts = {
              "FULL & ACTIVE": 0,
              "CURRENTLY FILLING": 0,
              DRAFTING: 0,
              "ORPHAN OPEN": 0,
              INACTIVE: 0,
            };
            let orphanCount = 0;
            let activeCount = 0;

            for (const lg of leagues) {
              const d = leagueDrafts[lg.id] || {};
              const st = (d.status ?? lg.status ?? "").toUpperCase();
              const norm =
                STATUS_OPTIONS.find((s) => s.toUpperCase() === st) || "INACTIVE";
              statusCounts[norm] = (statusCounts[norm] || 0) + 1;
              const isOrphan = d.is_orphan ?? lg.is_orphan ?? false;
              const isActive = d.is_active ?? (lg.is_active !== false);
              if (isOrphan || norm === "ORPHAN OPEN") orphanCount++;
              if (isActive) activeCount++;
            }

            const newList = newLeaguesByTheme[key] || [];
            const totalLeagues = leagues.length + newList.length;

            return (
              <div
                key={key}
                className="rounded-2xl border border-subtle bg-card-surface"
              >
                {/* Accordion header */}
                <button
                  type="button"
                  onClick={() => toggleTheme(key, leagues)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-panel/70 transition"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-accent">
                      {year} · {themeNameDraft}
                    </p>
                    <p className="text-[11px] text-muted">
                      {totalLeagues} leagues · Active: {activeCount} · Orphans:{" "}
                      {orphanCount}
                      {isDirty && (
                        <span className="ml-2 text-[10px] text-warning">
                          (Unsaved changes)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px] text-muted">
                    <span>
                      Full: {statusCounts["FULL & ACTIVE"]} · Filling:{" "}
                      {statusCounts["CURRENTLY FILLING"]} · Drafting:{" "}
                      {statusCounts["DRAFTING"]} · Inactive:{" "}
                      {statusCounts["INACTIVE"]}
                    </span>
                    <span>{open ? "Collapse ▲" : "Expand ▼"}</span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-subtle px-4 py-4 space-y-5 text-xs">
                    {/* Theme-level fields */}
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                      <div className="flex flex-col gap-1">
                        <span className="label text-[11px]">
                          Theme name (for this year)
                        </span>
                        <input
                          className="input !h-8 !py-1 text-[11px]"
                          value={themeNameDraft}
                          onChange={(e) => {
                            const value = e.target.value;
                            setThemeDrafts((prev) => ({
                              ...prev,
                              [key]: {
                                ...(prev[key] || {}),
                                theme_name: value,
                                theme_blurb: themeBlurbDraft,
                              },
                            }));
                            markThemeDirty(key);
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="label text-[11px]">Season year</span>
                        <input
                          className="input !h-8 !py-1 text-[11px]"
                          value={year}
                          disabled
                        />
                        <span className="text-[10px] text-muted">
                          Year is fixed per theme; use Quick Create for new
                          seasons.
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="label text-[11px]">
                        Theme description (blurb)
                      </span>
                      <textarea
                        className="input min-h-[48px] text-[11px]"
                        value={themeBlurbDraft}
                        onChange={(e) => {
                          const value = e.target.value;
                          setThemeDrafts((prev) => ({
                            ...prev,
                            [key]: {
                              ...(prev[key] || {}),
                              theme_name: themeNameDraft,
                              theme_blurb: value,
                            },
                          }));
                          markThemeDirty(key);
                        }}
                        placeholder="Short description for this year's theme. Shown above the league tiles."
                      />
                    </div>

                    {/* League table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-y-1">
                        <thead className="text-[11px] text-muted">
                          <tr>
                            <th className="text-left px-2 py-1">#</th>
                            <th className="text-left px-2 py-1">League</th>
                            <th className="text-left px-2 py-1">Status</th>
                            <th className="text-left px-2 py-1">
                              Fill note(optional)
                            </th>
                            <th className="text-left px-2 py-1">Orphan</th>
                            <th className="text-left px-2 py-1">Active</th>
                            <th className="text-left px-2 py-1">
                              Sleeper URL
                            </th>
                            <th className="text-left px-2 py-1">
                              Image URL (optional)
                            </th>
                            <th className="text-left px-2 py-1">
                              Note (optional)
                            </th>
                            <th className="text-left px-2 py-1">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Existing leagues */}
                          {leagues.map((lg) => {
                            const draftLg = leagueDrafts[lg.id] || {};

                            const display_order =
                              draftLg.display_order ??
                              (lg.display_order ?? "");
                            const name =
                              draftLg.name ?? (lg.name || "");
                            const status =
                              draftLg.status ?? (lg.status || "FULL & ACTIVE");
                            const fill_note =
                              draftLg.fill_note ??
                              (lg.fill_note || "");
                            const is_orphan =
                              draftLg.is_orphan ??
                              (lg.is_orphan ?? false);
                            const is_active =
                              draftLg.is_active ??
                              (lg.is_active !== false);
                            const sleeper_url =
                              draftLg.sleeper_url ??
                              (lg.sleeper_url || "");
                            const image_url =
                              draftLg.image_url ??
                              (lg.image_url || "");
                            const note =
                              draftLg.note ??
                              (lg.note || "");

                            return (
                              <tr
                                key={lg.id}
                                className="bg-panel border border-subtle/60"
                              >
                                <td className="px-2 py-1 align-middle w-[52px]">
                                  <input
                                    className="input !py-0 !h-7 w-14 text-[11px]"
                                    type="number"
                                    min={1}
                                    value={display_order}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          display_order: value,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle min-w-[160px]">
                                  <input
                                    className="input !py-0 !h-7 text-[11px]"
                                    placeholder="League name"
                                    value={name}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          name: value,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle w-[150px]">
                                  <select
                                    className="input !py-0 !h-7 text-[11px]"
                                    value={status}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          status: value,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  >
                                    {STATUS_OPTIONS.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                <td className="px-2 py-1 align-middle min-w-[50px]">
                                  <input
                                    className="input !py-0 !h-7 text-[11px]"
                                    placeholder="e.g. 7/12 filled - Drafting Soon!"
                                    value={fill_note}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          fill_note: value,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle w-[60px] text-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={!!is_orphan || status === "ORPHAN OPEN"}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          is_orphan: checked,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle w-[60px] text-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={is_active}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          is_active: checked,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle min-w-[175px]">
                                  <input
                                    className="input !py-0 !h-7 text-[11px] font-mono"
                                    placeholder="https://sleeper.app/leagues/..."
                                    value={sleeper_url}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          sleeper_url: value,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle min-w-[140px]">
                                  <input
                                    className="input !py-0 !h-7 text-[11px] font-mono"
                                    placeholder="/photos/dynasty.webp"
                                    value={image_url}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          image_url: value,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle min-w-[100px]">
                                  <input
                                    className="input !py-0 !h-7 text-[11px]"
                                    placeholder="Extra Info"
                                    value={note}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          note: value,
                                        },
                                      }));
                                      markThemeDirty(key);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle w-[90px]">
                                  <button
                                    type="button"
                                    className="text-danger underline underline-offset-2 text-[11px]"
                                    onClick={() =>
                                      handleDeleteLeague(lg.id, key, leagues)
                                    }
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                          {/* New leagues (not saved yet) */}
                          {newList.map((nl) => (
                            <tr
                              key={nl._localId}
                              className="bg-panel/60 border border-subtle/60"
                            >
                              <td className="px-2 py-1 align-middle w-[52px]">
                                <input
                                  className="input !py-0 !h-7 w-14 text-[11px]"
                                  type="number"
                                  min={1}
                                  value={nl.display_order ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? {
                                                ...row,
                                                display_order: value,
                                              }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                />
                              </td>

                              <td className="px-2 py-1 align-middle min-w-[160px]">
                                <input
                                  className="input !py-0 !h-7 text-[11px]"
                                  placeholder="League name"
                                  value={nl.name}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? { ...row, name: value }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                />
                              </td>

                              <td className="px-2 py-1 align-middle w-[150px]">
                                <select
                                  className="input !py-0 !h-7 text-[11px]"
                                  value={nl.status}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? { ...row, status: value }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                >
                                  {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="px-2 py-1 align-middle min-w-[150px]">
                                <input
                                  className="input !py-0 !h-7 text-[11px]"
                                  placeholder="e.g. 7/12 filled"
                                  value={nl.fill_note}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? { ...row, fill_note: value }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                />
                              </td>

                              <td className="px-2 py-1 align-middle w-[60px] text-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={!!nl.is_orphan || nl.status === "ORPHAN OPEN"}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? { ...row, is_orphan: checked }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                />
                              </td>

                              <td className="px-2 py-1 align-middle w-[60px] text-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={nl.is_active ?? true}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? { ...row, is_active: checked }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                />
                              </td>

                              <td className="px-2 py-1 align-middle min-w-[200px]">
                                <input
                                  className="input !py-0 !h-7 text-[11px] font-mono"
                                  placeholder="https://sleeper.app/leagues/..."
                                  value={nl.sleeper_url}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? { ...row, sleeper_url: value }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                />
                              </td>

                              <td className="px-2 py-1 align-middle min-w-[180px]">
                                <input
                                  className="input !py-0 !h-7 text-[11px] font-mono"
                                  placeholder="/photos/dynasty.webp"
                                  value={nl.image_url}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? { ...row, image_url: value }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                />
                              </td>

                              <td className="px-2 py-1 align-middle min-w-[180px]">
                                <input
                                  className="input !py-0 !h-7 text-[11px]"
                                  placeholder="Internal admin note"
                                  value={nl.note}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setNewLeaguesByTheme((prev) => {
                                      const list = prev[key] || [];
                                      return {
                                        ...prev,
                                        [key]: list.map((row) =>
                                          row._localId === nl._localId
                                            ? { ...row, note: value }
                                            : row
                                        ),
                                      };
                                    });
                                    markThemeDirty(key);
                                  }}
                                />
                              </td>

                              <td className="px-2 py-1 align-middle w-[90px]">
                                <button
                                  type="button"
                                  className="text-danger underline underline-offset-2 text-[11px]"
                                  onClick={() => handleRemoveNewLeague(key, nl._localId)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Theme controls */}
                    <div className="pt-3 mt-2 border-t border-subtle/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
                      <p className="text-muted">
                        {isDirty
                          ? "You have unsaved changes for this theme."
                          : "No unsaved changes for this theme."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-outline text-xs"
                          onClick={() => handleAddNewLeague(key, group)}
                        >
                          + Add league row
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline text-xs"
                          disabled={!isDirty || savingThemeKey === key}
                          onClick={() => resetThemeDraft(key, leagues)}
                        >
                          Reset changes
                        </button>

                        {/* Danger zone like Big Game: theme delete */}
                        {themeToDeleteKey === key ? (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-danger font-semibold">
                                This will permanently delete this theme and all leagues.
                              </span>
                              <span className="text-[10px] text-muted">
                                Type <span className="font-mono">ballsville</span> to confirm.
                              </span>
                              <input
                                className="input !h-7 !py-1 text-[11px] font-mono sm:max-w-[200px]"
                                value={themeDeleteInput}
                                onChange={(e) =>
                                  setThemeDeleteInput(e.target.value)
                                }
                                placeholder="ballsville"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn btn-primary text-xs"
                                disabled={deletingThemeKey === key}
                                onClick={() => handleDeleteTheme(key, group)}
                              >
                                {deletingThemeKey === key
                                  ? "Deleting…"
                                  : "Confirm delete"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline text-xs"
                                onClick={() => {
                                  setThemeToDeleteKey(null);
                                  setThemeDeleteInput("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline text-xs text-danger"
                            onClick={() => {
                              setThemeToDeleteKey(key);
                              setThemeDeleteInput("");
                            }}
                          >
                            Delete theme (all leagues)…
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-primary text-xs"
                          disabled={!isDirty || savingThemeKey === key}
                          onClick={() => handleSaveTheme(key, group)}
                        >
                          {savingThemeKey === key ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* QUICK CREATE MODAL */}
      {quickOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="card bg-bg border border-subtle max-w-lg w-full mx-4 p-6 space-y-4 relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-primary">
                New Season / Theme
              </h2>
              <button
                type="button"
                className="text-muted hover:text-fg"
                onClick={() => setQuickOpen(false)}
              >
                ✕
              </button>
            </div>

            <form className="space-y-3 text-sm" onSubmit={handleQuickCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-muted">Season year *</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                    value={quick.year}
                    onChange={(e) =>
                      setQuick((q) => ({ ...q, year: e.target.value }))
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-xs text-muted">Base status *</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                    value={quick.base_status}
                    onChange={(e) =>
                      setQuick((q) => ({ ...q, base_status: e.target.value }))
                    }
                  >
                    {["FULL & ACTIVE", "CURRENTLY FILLING", "DRAFTING"].map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-muted">Theme name *</span>
                <input
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                  placeholder="e.g. Heroes & Dragons of Dynasty"
                  value={quick.theme_name}
                  onChange={(e) =>
                    setQuick((q) => ({ ...q, theme_name: e.target.value }))
                  }
                />
              </label>

              <label className="block">
                <span className="text-xs text-muted">
                  Theme description (blurb)
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2 min-h-[80px]"
                  placeholder="Short description for this year's theme. Shown above the league tiles."
                  value={quick.theme_blurb}
                  onChange={(e) =>
                    setQuick((q) => ({ ...q, theme_blurb: e.target.value }))
                  }
                />
              </label>

              <label className="block">
                <span className="text-xs text-muted">
                  Base fill note (optional)
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                  placeholder="e.g. All 12 are currently filling from the waitlist."
                  value={quick.base_fill_note}
                  onChange={(e) =>
                    setQuick((q) => ({
                      ...q,
                      base_fill_note: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="block">
                <span className="text-xs text-muted">
                  League names (one per line) *
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2 min-h-[120px]"
                  placeholder={"League 1 name\nLeague 2 name\nLeague 3 name"}
                  value={quick.division_names}
                  onChange={(e) =>
                    setQuick((q) => ({
                      ...q,
                      division_names: e.target.value,
                    }))
                  }
                />
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setQuickOpen(false)}
                  disabled={quickSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={quickSaving}
                >
                  {quickSaving ? "Creating…" : "Create Season"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
