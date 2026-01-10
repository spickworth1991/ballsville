"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CURRENT_SEASON } from "@/lib/season";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function cleanSlug(s) {
  return safeStr(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function deriveSlug(row) {
  const existing = cleanSlug(row?.modeSlug || row?.slug || row?.id || row?.name);
  if (existing) return existing;
  return cleanSlug(row?.title || row?.name);
}

async function apiGet(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export default function DraftCompareAdminClient() {
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr("");
      setMsg("");
      setLoading(true);
      try {
        const data = await apiGet(`/api/admin/draft-compare?season=${encodeURIComponent(String(season))}&type=modes`);
        const next = safeArray(data?.rows || data || []);
        if (!cancelled) setRows(next);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [season]);

  const normalized = useMemo(() => {
    return safeArray(rows).map((r) => ({
      ...r,
      modeSlug: deriveSlug(r),
      title: safeStr(r?.title || r?.name || ""),
      subtitle: safeStr(r?.subtitle || r?.blurb || ""),
      order: Number(r?.order || 0) || 0,
      year: Number(r?.year || season) || season,
      imageKey: safeStr(r?.imageKey || r?.image_key || ""),
      image_url: safeStr(r?.image_url || r?.imageUrl || r?.image || ""),
      hasDraftJson: !!r?.hasDraftJson,
    }));
  }, [rows, season]);

  const addMode = () => {
    setRows((prev) => [
      ...safeArray(prev),
      {
        modeSlug: "", // auto-derived from title on save
        title: "",
        subtitle: "",
        order: safeArray(prev).length + 1,
        year: season,
        imageKey: "",
        image_url: "",
        hasDraftJson: false,
      },
    ]);
  };

  const updateRow = (idx, patch) => {
    setRows((prev) => {
      const next = safeArray(prev).slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removeRow = (idx) => {
    setRows((prev) => safeArray(prev).filter((_, i) => i !== idx));
  };

  const saveModes = async () => {
    setErr("");
    setMsg("");
    setSaving(true);
    try {
      const payload = normalized
        .map((r) => ({
          // IMPORTANT: do not auto-change existing slugs (modeSlug is derived
          // from the stored slug when present; otherwise it is derived from title).
          modeSlug: cleanSlug(r.modeSlug),
          title: safeStr(r.title).trim(),
          subtitle: safeStr(r.subtitle).trim(),
          order: Number(r.order || 0) || 0,
          year: Number(r.year || season) || season,
          imageKey: safeStr(r.imageKey).trim(),
          image_url: safeStr(r.image_url).trim(),
        }))
        .filter((r) => r.modeSlug && r.title);

      await apiPost(`/api/admin/draft-compare`, {
        season,
        type: "modes",
        rows: payload,
      });

      setMsg("Saved.");
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const uploadDraftJson = async (modeSlug, file) => {
    if (!modeSlug) {
      setErr("Mode slug is required before uploading JSON.");
      return;
    }
    setErr("");
    setMsg("");
    setSaving(true);
    try {
      const text = await file.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON file.");
      }

      await apiPost(`/api/admin/draft-compare`, {
        season,
        type: "drafts",
        modeSlug,
        data: json,
      });

      // Mark as uploaded in UI
      setRows((prev) =>
        safeArray(prev).map((r) => {
          const slug = cleanSlug(r?.modeSlug || r?.slug || r?.id || r?.name);
          return slug === modeSlug ? { ...r, hasDraftJson: true } : r;
        })
      );

      setMsg(`Uploaded draft JSON for ${modeSlug}.`);
    } catch (e) {
      setErr(e?.message || "Upload failed.");
    } finally {
      setSaving(false);
    }
  };

  const uploadModeImage = async (modeSlug, file) => {
    if (!modeSlug) {
      setErr("Mode slug is required before uploading an image.");
      return;
    }
    setErr("");
    setMsg("");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("section", "draft-compare-mode");
      form.append("season", String(season));
      form.append("modeSlug", modeSlug);

      const res = await fetch(`/api/admin/upload`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Upload failed (${res.status})`);

      // Persist the returned key/url onto the mode row so Save modes writes it.
      const imageKey = safeStr(data?.key);
      const image_url = safeStr(data?.url);
      setRows((prev) =>
        safeArray(prev).map((r) => {
          const slug = cleanSlug(r?.modeSlug || r?.slug || r?.id || r?.name);
          return slug === modeSlug ? { ...r, imageKey, image_url } : r;
        })
      );

      setMsg(`Uploaded image for ${modeSlug}.`);
    } catch (e) {
      setErr(e?.message || "Upload failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="section">
      <div className="container-site space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Admin</div>
            <h1 className="mt-1 text-2xl font-semibold text-primary">Draft Compare</h1>
            <p className="mt-2 text-sm text-muted">Define modes, upload draft JSON per mode, and optional header images.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="btn btn-secondary">
              Admin home
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-subtle bg-card-surface p-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted">Season</label>

          {/* ✅ prevent hydration mismatch from extension-injected attributes */}
          <input
            suppressHydrationWarning
            className="input"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value) || CURRENT_SEASON)}
            type="number"
            min={2000}
            max={2100}
            style={{ width: 120 }}
          />

          {/* ✅ prevent hydration mismatch from extension-injected attributes */}
          <button suppressHydrationWarning className="btn btn-secondary" onClick={addMode}>
            Add mode
          </button>

          {/* ✅ prevent hydration mismatch from extension-injected attributes */}
          <button suppressHydrationWarning className="btn btn-primary" disabled={saving} onClick={saveModes}>
            {saving ? "Saving…" : "Save modes"}
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div>
        ) : null}
        {msg ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{msg}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">Loading…</div>
        ) : null}

        {!loading ? (
          <div className="grid gap-4">
            {normalized.map((r, idx) => (
              <div key={`${idx}-${r.modeSlug}`} className="rounded-2xl border border-subtle bg-card-surface p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {r.hasDraftJson ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                      JSON uploaded
                    </span>
                  ) : (
                    <span className="rounded-full border border-border/60 bg-black/5 px-3 py-1 text-[11px] font-semibold text-muted">
                      No JSON
                    </span>
                  )}

                  {r.image_url ? (
                    <span className="rounded-full border border-border/60 bg-black/5 px-3 py-1 text-[11px] font-semibold text-muted">
                      Image set
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-xs text-muted">Mode slug</label>
                    <input className="input bg-black/5 text-muted" value={safeStr(r.modeSlug)} disabled readOnly />
                    <div className="text-[11px] text-muted">Auto-filled from Title for new modes.</div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-muted">Order</label>
                    <input
                      className="input"
                      value={safeStr(r.order)}
                      onChange={(e) => updateRow(idx, { order: Number(e.target.value) || 0 })}
                      type="number"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-muted">Year</label>
                    <input
                      className="input"
                      value={safeStr(r.year)}
                      onChange={(e) => updateRow(idx, { year: Number(e.target.value) || season })}
                      type="number"
                      min={2000}
                      max={2100}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-muted">Title</label>
                    <input
                      className="input"
                      value={safeStr(r.title)}
                      onChange={(e) => updateRow(idx, { title: e.target.value })}
                      placeholder="Mode display name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-muted">Subtitle (optional)</label>
                    <input
                      className="input"
                      value={safeStr(r.subtitle)}
                      onChange={(e) => updateRow(idx, { subtitle: e.target.value })}
                      placeholder="Short description"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="btn btn-secondary">
                    Upload draft JSON
                    <input
                      type="file"
                      accept="application/json,.json"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadDraftJson(cleanSlug(r.modeSlug), f);
                      }}
                    />
                  </label>

                  <label className="btn btn-secondary">
                    Upload mode image
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadModeImage(cleanSlug(r.modeSlug), f);
                      }}
                    />
                  </label>

                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image_url}
                      alt=""
                      className="h-10 w-10 rounded-lg border border-subtle object-cover"
                      loading="lazy"
                    />
                  ) : null}

                  <Link
                    prefetch={false}
                    className="btn btn-secondary"
                    href={`/draft-compare/mode?mode=${encodeURIComponent(cleanSlug(r.modeSlug))}&year=${encodeURIComponent(
                      String(r.year || season)
                    )}`}
                  >
                    View public
                  </Link>

                  <button className="btn btn-secondary" onClick={() => removeRow(idx)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
