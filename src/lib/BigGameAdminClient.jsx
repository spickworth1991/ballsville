// src/lib/BigGameAdminClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

const DIVISION_STATUS_OPTIONS = ["FULL", "FILLING", "DRAFTING", "TBD", "PRIVATE"];
const LEAGUE_STATUS_OPTIONS = ["FULL", "FILLING", "DRAFTING", "TBD"];

function groupByDivision(rows) {
  const map = new Map();

  for (const row of rows) {
    const name = row.division_name || "Untitled Division";
    if (!map.has(name)) {
      map.set(name, {
        header: null,
        leagues: [],
      });
    }
    const bucket = map.get(name);
    if (row.is_division_header) {
      bucket.header = row;
    } else {
      bucket.leagues.push(row);
    }
  }

  // Sort leagues by display_order then league_name
  for (const [, bucket] of map.entries()) {
    bucket.leagues.sort((a, b) => {
      const da = a.display_order ?? 999;
      const db = b.display_order ?? 999;
      if (da !== db) return da - db;
      return (a.league_name || "").localeCompare(b.league_name || "");
    });
  }

  return Array.from(map.entries())
    .map(([division_name, bucket]) => ({
      division_name,
      header: bucket.header,
      leagues: bucket.leagues,
    }))
    .sort((a, b) => a.division_name.localeCompare(b.division_name));
}

