// app/admin/posts/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

// --- helpers mapping coupon -> mini game ---

function isMiniGame(row) {
  return !!row.is_coupon;
}

function isClosed(row) {
  return (
    isMiniGame(row) &&
    row.expires_at &&
    new Date(row.expires_at) < new Date()
  );
}

function sortForDisplay(rows) {
  const now = new Date();
  const activeMini = [];
  const regularPosts = [];
  const closedMini = [];

  for (const r of rows) {
    if (isMiniGame(r)) {
      const closed = r.expires_at ? new Date(r.expires_at) < now : false;
      if (closed) closedMini.push(r);
      else activeMini.push(r);
    } else {
      regularPosts.push(r);
    }
  }

  activeMini.sort((a, b) => {
    const aTime = a.expires_at
      ? new Date(a.expires_at).getTime()
      : Number.MAX_SAFE_INTEGER;
    const bTime = b.expires_at
      ? new Date(b.expires_at).getTime()
      : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || new Date(b.created_at) - new Date(a.created_at);
  });

  regularPosts.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  closedMini.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return [...activeMini, ...regularPosts, ...closedMini];
}

function parseAdmins() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminPostsPage() {
  const [user, setUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    tags: "",
    is_mini_game: false, // local alias; maps to is_coupon
    expires_at: "",
    imageFile: null,
    image_url: "",
  });
  const [formDirty, setFormDirty] = useState(false); // track unsaved changes

  const [showFormModal, setShowFormModal] = useState(false);

  // recent-posts filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "post" | "mini"

  const ADMIN_EMAILS = useMemo(parseAdmins, []);
  const isAdmin =
    !!user && ADMIN_EMAILS.includes((user?.email || "").toLowerCase());

  const sortedPosts = useMemo(() => sortForDisplay(posts), [posts]);

  const filteredPosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sortedPosts.filter((p) => {
      // type filter
      if (typeFilter === "post" && isMiniGame(p)) return false;
      if (typeFilter === "mini" && !isMiniGame(p)) return false;

      if (!term) return true;

      const inTitle = (p.title || "").toLowerCase().includes(term);
      const inBody = (p.body || "").toLowerCase().includes(term);
      const inTags = (p.tags || [])
        .join(", ")
        .toLowerCase()
        .includes(term);

      return inTitle || inBody || inTags;
    });
  }, [sortedPosts, searchTerm, typeFilter]);

  // Check user once on mount
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

  // Fetch posts only if allowed
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
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error) setPosts(data || []);
      setLoading(false);
    }
    run();
  }, [userChecked, isAdmin]);

  async function reloadPosts() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setPosts(data || []);
  }

  function resetForm() {
    setEditing(null);
    setForm({
      title: "",
      body: "",
      tags: "",
      is_mini_game: false,
      expires_at: "",
      imageFile: null,
      image_url: "",
    });
    setFormDirty(false);
  }

  function openCreateModal() {
    resetForm();
    setShowFormModal(true);
  }

  function attemptCloseModal() {
    const hasContent =
      form.title.trim() ||
      form.body.trim() ||
      form.tags.trim() ||
      form.expires_at ||
      form.imageFile;
    if (formDirty && hasContent) {
      const discard = window.confirm(
        "You have unsaved changes to this post.\n\nOK = Discard changes and close.\nCancel = Keep editing."
      );
      if (!discard) return;
    }
    resetForm();
    setShowFormModal(false);
  }

  async function handleUploadImage(file) {
    if (!file) return null;
    const supabase = getSupabase();
    if (!supabase) throw new Error("Please try again in the browser.");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("You are signed out. Please log in again.");

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const rand =
      globalThis.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const key = `${rand}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("news")
      .upload(key, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from("news").getPublicUrl(key);
    return pub?.publicUrl || null;
  }

  function buildTagsArray(raw, isMini) {
    const seen = new Set();
    const out = [];
    const push = (t) => {
      const key = (t || "").trim();
      if (!key) return;
      const lower = key.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        out.push(key[0].toUpperCase() + key.slice(1));
      }
    };
    (raw || "").split(",").forEach((t) => push(t));
    if (isMini) push("Mini Game");
    return out;
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const supabase = getSupabase();
    if (!supabase) return alert("Please open this page in a browser.");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Please sign in again.");
      location.href = "/admin/login";
      return;
    }

    try {
      let image_url = form.image_url || null;
      if (form.imageFile) image_url = await handleUploadImage(form.imageFile);

      const tags = buildTagsArray(form.tags, form.is_mini_game);
      const { error } = await supabase.from("posts").insert({
        title: form.title.trim(),
        body: form.body.trim(),
        image_url,
        is_coupon: !!form.is_mini_game,
        expires_at: form.expires_at
          ? new Date(form.expires_at).toISOString()
          : null,
        tags,
      });

      if (error) throw error;
      resetForm();
      setShowFormModal(false);
      await reloadPosts();
    } catch (err) {
      alert(err.message || "Failed to create");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const supabase = getSupabase();
    if (!supabase) return alert("Please open this page in a browser.");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Please sign in again.");
      location.href = "/admin/login";
      return;
    }

    try {
      let image_url = form.image_url || editing?.image_url || null;
      if (form.imageFile) image_url = await handleUploadImage(form.imageFile);

      const tags = buildTagsArray(form.tags, form.is_mini_game);
      const { error } = await supabase
        .from("posts")
        .update({
          title: form.title.trim(),
          body: form.body.trim(),
          image_url,
          is_coupon: !!form.is_mini_game,
          expires_at: form.expires_at
            ? new Date(form.expires_at).toISOString()
            : null,
          tags,
        })
        .eq("id", editing.id);

      if (error) throw error;
      resetForm();
      setShowFormModal(false);
      await reloadPosts();
    } catch (err) {
      alert(err.message || "Failed to update");
    }
  }

  // 🔴 Delete with BALLSVILLE confirmation
  async function handleDelete(id) {
    if (!isAdmin) return;

    const text = window.prompt(
      'To permanently delete this post, type "BALLSVILLE" below:'
    );
    if (!text || text.trim().toLowerCase() !== "ballsville") {
      alert("Delete cancelled.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (!error) {
      await reloadPosts();
    }
  }

  function beginEdit(p) {
    setEditing(p);
    setForm({
      title: p.title || "",
      body: p.body || "",
      image_url: p.image_url || "",
      imageFile: null,
      is_mini_game: !!p.is_coupon,
      expires_at: p.expires_at
        ? new Date(p.expires_at).toISOString().slice(0, 16)
        : "",
      tags: (p.tags || []).join(", "),
    });
    setFormDirty(false);
    setShowFormModal(true);
  }

  // ---------- gated renders ----------
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
            Only Ballsville admins have access here. If this is a mistake, please
            contact the site developer.
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

  // ---------- admin UI ----------
  return (
    <section className="section">
      <div className="container-site max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <div>
            <span className="badge">Admins</span>
            <p className="text-xs uppercase tracking-[0.3em] text-accent mt-2">
              Admin · News &amp; Mini Games
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold mt-1">
              Posts &amp; Mini Games
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href="/admin" className="btn btn-outline text-xs sm:text-sm">
              ← Admin Home
            </a>
            <button
              className="btn btn-outline text-xs sm:text-sm"
              onClick={async () => {
                const supabase = getSupabase();
                if (supabase) await supabase.auth.signOut();
                location.href = "/admin/login";
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Quick create card with New Post button */}
        <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-primary">
                Publish a new update
              </h2>
              <p className="text-xs text-muted max-w-prose">
                Use this to post announcements, side pots, or{" "}
                <span className="font-semibold">Mini Games</span> to the News
                page. Mini Games can include signup deadlines and extra tags.
              </p>
            </div>
            <button
              className="btn btn-primary text-xs sm:text-sm"
              type="button"
              onClick={openCreateModal}
            >
              + New Post
            </button>
          </div>
        </div>

        {/* Recent Posts (restyled + filters) */}
        <section className="card bg-card-surface border border-subtle p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-primary">
                Recent Posts &amp; Mini Games
              </h2>
              <p className="text-xs text-muted">
                Active Mini Games show first, then regular posts, then closed
                mini games.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
              <input
                className="input !h-8 !py-1 text-xs sm:text-sm"
                placeholder="Search title, body, tags…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="input !h-8 !py-1 text-xs sm:text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All types</option>
                <option value="post">Posts only</option>
                <option value="mini">Mini Games only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-muted text-sm">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2 text-sm">
                <thead className="text-[11px] text-muted">
                  <tr>
                    <th className="px-3 py-1">Title</th>
                    <th className="px-3 py-1">Type</th>
                    <th className="px-3 py-1">Tags</th>
                    <th className="px-3 py-1 whitespace-nowrap">
                      Sign-up closes
                    </th>
                    <th className="px-3 py-1 whitespace-nowrap">Created</th>
                    <th className="px-3 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((p) => {
                    const closed = isClosed(p);
                    const typeLabel = isMiniGame(p)
                      ? closed
                        ? "Mini Game (Closed)"
                        : "Mini Game"
                      : "Post";

                    const tags = [
                      ...(p.tags || []),
                      ...(closed && isMiniGame(p) ? ["Mini Game (Closed)"] : []),
                    ];

                    return (
                      <tr
                        key={p.id}
                        className="align-top bg-panel border border-subtle/60 rounded-xl"
                      >
                        <td className="px-3 py-2 font-medium text-fg">
                          <div className="flex flex-col gap-1">
                            <span>{p.title}</span>
                            {p.body && (
                              <span className="text-[11px] text-muted line-clamp-2">
                                {p.body}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span
                            className="badge"
                            style={
                              isMiniGame(p) && !closed
                                ? {
                                    background:
                                      "color-mix(in oklab, var(--color-success) 18%, transparent)",
                                    color: "var(--color-success)",
                                  }
                                : undefined
                            }
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle text-xs text-muted max-w-[200px]">
                          {tags.length ? tags.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle text-xs text-muted whitespace-nowrap">
                          {isMiniGame(p) && p.expires_at
                            ? new Date(p.expires_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle text-xs text-muted whitespace-nowrap">
                          {new Date(p.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              className="text-primary underline underline-offset-4"
                              onClick={() => beginEdit(p)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-danger underline underline-offset-4"
                              onClick={() => handleDelete(p.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!posts.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-muted"
                      >
                        No posts yet.
                      </td>
                    </tr>
                  )}
                  {!!posts.length && !filteredPosts.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-muted text-xs"
                      >
                        No posts match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* CREATE / EDIT MODAL (modular publish area) */}
      {showFormModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="card bg-bg border border-subtle max-w-2xl w-full mx-4 p-6 space-y-4 relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-primary">
                {editing ? "Edit Post / Mini Game" : "Create New Post / Mini Game"}
              </h2>
              <button
                type="button"
                className="text-muted hover:text-fg"
                onClick={attemptCloseModal}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={editing ? handleUpdate : handleCreate}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"
            >
              <label className="block md:col-span-2">
                <span className="text-sm text-muted">Title *</span>
                <input
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                  required
                  value={form.title}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, title: e.target.value }));
                    setFormDirty(true);
                  }}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm text-muted">Body</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2 min-h-[120px]"
                  value={form.body}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, body: e.target.value }));
                    setFormDirty(true);
                  }}
                />
              </label>

              <label className="block">
                <span className="text-sm text-muted">Image (optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      imageFile: e.target.files?.[0] || null,
                    }));
                    setFormDirty(true);
                  }}
                />
                {editing?.image_url && (
                  <p className="mt-1 text-xs text-muted truncate">
                    Current: {editing.image_url}
                  </p>
                )}
              </label>

              <div className="flex items-center gap-3">
                <input
                  id="is_mini_game"
                  type="checkbox"
                  checked={form.is_mini_game}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      is_mini_game: e.target.checked,
                    }));
                    setFormDirty(true);
                  }}
                />
                <label htmlFor="is_mini_game" className="text-fg">
                  This is a <strong>mini game</strong>
                </label>
              </div>

              <label className="block">
                <span className="text-sm text-muted">
                  Sign-up closes (optional)
                </span>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                  value={form.expires_at}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, expires_at: e.target.value }));
                    setFormDirty(true);
                  }}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm text-muted">
                  Tags (comma-separated)
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                  placeholder="Announcement, Side Pot, Mini Game"
                  value={form.tags}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, tags: e.target.value }));
                    setFormDirty(true);
                  }}
                />
                {!!form.is_mini_game && (
                  <p className="text-xs text-muted mt-1">
                    Tip: “Mini Game” will be added automatically.
                  </p>
                )}
              </label>

              <div className="md:col-span-2 flex gap-3 justify-end pt-2">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={attemptCloseModal}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit">
                  {editing ? "Save Changes" : "Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
