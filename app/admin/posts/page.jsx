// app/admin/posts/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

// --- helpers mapping coupon -> mini game ---

function isMiniGame(row) {
  return !!row.is_coupon;
}

function isClosed(row) {
  return isMiniGame(row) && row.expires_at && new Date(row.expires_at) < new Date();
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
    const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || new Date(b.created_at) - new Date(a.created_at);
  });

  regularPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
    is_mini_game: false, // <- local alias; maps to is_coupon
    expires_at: "",
    imageFile: null,
    image_url: ""
  });

  const ADMIN_EMAILS = useMemo(parseAdmins, []);
  const isAdmin = !!user && ADMIN_EMAILS.includes((user?.email || "").toLowerCase());

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

  function resetForm() {
    setEditing(null);
    setForm({
      title: "",
      body: "",
      tags: "",
      is_mini_game: false,
      expires_at: "",
      imageFile: null,
      image_url: ""
    });
  }

  async function handleUploadImage(file) {
    if (!file) return null;
    const supabase = getSupabase();
    if (!supabase) throw new Error("Please try again in the browser.");

    const { data: { user } } = await supabase.auth.getUser();
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
    const { data: { user } } = await supabase.auth.getUser();
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
        is_coupon: !!form.is_mini_game, // <- map to DB field
        expires_at: form.expires_at
          ? new Date(form.expires_at).toISOString()
          : null,
        tags,
      });

      if (error) throw error;
      resetForm();
      const { data } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setPosts(data || []);
    } catch (err) {
      alert(err.message || "Failed to create");
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const supabase = getSupabase();
    if (!supabase) return alert("Please open this page in a browser.");
    const { data: { user } } = await supabase.auth.getUser();
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
          is_coupon: !!form.is_mini_game, // <- map
          expires_at: form.expires_at
            ? new Date(form.expires_at).toISOString()
            : null,
          tags,
        })
        .eq("id", editing.id);

      if (error) throw error;
      resetForm();
      const { data } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setPosts(data || []);
    } catch (err) {
      alert(err.message || "Failed to update");
    }
  }

  async function handleDelete(id) {
    if (!isAdmin) return;
    if (!confirm("Delete this post?")) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (!error) {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setPosts(data || []);
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
  }

  const display = useMemo(() => sortForDisplay(posts), [posts]);

  // ---------- gated renders ----------
  if (!userChecked) {
    return (
      <section className="section">
        <div className="container-site max-w-xl">
          <div className="card p-6">Checking access…</div>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="container-site max-w-xl text-center">
          <h1 className="h2 mb-2">Access required</h1>
          <p className="text-muted">
            Only Ballsville admins have access here. If this is a mistake, please contact the site developer.
          </p>
          <a href="/admin/login" className="btn btn-primary mt-6">
            Go to Login
          </a>
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="section">
        <div className="container-site max-w-xl text-center">
          <h1 className="h2 mb-2">No access</h1>
          <p className="text-muted">
            Sorry, you do not have access to this page.
          </p>
          <button
            className="btn btn-outline mt-6"
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
      <div className="container-site max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="h2">Posts / Mini Games</h1>
          <button
            className="btn btn-outline"
            onClick={async () => {
              const supabase = getSupabase();
              if (supabase) await supabase.auth.signOut();
              location.href = "/admin/login";
            }}
          >
            Sign out
          </button>
        </div>

        {/* Create / Edit form */}
        <section className="card p-6 space-y-4 mb-8">
          <h2 className="text-xl font-semibold">
            {editing ? "Edit Post / Mini Game" : "Create New Post or Mini Game"}
          </h2>

          <form
            onSubmit={editing ? handleUpdate : handleCreate}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <label className="block">
              <span className="text-sm text-muted">Title *</span>
              <input
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-muted">Body</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Image (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-subtle bg-transparent px-3 py-2"
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    imageFile: e.target.files?.[0] || null,
                  }))
                }
              />
            </label>

            <div className="flex items-center gap-3">
              <input
                id="is_mini_game"
                type="checkbox"
                checked={form.is_mini_game}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    is_mini_game: e.target.checked,
                  }))
                }
              />
              <label htmlFor="is_mini_game">
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, expires_at: e.target.value }))
                }
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
              />
              {!!form.is_mini_game && (
                <p className="text-xs text-muted mt-1">
                  Tip: “Mini Game” will be added automatically.
                </p>
              )}
            </label>

            <div className="md:col-span-2 flex gap-3">
              <button className="btn btn-primary" type="submit">
                {editing ? "Save Changes" : "Publish"}
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

        {/* List */}
        <section className="card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Recent Posts</h2>
          {loading ? (
            <div>Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead className="text-sm text-muted">
                  <tr>
                    <th className="px-3">Title</th>
                    <th className="px-3">Type</th>
                    <th className="px-3">Tags</th>
                    <th className="px-3 whitespace-nowrap">
                      Sign-up closes
                    </th>
                    <th className="px-3 whitespace-nowrap">Created</th>
                    <th className="px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {display.map((p) => {
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
                      <tr key={p.id} className="align-top">
                        <td className="px-3 font-medium">{p.title}</td>
                        <td className="px-3">
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
                        <td className="px-3 text-sm">
                          {tags.length ? tags.join(", ") : "—"}
                        </td>
                        <td className="px-3 text-sm">
                          {isMiniGame(p) && p.expires_at
                            ? new Date(p.expires_at).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 text-sm">
                          {new Date(p.created_at).toLocaleString()}
                        </td>
                        <td className="px-3">
                          <div className="flex items-center gap-2">
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
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
