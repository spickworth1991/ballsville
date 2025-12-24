"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { FiUpload, FiTrash2, FiPlus, FiSave, FiRefreshCw } from "react-icons/fi";
import { CURRENT_SEASON } from "@/lib/season";
import { getSupabase } from "@/lib/supabaseClient";

// GAUNTLET admin (R2-backed) — modeled after BigGameAdminClient.
// Stores to /api/admin/gauntlet (R2 JSON) and uploads images via /api/admin/upload.

const DEFAULT_SEASON = CURRENT_SEASON;

const DEFAULT_PAGE_EDITABLE = {
  hero: {
    promoImageKey: "",
    promoImageUrl: "",
    updatesHtml: "<p>Updates will show here.</p>",
  },
};

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function r2ImgSrc(key, fallbackUrl) {
  // Use key-based URL (served by /r2/* function). Keep deterministic query for light cache-busting.
  if (key) return `/r2/${key}?v=${encodeURIComponent(key)}`;
  return fallbackUrl || "";
}

function statusBadge(status) {
  const s = (status || "TBD").toUpperCase();
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border";
  if (s === "FULL") return `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`;
  if (s === "FILLING") return `${base} border-amber-500/30 bg-amber-500/10 text-amber-300`;
  if (s === "DRAFTING") return `${base} border-sky-500/30 bg-sky-500/10 text-sky-300`;
  return `${base} border-subtle bg-subtle-surface text-muted`;
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text?.slice(0, 300) || "Non-JSON response" };
  }
}

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}


