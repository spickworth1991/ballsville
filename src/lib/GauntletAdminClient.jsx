// src/lib/GauntletAdminClient.jsx
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

const STATUS_OPTIONS = ["filling", "full", "tbd", "drafting"];
const THEME_OPTIONS = ["EGYPTIANS", "GREEKS", "ROMANS"];

const emptyLegion = {
  id: null,
  name: "",
  code: "",
  theme: "EGYPTIANS",
  status: "filling",
  tagline: "",
  description: "",
  display_order: 0,
  is_active: true,
};

export default function GauntletAdminClient() {
  const [legions, setLegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null); // id or "new"
  const [form, setForm] = useState(emptyLegion);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLegions();
  }, []);

  async function loadLegions() {
    setLoading(true);
    setError("");
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase client not available in this environment.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("gauntlet_legions")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error(error);
      setError("Failed to load legions.");
    } else {
      setLegions(data || []);
    }
    setLoading(false);
  }

  function startNew() {
    setSelected("new");
    setForm({ ...emptyLegion });
  }

  function startEdit(legion) {
    setSelected(legion.id);
    setForm({
      ...emptyLegion,
      ...legion,
    });
  }

  function cancelEdit() {
    setSelected(null);
    setForm(emptyLegion);
    setError("");
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveLegion(e) {
    e?.preventDefault();
    setSaving(true);
    setError("");

    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase client not available.");
      setSaving(false);
      return;
    }

    if (!form.name.trim() || !form.code.trim()) {
      setError("Name and code are required.");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      theme: form.theme,
      status: form.status,
      tagline: form.tagline || null,
      description: form.description || null,
      is_active: !!form.is_active,
      display_order: Number(form.display_order) || 0,
    };

    let error;
    if (form.id) {
      const res = await supabase
        .from("gauntlet_legions")
        .update(payload)
        .eq("id", form.id)
        .select()
        .single();
      error = res.error;
    } else {
      const res = await supabase
        .from("gauntlet_legions")
        .insert(payload)
        .select()
        .single();
      error = res.error;
    }

    if (error) {
      console.error(error);
      setError(error.message || "Failed to save Legion.");
    } else {
      await loadLegions();
      cancelEdit();
    }

    setSaving(false);
  }

  async function deleteLegion(id) {
    if (!confirm("Delete this Legion? This cannot be undone.")) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase client not available.");
      return;
    }

    const { error } = await supabase
      .from("gauntlet_legions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setError("Failed to delete Legion.");
    } else {
      if (selected === id) cancelEdit();
      loadLegions();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* Left: list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            LEGIONS
          </h2>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-2 rounded-full border border-accent/70 bg-surface/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent hover:bg-accent/10 transition-colors"
          >
            <span className="text-base leading-none">＋</span>
            New Legion
          </button>
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="text-sm text-muted">Loading Legions…</div>
          )}

          {!loading && !legions.length && (
            <div className="text-sm text-muted">
              No Legions yet. Create the Egyptians, Greeks, and Romans to get
              started.
            </div>
          )}

          {legions.map((legion) => (
            <button
              key={legion.id}
              type="button"
              onClick={() => startEdit(legion)}
              className={`w-full text-left rounded-2xl border px-4 py-3 text-sm transition-colors ${
                selected === legion.id
                  ? "border-accent/80 bg-surface/90"
                  : "border-border/70 bg-surface/70 hover:border-accent/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{legion.name}</div>
                  <div className="text-xs text-muted">
                    {legion.theme} • {legion.status} • code: {legion.code}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] text-muted">
                    Order: {legion.display_order ?? 0}
                  </span>
                  <span className="text-[11px] text-muted">
                    {legion.is_active ? "Active" : "Hidden"}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: editor */}
      <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-4 sm:px-6 sm:py-5 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
            {selected === "new"
              ? "CREATE LEGION"
              : selected
              ? "EDIT LEGION"
              : "LEGION DETAILS"}
          </h2>
          {selected && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ✕ Cancel
            </button>
          )}
        </div>

        {!selected && (
          <p className="mt-4 text-sm text-muted">
            Select a Legion on the left or create a new one. These settings
            control what appears on the public Gauntlet page.
          </p>
        )}

        {selected && (
          <form onSubmit={saveLegion} className="mt-4 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium space-y-1">
                <span>Name</span>
                <input
                  type="text"
                  className="w-full rounded-md border border-border/70 bg-black/40 px-2.5 py-1.5 text-sm"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Egyptian Legion"
                  required
                />
              </label>

              <label className="text-xs font-medium space-y-1">
                <span>Code (slug)</span>
                <input
                  type="text"
                  className="w-full rounded-md border border-border/70 bg-black/40 px-2.5 py-1.5 text-sm"
                  value={form.code}
                  onChange={(e) =>
                    updateField("code", e.target.value.toLowerCase())
                  }
                  placeholder="egyptians"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium space-y-1">
                <span>Theme</span>
                <select
                  className="w-full rounded-md border border-border/70 bg-black/40 px-2.5 py-1.5 text-sm"
                  value={form.theme}
                  onChange={(e) => updateField("theme", e.target.value)}
                >
                  {THEME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium space-y-1">
                <span>Status</span>
                <select
                  className="w-full rounded-md border border-border/70 bg-black/40 px-2.5 py-1.5 text-sm"
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium space-y-1">
                <span>Display Order</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-border/70 bg-black/40 px-2.5 py-1.5 text-sm"
                  value={form.display_order ?? 0}
                  onChange={(e) =>
                    updateField("display_order", e.target.value)
                  }
                />
              </label>
            </div>

            <label className="text-xs font-medium space-y-1 block">
              <span>Tagline</span>
              <input
                type="text"
                className="w-full rounded-md border border-border/70 bg-black/40 px-2.5 py-1.5 text-sm"
                value={form.tagline || ""}
                onChange={(e) => updateField("tagline", e.target.value)}
                placeholder="Amun-Rah, Osiris, Horus, Anubis."
              />
            </label>

            <label className="text-xs font-medium space-y-1 block">
              <span>Description (admin note)</span>
              <textarea
                rows={4}
                className="w-full rounded-md border border-border/70 bg-black/40 px-2.5 py-1.5 text-sm"
                value={form.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Notes about this Legion, draft dates, commissioner, etc."
              />
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border/70 bg-black/60"
                checked={!!form.is_active}
                onChange={(e) => updateField("is_active", e.target.checked)}
              />
              <span>Show this Legion on the public Gauntlet page</span>
            </label>

            <div className="flex items-center justify-between gap-3 pt-2">
              {form.id && (
                <button
                  type="button"
                  onClick={() => deleteLegion(form.id)}
                  className="text-xs text-red-300 hover:text-red-100"
                >
                  Delete Legion
                </button>
              )}

              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-foreground/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-black hover:bg-accent/90 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Legion"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
