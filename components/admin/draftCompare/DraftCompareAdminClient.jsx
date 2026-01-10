// DraftCompareAdminClient.jsx (or .js)
// Admin client component for Draft Compare.
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
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
function safeNum(v, d = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
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
        // NOTE: API returns rows filtered by season, but each row includes `year`.
        const data = await apiGet(
          `/api/admin/draft-compare?season=${encodeURIComponent(String(season))}&type=modes`
        );
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

  // Normalize but DO NOT overwrite existing modeSlug unless missing.
  const normalized = useMemo(() => {
    return safeArray(rows).map((r, idx) => {
      const title = safeStr(r?.title || r?.name || "");
      const existingSlug = cleanSlug(r?.modeSlug || r?.slug || r?.id || "");
      const autoSlug = cleanSlug(title);
      const modeSlug = existingSlug || autoSlug || `mode-${idx + 1}`;

      return {
        ...r,
        year: safeNum(r?.year, safeNum(season)),
        modeSlug,
        title,
        subtitle: safeStr(r?.subtitle || r?.blurb || ""),
        order: safeNum(r?.order, idx + 1),
        image_url: safeStr(r?.image_url || r?.imageUrl || r?.image || ""),
        hasJson: !!r?.hasJson,
      };
    });
  }, [rows, season]);

  const addMode = () => {
    setRows((prev) => [
      ...safeArray(prev),
      {
        year: safeNum(season),
        modeSlug: "", // will be auto-derived from title on render/save
        title: "",
        subtitle: "",
        order: safeArray(prev).length + 1,
        image_url: "",
        hasJson: false,
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
      // Save only the current season’s rows in this admin view.
      const payload = normalized
        .filter((r) => safeNum(r.year) === safeNum(season))
        .map((r) => ({
          year: safeNum(r.year),
          modeSlug: cleanSlug(r.modeSlug),
          title: safeStr(r.title).trim(),
          subtitle: safeStr(r.subtitle).trim(),
          order: safeNum(r.order, 0),
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

      // flip local flag immediately
      setRows((prev) =>
        safeArray(prev).map((r) => {
          const s = cleanSlug(r?.modeSlug || "");
          return s === modeSlug ? { ...r, hasJson: true } : r;
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

      const url = safeStr(data?.url || data?.image_url || data?.publicUrl || "");

      if (url) {
        setRows((prev) =>
          safeArray(prev).map((r) => {
            const s = cleanSlug(r?.modeSlug || "");
            return s === modeSlug ? { ...r, image_url: url } : r;
          })
        );
      }

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
            <p className="mt-2 text-sm text-muted">
              Define modes, upload draft JSON per mode, and optional mode card images.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="btn btn-secondary">
              Admin home
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-subtle bg-card-surface p-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted">Season</label>
          <input
            className="input"
            value={season}
            onChange={(e) => setSeason(Number(e.target.value) || CURRENT_SEASON)}
            type="number"
            min={2000}
            max={2100}
            style={{ width: 120 }}
          />
          <button className="btn btn-secondary" onClick={addMode}>
            Add mode
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={saveModes}>
            {saving ? "Saving…" : "Save modes"}
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {err}
          </div>
        ) : null}
        {msg ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {msg}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">Loading…</div>
        ) : null}

        {!loading ? (
          <div className="grid gap-4">
            {normalized
              .filter((r) => safeNum(r.year) === safeNum(season))
              .map((r, idx) => {
                const slugDisabled = true;
                const slugDisplay = safeStr(r.modeSlug);

                return (
                  <div key={`${idx}-${slugDisplay}`} className="rounded-2xl border border-subtle bg-card-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-primary">{r.title || "Untitled mode"}</div>
                        {r.hasJson ? (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                            JSON uploaded ✓
                          </span>
                        ) : (
                          <span className="rounded-full border border-subtle bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-muted">
                            No JSON
                          </span>
                        )}
                      </div>

                      {r.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.image_url}
                          alt=""
                          className="h-10 w-16 rounded-lg border border-subtle object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
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

                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-xs text-muted">Title</label>
                        <input
                          className="input"
                          value={safeStr(r.title)}
                          onChange={(e) => {
                            const nextTitle = e.target.value;
                            // Only set slug if it was empty in source row (new rows)
                            const currentRaw = safeArray(rows)[idx] || {};
                            const currentSlug = cleanSlug(currentRaw?.modeSlug || currentRaw?.slug || "");
                            const nextSlug = currentSlug || cleanSlug(nextTitle);
                            updateRow(idx, { title: nextTitle, modeSlug: nextSlug });
                          }}
                          placeholder="Mode display name"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-xs text-muted">Subtitle (optional)</label>
                        <input
                          className="input"
                          value={safeStr(r.subtitle)}
                          onChange={(e) => updateRow(idx, { subtitle: e.target.value })}
                          placeholder="Short description"
                        />
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

                      <div className="space-y-2 md:col-span-3">
                        <label className="block text-xs text-muted">Slug (auto)</label>
                        <input
                          className="input"
                          value={slugDisplay}
                          disabled={slugDisabled}
                          style={{ opacity: 0.65 }}
                          title="Slug is auto-managed. Existing modes keep their slug."
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

                      <Link
                        prefetch={false}
                        className="btn btn-secondary"
                        href={`/draft-compare/mode?mode=${encodeURIComponent(cleanSlug(r.modeSlug))}&year=${encodeURIComponent(
                          String(season)
                        )}`}
                      >
                        View public
                      </Link>

                      <button className="btn btn-secondary" onClick={() => removeRow(idx)}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