export default function BigGameAdminClient() {
  const currentYear = new Date().getFullYear(); // used only as a filter

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Accordion open/closed
  const [openDivisions, setOpenDivisions] = useState(() => new Set());

  // Draft edits (unsaved)
  const [divisionDrafts, setDivisionDrafts] = useState({});
  const [leagueDrafts, setLeagueDrafts] = useState({});
  const [dirtyDivisions, setDirtyDivisions] = useState(() => new Set());

  // Division create form
  const [creatingDivision, setCreatingDivision] = useState(false);
  const [newDivision, setNewDivision] = useState({
    division_name: "",
    division_status: "TBD",
    division_image_path: "",
    division_blurb: "",
    division_order: "",
  });

  // Division delete confirmation
  const [divisionToDelete, setDivisionToDelete] = useState(null);
  const [divisionDeleteInput, setDivisionDeleteInput] = useState("");
  const [deletingDivisionName, setDeletingDivisionName] = useState(null);

  // Saving state per-division
  const [savingDivisionName, setSavingDivisionName] = useState(null);

  // Load rows for current season
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
          .from("biggame_leagues")
          .select("*")
          .eq("year", currentYear)
          .order("division_name", { ascending: true })
          .order("is_division_header", { ascending: false })
          .order("display_order", { ascending: true });

        if (error) throw error;

        if (!cancelled) {
          setRows(data || []);
        }
      } catch (err) {
        console.error("Failed to load biggame_leagues:", err);
        if (!cancelled) {
          setErrorMsg("Unable to load Big Game leagues from Supabase.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  const divisions = useMemo(() => groupByDivision(rows), [rows]);

  function markDivisionDirty(divisionName) {
    setDirtyDivisions((prev) => {
      const next = new Set(prev);
      next.add(divisionName);
      return next;
    });
  }

  function handleNewDivisionField(field, value) {
    setNewDivision((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateDivision(e) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setCreatingDivision(true);

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available");

      const division_name = newDivision.division_name.trim();
      if (!division_name) {
        setErrorMsg("Division name is required.");
        setCreatingDivision(false);
        return;
      }

      const division_status = newDivision.division_status || "FILLING";
      const division_image_path =
        newDivision.division_image_path.trim() || null;
      const division_blurb = newDivision.division_blurb.trim() || null;
      const division_order =
        newDivision.division_order === "" ||
        newDivision.division_order == null
          ? null
          : Number(newDivision.division_order) || null;

      // Header row
      const payloads = [
        {
          year: currentYear,
          division_name,
          division_status,
          division_image_path,
          division_blurb,
          division_order,
          league_name: null,
          league_url: null,
          league_image_path: null,
          display_order: null,
          is_active: true,
          is_division_header: true,
          spots_available: null,
          league_status: null,
        },
      ];

      // Eight empty league slots
      for (let i = 1; i <= 8; i++) {
        payloads.push({
          year: currentYear,
          division_name,
          division_status,
          division_image_path,
          division_blurb,
          division_order: null, // division_order lives on the header only
          league_name: "",
          league_url: "",
          league_image_path: null,
          display_order: i,
          is_active: false,
          is_division_header: false,
          spots_available: null,
          league_status: division_status,
        });
      }

      const { data, error } = await supabase
        .from("biggame_leagues")
        .insert(payloads)
        .select("*");

      if (error) throw error;

      setRows((prev) => [...prev, ...(data || [])]);
      setInfoMsg(`Division "${division_name}" created with 8 league slots.`);

      setNewDivision({
        division_name: "",
        division_status: "FILLING",
        division_image_path: "",
        division_blurb: "",
        division_order: "",
      });

      setOpenDivisions((prev) => {
        const next = new Set(prev);
        next.add(division_name);
        return next;
      });
    } catch (err) {
      console.error("Failed to create division:", err);
      setErrorMsg("Failed to create division. Check console for details.");
    } finally {
      setCreatingDivision(false);
    }
  }

  function handleResetDivisionDraft(divisionName, leagues) {
    setDivisionDrafts((prev) => {
      const copy = { ...prev };
      delete copy[divisionName];
      return copy;
    });
    setLeagueDrafts((prev) => {
      const copy = { ...prev };
      for (const lg of leagues) {
        delete copy[lg.id];
      }
      return copy;
    });
    setDirtyDivisions((prev) => {
      const next = new Set(prev);
      next.delete(divisionName);
      return next;
    });
  }

  function toggleDivision(divisionName, leagues = []) {
    setOpenDivisions((prev) => {
      const isOpen = prev.has(divisionName);
      const next = new Set(prev);

      if (isOpen && dirtyDivisions.has(divisionName)) {
        const discard = window.confirm(
          "You have unsaved changes in this division.\n\nOK = Discard changes and collapse.\nCancel = Keep editing."
        );
        if (!discard) {
          return prev; // keep open, keep drafts
        }
        // discard drafts for this division
        handleResetDivisionDraft(divisionName, leagues);
      }

      if (isOpen) {
        next.delete(divisionName);
      } else {
        next.add(divisionName);
      }
      return next;
    });
  }

  async function handleSaveDivision(divisionName, headerRow, leagues) {
    setErrorMsg("");
    setInfoMsg("");
    setSavingDivisionName(divisionName);

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available");

      const headerDraft = divisionDrafts[divisionName];

      // Build updated header row (if it exists)
      let newHeader = null;
      if (headerRow) {
        const currentStatus =
          headerRow.division_status || headerRow.status || "TBD";
        const currentImagePath =
          headerRow.division_image_path || headerRow.image_url || "";
        const currentBlurb = headerRow.division_blurb || "";
        const currentName = headerRow.division_name || divisionName;
        const currentOrder =
          headerRow.division_order === null ||
          headerRow.division_order === undefined
            ? null
            : Number(headerRow.division_order) || null;

        // Name
        const division_name =
          (headerDraft &&
            "division_name" in headerDraft &&
            headerDraft.division_name.trim()) ||
          currentName;

        // Status
        const division_status =
          (headerDraft && headerDraft.division_status) ||
          currentStatus;

        // Artwork path – only overwrite if explicitly present in draft
        const draftImageRaw =
          headerDraft && "division_image_path" in headerDraft
            ? headerDraft.division_image_path
            : currentImagePath;
        const division_image_path = draftImageRaw
          ? draftImageRaw.trim()
          : null;

        // Blurb – same “only if present” logic
        const draftBlurbRaw =
          headerDraft && "division_blurb" in headerDraft
            ? headerDraft.division_blurb
            : currentBlurb;
        const division_blurb =
          draftBlurbRaw && draftBlurbRaw.trim()
            ? draftBlurbRaw.trim()
            : null;

        // Order – only overwrite if present in draft
        const draftOrderRaw =
          headerDraft && "division_order" in headerDraft
            ? headerDraft.division_order
            : currentOrder;
        const division_order =
          draftOrderRaw === "" || draftOrderRaw == null
            ? null
            : Number(draftOrderRaw) || null;

        newHeader = {
          ...headerRow,
          division_name,
          division_status,
          division_image_path,
          division_blurb,
          division_order,
        };
      }

      const rowsToUpsert = [];
      if (newHeader) rowsToUpsert.push(newHeader);

      // Build updated league rows
      for (const lg of leagues) {
        const draft = leagueDrafts[lg.id];

        const baseStatus = lg.league_status || "TBD";
        const league_status = draft?.league_status || baseStatus;
        const leagueIsFilling = league_status === "FILLING";

        const updated = {
          ...lg,
          // Keep division_order NULL for league rows; header owns the order
          division_name: newHeader?.division_name || lg.division_name,
          display_order:
            draft && "display_order" in draft
              ? draft.display_order === "" || draft.display_order == null
                ? null
                : Number(draft.display_order) || null
              : lg.display_order,
          league_name:
            draft && "league_name" in draft
              ? draft.league_name
              : lg.league_name,
          league_status,
          league_url:
            draft && "league_url" in draft
              ? draft.league_url
              : lg.league_url,
          league_image_path:
            draft && "league_image_path" in draft
              ? draft.league_image_path || null
              : lg.league_image_path,
          spots_available: leagueIsFilling
            ? draft && "spots_available" in draft
              ? draft.spots_available === "" || draft.spots_available == null
                ? null
                : Number(draft.spots_available) || null
              : lg.spots_available ?? null
            : null,
          is_active:
            draft && "is_active" in draft
              ? draft.is_active
              : lg.is_active,
        };

        rowsToUpsert.push(updated);
      }

      if (rowsToUpsert.length === 0) {
        setSavingDivisionName(null);
        return;
      }

      const { data, error } = await supabase
        .from("biggame_leagues")
        .upsert(rowsToUpsert)
        .select("*");

      if (error) throw error;

      const updatedMap = new Map(data.map((r) => [r.id, r]));
      setRows((prev) => prev.map((r) => updatedMap.get(r.id) || r));

      // Clear drafts + dirty state for this division
      handleResetDivisionDraft(divisionName, leagues);

      const newName =
        (newHeader && newHeader.division_name) || divisionName;
      setInfoMsg(`Saved changes for "${newName}".`);
    } catch (err) {
      console.error("Failed to save division:", err);
      setErrorMsg("Failed to save division. Check console for details.");
    } finally {
      setSavingDivisionName(null);
    }
  }

  async function handleDeleteDivision(divisionName) {
    setErrorMsg("");
    setInfoMsg("");

    if (divisionDeleteInput.trim().toLowerCase() !== "ballsville") {
      setErrorMsg('To delete a division, type "ballsville" exactly.');
      return;
    }

    setDeletingDivisionName(divisionName);

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available");

      const { error } = await supabase
        .from("biggame_leagues")
        .delete()
        .eq("year", currentYear)
        .eq("division_name", divisionName);

      if (error) throw error;

      setRows((prev) =>
        prev.filter(
          (r) => !(r.year === currentYear && r.division_name === divisionName)
        )
      );

      // Clean up local state for that division
      setDivisionDrafts((prev) => {
        const copy = { ...prev };
        delete copy[divisionName];
        return copy;
      });
      setLeagueDrafts((prev) => {
        const copy = { ...prev };
        return copy; // leagues already removed via setRows
      });
      setDirtyDivisions((prev) => {
        const next = new Set(prev);
        next.delete(divisionName);
        return next;
      });
      setOpenDivisions((prev) => {
        const next = new Set(prev);
        next.delete(divisionName);
        return next;
      });

      setInfoMsg(`Division "${divisionName}" deleted.`);
      setDivisionToDelete(null);
      setDivisionDeleteInput("");
    } catch (err) {
      console.error("Failed to delete division:", err);
      setErrorMsg("Failed to delete division. Check console for details.");
    } finally {
      setDeletingDivisionName(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading leagues…</p>;
  }

  return (
    <section className="space-y-8">
      {(errorMsg || infoMsg) && (
        <div className="space-y-1 text-sm">
          {errorMsg && <p className="text-danger">{errorMsg}</p>}
          {infoMsg && !errorMsg && <p className="text-accent">{infoMsg}</p>}
        </div>
      )}

      {/* CREATE DIVISION */}
      <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-4">
        <h2 className="text-lg font-semibold">Add a new division</h2>
        <p className="text-xs text-muted">
          This will create a division header and{" "}
          <span className="font-semibold">exactly 8 blank league slots</span> for
          the current season.
        </p>

        <form onSubmit={handleCreateDivision} className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_0.9fr]">
            <label className="flex flex-col gap-1 md:col-span-1">
              <span className="label">Division name</span>
              <input
                className="input"
                placeholder="Game of Thrones"
                value={newDivision.division_name}
                onChange={(e) =>
                  handleNewDivisionField("division_name", e.target.value)
                }
              />
              <span className="text-[11px] text-muted">
                This is what shows on the public Big Game page.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="label">Status</span>
              <select
                className="input"
                value={newDivision.division_status}
                onChange={(e) =>
                  handleNewDivisionField("division_status", e.target.value)
                }
              >
                {DIVISION_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted">
                Shown as a badge over the artwork.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="label">Division # (order)</span>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="1"
                value={newDivision.division_order}
                onChange={(e) =>
                  handleNewDivisionField("division_order", e.target.value)
                }
              />
              <span className="text-[11px] text-muted">
                Controls the D1 / D2 label and card ordering.
              </span>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
            <label className="flex flex-col gap-1">
              <span className="label">Division artwork path</span>
              <input
                className="input"
                placeholder="/photos/biggame/game-of-thrones.jpg"
                value={newDivision.division_image_path}
                onChange={(e) =>
                  handleNewDivisionField(
                    "division_image_path",
                    e.target.value
                  )
                }
              />
              <span className="text-[11px] text-muted">
                Path under <code>public/</code>. Leagues inherit this unless
                overridden.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="label">Division blurb (optional)</span>
              <textarea
                className="input min-h-[60px]"
                placeholder="Short description for this division’s vibe."
                value={newDivision.division_blurb}
                onChange={(e) =>
                  handleNewDivisionField("division_blurb", e.target.value)
                }
              />
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingDivision}
            >
              {creatingDivision ? "Creating…" : "Add division + 8 leagues"}
            </button>
          </div>
        </form>
      </div>

      {/* EXISTING DIVISIONS */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Existing divisions</h2>

        {divisions.length === 0 ? (
          <p className="text-sm text-muted">
            No rows found in <code>biggame_leagues</code> for the current
            season.
          </p>
        ) : (
          divisions.map(({ division_name, header, leagues }) => {
            const count = leagues.length;
            const needs = 8 - count;
            const open = openDivisions.has(division_name);

            const currentStatus =
              header?.division_status || header?.status || "TBD";
            const currentImagePath =
              header?.division_image_path || header?.image_url || "";
            const currentBlurb = header?.division_blurb || "";
            const currentName = header?.division_name || division_name;
            const currentOrderRaw =
              header?.division_order === null ||
              header?.division_order === undefined
                ? ""
                : String(header.division_order);

            const draft = divisionDrafts[division_name];
            const draftName = draft?.division_name ?? currentName;
            const draftStatus = draft?.division_status ?? currentStatus;
            const draftImagePath =
              draft?.division_image_path ?? currentImagePath;
            const draftBlurb = draft?.division_blurb ?? currentBlurb;
            const draftOrder = draft?.division_order ?? currentOrderRaw;

            const isDirty = dirtyDivisions.has(division_name);

            // Aggregate league status counts (respecting unsaved drafts)
            const statusCounts = {
              DRAFTING: 0,
              TBD: 0,
              FULL: 0,
              FILLING: 0,
            };

            for (const lg of leagues) {
              const draftLg = leagueDrafts[lg.id] || {};
              const st = (draftLg.league_status || lg.league_status || "TBD").toUpperCase();
              if (statusCounts[st] !== undefined) {
                statusCounts[st] += 1;
              } else {
                statusCounts.TBD += 1;
              }
            }

            return (
              <div
                key={division_name}
                className="rounded-2xl border border-subtle bg-card-surface"
              >
                {/* Accordion header */}
                <button
                  type="button"
                  onClick={() => toggleDivision(division_name, leagues)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-panel/70 transition"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-accent">
                      {draftName}
                    </p>
                    <p className="text-[11px] text-muted">
                      {count}/8 leagues configured{" "}
                      {needs > 0 && (
                        <span className="text-warning">
                          · {needs} more needed
                        </span>
                      )}
                      {isDirty && (
                        <span className="ml-2 text-[10px] text-warning">
                          (Unsaved changes)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-5 sm:gap-1 sm:flex-row sm:items-center sm:justify-end sm:space-x-3">
                    <span className="text-[11px] text-muted text-right">
                      Drafting: {statusCounts.DRAFTING} · TBD:{" "}
                      {statusCounts.TBD} · Full: {statusCounts.FULL} · Filling:{" "}
                      {statusCounts.FILLING}
                    </span>

                    <span className="text-[11px] text-muted hidden sm:inline">
                      Artwork:{" "}
                      <span className="font-mono">
                        {draftImagePath || "—"}
                      </span>
                    </span>

                    <span className="text-xs text-muted">
                      {open ? "Collapse ▲" : "Expand ▼"}
                    </span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-subtle px-4 py-4 space-y-5">
                    {/* Division-level fields */}
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr_0.9fr] text-xs">
                      <label className="flex flex-col gap-1 md:col-span-3">
                        <span className="label">Division name</span>
                        <input
                          className="input !h-8 !py-1 text-[11px]"
                          value={draftName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDivisionDrafts((prev) => ({
                              ...prev,
                              [division_name]: {
                                ...(prev[division_name] || {
                                  division_name: currentName,
                                  division_status: currentStatus,
                                  division_image_path: currentImagePath,
                                  division_blurb: currentBlurb,
                                  division_order: currentOrderRaw,
                                }),
                                division_name: value,
                              },
                            }));
                            markDivisionDirty(division_name);
                          }}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="label">Division status</span>
                        <select
                          className="input !h-8 !py-1"
                          value={draftStatus}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDivisionDrafts((prev) => ({
                              ...prev,
                              [division_name]: {
                                ...(prev[division_name] || {
                                  division_name: currentName,
                                  division_status: currentStatus,
                                  division_image_path: currentImagePath,
                                  division_blurb: currentBlurb,
                                  division_order: currentOrderRaw,
                                }),
                                division_status: value,
                              },
                            }));
                            markDivisionDirty(division_name);
                          }}
                        >
                          {DIVISION_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="label">Division # (order)</span>
                        <input
                          className="input !h-8 !py-1 text-[11px]"
                          type="number"
                          min={1}
                          placeholder="1"
                          value={draftOrder}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDivisionDrafts((prev) => ({
                              ...prev,
                              [division_name]: {
                                ...(prev[division_name] || {
                                  division_name: currentName,
                                  division_status: currentStatus,
                                  division_image_path: currentImagePath,
                                  division_blurb: currentBlurb,
                                  division_order: currentOrderRaw,
                                }),
                                division_order: value,
                              },
                            }));
                            markDivisionDirty(division_name);
                          }}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="label">Artwork path</span>
                        <input
                          className="input !h-8 !py-1 text-[11px] font-mono"
                          value={draftImagePath}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDivisionDrafts((prev) => ({
                              ...prev,
                              [division_name]: {
                                ...(prev[division_name] || {
                                  division_name: currentName,
                                  division_status: currentStatus,
                                  division_image_path: currentImagePath,
                                  division_blurb: currentBlurb,
                                  division_order: currentOrderRaw,
                                }),
                                division_image_path: value,
                              },
                            }));
                            markDivisionDirty(division_name);
                          }}
                        />
                      </label>

                      <label className="flex flex-col gap-1 md:col-span-2">
                        <span className="label">Division blurb</span>
                        <textarea
                          className="input min-h-[48px]"
                          value={draftBlurb}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDivisionDrafts((prev) => ({
                              ...prev,
                              [division_name]: {
                                ...(prev[division_name] || {
                                  division_name: currentName,
                                  division_status: currentStatus,
                                  division_image_path: currentImagePath,
                                  division_blurb: currentBlurb,
                                  division_order: currentOrderRaw,
                                }),
                                division_blurb: value,
                              },
                            }));
                            markDivisionDirty(division_name);
                          }}
                        />
                      </label>
                    </div>

                    {/* League table */}
                    <div className="overflow-x-auto text-xs">
                      <table className="min-w-full border-separate border-spacing-y-1">
                        <thead className="text-[11px] text-muted">
                          <tr>
                            <th className="text-left px-2 py-1">#</th>
                            <th className="text-left px-2 py-1">League</th>
                            <th className="text-left px-2 py-1">Status</th>
                            <th className="text-left px-2 py-1">Link</th>
                            <th className="text-left px-2 py-1">
                              Image path
                            </th>
                            <th className="text-left px-2 py-1">
                              Spots avail.
                            </th>
                            <th className="text-left px-2 py-1">Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leagues.map((lg) => {
                            const baseStatus = lg.league_status || "TBD";
                            const draftLg = leagueDrafts[lg.id] || {};
                            const league_status =
                              draftLg.league_status ?? baseStatus;
                            const leagueIsFilling =
                              league_status === "FILLING";

                            const displayOrder =
                              draftLg.display_order ??
                              (lg.display_order ?? "");
                            const leagueName =
                              draftLg.league_name ?? (lg.league_name || "");
                            const leagueUrl =
                              draftLg.league_url ?? (lg.league_url || "");
                            const leagueImg =
                              draftLg.league_image_path ??
                              (lg.league_image_path || "");
                            const spots =
                              draftLg.spots_available ??
                              (lg.spots_available ?? "");
                            const isActive =
                              draftLg.is_active ?? (lg.is_active !== false);

                            return (
                              <tr
                                key={lg.id}
                                className="bg-panel border border-subtle/60"
                              >
                                <td className="px-2 py-1 align-middle w-[40px]">
                                  <input
                                    className="input !py-0 !h-7 w-14 text-[11px]"
                                    type="number"
                                    min={1}
                                    max={8}
                                    value={displayOrder}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          display_order: value,
                                        },
                                      }));
                                      markDivisionDirty(division_name);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle">
                                  <input
                                    className="input !py-0 !h-7 text-[11px]"
                                    placeholder="League name"
                                    value={leagueName}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          league_name: value,
                                        },
                                      }));
                                      markDivisionDirty(division_name);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle w-[120px]">
                                  <select
                                    className="input !py-0 !h-7 text-[11px]"
                                    value={league_status}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          league_status: value,
                                        },
                                      }));
                                      markDivisionDirty(division_name);
                                    }}
                                  >
                                    {LEAGUE_STATUS_OPTIONS.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                <td className="px-2 py-1 align-middle min-w-[180px]">
                                  <input
                                    className="input !py-0 !h-7 text-[11px] font-mono"
                                    placeholder="https://sleeper.app/leagues/..."
                                    value={leagueUrl}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          league_url: value,
                                        },
                                      }));
                                      markDivisionDirty(division_name);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle min-w-[160px]">
                                  <input
                                    className="input !py-0 !h-7 text-[11px] font-mono"
                                    placeholder="(optional) override"
                                    value={leagueImg}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          league_image_path: value,
                                        },
                                      }));
                                      markDivisionDirty(division_name);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle w-[90px]">
                                  <input
                                    className="input !py-0 !h-7 text-[11px]"
                                    type="number"
                                    min={0}
                                    max={10}
                                    placeholder={
                                      leagueIsFilling ? "Spots" : "-"
                                    }
                                    value={leagueIsFilling ? spots : ""}
                                    disabled={!leagueIsFilling}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          spots_available: value,
                                        },
                                      }));
                                      markDivisionDirty(division_name);
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 align-middle w-[48px] text-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={isActive}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setLeagueDrafts((prev) => ({
                                        ...prev,
                                        [lg.id]: {
                                          ...(prev[lg.id] || {}),
                                          is_active: checked,
                                        },
                                      }));
                                      markDivisionDirty(division_name);
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Save / reset controls */}
                    <div className="pt-3 mt-2 border-t border-subtle/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
                      <p className="text-muted">
                        {isDirty
                          ? "You have unsaved changes for this division."
                          : "No unsaved changes."}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline text-xs"
                          disabled={!isDirty || savingDivisionName === division_name}
                          onClick={() =>
                            handleResetDivisionDraft(division_name, leagues)
                          }
                        >
                          Reset changes
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary text-xs"
                          disabled={!isDirty || savingDivisionName === division_name}
                          onClick={() =>
                            handleSaveDivision(division_name, header, leagues)
                          }
                        >
                          {savingDivisionName === division_name
                            ? "Saving…"
                            : "Save changes"}
                        </button>
                      </div>
                    </div>

                    {/* Danger zone: delete division */}
                    <div className="pt-4 mt-2 border-t border-subtle/70">
                      {divisionToDelete === division_name ? (
                        <div className="space-y-2 text-[11px]">
                          <p className="text-danger font-semibold">
                            This will permanently delete this division and all 8
                            leagues for the current season.
                          </p>
                          <p className="text-muted">
                            Type <span className="font-mono">ballsville</span>{" "}
                            to confirm.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <input
                              className="input !h-8 !py-1 text-[11px] font-mono sm:max-w-[200px]"
                              value={divisionDeleteInput}
                              onChange={(e) =>
                                setDivisionDeleteInput(e.target.value)
                              }
                              placeholder="ballsville"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn btn-primary text-xs"
                                disabled={
                                  deletingDivisionName === division_name
                                }
                                onClick={() =>
                                  handleDeleteDivision(division_name)
                                }
                              >
                                {deletingDivisionName === division_name
                                  ? "Deleting…"
                                  : "Confirm delete"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline text-xs"
                                onClick={() => {
                                  setDivisionToDelete(null);
                                  setDivisionDeleteInput("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline text-xs text-danger border-danger"
                          onClick={() => {
                            setDivisionToDelete(division_name);
                            setDivisionDeleteInput("");
                          }}
                        >
                          Delete this division…
                        </button>
                      )}
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
