// app/admin/redraft/RedraftAdminClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/src/lib/supabaseClient";

const SEASON = 2025;

const STATUS_OPTIONS = [
  { value: "tbd", label: "TBD" },
  { value: "filling", label: "FILLING" },
  { value: "drafting", label: "DRAFTING" },
  { value: "full", label: "FULL" },
];

const DEFAULT_PAGE = {
  season: SEASON,
  hero: {
    promoImageKey: "",
    promoImageUrl: "/photos/redraft/how-it-works.jpg",
    updatesHtml: "<p>Updates will show here.</p>",
  },
};

function emptyLeague(order) {
  return {
    name: `League ${order}`,
    url: "",
    status: "tbd",
    active: true,
    order,
    imageKey: "",
    imageUrl: "",
  };
}

async function getAccessToken() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function readApiError(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      return j?.error || j?.message || JSON.stringify(j);
    }
  } catch {
    // ignore
  }
  const text = await res.text();
  if (!text) return `Request failed (${res.status})`;
  if (text.trim().startsWith("<")) return `Request failed (${res.status}). Check Cloudflare Pages function logs.`;
  return text;
}

async function apiGET(type) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/redraft?season=${SEASON}&type=${type}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function apiPUT(type, data) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/redraft?season=${SEASON}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, data }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function uploadImage(file, payload) {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", file);
  form.append("section", payload.section);
  form.append("season", String(payload.season));
  if (payload.leagueOrder) form.append("leagueOrder", String(payload.leagueOrder));

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

function useObjectUrl() {
  const urlsRef = useRef(new Set());
  useEffect(() => {
    return () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
      urlsRef.current.clear();
    };
  }, []);
  return (file) => {
    if (!file) return "";
    const url = URL.createObjectURL(file);
    urlsRef.current.add(url);
    return url;
  };
}

