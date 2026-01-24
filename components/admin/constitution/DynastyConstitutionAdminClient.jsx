"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";
import { safeStr } from "@/lib/safe";

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function slugify(s) {
  return safeStr(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

async function getAuthToken() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

function normalizeClientSections(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const cleaned = arr
    .map((s, idx) => {
      const title = safeStr(s?.title).trim();
      const id = slugify(s?.id || s?.anchor || title || `section-${idx + 1}`);
      const order = toInt(s?.order, idx + 1);
      const bodyHtml = safeStr(s?.bodyHtml || s?.html || "");
      return { id, title, order, bodyHtml };
    })
    .filter((s) => s.title);

  cleaned.sort((a, b) => a.order - b.order);
  cleaned.forEach((s, i) => {
    s.order = i + 1;
    // keep id stable if already set; otherwise derive from title
    if (!s.id) s.id = slugify(s.title || `section-${i + 1}`);
  });
  return cleaned;
}

export default function DynastyConstitutionAdminClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [updatedAt, setUpdatedAt] = useState("");
  const [sections, setSections] = useState([]);

  const apiUrl = "/api/admin/dynasty-constitution";

  async function load() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No admin session. Please sign in again.");

      const res = await fetch(apiUrl, {
        headers: { authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed to load (${res.status})`);

      const data = json?.data || {};
      setUpdatedAt(safeStr(data?.updatedAt || ""));
      setSections(normalizeClientSections(data?.sections || []));
    } catch (e) {
      setError(e?.message || "Failed to load dynasty constitution.");
      setUpdatedAt("");
      setSections([]);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No admin session. Please sign in again.");

      const payload = {
        sections: sections.map((s, idx) => ({
          // server will normalize + renumber; we send what user edited
          id: safeStr(s?.id || ""),
          title: safeStr(s?.title || "").trim(),
          order: toInt(s?.order, idx + 1),
          bodyHtml: safeStr(s?.bodyHtml || ""),
        })),
      };

      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      setSuccess(`Saved · ${json.count} sections`);
      // Reload so we reflect server-normalized numbering + updatedAt
      await load();
    } catch (e) {
      setError(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function addSection() {
    setSuccess("");
    setSections((prev) => {
      const nextOrder = (Array.isArray(prev) ? prev.length : 0) + 1;
      return [
        ...prev,
        {
          id: `section-${Date.now()}`,
          title: "",
          order: nextOrder,
          bodyHtml: "",
        },
      ];
    });
  }

  function removeSection(id) {
    setSuccess("");
    setSections((prev) => normalizeClientSections((prev || []).filter((s) => s.id !== id)));
  }

  function updateSection(id, patch) {
    setSuccess("");
    setSections((prev) =>
      (prev || []).map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        // If title changes and id looks auto-generated, keep id in sync.
        if (patch?.title != null && (!s.id || String(s.id).startsWith("section-"))) {
          next.id = slugify(patch.title) || s.id;
        }
        return next;
      })
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  return (
    <main className="min-h-screen text-fg relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          <header className="rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">ADMIN</p>
                <h1 className="text-2xl sm:text-3xl font-semibold text-primary">
                  Dynasty Constitution
                </h1>
                <p className="text-sm text-muted">
                  Edit sections, reorder them, and publish instantly.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link prefetch={false} href="/constitution/dynasty" className="btn btn-outline">
                  View Public
                </Link>
                <Link prefetch={false} href="/admin" className="btn btn-outline">
                  Admin Home
                </Link>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-end gap-3">
              <div className="flex-1" />

              <button
                type="button"
                onClick={addSection}
                className="btn btn-outline"
                disabled={loading || saving}
              >
                + Add section
              </button>

              <button
                type="button"
                onClick={save}
                className="btn btn-primary"
                disabled={loading || saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 text-muted">
                Live · Last updated {updatedAt ? fmtDate(updatedAt) : "—"}
              </span>
              {success ? (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-950/30 px-3 py-1 text-emerald-200">
                  {success}
                </span>
              ) : null}
              {error ? (
                <span className="rounded-full border border-red-500/25 bg-red-950/30 px-3 py-1 text-red-200">
                  {error}
                </span>
              ) : null}
            </div>
          </header>

          {loading ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-6 text-muted">Loading…</div>
          ) : (
            <div className="space-y-6">
              {(sections || []).map((s) => (
                <section
                  key={s.id}
                  className="rounded-3xl border border-subtle bg-card-surface shadow-sm p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-subtle bg-card-trans px-3 text-sm font-semibold text-primary">
                          {toInt(s.order, 1)}
                        </span>
                        <div className="text-sm text-muted">
                          Anchor: <span className="text-fg">#{slugify(s.id || s.title)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeSection(s.id)}
                      className="rounded-xl border border-red-500/25 bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-950/35"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[140px_1fr] md:items-start">
                    <label className="text-sm text-muted">
                      Order
                      <input
                        value={toInt(s.order, 1)}
                        onChange={(e) => updateSection(s.id, { order: toInt(e.target.value, s.order) })}
                        className="mt-1 block w-full rounded-xl border border-subtle bg-card-trans px-3 py-2 text-fg"
                        inputMode="numeric"
                      />
                    </label>

                    <label className="text-sm text-muted">
                      Title
                      <input
                        value={safeStr(s.title)}
                        onChange={(e) => updateSection(s.id, { title: e.target.value })}
                        className="mt-1 block w-full rounded-xl border border-subtle bg-card-trans px-3 py-2 text-fg"
                        placeholder="Section title"
                      />
                    </label>
                  </div>

                  <label className="text-sm text-muted block">
                    Body (HTML)
                    <textarea
                      value={safeStr(s.bodyHtml)}
                      onChange={(e) => updateSection(s.id, { bodyHtml: e.target.value })}
                      className="mt-1 block w-full min-h-[180px] rounded-2xl border border-subtle bg-card-trans px-4 py-3 font-mono text-xs text-fg"
                      placeholder="<p>Write your content here…</p>"
                    />
                  </label>
                </section>
              ))}

              {!sections?.length ? (
                <div className="rounded-2xl border border-subtle bg-card-surface p-6 text-muted">
                  No sections yet. Click “Add section” to start.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
