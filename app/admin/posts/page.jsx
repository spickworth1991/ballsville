"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";
import { safeStr } from "@/lib/safe";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normalizeTags(v) {
  const tags = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(",").map((s) => s.trim()) : [];
  const out = [];
  const seen = new Set();
  for (const tag of tags) {
    const value = String(tag || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normPost(post, idx) {
  const id = String(post?.id || idx);
  const created_at = typeof post?.created_at === "string" ? post.created_at : new Date().toISOString();
  const media_type =
    typeof post?.media_type === "string" ? post.media_type : typeof post?.mediaType === "string" ? post.mediaType : "";
  const is_video = Boolean(post?.is_video ?? post?.isVideo);
  const expires_at_raw = post?.expires_at ?? post?.expiresAt ?? null;
  const expires_at = typeof expires_at_raw === "string" && expires_at_raw.trim() ? expires_at_raw : null;
  const pinned = Boolean(post?.pinned ?? post?.pin);
  const is_coupon = Boolean(post?.is_coupon);
  const imageKey = typeof post?.imageKey === "string" ? post.imageKey : "";
  const imageUrl = typeof post?.imageUrl === "string" ? post.imageUrl : typeof post?.image_url === "string" ? post.image_url : "";

  let tags = normalizeTags(post?.tags);
  const hasMini = tags.some((tag) => tag.toLowerCase() === "mini game");
  if (is_coupon && !hasMini) tags = ["Mini Game", ...tags];
  if (!is_coupon && hasMini) tags = tags.filter((tag) => tag.toLowerCase() !== "mini game");

  return {
    id,
    created_at,
    title: safeStr(post?.title).trim(),
    body: safeStr(post?.body).trim(),
    link: safeStr(post?.link || post?.url).trim(),
    tags,
    pinned,
    is_coupon,
    expires_at,
    imageKey,
    imageUrl,
    media_type,
    is_video,
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

function isVideoUrl(u) {
  const url = safeStr(u).toLowerCase();
  return url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg");
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

  const selected = useMemo(() => posts.find((post) => post.id === selectedId) || null, [posts, selectedId]);

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
      const res = await fetch("/api/admin/posts", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data?.posts) ? data.posts : [];
      const normalized = list.map(normPost);
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
      const payload = {
        posts: (nextPosts || []).map((post) => {
          let tags = normalizeTags(post?.tags);
          const hasMini = tags.some((tag) => tag.toLowerCase() === "mini game");
          if (post?.is_coupon && !hasMini) tags = ["Mini Game", ...tags];
          if (!post?.is_coupon && hasMini) tags = tags.filter((tag) => tag.toLowerCase() !== "mini game");

          return {
            id: String(post?.id || ""),
            title: safeStr(post?.title).trim(),
            body: safeStr(post?.body || ""),
            link: safeStr(post?.link || ""),
            tags,
            pin: !!post?.pinned,
            is_coupon: !!post?.is_coupon,
            expires_at: post?.expires_at ? String(post.expires_at) : null,
            created_at: post?.created_at ? String(post.created_at) : new Date().toISOString(),
            imageKey: typeof post?.imageKey === "string" ? post.imageKey : "",
            image_url: typeof post?.imageUrl === "string" ? post.imageUrl : "",
            media_type: typeof post?.media_type === "string" ? post.media_type : "",
            is_video: !!post?.is_video,
          };
        }),
      };

      const res = await fetch(`/api/admin/posts?season=${encodeURIComponent(String(season))}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed (${res.status}): ${text}`);
      }

      setOk("Saved.");
      setPosts(nextPosts.map(normPost));
    } catch (e) {
      setErr(e?.message || "Failed to save posts.");
    } finally {
      setSaving(false);
    }
  }

  function updateSelected(patch) {
    setPosts((prev) => prev.map((post) => (post.id === selectedId ? { ...post, ...patch } : post)));
  }

  async function uploadMedia(file) {
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

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Upload failed (${res.status})`);

      const key = String(data.key || "");
      const media_type = String(data.media_type || "").toLowerCase();

      updateSelected({
        imageKey: key,
        imageUrl: "",
        media_type: media_type === "video" || media_type === "image" ? media_type : "",
        is_video: media_type === "video",
      });

      setOk("Media uploaded (remember to save).");
    } catch (e) {
      setErr(e?.message || "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  function addPost() {
    const id = uid();
    const post = {
      id,
      created_at: new Date().toISOString(),
      title: "",
      body: "",
      link: "",
      tags: [],
      pinned: false,
      is_coupon: false,
      expires_at: null,
      imageKey: "",
      imageUrl: "",
      media_type: "",
      is_video: false,
    };
    setPosts((prev) => [post, ...prev]);
    setSelectedId(id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    if (!window.confirm("Delete this post?")) return;
    const next = posts.filter((post) => post.id !== selectedId);
    setPosts(next);
    setSelectedId(next[0]?.id || "");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mediaSrc = selected?.imageKey ? `/r2/${selected.imageKey}` : safeStr(selected?.imageUrl || "");
  const isMiniClosed = !!(selected?.is_coupon && selected?.expires_at && new Date(selected.expires_at) < new Date());

  return (
    <main className="section">
      <div className="container-site space-y-6">
        <AdminNav
          eyebrow={`Admin - Posts - Season ${season}`}
          title="Posts"
          description="News and Mini-Game posts are stored in R2."
          publicHref="/news"
          publicLabel="<- View Public News Page"
          rightExtra={
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline" type="button" onClick={load} disabled={loading || saving}>
                Refresh
              </button>
              <button className="btn btn-outline" type="button" onClick={addPost} disabled={saving}>
                New Post
              </button>
              <button className="btn btn-primary" type="button" onClick={() => saveAll(posts)} disabled={saving}>
                {saving ? "Saving..." : "Save"}
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

            <div className="mt-3 max-h-[70vh] space-y-2 overflow-auto pr-1">
              {loading ? (
                <div className="text-sm text-muted">Loading...</div>
              ) : posts.length === 0 ? (
                <div className="text-sm text-muted">No posts yet.</div>
              ) : (
                posts.map((post) => {
                  const closed = !!(post?.is_coupon && post?.expires_at && new Date(post.expires_at) < new Date());
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedId(post.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        post.id === selectedId
                          ? "border-primary/50 bg-subtle-surface/40"
                          : "border-subtle bg-card-trans hover:bg-subtle-surface/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{post.title || "(Untitled)"}</div>
                          <div className="truncate text-[11px] text-muted">
                            {post.created_at ? new Date(post.created_at).toLocaleString() : ""}
                          </div>
                          {post.is_coupon && post.expires_at ? (
                            <div className="truncate text-[11px] text-muted">
                              Closes: {new Date(post.expires_at).toLocaleString()} {closed ? "(Closed)" : ""}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {post.pinned ? <span className="rounded-full border border-primary/30 px-2 py-1 text-[10px] text-primary">PIN</span> : null}
                          {post.is_coupon ? <span className="rounded-full border border-subtle px-2 py-1 text-[10px] text-muted">MINI</span> : null}
                          {closed ? <span className="rounded-full border border-rose-400/30 px-2 py-1 text-[10px] text-rose-200">CLOSED</span> : null}
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

                {selected.is_coupon ? (
                  <div
                    className={`rounded-xl border p-3 text-xs ${
                      isMiniClosed ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-subtle bg-subtle-surface/30 text-muted"
                    }`}
                  >
                    {isMiniClosed
                      ? "This Mini Game is closed. You can still edit it here."
                      : "This post is marked as a Mini Game. Add an optional close time below."}
                  </div>
                ) : null}

                <div className="grid gap-3">
                  <label className="text-xs text-muted">Title</label>
                  <input className="input" value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} placeholder="Post title" />
                </div>

                <div className="grid gap-3">
                  <label className="text-xs text-muted">Body (supports basic HTML)</label>
                  <textarea
                    className="input min-h-[160px] resize-y"
                    value={selected.body}
                    onChange={(e) => updateSelected({ body: e.target.value })}
                    placeholder="Write your post..."
                  />
                </div>

                <div className="grid gap-3">
                  <label className="text-xs text-muted">Primary link (optional)</label>
                  <input
                    className="input"
                    value={selected.link || ""}
                    onChange={(e) => updateSelected({ link: e.target.value })}
                    placeholder="https://..."
                  />
                  <div className="text-[11px] text-muted">This becomes a clean call-to-action button on the public news page.</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs text-muted">Tags (comma separated)</label>
                    <input
                      className="input"
                      value={selected.tags.join(", ")}
                      onChange={(e) => updateSelected({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    />
                    <div className="text-[11px] text-muted">Tip: the "Mini Game" tag is handled automatically by the Mini Game checkbox.</div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted">Pinned</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="checkbox" checked={selected.pinned} onChange={(e) => updateSelected({ pinned: e.target.checked })} />
                        <span className="text-sm text-muted">Show in pinned section</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted">Mini Game</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.is_coupon}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            updateSelected({
                              is_coupon: checked,
                              expires_at: checked ? selected.expires_at : null,
                            });
                          }}
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
                              <div className={`text-xs ${isMiniClosed ? "text-rose-200" : "text-muted"}`}>
                                {isMiniClosed ? "Closed" : "Closes"}: {new Date(selected.expires_at).toLocaleString()}
                              </div>
                            ) : (
                              <div className="text-xs text-muted">Optional - leave blank to keep it open.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <label className="text-xs text-muted">Media (upload or paste external URL)</label>

                  <div className="flex flex-wrap items-center gap-2">
                    <input type="file" accept="image/*,video/*" onChange={(e) => uploadMedia(e.target.files?.[0])} disabled={saving} />
                    <span className="text-xs text-muted">Uploads replace existing media for this post.</span>
                  </div>

                  <input
                    className="input"
                    value={selected.imageUrl}
                    onChange={(e) => updateSelected({ imageUrl: e.target.value, imageKey: "" })}
                    placeholder="https://... (optional external image or video URL)"
                  />

                  {mediaSrc ? (
                    <div className="w-full max-w-[720px] overflow-hidden rounded-2xl border border-subtle bg-black/10">
                      {isVideoUrl(mediaSrc) ? (
                        <div className="aspect-[16/9] w-full">
                          <video key={mediaSrc} className="h-full w-full object-contain" controls playsInline preload="metadata">
                            <source src={mediaSrc} />
                          </video>
                        </div>
                      ) : (
                        <div className="relative h-[240px] w-full">
                          <Image src={mediaSrc} alt="Post media" fill className="object-contain p-2" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted">No media.</div>
                  )}
                </div>

                <div className="text-xs text-muted">
                  Stored media key (if uploaded): <span className="font-mono">{selected.imageKey || "(none)"}</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
