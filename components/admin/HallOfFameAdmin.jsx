"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import Link from "next/link";

const CATEGORY_OPTIONS = [
  { value: "dynasty", label: "Dynasty" },
  { value: "biggame", label: "The BIG Game" },
  { value: "minileagues", label: "Mini-Leagues" },
  { value: "redraft", label: "Redraft" },
  { value: "poy", label: "Player of the Year" },
];

const EMPTY = {
  id: null,
  year: new Date().getFullYear(),
  category: "dynasty", // ✅ REQUIRED by your table
  game_label: "The BALLSVILLE game #1",
  title: "",
  blurb: "",
  image_url: "/photos/halloffame-1280.webp",
  image_alt: "",
  sort_order: 10,
  is_active: true,
};

export default function HallOfFameAdmin() {
  const supabase = useMemo(() => getSupabase(), []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(EMPTY);

  async function load() {
    setError("");
    setMsg("");
    setLoading(true);

    if (!supabase) {
      setError("Supabase client not available.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("hall_of_fame")
      .select("*")
      .order("year", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error) setError(error.message);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNew() {
    setMsg("");
    setError("");
    setEditing({ ...EMPTY, year: new Date().getFullYear() });
  }

  function startEdit(row) {
    setMsg("");
    setError("");
    setEditing({ ...row });
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!supabase) {
      setError("Supabase client not available.");
      return;
    }

    const payload = {
      year: Number(editing.year),
      category: String(editing.category || "").trim(), // ✅ REQUIRED
      game_label: String(editing.game_label || "").trim(),
      title: String(editing.title || "").trim(),
      blurb: String(editing.blurb || "").trim(),
      image_url: String(editing.image_url || "").trim(),
      image_alt: String(editing.image_alt || "").trim(),
      sort_order: Number(editing.sort_order),
      is_active: !!editing.is_active,
      // updated_at: new Date().toISOString(), // optional if you want it to change on edit
    };

    if (!payload.category) {
      setError("Category is required.");
      return;
    }
    if (!payload.title || !payload.blurb || !payload.image_url) {
      setError("Title, blurb, and image_url are required.");
      return;
    }
    if (!payload.image_alt) payload.image_alt = payload.title;

    if (editing.id) {
      const { error } = await supabase
        .from("hall_of_fame")
        .update(payload)
        .eq("id", editing.id);

      if (error) return setError(error.message);

      setMsg("Updated.");
      setEditing(EMPTY);
      await load();
      return;
    }

    const { error } = await supabase.from("hall_of_fame").insert(payload);
    if (error) return setError(error.message);

    setMsg("Created.");
    setEditing(EMPTY);
    await load();
  }

  async function remove(id) {
    setError("");
    setMsg("");

    const { error } = await supabase.from("hall_of_fame").delete().eq("id", id);
    if (error) return setError(error.message);

    setMsg("Deleted.");
    await load();
  }

  async function toggleActive(row) {
    setError("");
    setMsg("");

    const { error } = await supabase
      .from("hall_of_fame")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);

    if (error) return setError(error.message);

    setMsg("Updated visibility.");
    await load();
  }

  return (
    <section className="section">
      <div className="container-site space-y-8">
        <div className="flex flex-col items-end gap-2">
            <Link href="/hall-of-fame" className="btn btn-primary text-sm">
              ← View Public Hall of Fame
            </Link>
            <a href="/admin" className="btn btn-primary">
            ← Admin Home
          </a>
            <button
              className="btn btn-primary text-xs"
              onClick={async () => {
                const supabase = getSupabase();
                if (supabase) await supabase.auth.signOut();
                location.href = "/admin/login";
              }}
            >
              Sign out
            </button>
          </div>
        <header className="bg-card-surface p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="badge">Admin</span>
              <h1 className="h2 mt-2">Hall of Fame Manager</h1>
              <p className="text-muted mt-2">
                Add/edit winners, photos, captions, ordering, and visibility.
              </p>
            </div>

            <button className="btn btn-primary" type="button" onClick={startNew}>
              + New Entry
            </button>
          </div>

          {error && <p className="mt-4 text-danger">{error}</p>}
          {msg && <p className="mt-4 text-accent">{msg}</p>}
        </header>

        {/* Editor */}
        <div className="bg-card-surface p-6 md:p-8">
          <h2 className="h3 mb-4">{editing?.id ? "Edit Entry" : "Create Entry"}</h2>

          <form onSubmit={save} className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="label mb-1">Year</div>
                <input
                  className="input"
                  type="number"
                  value={editing.year}
                  onChange={(e) => setEditing((p) => ({ ...p, year: e.target.value }))}
                />
              </div>

              <div>
                <div className="label mb-1">Sort Order</div>
                <input
                  className="input"
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, sort_order: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* ✅ Category */}
            <div>
              <div className="label mb-1">Category</div>
              <select
                className="input"
                value={editing.category}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, category: e.target.value }))
                }
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">
                This should match the public page section (dynasty, biggame, minileagues, redraft, poy).
              </p>
            </div>

            <div>
              <div className="label mb-1">Game Label</div>
              <input
                className="input"
                placeholder="The BALLSVILLE game #1"
                value={editing.game_label}
                onChange={(e) => setEditing((p) => ({ ...p, game_label: e.target.value }))}
              />
            </div>

            <div>
              <div className="label mb-1">Title</div>
              <input
                className="input"
                placeholder="2025 Dragons of Dynasty Winners"
                value={editing.title}
                onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div>
              <div className="label mb-1">Blurb</div>
              <textarea
                className="input"
                rows={4}
                value={editing.blurb}
                onChange={(e) => setEditing((p) => ({ ...p, blurb: e.target.value }))}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="label mb-1">Image URL</div>
                <input
                  className="input"
                  placeholder="/photos/halloffame-1280.webp or https://..."
                  value={editing.image_url}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, image_url: e.target.value }))
                  }
                />
              </div>

              <div>
                <div className="label mb-1">Image Alt</div>
                <input
                  className="input"
                  placeholder="Defaults to title if blank"
                  value={editing.image_alt}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, image_alt: e.target.value }))
                  }
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-fg">
              <input
                type="checkbox"
                checked={!!editing.is_active}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, is_active: e.target.checked }))
                }
              />
              Visible on public page
            </label>

            <div className="flex gap-3 flex-wrap">
              <button className="btn btn-primary" type="submit">
                {editing?.id ? "Save Changes" : "Create Entry"}
              </button>

              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setEditing(EMPTY)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="bg-card-surface p-6 md:p-8">
          <h2 className="h3 mb-4">Existing Entries</h2>

          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted">No Hall of Fame entries yet.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="bg-subtle-surface p-4 rounded-xl border border-subtle flex items-start justify-between gap-4 flex-wrap"
                >
                  <div>
                    <div className="text-sm text-muted">
                      {r.year} • {r.category} • sort {r.sort_order} •{" "}
                      {r.is_active ? (
                        <span className="text-success">Visible</span>
                      ) : (
                        <span className="text-warning">Hidden</span>
                      )}
                    </div>
                    <div className="font-semibold mt-1">{r.title}</div>
                    <div className="text-sm text-muted mt-1">{r.game_label}</div>
                  </div>

                  <div className="flex gap-2">
                    <button className="btn btn-outline" type="button" onClick={() => startEdit(r)}>
                      Edit
                    </button>
                    <button className="btn btn-outline" type="button" onClick={() => toggleActive(r)}>
                      {r.is_active ? "Hide" : "Show"}
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => remove(r.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
