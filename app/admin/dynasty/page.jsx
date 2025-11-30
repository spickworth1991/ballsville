// app/admin/dynasty/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

function parseAdmins() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Status options now include filling/drafting
const STATUS_OPTIONS = [
  "FULL & ACTIVE",
  "CURRENTLY FILLING",
  "DRAFTING",
  "ORPHAN OPEN",
  "INACTIVE",
];

export default function AdminDynastyPage() {
  const [user, setUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    theme_name: "",
    status: "FULL & ACTIVE",
    sleeper_url: "",
    image_url: "",
    note: "",
    display_order: "",
    is_active: true,
    is_orphan: false,
    theme_blurb: "",
    fill_note: "",
  });
  const [showThemeBlurbField, setShowThemeBlurbField] = useState(false);

  // Quick-create modal state
  const [quickOpen, setQuickOpen] = useState(false);
  const [quick, setQuick] = useState({
    year: new Date().getFullYear(),
    theme_name: "",
    theme_blurb: "",
    base_status: "CURRENTLY FILLING",
    base_fill_note: "",
    division_names: "", // one name per line
  });
  const [quickSaving, setQuickSaving] = useState(false);

  const ADMIN_EMAILS = useMemo(parseAdmins, []);
  const isAdmin =
    !!user && ADMIN_EMAILS.includes((user?.email || "").toLowerCase());

  // Build list of existing themes for dropdown suggestions
  const themeOptions = useMemo(() => {
    const set = new Set();
    leagues.forEach((lg) => {
      const t = (lg.theme_name || lg.kind || "").trim();
      if (t) set.add(t);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leagues]);

  // auth check
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setUserChecked(true);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      setUserChecked(true);
    });
  }, []);

  // fetch leagues
  useEffect(() => {
    async function run() {
      if (!userChecked || !isAdmin) return;
      setLoading(true);
      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("dynasty_leagues")
        .select("*")
        .order("year", { ascending: false })
        .order("theme_name", { ascending: true })
        .order("display_order", { ascending: true });

      if (!error) setLeagues(data || []);
      setLoading(false);
    }
    run();
  }, [userChecked, isAdmin]);

  function resetForm() {
    setEditing(null);
    setForm({
      name: "",
      year: new Date().getFullYear(),
      theme_name: "",
      status: "FULL & ACTIVE",
      sleeper_url: "",
      image_url: "",
      note: "",
      display_order: "",
      is_active: true,
      is_orphan: false,
      theme_blurb: "",
      fill_note: "",
    });
    setShowThemeBlurbField(false);
  }

  function startEdit(lg) {
    setEditing(lg);
    setForm({
      name: lg.name || "",
      year: lg.year || new Date().getFullYear(),
      theme_name:
        lg.theme_name ||
        lg.kind || // fallback to old column if present
        "",
      status: lg.status || "FULL & ACTIVE",
      sleeper_url: lg.sleeper_url || "",
      image_url: lg.image_url || "",
      note: lg.note || "",
      display_order:
        typeof lg.display_order === "number" ? String(lg.display_order) : "",
      is_active: lg.is_active ?? true,
      is_orphan: lg.is_orphan ?? false,
      theme_blurb: lg.theme_blurb || "",
      fill_note: lg.fill_note || "",
    });
    setShowThemeBlurbField(!!lg.theme_blurb);
  }

  async function refresh() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("dynasty_leagues")
      .select("*")
      .order("year", { ascending: false })
      .order("theme_name", { ascending: true })
      .order("display_order", { ascending: true });

    if (!error) setLeagues(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const supabase = getSupabase();
    if (!supabase) return alert("Please open this page in a browser.");
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      alert("Please sign in again.");
      location.href = "/admin/login";
      return;
    }

    const payload = {
      name: form.name.trim(),
      year: Number(form.year) || new Date().getFullYear(),
      theme_name: form.theme_name.trim() || null,
      theme_blurb: (showThemeBlurbField ? form.theme_blurb.trim() : "") || null,
      status: form.status,
      sleeper_url: form.sleeper_url.trim() || null,
      image_url: form.image_url.trim() || null,
      note: form.note.trim() || null,
      fill_note: form.fill_note.trim() || null,
      display_order: form.display_order ? Number(form.display_order) : null,
      is_active: !!form.is_active,
      is_orphan: !!form.is_orphan || form.status === "ORPHAN OPEN",
    };

        try {
      if (editing) {
        const { error } = await supabase
          .from("dynasty_leagues")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dynasty_leagues")
          .insert(payload);
        if (error) throw error;
      }

      // If we're editing the theme blurb, sync it to all leagues
      // with the same year + theme_name so it's truly theme-level.
      if (showThemeBlurbField && payload.theme_blurb) {
        const { error: blurbError } = await supabase
          .from("dynasty_leagues")
          .update({ theme_blurb: payload.theme_blurb })
          .eq("year", payload.year)
          .eq("theme_name", payload.theme_name);
        if (blurbError) throw blurbError;
      }

      resetForm();
      await refresh();
    } catch (err) {
      alert(err.message || "Failed to save league");
    }
  }

  async function handleDelete(id) {
    if (!isAdmin) return;
    if (
      !confirm(
        "Delete this league entry? This does NOT delete the actual Sleeper league."
      )
    ) {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase
      .from("dynasty_leagues")
      .delete()
      .eq("id", id);
    if (!error) {
      await refresh();
    }
  }

  async function handleQuickCreate(e) {
    e.preventDefault();
    if (!isAdmin) return;
    const supabase = getSupabase();
    if (!supabase) return alert("Please open this page in a browser.");

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      alert("Please sign in again.");
      location.href = "/admin/login";
      return;
    }

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
      alert("Please enter at least one team/division name (one per line).");
      return;
    }

    const rowsToInsert = names.map((name, idx) => ({
      name,
      year,
      theme_name: themeName,
      theme_blurb: themeBlurb,
      status: baseStatus,
      fill_note: baseFillNote,
      display_order: idx + 1, // division number
      is_active: true,
      is_orphan: baseStatus === "ORPHAN OPEN",
    }));

    try {
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
      await refresh();
    } catch (err) {
      alert(err.message || "Failed to quick-create season");
    } finally {
      setQuickSaving(false);
    }
  }

  if (!userChecked) {
    return (
      <section className="section">
        <div className="container-site max-w-xl">
          <div className="card bg-card-surface border border-subtle p-6 text-center">
            <p className="text-muted">Checking access…</p>
          </div>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="container-site max-w-xl text-center space-y-3">
          <h1 className="h2 mb-2 text-primary">Access required</h1>
          <p className="text-muted">
            Only Ballsville admins have access here. If this is a mistake,
            please contact the site developer.
          </p>
          <a href="/admin/login" className="btn btn-primary mt-4">
            Go to Login
          </a>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="section">
        <div className="container-site max-w-xl text-center space-y-3">
          <h1 className="h2 mb-2 text-primary">No access</h1>
          <p className="text-muted">
            Sorry, you do not have access to this page.
          </p>
          <button
            className="btn btn-outline mt-4"
            onClick={async () => {
              const supabase = getSupabase();
              if (supabase) await supabase.auth.signOut();
              location.href = "/admin/login";
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    );
  }

  const sorted = leagues.slice().sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const at = (a.theme_name || a.kind || "").localeCompare(
      b.theme_name || b.kind || ""
    );
    if (at !== 0) return at;
    const ao = a.display_order ?? 9999;
    const bo = b.display_order ?? 9999;
    return ao - bo;
  });

  return (
    <section className="section">
      <div className="container-site max-w-5xl space-y-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="badge">Admins</span>
            <h1 className="h2 mt-3 text-primary">Dynasty Leagues</h1>
            <p className="text-muted mt-1 text-sm">
              Manage Dynasty Empire leagues – season, theme, division number,
              and fill status used on the public Dynasty Game page.
            </p>
          </div>
          <a href="/admin" className="btn btn-outline">
            ← Admin Home
          </a>
        </div>

        {/* Quick create season & theme */}
        <section className="card bg-card-surface border border-subtle p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Quick create season & theme
              </h2>
              <p className="text-xs text-muted max-w-prose">
                Use this when you launch a new year of Dynasty – it will create
                all divisions for a theme at once, with the same status and
                theme description.
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
        </section>

        {/* Create / Edit single league */}
        <section className="card bg-card-surface border border-subtle p-6 space-y-4">
          <h2 className="text-xl font-semibold text-primary">
            {editing ? "Edit Dynasty League" : "Add Dynasty League"}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <label className="block">
              <span className="text-sm text-muted">League name *</span>
              <input
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Season year *</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                value={form.year}
                onChange={(e) =>
                  setForm((f) => ({ ...f, year: e.target.value }))
                }
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-muted">
                Theme name (grouping for this year) *
              </span>
              <input
                list="dynasty-theme-options"
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                placeholder="Start typing or pick an existing theme"
                value={form.theme_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, theme_name: e.target.value }))
                }
              />
              <datalist id="dynasty-theme-options">
                {themeOptions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-muted">
                All leagues sharing the same year + theme name will be grouped
                together on the public page. Use Quick Create for new themes.
              </p>
            </label>

            <label className="block">
              <span className="text-sm text-muted">Status *</span>
              <select
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-muted">
                Division number (1, 2, 3…)
              </span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                value={form.display_order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, display_order: e.target.value }))
                }
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-muted">Sleeper league URL</span>
              <input
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                placeholder="https://sleeper.app/leagues/…"
                value={form.sleeper_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sleeper_url: e.target.value }))
                }
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-muted">Image URL (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                placeholder="/photos/dynasty.webp"
                value={form.image_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, image_url: e.target.value }))
                }
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-muted">
                Fill note (for “Currently filling” / “Drafting”)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                placeholder="e.g. 7/12 filled – drafting this weekend"
                value={form.fill_note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fill_note: e.target.value }))
                }
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-muted">Internal note (optional)</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2 min-h-[80px]"
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </label>

            <div className="flex items-center gap-3 md:col-span-2">
              <input
                id="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
              />
              <label htmlFor="is_active" className="text-sm text-fg">
                League is active (show on public Dynasty page)
              </label>
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              <input
                id="is_orphan"
                type="checkbox"
                checked={form.is_orphan || form.status === "ORPHAN OPEN"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_orphan: e.target.checked }))
                }
              />
              <label htmlFor="is_orphan" className="text-sm text-fg">
                Mark as an orphan opening
              </label>
            </div>

            <div className="md:col-span-2 flex items-center gap-3">
              <input
                id="show_theme_blurb"
                type="checkbox"
                checked={showThemeBlurbField}
                onChange={(e) => setShowThemeBlurbField(e.target.checked)}
              />
              <label htmlFor="show_theme_blurb" className="text-sm text-fg">
                Edit theme description (blurb) and name for this year/theme
              </label>
            </div>

            {showThemeBlurbField && (
              <>
                <label className="block md:col-span-2">
                  <span className="text-sm text-muted">
                    Theme description (blurb)
                  </span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2 min-h-[80px]"
                    placeholder="Short description for this season's theme. Shown above the league tiles."
                    value={form.theme_blurb}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, theme_blurb: e.target.value }))
                    }
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm text-muted">
                    Theme name (edit for this league)
                  </span>
                  <input
                    className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                    value={form.theme_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, theme_name: e.target.value }))
                    }
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    Updating this will change the theme name for this league
                    entry. If multiple divisions share this theme, update them
                    as needed to keep grouping consistent.
                  </p>
                </label>
              </>
            )}

            <div className="md:col-span-2 flex gap-3 mt-2">
              <button className="btn btn-primary" type="submit">
                {editing ? "Save Changes" : "Add League"}
              </button>
              {editing && (
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* List of leagues */}
        <section className="card bg-card-surface border border-subtle p-6 space-y-4">
          <h2 className="text-xl font-semibold text-primary">Existing Leagues</h2>
          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-muted text-sm">
              No dynasty leagues in the table yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2 text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-3">League</th>
                    <th className="px-3">Year</th>
                    <th className="px-3">Theme</th>
                    <th className="px-3">Division #</th>
                    <th className="px-3">Status</th>
                    <th className="px-3">Fill note</th>
                    <th className="px-3">Orphan</th>
                    <th className="px-3">Active</th>
                    <th className="px-3">Sleeper</th>
                    <th className="px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((lg) => (
                    <tr key={lg.id} className="align-top">
                      <td className="px-3 font-medium text-fg">
                        {lg.name}
                        {lg.note && (
                          <div className="text-[11px] text-muted max-w-xs">
                            {lg.note}
                          </div>
                        )}
                      </td>
                      <td className="px-3 text-sm text-muted">{lg.year}</td>
                      <td className="px-3 text-sm text-muted">
                        {lg.theme_name || lg.kind || "—"}
                        {lg.theme_blurb && (
                          <div className="text-[11px] text-muted max-w-xs">
                            {lg.theme_blurb}
                          </div>
                        )}
                      </td>
                      <td className="px-3 text-sm text-muted">
                        {lg.display_order ?? "—"}
                      </td>
                      <td className="px-3 text-sm">
                        <span className="badge">{lg.status}</span>
                      </td>
                      <td className="px-3 text-[11px] text-muted max-w-xs">
                        {lg.fill_note || "—"}
                      </td>
                      <td className="px-3 text-sm text-muted">
                        {lg.is_orphan ? "Yes" : "No"}
                      </td>
                      <td className="px-3 text-sm text-muted">
                        {lg.is_active ? "Yes" : "No"}
                      </td>
                      <td className="px-3 text-xs text-muted max-w-[180px] truncate">
                        {lg.sleeper_url ? (
                          <a
                            href={lg.sleeper_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline underline-offset-2"
                          >
                            Sleeper link
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="text-primary underline underline-offset-4"
                            onClick={() => startEdit(lg)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-danger underline underline-offset-4"
                            onClick={() => handleDelete(lg.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Quick create modal */}
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

            <form className="space-y-3" onSubmit={handleQuickCreate}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-muted">Season year *</span>
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
                  <span className="text-sm text-muted">Base status *</span>
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
                <span className="text-sm text-muted">Theme name *</span>
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
                <span className="text-sm text-muted">
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
                <span className="text-sm text-muted">
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
                <span className="text-sm text-muted">
                  Team / division names (one per line) *
                </span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2 min-h-[120px]"
                  placeholder={"Division 1 name\nDivision 2 name\nDivision 3 name"}
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