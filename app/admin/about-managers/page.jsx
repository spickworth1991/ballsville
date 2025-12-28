"use client";

// app/admin/about-managers/page.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function cleanStr(v, max = 4000) {
  return String(v || "").trim().slice(0, max);
}

function normalizeManager(m, idx) {
  const o = m && typeof m === "object" ? m : {};
  const bullets = Array.isArray(o.bullets)
    ? o.bullets
    : typeof o.bullets === "string"
      ? o.bullets.split("\n")
      : [];
  return {
    id: cleanStr(o.id || crypto.randomUUID(), 96),
    order: Number.isFinite(Number(o.order)) ? Number(o.order) : idx + 1,
    name: cleanStr(o.name, 120),
    role: cleanStr(o.role, 160),
    bullets: bullets
      .map((s) => cleanStr(s, 160))
      .map((s) => s.replace(/^[-•\s]+/, ""))
      .filter(Boolean)
      .slice(0, 8),
    bio: cleanStr(o.bio, 6000),
    imageKey: cleanStr(o.imageKey, 240),
    imageUrl: cleanStr(o.imageUrl || o.image_url, 800),
    twitter: cleanStr(o.twitter, 240),
    discord: cleanStr(o.discord, 240),
    sleeper: cleanStr(o.sleeper, 240),
  };
}

async function getToken() {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token || "";
}

