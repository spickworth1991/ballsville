"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function slugify(s) {
  return safeStr(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSections(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const cleaned = rows
    .map((s, i) => {
      const title = safeStr(s?.title || "").trim();
      const id = slugify(s?.id || s?.anchor || title || `section-${i + 1}`);
      const order = Number.isFinite(Number(s?.order)) ? Number(s.order) : i + 1;
      const bodyHtml = safeStr(s?.bodyHtml || s?.html || "").trim();
      return { id, title, order, bodyHtml };
    })
    .filter((s) => s.id && s.title);

  cleaned.sort((a, b) => a.order - b.order);
  return cleaned.map((s, idx) => ({ ...s, order: idx + 1 }));
}

export default function ConstitutionAdminClient() {
  const API = "/api/admin/constitution";

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [updatedAt, setUpdatedAt] = useState("");
  const [sections, setSections] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setNotice("");

    fetch(API)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;

        // ✅ main constitution API returns { ok, data }
        const data = json?.data || {};
        const normalized = normalizeSections(data?.sections || data?.items || []);
        setSections(normalized);
        setUpdatedAt(safeStr(data?.updatedAt || ""));
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load constitution.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toc = useMemo(
    () => sections.map((s) => ({ id: s.id, label: `${s.order}. ${s.title}` })),
    [sections]
  );

  function updateSection(id, patch) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => {
      const nextOrder = prev.length + 1;
      const id = `section-${nextOrder}`;
      return [...prev, { id, title: `New Section ${nextOrder}`, order: nextOrder, bodyHtml: "" }];
    });
  }

  function deleteSection(id) {
    setSections((prev) => {
      const kept = prev.filter((s) => s.id !== id);
      return kept.map((s, idx) => ({ ...s, order: idx + 1 }));
    });
  }

  function moveSection(id, dir) {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapWith = dir < 0 ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      const t = next[idx];
      next[idx] = next[swapWith];
      next[swapWith] = t;
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        updatedAt: nowIso(),
        sections: normalizeSections(sections),
      };

      // ✅ main constitution API expects PUT
      const res = await fetch(API, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Save failed (${res.status})`);
      }

      const json = await res.json().catch(() => ({}));

      // ✅ main constitution API returns { ok, manifest, data }
      const data = json?.data || payload;

      setUpdatedAt(safeStr(data?.updatedAt || payload.updatedAt));
      setSections(normalizeSections(data?.sections || payload.sections));
      setNotice("Published to R2.");
    } catch (e) {
      setError(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-accent">ADMIN</p>
                <h1 className="text-2xl md:text-3xl font-semibold text-primary">League Constitution</h1>
                <p className="text-sm text-muted mt-1">
                  Edit sections and publish to R2.
                  {updatedAt ? ` Last updated ${updatedAt.slice(0, 10)}.` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href="/constitution" prefetch={false} className="btn btn-outline">
                  View Live
                </Link>
                <button className="btn btn-outline" onClick={addSection} type="button">
                  + Add Section
                </button>
                <button className="btn btn-primary" onClick={save} disabled={saving} type="button">
                  {saving ? "Publishing…" : "Publish"}
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-950/30 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-950/30 p-3 text-sm text-emerald-200">
                {notice}
              </div>
            ) : null}
          </header>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start">
            <aside className="space-y-3">
              <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-primary uppercase tracking-wide m-0">Table of Contents</h2>
                <div className="mt-3 space-y-1">
                  {!loaded ? (
                    <div className="text-sm text-muted">Loading…</div>
                  ) : toc.length === 0 ? (
                    <div className="text-sm text-muted">No sections yet.</div>
                  ) : (
                    toc.map((t) => (
                      <a
                        key={t.id}
                        href={`#${t.id}`}
                        className="block rounded-lg px-3 py-2 text-sm text-muted hover:text-primary hover:bg-subtle-surface"
                      >
                        {t.label}
                      </a>
                    ))
                  )}
                </div>
              </div>
            </aside>

            <div className="space-y-6">
              {!loaded ? (
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted text-center">
                  Loading…
                </div>
              ) : sections.length === 0 ? (
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-sm text-muted">
                  No constitution sections yet.
                </div>
              ) : (
                sections.map((s, idx) => (
                  <section
                    key={s.id}
                    id={s.id}
                    className="scroll-mt-28 rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[200px] flex-1">
                        <label className="label">Title</label>
                        <input
                          className="input mt-1"
                          value={s.title}
                          onChange={(e) => updateSection(s.id, { title: e.target.value })}
                        />
                        <div className="mt-2 text-xs text-muted">ID: {s.id}</div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => moveSection(s.id, -1)}
                          disabled={idx === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => moveSection(s.id, 1)}
                          disabled={idx === sections.length - 1}
                        >
                          ↓
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => deleteSection(s.id)}>
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="label">HTML body</label>
                      <textarea
                        className="input mt-1"
                        rows={10}
                        value={s.bodyHtml}
                        onChange={(e) => updateSection(s.id, { bodyHtml: e.target.value })}
                      />
                      <p className="mt-2 text-xs text-muted">
                        Tip: paste HTML from your editor. (The public page renders this as-is.)
                      </p>
                    </div>
                  </section>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
