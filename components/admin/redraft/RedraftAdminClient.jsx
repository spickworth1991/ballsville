// components/admin/redraft/RedraftAdminClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

const SEASON = CURRENT_SEASON;

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
    leagueId: "", // Sleeper league_id (optional for legacy/manual leagues)
    sleeperUrl: "",
    avatarId: "",
    name: `League ${order}`,
    url: "", // invite link (manual)
    status: "tbd", // legacy/manual; Sleeper-driven leagues use: predraft|drafting|inseason|complete
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
  if (payload.leagueOrder != null) form.append("leagueOrder", String(payload.leagueOrder));
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

function useObjectUrl() {
  const cacheRef = useRef(new Map());
  useEffect(() => {
    return () => {
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current.clear();
    };
  }, []);
  return (file) => {
    if (!file) return "";
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    const existing = cacheRef.current.get(key);
    if (existing) return existing;
    const url = URL.createObjectURL(file);
    cacheRef.current.set(key, url);
    return url;
  };
}

function statusLabel(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "predraft" || s === "pre-draft" || s === "pre_draft") return "PRE-DRAFT";
  if (s === "drafting") return "DRAFTING";
  if (s === "inseason" || s === "in-season" || s === "in_season") return "IN-SEASON";
  if (s === "complete") return "COMPLETE";

  // legacy fallbacks
  if (s === "filling") return "PRE-DRAFT";
  if (s === "full") return "FULL";
  if (s === "tbd") return "TBD";
  return s ? s.toUpperCase() : "TBD";
}

