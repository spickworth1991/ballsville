"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import { getSupabase } from "@/lib/supabaseClient";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `announcement_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v, fallback = 0) {
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function sanitizeAnnouncementBar(input) {
  const value = input && typeof input === "object" ? input : {};
  return {
    enabled: value?.enabled !== false,
    eyebrow: safeStr(value?.eyebrow || "Ballsville Bulletin").trim() || "Ballsville Bulletin",
    speedSeconds: Math.max(8, safeNum(value?.speedSeconds, 34)),
    items: safeArray(value?.items).map((item, index) => ({
      id: safeStr(item?.id).trim() || `announcement_${index + 1}`,
      text: safeStr(item?.text).trim(),
      href: safeStr(item?.href).trim(),
    })),
  };
}

export default function AdminAnnouncementsPage() {
  return (
    <AdminGuard>
      <AdminAnnouncementsInner />
    </AdminGuard>
  );
}

function AdminAnnouncementsInner() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState(() =>
    sanitizeAnnouncementBar({
      enabled: true,
      eyebrow: "Ballsville Bulletin",
      speedSeconds: 34,
      items: [],
    })
  );

  async function getToken() {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/announcement-bar", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to load announcement bar (${res.status})`);
      setForm(sanitizeAnnouncementBar(data?.data || data));
    } catch (e) {
      setErr(e?.message || "Failed to load announcement bar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateItem(id, patch) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { id: uid(), text: "", href: "" }],
    }));
  }

  function removeItem(id) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }

  function moveItem(id, direction) {
    setForm((prev) => {
      const items = [...prev.items];
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= items.length) return prev;
      const [item] = items.splice(index, 1);
      items.splice(nextIndex, 0, item);
      return { ...prev, items };
    });
  }

  async function save() {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      const token = await getToken();
      const payload = sanitizeAnnouncementBar(form);
      const res = await fetch("/api/admin/announcement-bar", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      setForm(sanitizeAnnouncementBar(data?.data || payload));
      setOk("Announcement bar saved.");
    } catch (e) {
      setErr(e?.message || "Failed to save announcement bar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="section">
      <div className="container-site space-y-6">
        <AdminNav
          eyebrow="Admin - Sitewide Announcements"
          title="Announcement Bar"
          description="Edit the live sitewide ticker that sits below the navbar. Saved to R2 and pushed live through the manifest."
          rightExtra={
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline" type="button" onClick={load} disabled={loading || saving}>
                Refresh
              </button>
              <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          }
        />

        {err ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div> : null}
        {ok ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{ok}</div> : null}

        <section className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm">
          {loading ? (
            <div className="text-sm text-muted">Loading announcement bar...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)_180px]">
                <label className="flex items-center gap-2 rounded-xl border border-subtle bg-subtle-surface/30 px-4 py-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span>Enabled</span>
                </label>

                <div className="grid gap-2">
                  <label className="text-xs text-muted">Eyebrow</label>
                  <input
                    className="input"
                    value={form.eyebrow}
                    onChange={(e) => setForm((prev) => ({ ...prev, eyebrow: e.target.value }))}
                    placeholder="Ballsville Bulletin"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-muted">Loop seconds</label>
                  <input
                    className="input"
                    type="number"
                    min={8}
                    max={120}
                    value={form.speedSeconds}
                    onChange={(e) => setForm((prev) => ({ ...prev, speedSeconds: Math.max(8, Number(e.target.value) || 34) }))}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-subtle-surface/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-primary">Ticker items</div>
                    <div className="mt-1 text-xs text-muted">Each item can be plain text or clickable with a relative or full URL.</div>
                  </div>
                  <button className="btn btn-outline" type="button" onClick={addItem}>
                    Add item
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {form.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-subtle p-4 text-sm text-muted">
                      No announcement items yet. Add one to start the ticker.
                    </div>
                  ) : (
                    form.items.map((item, index) => (
                      <div key={item.id} className="rounded-2xl border border-subtle bg-card-trans p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs uppercase tracking-[0.22em] text-accent">Item {index + 1}</div>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn btn-outline text-xs" type="button" onClick={() => moveItem(item.id, "up")} disabled={index === 0}>
                              Up
                            </button>
                            <button
                              className="btn btn-outline text-xs"
                              type="button"
                              onClick={() => moveItem(item.id, "down")}
                              disabled={index === form.items.length - 1}
                            >
                              Down
                            </button>
                            <button className="btn btn-outline text-xs" type="button" onClick={() => removeItem(item.id)}>
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
                          <div className="grid gap-2">
                            <label className="text-xs text-muted">Message</label>
                            <input
                              className="input"
                              value={item.text}
                              onChange={(e) => updateItem(item.id, { text: e.target.value })}
                              placeholder="What should the ticker say?"
                            />
                          </div>

                          <div className="grid gap-2">
                            <label className="text-xs text-muted">Link (optional)</label>
                            <input
                              className="input"
                              value={item.href}
                              onChange={(e) => updateItem(item.id, { href: e.target.value })}
                              placeholder="/news or https://..."
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