export default function AdminAboutManagersPage() {
  const season = CURRENT_SEASON;

  const [managers, setManagers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const selected = useMemo(
    () => managers.find((m) => m.id === selectedId) || null,
    [managers, selectedId]
  );

  function pickFirst(list) {
    const first = list?.[0]?.id || "";
    setSelectedId((id) => id || first);
  }

  async function load() {
    setErr("");
    setNotice("");
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/about-managers?season=${season}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed to load (${res.status})`);
      }
      const data = await res.json();
      const list = safeArray(data?.managers || data?.rows || data);
      const norm = list.map(normalizeManager).sort((a, b) => a.order - b.order);
      setManagers(norm);
      pickFirst(norm);
    } catch (e) {
      setErr(e?.message || "Failed to load.");
      setManagers([]);
      setSelectedId("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSelected(patch) {
    setManagers((prev) =>
      prev.map((m) => (m.id === selectedId ? { ...m, ...patch } : m))
    );
  }

  function addManager() {
    const id = crypto.randomUUID();
    const nextOrder = (managers?.reduce((mx, m) => Math.max(mx, Number(m.order) || 0), 0) || 0) + 1;
    const m = normalizeManager({
      id,
      order: nextOrder,
      name: "",
      role: "",
      bullets: [],
      bio: "",
      imageKey: "",
      imageUrl: "",
    }, managers.length);
    setManagers((prev) => [...prev, m].sort((a, b) => a.order - b.order));
    setSelectedId(id);
    setNotice("Added manager — upload an image and fill in details.");
  }

  function deleteSelected() {
    if (!selected) return;
    const ok = confirm(`Delete ${selected.name || "this manager"}?`);
    if (!ok) return;
    setManagers((prev) => prev.filter((m) => m.id !== selected.id));
    setSelectedId("");
    setNotice("Deleted.");
  }

  function moveSelected(dir) {
    if (!selected) return;
    const sorted = [...managers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((m) => m.id === selected.id);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapWith];
    const tmp = a.order;
    a.order = b.order;
    b.order = tmp;
    const next = sorted.sort((x, y) => x.order - y.order);
    setManagers(next);
  }

  async function save() {
    setErr("");
    setNotice("");
    setSaving(true);
    try {
      const token = await getToken();
      const payload = {
        managers: managers
          .map((m, idx) => normalizeManager(m, idx))
          .sort((a, b) => a.order - b.order),
      };
      const res = await fetch(`/api/admin/about-managers?season=${season}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed to save (${res.status})`);
      }
      setNotice("Saved. Public page will refresh automatically.");
      await load();
    } catch (e) {
      setErr(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file) {
    if (!selected) return;
    setErr("");
    setNotice("");
    setUploading(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.set("file", file);
      form.set("section", "about-managers");
      form.set("season", String(season));
      form.set("managerId", selected.id);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      const key = String(data?.key || "");
      if (!key) throw new Error("Upload returned no key.");

      updateSelected({ imageKey: key, imageUrl: "" });
      setNotice("Image uploaded. Don't forget to hit Save.");
    } catch (e) {
      setErr(e?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const previewSrc = selected?.imageKey
    ? `/r2/${selected.imageKey}?v=${encodeURIComponent(selected.imageKey)}`
    : selected?.imageUrl || "";

  return (
    <AdminGuard>
      <main className="relative min-h-screen text-fg">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-glow" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <AdminNav title="Meet our managers" subtitle={`About page managers — Season ${season}`} />

          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={addManager}>
              + Add manager
            </button>
            <button className="btn btn-outline" onClick={save} disabled={saving || loading}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button className="btn btn-outline" onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>

          {err ? <p className="text-sm text-[color:var(--color-warning)]">{err}</p> : null}
          {notice ? <p className="text-sm text-muted">{notice}</p> : null}

          <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
            <section className="rounded-3xl border border-subtle bg-card-surface shadow-md p-4">
              <h2 className="text-sm font-semibold text-primary mb-3">Managers</h2>
              {loading ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : managers.length ? (
                <div className="space-y-2">
                  {managers
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((m) => {
                      const active = m.id === selectedId;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedId(m.id)}
                          className={`w-full text-left rounded-2xl border p-3 transition ${
                            active
                              ? "border-accent bg-card-trans"
                              : "border-subtle bg-card-trans hover:border-accent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-subtle bg-black/20 shrink-0">
                              {m.imageKey ? (
                                <Image
                                  src={`/r2/${m.imageKey}?v=${encodeURIComponent(m.imageKey)}`}
                                  alt={m.name || "Manager"}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 grid place-items-center text-xs text-muted">
                                  IMG
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-fg truncate">
                                {m.name || "(unnamed)"}
                              </div>
                              <div className="text-xs text-muted truncate">{m.role || "—"}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted">No managers yet. Click “Add manager”.</p>
              )}
            </section>

            <section className="rounded-3xl border border-subtle bg-card-surface shadow-md p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-primary">Edit manager</h2>
                  <p className="text-xs text-muted mt-1">Click a manager on the left to edit.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button className="btn btn-outline text-xs" onClick={() => moveSelected(-1)} disabled={!selected}>
                    ↑
                  </button>
                  <button className="btn btn-outline text-xs" onClick={() => moveSelected(1)} disabled={!selected}>
                    ↓
                  </button>
                  <button className="btn btn-outline text-xs" onClick={deleteSelected} disabled={!selected}>
                    Delete
                  </button>
                </div>
              </div>

              {!selected ? (
                <div className="mt-6 rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-5 text-sm text-muted">
                  Select a manager to edit their profile.
                </div>
              ) : (
                <div className="mt-5 grid gap-6 md:grid-cols-[240px,1fr]">
                  <div className="space-y-3">
                    <div className="relative w-full overflow-hidden rounded-2xl border border-subtle bg-black/20" style={{ aspectRatio: "1/1" }}>
                      {previewSrc ? (
                        <Image src={previewSrc} alt={selected.name || "Manager"} fill sizes="240px" className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-sm text-muted">No image</div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-3">
                      <label className="block text-xs text-muted mb-2">Upload image</label>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="block w-full text-xs"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(f);
                        }}
                      />
                      <p className="mt-2 text-[11px] text-muted">
                        Tip: square-ish images look best. Upload replaces prior image automatically.
                      </p>
                    </div>

                    <div className="text-[11px] text-muted">
                      <div className="font-semibold text-fg">R2 key</div>
                      <div className="break-all">{selected.imageKey || "(none)"}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-muted mb-1">Name</label>
                        <input
                          className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2 text-sm"
                          value={selected.name}
                          onChange={(e) => updateSelected({ name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Role / title</label>
                        <input
                          className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2 text-sm"
                          value={selected.role}
                          onChange={(e) => updateSelected({ role: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-muted mb-1">Bullets (one per line)</label>
                      <textarea
                        className="w-full min-h-[120px] rounded-xl border border-subtle bg-card-trans px-3 py-2 text-sm"
                        value={(selected.bullets || []).join("\n")}
                        onChange={(e) => updateSelected({ bullets: e.target.value.split("\n") })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-muted mb-1">Bio (modal details)</label>
                      <textarea
                        className="w-full min-h-[170px] rounded-xl border border-subtle bg-card-trans px-3 py-2 text-sm"
                        value={selected.bio}
                        onChange={(e) => updateSelected({ bio: e.target.value })}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Sleeper</label>
                        <input
                          className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2 text-sm"
                          value={selected.sleeper}
                          onChange={(e) => updateSelected({ sleeper: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Discord</label>
                        <input
                          className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2 text-sm"
                          value={selected.discord}
                          onChange={(e) => updateSelected({ discord: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">X / Twitter</label>
                        <input
                          className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2 text-sm"
                          value={selected.twitter}
                          onChange={(e) => updateSelected({ twitter: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-muted">
                        ID: <span className="font-mono text-fg">{selected.id}</span>
                      </div>
                      <div className="text-xs text-muted">Order: {selected.order}</div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </AdminGuard>
  );
}
