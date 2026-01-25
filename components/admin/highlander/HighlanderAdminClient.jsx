// components/admin/highlander/HighlanderAdminClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiPlus, FiSave, FiRefreshCw, FiTrash2, FiArrowUp, FiArrowDown } from "react-icons/fi";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

const DEFAULT_SEASON = CURRENT_SEASON;

const STATUS_OPTIONS = [
  { value: "tbd", label: "TBD" },
  { value: "filling", label: "FILLING" },
  { value: "drafting", label: "DRAFTING" },
  { value: "full", label: "FULL" },
];

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function uid() {
  return `lg_${Math.random().toString(16).slice(2)}_${Date.now()}`;
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
  try {
    return await res.text();
  } catch {
    return `HTTP ${res.status}`;
  }
}

function normalizeLeagueRow(l, idx) {
  const order = Number(l?.order);
  const active = l?.active !== false;
  return {
    id: safeStr(l?.id || uid()),
    name: safeStr(l?.name || `League ${idx + 1}`),
    url: safeStr(l?.url || ""),
    status: safeStr(l?.status || "tbd").toLowerCase(),
    active,
    order: Number.isFinite(order) ? order : idx + 1,
  };
}

export default function HighlanderAdminClient() {
  const [season, setSeason] = useState(DEFAULT_SEASON);

  const [page, setPage] = useState({
    season: DEFAULT_SEASON,
    hero: {
      promoImageKey: "",
      promoImageUrl: "/photos/biggame-v2.webp",
      updatesHtml: "<p>Highlander updates will show here.</p>",
    },
  });

  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const okTimer = useRef(null);

  function flashOk(msg) {
    setOkMsg(msg);
    if (okTimer.current) clearTimeout(okTimer.current);
    okTimer.current = setTimeout(() => setOkMsg(""), 2500);
  }

  const sortedLeagues = useMemo(() => {
    const list = safeArray(leagues).map(normalizeLeagueRow);
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return list;
  }, [leagues]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  async function apiFetch(path, init) {
    const token = await getAccessToken();
    const headers = {
      ...(init?.headers || {}),
      authorization: token ? `Bearer ${token}` : "",
    };
    return fetch(path, { ...init, headers });
  }

  async function loadAll() {
    setErr("");
    setOkMsg("");
    setLoading(true);

    try {
      const pageRes = await apiFetch(`/api/admin/highlander?season=${encodeURIComponent(season)}&type=page`);
      if (pageRes.ok) {
        const data = await pageRes.json();
        const hero = data?.hero || {};
        setPage({
          season,
          hero: {
            promoImageKey: safeStr(hero?.promoImageKey || ""),
            promoImageUrl: safeStr(hero?.promoImageUrl || "/photos/biggame-v2.webp"),
            updatesHtml: safeStr(hero?.updatesHtml || "<p>Highlander updates will show here.</p>"),
          },
        });
      } else if (pageRes.status === 404) {
        setPage({
          season,
          hero: {
            promoImageKey: "",
            promoImageUrl: "/photos/biggame-v2.webp",
            updatesHtml: "<p>Highlander updates will show here.</p>",
          },
        });
      } else {
        setErr(await readApiError(pageRes));
      }

      const leaguesRes = await apiFetch(`/api/admin/highlander?season=${encodeURIComponent(season)}&type=leagues`);
      if (leaguesRes.ok) {
        const data = await leaguesRes.json();
        const list = safeArray(data?.leagues).map(normalizeLeagueRow);
        setLeagues(list);
      } else if (leaguesRes.status === 404) {
        setLeagues([]);
      } else {
        setErr(await readApiError(leaguesRes));
      }
    } catch (e) {
      setErr(e?.message || "Failed to load Highlander admin data.");
    } finally {
      setLoading(false);
    }
  }

  async function savePage() {
    setErr("");
    setOkMsg("");
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/highlander?season=${encodeURIComponent(season)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "page", data: { ...page, season } }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      flashOk("Saved page content.");
    } catch (e) {
      setErr(e?.message || "Failed to save page.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLeagues() {
    setErr("");
    setOkMsg("");
    setSaving(true);
    try {
      const payload = {
        season,
        leagues: sortedLeagues.map((l, idx) => ({ ...l, order: Number(l.order) || idx + 1 })),
      };
      const res = await apiFetch(`/api/admin/highlander?season=${encodeURIComponent(season)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "leagues", data: payload }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setLeagues(payload.leagues);
      flashOk("Saved leagues.");
    } catch (e) {
      setErr(e?.message || "Failed to save leagues.");
    } finally {
      setSaving(false);
    }
  }

  function addLeague() {
    const nextOrder = (sortedLeagues.at(-1)?.order || sortedLeagues.length || 0) + 1;
    setLeagues((prev) => [
      ...safeArray(prev),
      {
        id: uid(),
        name: `League ${safeArray(prev).length + 1}`,
        url: "",
        status: "tbd",
        active: true,
        order: nextOrder,
      },
    ]);
  }

  function removeLeague(id) {
    setLeagues((prev) => safeArray(prev).filter((x) => x?.id !== id));
  }

  function moveLeague(id, dir) {
    setLeagues((prev) => {
      const arr = safeArray(prev).map(normalizeLeagueRow);
      arr.sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = arr.findIndex((x) => x.id === id);
      if (idx < 0) return prev;

      const swapWith = dir === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= arr.length) return prev;

      const a = arr[idx];
      const b = arr[swapWith];
      const ao = a.order;
      a.order = b.order;
      b.order = ao;
      return arr;
    });
  }

  function updateLeague(id, patch) {
    setLeagues((prev) =>
      safeArray(prev).map((x) => (x?.id === id ? { ...x, ...patch } : x))
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs tracking-widest text-muted uppercase">Season</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                className="input w-36"
                value={season}
                onChange={(e) => setSeason(safeStr(e.target.value).replace(/[^\d]/g, "").slice(0, 4))}
                placeholder="2026"
              />
              <button className="btn btn-subtle" onClick={loadAll} disabled={loading || saving}>
                <FiRefreshCw />
                Refresh
              </button>
            </div>
            <div className="mt-2 text-xs text-muted">
              Saves to R2: <span className="font-mono">content/highlander/page_{season}.json</span> and{" "}
              <span className="font-mono">data/highlander/leagues_{season}.json</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={savePage} disabled={saving || loading}>
              <FiSave />
              Save Page
            </button>
            <button className="btn btn-primary" onClick={saveLeagues} disabled={saving || loading}>
              <FiSave />
              Save Leagues
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            {err}
          </div>
        ) : null}
        {okMsg ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {okMsg}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-muted uppercase">Hero / Updates</div>
            <h3 className="mt-2 text-xl font-semibold text-primary">Page Content</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-3">
            <label className="block">
              <div className="text-sm text-muted mb-1">Promo Image Key (R2) — optional</div>
              <input
                className="input w-full"
                value={safeStr(page?.hero?.promoImageKey)}
                onChange={(e) => setPage((p) => ({ ...p, hero: { ...p.hero, promoImageKey: safeStr(e.target.value) } }))}
                placeholder="content/highlander/hero.webp"
              />
            </label>

            <label className="block">
              <div className="text-sm text-muted mb-1">Promo Image URL fallback</div>
              <input
                className="input w-full"
                value={safeStr(page?.hero?.promoImageUrl)}
                onChange={(e) => setPage((p) => ({ ...p, hero: { ...p.hero, promoImageUrl: safeStr(e.target.value) } }))}
                placeholder="/photos/highlander.webp"
              />
            </label>
          </div>

          <div className="lg:col-span-7">
            <label className="block">
              <div className="text-sm text-muted mb-1">Updates HTML</div>
              <textarea
                className="textarea w-full min-h-[180px]"
                value={safeStr(page?.hero?.updatesHtml)}
                onChange={(e) => setPage((p) => ({ ...p, hero: { ...p.hero, updatesHtml: safeStr(e.target.value) } }))}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-muted uppercase">Leagues</div>
            <h3 className="mt-2 text-xl font-semibold text-primary">League List</h3>
            <p className="mt-1 text-sm text-muted">Add leagues as you create them in Sleeper.</p>
          </div>

          <button className="btn btn-subtle" onClick={addLeague} disabled={loading || saving}>
            <FiPlus />
            Add League
          </button>
        </div>

        {sortedLeagues.length === 0 ? (
          <div className="rounded-2xl border border-subtle bg-subtle-surface p-5 text-muted">
            No leagues yet. Click <span className="text-text font-semibold">Add League</span>.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedLeagues.map((l, idx) => (
              <div key={l.id} className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-4">
                      <div className="text-xs text-muted mb-1">League Name</div>
                      <input
                        className="input w-full"
                        value={l.name}
                        onChange={(e) => updateLeague(l.id, { name: safeStr(e.target.value) })}
                      />
                    </div>
                    <div className="md:col-span-5">
                      <div className="text-xs text-muted mb-1">Sleeper URL</div>
                      <input
                        className="input w-full"
                        value={l.url}
                        onChange={(e) => updateLeague(l.id, { url: safeStr(e.target.value) })}
                        placeholder="https://sleeper.com/i/..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs text-muted mb-1">Status</div>
                      <select
                        className="input w-full"
                        value={l.status}
                        onChange={(e) => updateLeague(l.id, { status: safeStr(e.target.value).toLowerCase() })}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={l.active !== false}
                          onChange={(e) => updateLeague(l.id, { active: !!e.target.checked })}
                        />
                        <span className="text-muted">Active</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button className="btn btn-subtle" onClick={() => moveLeague(l.id, "up")} disabled={idx === 0}>
                      <FiArrowUp />
                    </button>
                    <button
                      className="btn btn-subtle"
                      onClick={() => moveLeague(l.id, "down")}
                      disabled={idx === sortedLeagues.length - 1}
                    >
                      <FiArrowDown />
                    </button>
                    <button className="btn btn-danger" onClick={() => removeLeague(l.id)}>
                      <FiTrash2 />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-5 sm:p-6">
        <div className="text-xs tracking-widest text-muted uppercase">Reminder</div>
        <div className="mt-2 text-sm text-muted leading-relaxed">
          Highlander is <span className="text-text font-semibold">18 teams</span>, <span className="text-text font-semibold">Best Ball</span>, and
          eliminates the lowest score weekly. Post leagues early with status <span className="text-text font-semibold">FILLING</span>, then flip to{" "}
          <span className="text-text font-semibold">DRAFTING</span> / <span className="text-text font-semibold">FULL</span>.
        </div>
      </div>
    </div>
  );
}