export default function RedraftAdminClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE);
  const [leagues, setLeagues] = useState([]);

  const makeUrl = useObjectUrl();

  const [pendingUpdatesFile, setPendingUpdatesFile] = useState(null);
  const [pendingLeagueFiles, setPendingLeagueFiles] = useState(() => ({})); // order -> File (legacy/manual)

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

  function normalizeOrders(next) {
    const sorted = [...next].sort((a, b) => Number(a.order) - Number(b.order));
    return sorted.map((l, idx) => ({ ...l, order: idx + 1 }));
  }

  function moveLeague(order, dir) {
    setLeagues((prev) => {
      const sorted = [...prev].sort((a, b) => Number(a.order) - Number(b.order));
      const i = sorted.findIndex((l) => Number(l.order) === Number(order));
      if (i < 0) return prev;
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= sorted.length) return prev;
      const swapped = [...sorted];
      const tmp = swapped[i];
      swapped[i] = swapped[j];
      swapped[j] = tmp;
      return normalizeOrders(swapped);
    });
  }

  function addManualLeague() {
    const nextOrder = leagues.length ? Math.max(...leagues.map((l) => Number(l.order) || 0)) + 1 : 1;
    setLeagues((prev) => [...prev, emptyLeague(nextOrder)]);
  }

  function removeLeague(order) {
    setLeagues((prev) => normalizeOrders(prev.filter((l) => Number(l.order) !== Number(order))));
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
        // Only allow manual image overrides for legacy/manual entries (no leagueId),
        // or if the admin explicitly uploaded a replacement.
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

  const sortedLeagues = useMemo(() => {
    const next = [...leagues];
    next.sort((a, b) => Number(a.order) - Number(b.order));
    return next;
  }, [leagues]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Redraft Admin</h1>
          <p className="text-white/60">Season: {SEASON}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/redraft/add-leagues`}
            className="rounded-xl bg-card-surface px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Add leagues (from Sleeper)
          </Link>

          <button
            type="button"
            onClick={addManualLeague}
            className="rounded-xl bg-card-surface px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Add manual league
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={saveAll}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {(ok || err) && (
        <div className="mb-5 grid gap-2">
          {ok && <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-emerald-100">{ok}</div>}
          {err && <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-100">{err}</div>}
        </div>
      )}

      {/* HERO */}
      <div className="mb-8 grid gap-4 rounded-2xl border border-white/10 bg-card-surface p-5 md:grid-cols-3">
        <div className="md:col-span-1">
          <div className="text-sm font-semibold text-white/80">Promo image</div>
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={updatesPreview} alt="promo" className="h-40 w-full object-cover" />
          </div>
          <label className="mt-3 block">
            <div className="mb-1 text-xs text-white/60">Upload new promo image</div>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white hover:file:bg-white/15"
              onChange={(e) => setPendingUpdatesFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="md:col-span-2">
          <div className="text-sm font-semibold text-white/80">Updates HTML</div>
          <textarea
            className="mt-3 h-40 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/90 outline-none focus:border-white/20"
            value={pageCfg?.hero?.updatesHtml || ""}
            onChange={(e) =>
              setPageCfg((prev) => ({
                ...prev,
                hero: { ...(prev.hero || {}), updatesHtml: e.target.value },
              }))
            }
          />
          <div className="mt-2 text-xs text-white/50">
            This renders on the Redraft page (keep it clean — links/buttons ok).
          </div>
        </div>
      </div>

      {/* LEAGUES */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Leagues</h2>
        <div className="text-xs text-white/50">
          Tip: Only <span className="text-white/80">PRE-DRAFT</span> leagues will be clickable on the public page.
        </div>
      </div>

      <div className="grid gap-4">
        {sortedLeagues.map((l, idx) => {
          const isSleeper = Boolean(l.leagueId);
          const preview = leaguePreviewSrc(l);
          const sleeperUrl = l.sleeperUrl || (l.leagueId ? `https://sleeper.app/league/${l.leagueId}` : "");
          return (
            <div key={`${l.order}-${l.leagueId || l.name}`} className="rounded-2xl border border-white/10 bg-card-surface p-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="w-full md:w-56">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {preview ? (
                      <Image
                        src={preview}
                        alt={l.name || "league"}
                        width={600}
                        height={340}
                        className="h-32 w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center text-xs text-white/40">No image</div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-white/70">Order</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveLeague(l.order, "up")}
                        disabled={idx === 0}
                        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80 disabled:opacity-40"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLeague(l.order, "down")}
                        disabled={idx === sortedLeagues.length - 1}
                        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/80 disabled:opacity-40"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/70">
                        {l.order}
                      </div>
                    </div>
                  </div>

                  {!isSleeper && (
                    <label className="mt-3 block">
                      <div className="mb-1 text-xs text-white/60">Upload league image (manual only)</div>
                      <input
                        type="file"
                        accept="image/*"
                        className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white hover:file:bg-white/15"
                        onChange={(e) =>
                          setPendingLeagueFiles((prev) => ({
                            ...prev,
                            [String(l.order)]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                    </label>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-white/80">
                        {statusLabel(l.status)}
                      </div>
                      {sleeperUrl ? (
                        <a
                          href={sleeperUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--color-accent)] hover:underline"
                        >
                          Sleeper link
                        </a>
                      ) : (
                        <span className="text-xs text-white/40">No Sleeper link</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLeague(l.order)}
                      className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/15"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-1 text-xs text-white/60">League name</div>
                      <input
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20 disabled:opacity-60"
                        value={l.name || ""}
                        disabled={isSleeper}
                        onChange={(e) =>
                          setLeagues((prev) =>
                            prev.map((x) => (Number(x.order) === Number(l.order) ? { ...x, name: e.target.value } : x))
                          )
                        }
                      />
                      {isSleeper && <div className="mt-1 text-[11px] text-white/40">Synced from Sleeper</div>}
                    </label>

                    <label className="block">
                      <div className="mb-1 text-xs text-white/60">Invite link (manual)</div>
                      <input
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20"
                        value={l.url || ""}
                        onChange={(e) =>
                          setLeagues((prev) =>
                            prev.map((x) => (Number(x.order) === Number(l.order) ? { ...x, url: e.target.value } : x))
                          )
                        }
                        placeholder="https://sleeper.com/i/..."
                      />
                      <div className="mt-1 text-[11px] text-white/40">
                        Only used for filling leagues — keep this up to date.
                      </div>
                    </label>
                  </div>

                  {!isSleeper && (
                    <div className="mt-3">
                      <label className="block">
                        <div className="mb-1 text-xs text-white/60">Status (manual only)</div>
                        <select
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20"
                          value={l.status || "tbd"}
                          onChange={(e) =>
                            setLeagues((prev) =>
                              prev.map((x) => (Number(x.order) === Number(l.order) ? { ...x, status: e.target.value } : x))
                            )
                          }
                        >
                          <option value="tbd">TBD</option>
                          <option value="predraft">PRE-DRAFT</option>
                          <option value="drafting">DRAFTING</option>
                          <option value="inseason">IN-SEASON</option>
                          <option value="complete">COMPLETE</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-card-surface p-4 text-xs text-white/60">
        <div className="font-semibold text-white/80">Workflow</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Use <span className="text-white/80">Add leagues (from Sleeper)</span> to pull name/status/avatar automatically.
          </li>
          <li>Set the invite link manually (Sleeper does not provide this).</li>
          <li>Reorder with ↑ ↓. Save when done.</li>
        </ul>
      </div>
    </div>
  );
}
