"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CURRENT_SEASON } from "@/lib/season";
import { getSupabase } from "@/lib/supabaseClient";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeInt(v, fallback) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
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

async function getAccessToken() {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  } catch {
    return "";
  }
}

export default function DraftCompareAdminClient() {
  const initialSeason = safeInt(CURRENT_SEASON, new Date().getFullYear());

  // The "active" season we are viewing/editing
  const [season, setSeason] = useState(initialSeason);

  // Editable input box (so typing doesn't instantly reload unless you want it)
  const [seasonInput, setSeasonInput] = useState(String(initialSeason));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");


function normalizeModeRows(inputRows, activeSeason) {
  const y = safeInt(activeSeason, new Date().getFullYear());
  return safeArray(inputRows).map((r0) => {
    const r = r0 || {};
    const modeSlug = deriveSlug(r);
    return {
      ...r,
      modeSlug,
      year: safeInt(r.year, y) || y,
      order: safeInt(r.order, 0),
      title: safeStr(r.title || "").trim(),
      subtitle: safeStr(r.subtitle || "").trim(),
    };
  });
}

function canBuildRow(r) {
  return !!(
    safeStr(r?.title).trim() &&
    safeInt(r?.year, 0) > 0 &&
    safeInt(r?.order, 0) > 0 &&
    deriveSlug(r)
  );
}

function buildHrefForRow(r, action) {
  const slug = encodeURIComponent(deriveSlug(r));
  const title = encodeURIComponent(safeStr(r?.title).trim());
  const year = encodeURIComponent(String(safeInt(r?.year, season)));
  const order = encodeURIComponent(String(safeInt(r?.order, 0)));
  const act = encodeURIComponent(action || "create");
  return `/admin/draft-compare/build?season=${encodeURIComponent(String(season))}&modeSlug=${slug}&title=${title}&year=${year}&order=${order}&action=${act}`;
}

async function saveModesBeforeBuild() {
  // IMPORTANT:
  // The public/admin pages list modes from modes_<season>.json.
  // If you click "Create/Rebuild" without saving modes, the mode won't exist publicly.
  const normalized = normalizeModeRows(rows, season);
  setSaving(true);
  setErr("");
  setMsg("");
  try {
    await apiPost(`/api/admin/draft-compare`, { season, type: "modes", rows: normalized });
    setRows(normalized);
    setMsg("Modes saved.");
    return normalized;
  } finally {
    setSaving(false);
  }
}


  // Image selection should preview immediately, but only upload on "Save modes".
  // Map: modeSlug -> { file: File, previewUrl: string }
  const [pendingImages, setPendingImages] = useState(() => Object.create(null));
  const pendingImagesRef = useRef(pendingImages);
  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      const current = pendingImagesRef.current || {};
      for (const k of Object.keys(current)) {
        try {
          URL.revokeObjectURL(current[k]?.previewUrl);
        } catch {}
      }
    };
  }, []);

  // Load rows whenever "season" changes (the active season)
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

  function stageModeImage(modeSlug, file) {
    const slug = cleanSlug(modeSlug);
    if (!slug) {
      setErr("Mode slug is required before selecting an image. Add a Title first, then Save modes.");
      return;
    }
    if (!file) return;

    setErr("");
    setMsg("");

    const previewUrl = URL.createObjectURL(file);

    setPendingImages((prev) => {
      const next = { ...(prev || {}) };
      try {
        if (next[slug]?.previewUrl) URL.revokeObjectURL(next[slug].previewUrl);
      } catch {}
      next[slug] = { file, previewUrl };
      return next;
    });
  }

  function applySeasonInput() {
    const next = safeInt(seasonInput, NaN);
    if (!Number.isFinite(next) || next < 2000 || next > 2100) {
      setErr("Season must be a valid year (2000–2100).");
      return;
    }
    setErr("");
    setMsg("");
    // clear staged images when switching seasons (prevents accidental cross-season uploads)
    setPendingImages((prev) => {
      const current = prev || {};
      for (const k of Object.keys(current)) {
        try {
          URL.revokeObjectURL(current[k]?.previewUrl);
        } catch {}
      }
      return Object.create(null);
    });
    setSeason(next);
  }

  const saveModes = async () => {
    setErr("");
    setMsg("");
    setSaving(true);
    try {
      // 1) Build payload from current form state
      let payload = normalized
        .map((r) => ({
          modeSlug: cleanSlug(r.modeSlug),
          title: safeStr(r.title).trim(),
          subtitle: safeStr(r.subtitle).trim(),
          order: Number(r.order || 0) || 0,
          year: Number(r.year || season) || season,
          imageKey: safeStr(r.imageKey).trim(),
          image_url: safeStr(r.image_url).trim(),
        }))
        .filter((r) => r.modeSlug && r.title);

      // 2) Upload any staged images (auth required), then patch payload + rows.
      const staged = pendingImagesRef.current || {};
      const stagedSlugs = Object.keys(staged);

      if (stagedSlugs.length) {
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated. Please re-login to admin.");

        const uploadedBySlug = Object.create(null);

        for (const slug of stagedSlugs) {
          const file = staged?.[slug]?.file;
          if (!file) continue;

          const form = new FormData();
          form.append("file", file);
          form.append("section", "draft-compare-mode");
          form.append("season", String(season));
          form.append("modeSlug", slug);

          const res = await fetch(`/api/admin/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.ok) throw new Error(data?.error || `Upload failed (${res.status})`);

          uploadedBySlug[slug] = {
            imageKey: safeStr(data?.key),
            image_url: safeStr(data?.url),
          };
        }

        payload = payload.map((r) => {
          const up = uploadedBySlug[r.modeSlug];
          return up ? { ...r, ...up } : r;
        });

        setRows((prev) =>
          safeArray(prev).map((r) => {
            const slug = cleanSlug(r?.modeSlug || r?.slug || r?.id || r?.name) || deriveSlug(r);
            const up = uploadedBySlug[slug];
            return up ? { ...r, imageKey: up.imageKey, image_url: up.image_url } : r;
          })
        );

        setPendingImages((prev) => {
          const next = { ...(prev || {}) };
          for (const slug of Object.keys(uploadedBySlug)) {
            try {
              if (next[slug]?.previewUrl) URL.revokeObjectURL(next[slug].previewUrl);
            } catch {}
            delete next[slug];
          }
          return next;
        });
      }

      // 3) Save modes JSON to R2
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
          <label className="text-sm text-muted">Modes JSON season</label>

          <input
            className="input"
            value={seasonInput}
            onChange={(e) => setSeasonInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySeasonInput();
            }}
            type="number"
            min={2000}
            max={2100}
            style={{ width: 140 }}
          />

          <button className="btn btn-secondary" onClick={applySeasonInput} disabled={loading || saving}>
            Load season
          </button>

          <div className="text-[11px] text-muted">
            Loaded: <span className="font-semibold text-primary">{season}</span>. Change it to edit older seasons.
          </div>

          <button className="btn btn-secondary" onClick={addMode}>
            Add mode
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={saveModes}>
            {saving ? "Saving…" : "Save modes"}
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div>
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
            {normalized.map((r, idx) => {
              const slug = cleanSlug(r.modeSlug);
              const stagedPreview = pendingImages?.[slug]?.previewUrl || "";
              const previewUrl = stagedPreview || r.image_url || "";
              const canBuild = !!safeStr(r.title).trim() && Number(r.order) > 0 && Number(r.year) > 0 && !!cleanSlug(r.modeSlug);

              return (
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

                    {previewUrl ? (
                      <span className="rounded-full border border-border/60 bg-black/5 px-3 py-1 text-[11px] font-semibold text-muted">
                        Image set
                      </span>
                    ) : null}

                    {stagedPreview ? (
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
                        Pending save
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
                      <div className="text-[11px] text-muted">
                        This controls which year the mode appears under on the homepage.
                      </div>
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
                    <button
                      type="button"
                      className={`btn btn-primary${!canBuild ? " opacity-50 cursor-not-allowed" : ""}`}
                      disabled={!canBuild || saving}
                      onClick={async () => {
                        if (!canBuild || saving) return;
                        try {
                          await saveModesBeforeBuild();
                          const action = r.hasDraftJson ? "rebuild" : "create";
                          window.location.href = buildHrefForRow(r, action);
                        } catch (e) {
                          setErr(e?.message || "Failed to start build");
                        }
                      }}
                    >
                      {r.hasDraftJson ? "Rebuild database" : "Create database"}
                    </button>

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
                      Select mode image
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) stageModeImage(cleanSlug(r.modeSlug), f);
                        }}
                      />
                    </label>

                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg border border-subtle object-cover"
                        loading="lazy"
                      />
                    ) : null}

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
