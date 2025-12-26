// app/admin/posts/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normPost(p, idx) {
  const id = String(p?.id || idx);
  const created_at = typeof p?.created_at === "string" ? p.created_at : new Date().toISOString();
  const expires_at_raw = p?.expires_at ?? p?.expiresAt ?? null;
  const expires_at = typeof expires_at_raw === "string" && expires_at_raw.trim() ? expires_at_raw : null;
  return {
    id,
    created_at,
    title: String(p?.title || "").trim(),
    body: String(p?.body || "").trim(),
    tags: Array.isArray(p?.tags) ? p.tags.map(String) : typeof p?.tags === "string" ? p.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
    // Back-compat: older data used `pin`, UI uses `pinned`.
    pinned: Boolean(p?.pinned ?? p?.pin),
    // Mini-game flag (used by /news to separate “Mini Games”)
    is_coupon: Boolean(p?.is_coupon),
    // Optional close time for Mini Games
    expires_at,
    imageKey: typeof p?.imageKey === "string" ? p.imageKey : "",
    // Back-compat: data stored as image_url
    imageUrl: typeof p?.imageUrl === "string" ? p.imageUrl : typeof p?.image_url === "string" ? p.image_url : "",
  };
}

function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminPostsPage() {
  return (
    <AdminGuard>
      <AdminPostsInner />
    </AdminGuard>
  );
}