function StatusSelect({ value, onChange }) {
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function RedraftAdminClient() {
  const [tab, setTab] = useState("updates"); // updates | leagues
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE);
  const [leagues, setLeagues] = useState([]);

  const makeUrl = useObjectUrl();

  const [pendingUpdatesFile, setPendingUpdatesFile] = useState(null);
  const [pendingLeagueFiles, setPendingLeagueFiles] = useState(() => ({})); // key: order -> File

  const updatesPreview = pendingUpdatesFile
    ? makeUrl(pendingUpdatesFile)
    : pageCfg?.hero?.promoImageKey
    ? `/r2/${pageCfg.hero.promoImageKey}`
    : pageCfg?.hero?.promoImageUrl;

  function leaguePreviewSrc(l) {
    const pending = pendingLeagueFiles[String(l.order)];
    if (pending) return makeUrl(pending);
    return l.imageKey ? `/r2/${l.imageKey}` : l.imageUrl || "";
  }

  async function loadAll() {
    setErr("");
    setOk("");
    setLoading(true);
    setPendingUpdatesFile(null);
    setPendingLeagueFiles({});
    try {
      const page = await apiGET("page");
      const hero = page?.data?.hero || {};
      setPageCfg({
        ...DEFAULT_PAGE,
        ...page?.data,
        hero: {
          ...DEFAULT_PAGE.hero,
          promoImageKey: hero?.promoImageKey ?? "",
          promoImageUrl: hero?.promoImageUrl ?? DEFAULT_PAGE.hero.promoImageUrl,
          updatesHtml: hero?.updatesHtml ?? DEFAULT_PAGE.hero.updatesHtml,
        },
      });

      const ls = await apiGET("leagues");
      const list = Array.isArray(ls?.data?.leagues) ? ls.data.leagues : [];
      list.sort((a, b) => Number(a.order) - Number(b.order));
      setLeagues(list.length ? list : [emptyLeague(1)]);
    } catch (e) {
      setErr(e?.message || "Failed to load Redraft admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLeague() {
    const nextOrder = leagues.length ? Math.max(...leagues.map((l) => Number(l.order) || 0)) + 1 : 1;
    setLeagues((prev) => [...prev, emptyLeague(nextOrder)]);
  }

  function removeLeague(order) {
    setLeagues((prev) => prev.filter((l) => Number(l.order) !== Number(order)));
    setPendingLeagueFiles((prev) => {
      const next = { ...prev };
      delete next[String(order)];
      return next;
    });
  }

  async function saveAll() {
    setErr("");
    setOk("");
    setSaving(true);
    try {
      // 1) uploads (deterministic keys)
      let nextPage = { ...pageCfg };

      if (pendingUpdatesFile) {
        const up = await uploadImage(pendingUpdatesFile, { section: "redraft-updates", season: SEASON });
        nextPage = {
          ...nextPage,
          hero: {
            ...nextPage.hero,
            promoImageKey: up?.key || "",
          },
        };
      }

      let nextLeagues = leagues.map((l) => ({ ...l }));
      for (const l of nextLeagues) {
        const f = pendingLeagueFiles[String(l.order)];
        if (!f) continue;
        const up = await uploadImage(f, { section: "redraft-league", season: SEASON, leagueOrder: l.order });
        l.imageKey = up?.key || "";
      }

      // 2) write JSON
      await apiPUT("page", nextPage);
      await apiPUT("leagues", { season: SEASON, leagues: nextLeagues });

      setOk("Saved to R2.");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="section">
        <div className="container-site max-w-3xl">
          <div className="card bg-card-surface border border-subtle p-6 text-center">
            <p className="text-muted">Loading Redraft admin…</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container-site max-w-5xl space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="badge">Admins</span>
            <h1 className="h2 mt-3 text-primary">Redraft Manager</h1>
            <p className="text-muted mt-1 text-sm">Edits live content on /redraft from R2 (no divisions).</p>
          </div>
          <div className="flex gap-2">
            <Link href="/redraft" className="btn btn-outline">
              View Page
            </Link>
            <Link href="/admin" className="btn btn-outline">
              Admin Home
            </Link>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            className={`btn ${tab === "updates" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTab("updates")}
          >
            Updates
          </button>
          <button
            className={`btn ${tab === "leagues" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTab("leagues")}
          >
            Leagues
          </button>
        </div>

        {err ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div>
        ) : null}
        {ok ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{ok}</div>
        ) : null}

        {tab === "updates" ? (
          <div className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-primary">Updates Block</h2>
                <p className="text-sm text-muted mt-1">Image + HTML content shown on /redraft.</p>
              </div>
              <div className="text-xs text-muted">Season {SEASON}</div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-fg">Updates image</label>
                <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
                  <Image src={updatesPreview || "/photos/redraft/how-it-works.jpg"} alt="Updates" fill className="object-cover" />
                </div>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPendingUpdatesFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted">Uploads on Save (deterministic key in R2).</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-fg">Updates HTML</label>
                <textarea
                  className="input min-h-[200px]"
                  value={pageCfg?.hero?.updatesHtml || ""}
                  onChange={(e) => setPageCfg((p) => ({ ...p, hero: { ...p.hero, updatesHtml: e.target.value } }))}
                />
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Preview</p>
                  <div
                    className="prose prose-invert max-w-none text-sm text-muted mt-2"
                    dangerouslySetInnerHTML={{ __html: pageCfg?.hero?.updatesHtml || "" }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "leagues" ? (
          <div className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-primary">Redraft Leagues</h2>
                <p className="text-sm text-muted mt-1">Add as many as you want. Order controls display.</p>
              </div>
              <button className="btn btn-outline" onClick={addLeague}>
                + Add league
              </button>
            </div>

            <div className="space-y-4">
              {leagues
                .slice()
                .sort((a, b) => Number(a.order) - Number(b.order))
                .map((l) => (
                  <div key={String(l.order)} className="rounded-2xl border border-subtle bg-subtle-surface p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-[160px]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">League #{l.order}</p>
                        <label className="mt-2 block text-xs text-muted">Status</label>
                        <StatusSelect
                          value={l.status || "tbd"}
                          onChange={(v) =>
                            setLeagues((prev) => prev.map((x) => (Number(x.order) === Number(l.order) ? { ...x, status: v } : x)))
                          }
                        />
                        <label className="mt-3 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={l.active !== false}
                            onChange={(e) =>
                              setLeagues((prev) =>
                                prev.map((x) => (Number(x.order) === Number(l.order) ? { ...x, active: e.target.checked } : x))
                              )
                            }
                          />
                          Active
                        </label>
                      </div>

                      <div className="flex-1 min-w-[220px] space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs text-muted">Name</label>
                            <input
                              className="input"
                              value={l.name || ""}
                              onChange={(e) =>
                                setLeagues((prev) => prev.map((x) => (Number(x.order) === Number(l.order) ? { ...x, name: e.target.value } : x)))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted">Sleeper link</label>
                            <input
                              className="input"
                              value={l.url || ""}
                              onChange={(e) =>
                                setLeagues((prev) => prev.map((x) => (Number(x.order) === Number(l.order) ? { ...x, url: e.target.value } : x)))
                              }
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs text-muted">Order</label>
                            <input
                              className="input"
                              type="number"
                              value={Number(l.order) || 1}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isFinite(v)) return;
                                setLeagues((prev) => prev.map((x) => (Number(x.order) === Number(l.order) ? { ...x, order: v } : x)));
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted">League image (optional)</label>
                            <input
                              className="input"
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                setPendingLeagueFiles((prev) => ({ ...prev, [String(l.order)]: e.target.files?.[0] || null }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="w-full sm:w-[220px] space-y-3">
                        {leaguePreviewSrc(l) ? (
                          <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-subtle bg-black/20">
                            <Image src={leaguePreviewSrc(l)} alt="League" fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-full aspect-[16/9] rounded-xl border border-subtle bg-black/10 flex items-center justify-center text-xs text-muted">
                            No image
                          </div>
                        )}

                        <button className="btn btn-outline w-full" onClick={() => removeLeague(l.order)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button className="btn btn-outline" onClick={loadAll} disabled={saving}>
            Reload
          </button>
          <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}