export default function GauntletAdminClient({ defaultSeason = DEFAULT_SEASON }) {
  const [season, setSeason] = useState(defaultSeason);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE_EDITABLE);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageSaving, setPageSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadCtx, setUploadCtx] = useState(null); // { type: 'legion'|'league', legionSlug, leagueOrder }

  async function load() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gauntlet?season=${encodeURIComponent(season)}`, {
        cache: "no-store",
      });
      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Failed to load");
      setRows(Array.isArray(data.rows) ? data.rows.map((r) => ({ ...r, __key: r.__key || uid() })) : []);
    } catch (e) {
      setError(e?.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPageConfig(nextSeason = season) {
    setPageLoading(true);
    try {
      const res = await fetch(`/api/admin/gauntlet?season=${encodeURIComponent(String(nextSeason))}&type=page`, {
        cache: "no-store",
      });
      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        setPageCfg(DEFAULT_PAGE_EDITABLE);
        return;
      }
      const hero = data?.data?.hero || {};
      setPageCfg({
        hero: {
          promoImageKey: String(hero.promoImageKey || ""),
          promoImageUrl: String(hero.promoImageUrl || ""),
          updatesHtml: hero.updatesHtml ?? DEFAULT_PAGE_EDITABLE.hero.updatesHtml,
        },
      });
    } catch {
      setPageCfg(DEFAULT_PAGE_EDITABLE);
    } finally {
      setPageLoading(false);
    }
  }

  async function savePageConfig(nextSeason = season) {
    setError("");
    setNotice("");
    setPageSaving(true);
    try {
      const res = await fetch(`/api/admin/gauntlet?season=${encodeURIComponent(String(nextSeason))}&type=page`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "page", data: pageCfg }),
      });
      const out = await safeJson(res);
      if (!res.ok || out?.ok === false) throw new Error(out?.error || `Save failed (${res.status})`);
      setNotice("Owner Updates saved.");
    } catch (e) {
      setError(e?.message || "Failed to save Owner Updates.");
    } finally {
      setPageSaving(false);
    }
  }

  async function uploadOwnerUpdatesImage(file) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("section", "gauntlet-updates");
    fd.append("season", String(season));
    const token = await getAccessToken();
    const res = await fetch(`/api/admin/upload`, { method: "POST", body: fd, headers: { authorization: `Bearer ${token}` } });
    const out = await safeJson(res);
    if (!res.ok || out?.ok === false) throw new Error(out?.error || "Upload failed");

    setPageCfg((p) => ({
      ...p,
      hero: { ...p.hero, promoImageKey: String(out.key || ""), promoImageUrl: String(out.url || "") },
    }));
    setNotice("Image uploaded. Click Save Owner Updates to publish.");
  }

  useEffect(() => {
    load();
    loadPageConfig(season);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const legions = useMemo(() => {
    const headers = rows
      .filter((r) => r?.is_legion_header)
      .map((r) => ({
        ...r,
        __key: r.__key,
      }))
      .sort((a, b) => (Number(a.legion_order || 0) - Number(b.legion_order || 0)) || String(a.legion_name || "").localeCompare(String(b.legion_name || "")));

    const bySlug = new Map();
    for (const r of rows) {
      if (r?.is_legion_header) continue;
      const slug = r.legion_slug;
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push({ ...r, __key: r.__key });
    }
    for (const [slug, list] of bySlug.entries()) {
      list.sort((a, b) => Number(a.league_order || 0) - Number(b.league_order || 0));
      bySlug.set(slug, list);
    }

    return { headers, bySlug };
  }, [rows]);

  function setRow(patchFn) {
    setRows((prev) => patchFn([...prev]));
  }

  function updateLegion(slug, patch) {
    setRow((next) =>
      next.map((r) => {
        if (!r?.is_legion_header) return r;
        if (r.legion_slug !== slug) return r;
        return { ...r, ...patch };
      })
    );
  }

  function updateLeague(legionSlug, leagueOrder, patch) {
    setRow((next) =>
      next.map((r) => {
        if (r?.is_legion_header) return r;
        if (r.legion_slug !== legionSlug) return r;
        if (Number(r.league_order || 0) !== Number(leagueOrder || 0)) return r;
        return { ...r, ...patch };
      })
    );
  }

  function addLegion() {
    const name = "New Legion";
    const slug = slugify(name) || uid();
    const maxOrder = Math.max(0, ...legions.headers.map((h) => Number(h.legion_order || 0)));
    setRows((prev) => [
      ...prev,
      {
        __key: uid(),
        season,
        is_legion_header: true,
        legion_name: name,
        legion_slug: slug,
        legion_status: "TBD",
        legion_spots: 0,
        legion_order: maxOrder + 1,
        legion_image_key: "",
        legion_image_path: "",
        is_active: true,
      },
    ]);
  }

  function deleteLegion(legionSlug) {
    if (!confirm("Delete this legion AND all of its leagues?")) return;
    setRows((prev) => prev.filter((r) => r.legion_slug !== legionSlug));
  }

  function addLeague(legionSlug) {
    const list = legions.bySlug.get(legionSlug) || [];
    const nextOrder = Math.max(0, ...list.map((l) => Number(l.league_order || 0))) + 1;
    setRows((prev) => [
      ...prev,
      {
        __key: uid(),
        season,
        is_legion_header: false,
        legion_slug: legionSlug,
        league_order: nextOrder,
        league_name: "",
        league_url: "",
        league_status: "FULL",
        is_active: true,
        league_image_key: "",
        league_image_path: "",
      },
    ]);
  }

  function deleteLeague(legionSlug, leagueOrder) {
    if (!confirm("Delete this league?")) return;
    setRows((prev) =>
      prev.filter((r) => {
        if (r?.is_legion_header) return true;
        if (r.legion_slug !== legionSlug) return true;
        return Number(r.league_order || 0) !== Number(leagueOrder || 0);
      })
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      // sanitize rows: ensure season set and stable keys removed
      const cleaned = rows.map((r) => {
        const out = { ...r };
        delete out.__key;
        out.season = season;
        return out;
      });

      const res = await fetch("/api/admin/gauntlet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ season, rows: cleaned }),
      });
      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Save failed");
      setNotice("Published ✓");
      await load();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function openUpload(ctx) {
    setUploadCtx(ctx);
    if (fileInputRef.current) fileInputRef.current.click();
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadCtx) return;
    setError("");
    setNotice("");
    try {
      const form = new FormData();

      if (uploadCtx.type === "legion") {
        form.set("section", "gauntlet-legion");
        form.set("season", String(season));
        form.set("legionCode", uploadCtx.legionSlug);
      } else {
        form.set("section", "gauntlet-league");
        form.set("season", String(season));
        form.set("legionCode", uploadCtx.legionSlug);
        form.set("leagueOrder", String(uploadCtx.leagueOrder));
      }

      form.set("file", file);

      const token = await getAccessToken();

      const res = await fetch("/api/admin/upload", { method: "POST", body: form, headers: { authorization: `Bearer ${token}` } });
      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Upload failed");

      // IMPORTANT:
      // The PUBLIC gauntlet pages currently render from *_image_path (as seen in leagues_YYYY.json).
      // The upload endpoint returns a deterministic key + a cache-busted /r2 URL.
      // We store the URL (or a /r2/<key> fallback) directly into *_image_path so publishing persists it.
      const nextKey = String(data.key || "");
      const nextPath = String(data.url || (nextKey ? `/r2/${nextKey}` : ""));

      if (uploadCtx.type === "legion") {
        updateLegion(uploadCtx.legionSlug, { legion_image_path: nextPath });
      } else {
        updateLeague(uploadCtx.legionSlug, uploadCtx.leagueOrder, { league_image_path: nextPath });
      }
      setNotice("Image uploaded ✓ (remember to Publish)");
    } catch (e2) {
      setError(e2?.message || String(e2));
    } finally {
      setUploadCtx(null);
    }
  }

  return (
    <main className="section">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />

      <div className="container-site">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="h1">Gauntlet Admin</h1>
            <p className="text-muted mt-1">Manage legions + their leagues. Upload images to R2 and publish to the public site.</p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Season</label>
            <input
              className="input w-28"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value || DEFAULT_SEASON))}
              inputMode="numeric"
            />
            <button className="btn btn-subtle" onClick={load} disabled={loading || saving}>
              <FiRefreshCw />
              Refresh
            </button>
            <button className="btn btn-primary" onClick={save} disabled={loading || saving}>
              <FiSave />
              {saving ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">{error}</div>
        ) : null}
        {notice ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">{notice}</div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-subtle bg-card-surface p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold">Owner Updates (Hero)</p>
              <p className="text-xs text-muted">This image + text renders in the hero section on the public Gauntlet page.</p>
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => savePageConfig(season)}
              disabled={pageSaving || pageLoading}
            >
              {pageSaving ? "Saving…" : "Save Owner Updates"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs text-muted">Promo image</p>
              <div className="rounded-xl border border-subtle bg-black/20 overflow-hidden">
                {pageCfg.hero.promoImageKey ? (
                  <img src={`/r2/${pageCfg.hero.promoImageKey}`} alt="Owner promo" className="w-full h-auto block" loading="lazy" />
                ) : (
                  <div className="p-6 text-sm text-muted">No image uploaded.</div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    await uploadOwnerUpdatesImage(file);
                  } catch (err) {
                    setError(err?.message || "Upload failed.");
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted">Updates HTML</p>
              <textarea
                className="input min-h-[180px]"
                value={pageCfg.hero.updatesHtml}
                onChange={(e) => setPageCfg((p) => ({ ...p, hero: { ...p.hero, updatesHtml: e.target.value } }))}
                placeholder="<p>Type your updates here…</p>"
              />
              <p className="text-xs text-muted">Tip: keep it short (1–4 lines) so the hero stays clean.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="h2">Legions</h2>
          <button className="btn btn-subtle" onClick={addLegion} disabled={loading || saving}>
            <FiPlus />
            Add Legion
          </button>
        </div>

        {loading ? <p className="text-muted mt-4">Loading…</p> : null}

        <div className="mt-4 grid grid-cols-1 gap-4">
          {legions.headers.map((h) => {
            const list = legions.bySlug.get(h.legion_slug) || [];
            return (
              <section key={h.__key} className="card bg-card-surface border border-subtle p-5 md:p-6">
                <div className="flex flex-col lg:flex-row gap-4 lg:items-start lg:justify-between">
                  <div className="flex gap-4 items-start">
                    <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-subtle bg-subtle-surface flex-shrink-0">
                      {(h.legion_image_key || h.legion_image_path) ? (
                        <Image src={r2ImgSrc(h.legion_image_key, h.legion_image_path)} alt={h.legion_name || "Legion"} fill sizes="80px" className="object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-xs text-muted">No Image</div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          className="input w-[min(420px,80vw)]"
                          value={h.legion_name || ""}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            const nextSlug = slugify(nextName) || h.legion_slug;
                            // update header
                            updateLegion(h.legion_slug, { legion_name: nextName, legion_slug: nextSlug });
                            // also migrate league rows to new slug
                            if (nextSlug !== h.legion_slug) {
                              setRows((prev) =>
                                prev.map((r) => {
                                  if (r.legion_slug !== h.legion_slug) return r;
                                  return { ...r, legion_slug: nextSlug };
                                })
                              );
                            }
                          }}
                        />
                        <span className={statusBadge(h.legion_status)}>{(h.legion_status || "TBD").toUpperCase()}</span>
                        <span className="text-xs text-muted">slug: {h.legion_slug}</span>
                      </div>

                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <label className="text-sm text-muted">Order</label>
                        <input
                          className="input w-24"
                          value={h.legion_order ?? 0}
                          onChange={(e) => updateLegion(h.legion_slug, { legion_order: Number(e.target.value || 0) })}
                          inputMode="numeric"
                        />
                        <label className="text-sm text-muted">Status</label>
                        <select
                          className="input"
                          value={h.legion_status || "TBD"}
                          onChange={(e) => updateLegion(h.legion_slug, { legion_status: e.target.value })}
                        >
                          <option value="TBD">TBD</option>
                          <option value="FILLING">FILLING</option>
                          <option value="DRAFTING">DRAFTING</option>
                          <option value="FULL">FULL</option>
                        </select>
                        <label className="text-sm text-muted">Spots</label>
                        <input
                          className="input w-24"
                          value={h.legion_spots ?? 0}
                          onChange={(e) => updateLegion(h.legion_slug, { legion_spots: Number(e.target.value || 0) })}
                          inputMode="numeric"
                        />
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!h.is_active}
                            onChange={(e) => updateLegion(h.legion_slug, { is_active: e.target.checked })}
                          />
                          Active
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="btn btn-subtle" onClick={() => openUpload({ type: "legion", legionSlug: h.legion_slug })}>
                      <FiUpload />
                      Upload Image
                    </button>
                    <button className="btn btn-subtle" onClick={() => addLeague(h.legion_slug)}>
                      <FiPlus />
                      Add League
                    </button>
                    <button className="btn btn-danger" onClick={() => deleteLegion(h.legion_slug)}>
                      <FiTrash2 />
                      Delete Legion
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  {list.length === 0 ? (
                    <p className="text-sm text-muted">No leagues yet. Add a league.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted">
                            <th className="text-left py-2 pr-3">#</th>
                            <th className="text-left py-2 pr-3">League</th>
                            <th className="text-left py-2 pr-3">Sleeper URL</th>
                            <th className="text-left py-2 pr-3">Status</th>
                            <th className="text-left py-2 pr-3">Active</th>
                            <th className="text-left py-2 pr-3">Image</th>
                            <th className="text-right py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((l) => (
                            <tr key={l.__key} className="border-t border-subtle">
                              <td className="py-2 pr-3 align-top">
                                <input
                                  className="input w-20"
                                  value={l.league_order ?? 0}
                                  onChange={(e) => updateLeague(h.legion_slug, l.league_order, { league_order: Number(e.target.value || 0) })}
                                  inputMode="numeric"
                                />
                              </td>
                              <td className="py-2 pr-3 align-top">
                                <input
                                  className="input w-[260px]"
                                  value={l.league_name || ""}
                                  onChange={(e) => updateLeague(h.legion_slug, l.league_order, { league_name: e.target.value })}
                                  placeholder="League name"
                                />
                              </td>
                              <td className="py-2 pr-3 align-top">
                                <input
                                  className="input w-[420px]"
                                  value={l.league_url || ""}
                                  onChange={(e) => updateLeague(h.legion_slug, l.league_order, { league_url: e.target.value })}
                                  placeholder="https://sleeper.com/leagues/..."
                                />
                              </td>
                              <td className="py-2 pr-3 align-top">
                                <select
                                  className="input"
                                  value={l.league_status || "FULL"}
                                  onChange={(e) => updateLeague(h.legion_slug, l.league_order, { league_status: e.target.value })}
                                >
                                  <option value="FULL">FULL</option>
                                  <option value="FILLING">FILLING</option>
                                  <option value="DRAFTING">DRAFTING</option>
                                  <option value="TBD">TBD</option>
                                </select>
                              </td>
                              <td className="py-2 pr-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={!!l.is_active}
                                  onChange={(e) => updateLeague(h.legion_slug, l.league_order, { is_active: e.target.checked })}
                                />
                              </td>
                              <td className="py-2 pr-3 align-top">
                                <div className="flex items-center gap-2">
                                  <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-subtle bg-subtle-surface">
                                    {(l.league_image_key || l.league_image_path) ? (
                                      <Image
                                        src={r2ImgSrc(l.league_image_key, l.league_image_path)}
                                        alt={l.league_name || "League"}
                                        fill
                                        sizes="40px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <div className="h-full w-full grid place-items-center text-[10px] text-muted">—</div>
                                    )}
                                  </div>
                                  <button
                                    className="btn btn-subtle"
                                    onClick={() => openUpload({ type: "league", legionSlug: h.legion_slug, leagueOrder: l.league_order })}
                                  >
                                    <FiUpload />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 text-right align-top">
                                <button className="btn btn-danger" onClick={() => deleteLeague(h.legion_slug, l.league_order)}>
                                  <FiTrash2 />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <p className="mt-4 text-xs text-muted">Uploads replace existing images. Publish to push changes live.</p>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