function AdminPostsInner() {
  const season = CURRENT_SEASON;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [selectedId, setSelectedId] = useState("");

  const selected = useMemo(() => posts.find((p) => p.id === selectedId) || null, [posts, selectedId]);

  async function getToken() {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/posts`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data?.posts) ? data.posts : [];
      const normalized = list.map(normPost);
      // Newest first
      normalized.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      setPosts(normalized);
      if (!selectedId && normalized.length) setSelectedId(normalized[0].id);
    } catch (e) {
      setErr(e?.message || "Failed to load posts.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAll(nextPosts) {
    setErr("");
    setOk("");
    setSaving(true);
    try {
      const token = await getToken();
      // Backend expects snake_case fields for the public /news page.
      const payload = {
        posts: (nextPosts || []).map((p) => ({
          id: String(p?.id || ""),
          title: String(p?.title || "").trim(),
          body: String(p?.body || ""),
          tags: Array.isArray(p?.tags) ? p.tags : [],
          pin: !!p?.pinned,
          is_coupon: !!p?.is_coupon,
          expires_at: p?.expires_at ? String(p.expires_at) : null,
          created_at: p?.created_at ? String(p.created_at) : new Date().toISOString(),
          imageKey: typeof p?.imageKey === "string" ? p.imageKey : "",
          image_url: typeof p?.imageUrl === "string" ? p.imageUrl : "",
        })),
      };
      const res = await fetch(`/api/admin/posts`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Save failed (${res.status}): ${t}`);
      }
      setOk("Saved.");
      setPosts(nextPosts);
    } catch (e) {
      setErr(e?.message || "Failed to save posts.");
    } finally {
      setSaving(false);
    }
  }

  function updateSelected(patch) {
    setPosts((prev) => prev.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)));
  }

  async function uploadImage(file) {
    if (!file || !selectedId) return;
    setErr("");
    setOk("");
    setSaving(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("file", file);
      form.append("section", "posts-image");
      form.append("season", String(season));
      form.append("postId", selectedId);

      const res = await fetch(`/api/admin/upload`, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Upload failed (${res.status})`);

      const key = String(data.key || "");
      updateSelected({ imageKey: key, imageUrl: "" });
      setOk("Image uploaded (remember to Save)." );
    } catch (e) {
      setErr(e?.message || "Image upload failed.");
    } finally {
      setSaving(false);
    }
  }

  function addPost() {
    const id = uid();
    const p = {
      id,
      created_at: new Date().toISOString(),
      title: "",
      body: "",
      tags: [],
      pinned: false,
      is_coupon: false,
      expires_at: null,
      imageKey: "",
      imageUrl: "",
    };
    setPosts((prev) => [p, ...prev]);
    setSelectedId(id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const next = posts.filter((p) => p.id !== selectedId);
    setPosts(next);
    setSelectedId(next[0]?.id || "");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imageSrc = selected?.imageKey
    ? `/r2/${selected.imageKey}?v=${encodeURIComponent(selected.imageKey)}`
    : selected?.imageUrl || "";

  const selectedIsClosed = !!(selected?.is_coupon && selected?.expires_at && new Date(selected.expires_at) < new Date());

  return (
    
    <main className="section">
      <div className="container-site space-y-6">
        <AdminNav
          eyebrow={`Admin · Posts · Season ${season}`}
          title="Posts"
          description="News + Mini-Games posts are stored in R2."
          publicHref="/news"
          publicLabel="← View Public News Page"
          rightExtra={
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline" type="button" onClick={load} disabled={loading || saving}>
                Refresh
              </button>
              <button className="btn btn-outline" type="button" onClick={addPost} disabled={saving}>
                New Post
              </button>
              <button className="btn btn-primary" type="button" onClick={() => saveAll(posts)} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          }
        />

        {err ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div> : null}
        {ok ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{ok}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-subtle bg-card-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">All Posts</div>
              <div className="text-xs text-muted">{posts.length}</div>
            </div>
            <div className="mt-3 space-y-2 max-h-[70vh] overflow-auto pr-1">
              {loading ? (
                <div className="text-sm text-muted">Loading…</div>
              ) : posts.length === 0 ? (
                <div className="text-sm text-muted">No posts yet.</div>
              ) : (
                posts.map((p) => {
                  const closed = !!(p?.is_coupon && p?.expires_at && new Date(p.expires_at) < new Date());
                  // Keep closed posts unclickable (matches public behavior), but allow the currently-selected one to remain editable.
                  const disabled = closed && p.id !== selectedId;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      disabled={disabled}
                      title={closed ? "Mini Game is closed (expired)" : undefined}
                      className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                        p.id === selectedId
                          ? "border-primary/50 bg-subtle-surface/40"
                          : disabled
                          ? "border-subtle bg-card-trans opacity-60 grayscale cursor-not-allowed"
                          : "border-subtle bg-card-trans hover:bg-subtle-surface/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{p.title || "(Untitled)"}</div>
                          <div className="text-[11px] text-muted truncate">{p.created_at ? new Date(p.created_at).toLocaleString() : ""}</div>
                          {p.is_coupon && p.expires_at ? (
                            <div className="text-[11px] text-muted truncate">
                              Closes: {new Date(p.expires_at).toLocaleString()} {closed ? "(Closed)" : ""}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {p.pinned ? (
                            <span className="text-[10px] px-2 py-1 rounded-full border border-primary/30 text-primary">PIN</span>
                          ) : null}
                          {p.is_coupon ? (
                            <span className="text-[10px] px-2 py-1 rounded-full border border-subtle text-muted">
                              MINI
                            </span>
                          ) : null}
                          {closed ? (
                            <span className="text-[10px] px-2 py-1 rounded-full border border-rose-400/30 text-rose-200">
                              CLOSED
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm">
            {!selected ? (
              <div className="text-sm text-muted">Select a post to edit.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">Edit Post</div>
                  <button className="btn btn-outline" type="button" onClick={deleteSelected} disabled={saving}>
                    Delete
                  </button>
                </div>

                <div className="grid gap-3">
                  <label className="text-xs text-muted">Title</label>
                  <input
                    className="input"
                    value={selected.title}
                    onChange={(e) => updateSelected({ title: e.target.value })}
                    placeholder="Post title"
                  />
                </div>

                <div className="grid gap-3">
                  <label className="text-xs text-muted">Body (supports basic HTML)</label>
                  <textarea
                    className="input min-h-[160px] resize-y"
                    value={selected.body}
                    onChange={(e) => updateSelected({ body: e.target.value })}
                    placeholder="Write your post…"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs text-muted">Tags (comma separated)</label>
                    <input
                      className="input"
                      value={selected.tags.join(", ")}
                      onChange={(e) => updateSelected({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted">Pinned</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.pinned}
                          onChange={(e) => updateSelected({ pinned: e.target.checked })}
                        />
                        <span className="text-sm text-muted">Show in pinned section</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted">Mini Game</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.is_coupon}
                          onChange={(e) => updateSelected({ is_coupon: e.target.checked, expires_at: e.target.checked ? selected.expires_at : null })}
                        />
                        <span className="text-sm text-muted">Treat this post as a Mini Game</span>
                      </div>

                      {selected.is_coupon ? (
                        <div className="mt-3">
                          <label className="text-xs text-muted">Sign-up close time</label>
                          <div className="mt-2 flex flex-col gap-2">
                            <input
                              className="input"
                              type="datetime-local"
                              value={isoToLocalInput(selected.expires_at)}
                              onChange={(e) => updateSelected({ expires_at: localInputToIso(e.target.value) })}
                            />
                            {selected.expires_at ? (
                              <div className={`text-xs ${selectedIsClosed ? "text-rose-200" : "text-muted"}`}>
                                {selectedIsClosed ? "Closed" : "Closes"}: {new Date(selected.expires_at).toLocaleString()}
                              </div>
                            ) : (
                              <div className="text-xs text-muted">Optional — leave blank to keep it open.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <label className="text-xs text-muted">Image (upload or paste external URL)</label>

                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadImage(e.target.files?.[0])}
                      disabled={saving}
                    />
                    <span className="text-xs text-muted">Uploads replace existing image for this post.</span>
                  </div>

                  <input
                    className="input"
                    value={selected.imageUrl}
                    onChange={(e) => updateSelected({ imageUrl: e.target.value, imageKey: "" })}
                    placeholder="https://... (optional external image URL)"
                  />

                  {imageSrc ? (
                    <div className="relative w-full max-w-[720px] h-[240px] rounded-2xl overflow-hidden border border-subtle bg-black/10">
                      <Image src={imageSrc} alt="Post image" fill className="object-contain p-2" />
                    </div>
                  ) : (
                    <div className="text-xs text-muted">No image.</div>
                  )}
                </div>

                <div className="text-xs text-muted">
                  Stored image path (if uploaded): <span className="font-mono">{selected.imageKey || "(none)"}</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
