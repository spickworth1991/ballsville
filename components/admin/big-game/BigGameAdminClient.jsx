"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { r2Url } from "@/lib/r2Url";
import { getSupabase } from "@/lib/supabaseClient";

const DEFAULT_SEASON = new Date().getFullYear();

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function safeBool(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}
function uid() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normalizeLeagueStatus(s) {
  const raw = safeStr(s).trim();
  if (!raw) return "TBD";
  const up = raw.toUpperCase();
  if (up === "TBD") return "TBD";
  if (up === "DRAFTING") return "DRAFTING";
  if (up === "FILLING") return "FILLING";
  if (up === "FULL") return "FULL";
  return "TBD";
}

function badgeForStatus(status) {
  const s = normalizeLeagueStatus(status);
  if (s === "FULL") return "badge badge-success";
  if (s === "FILLING") return "badge badge-warn";
  if (s === "DRAFTING") return "badge badge-info";
  return "badge";
}

function computeOpenSlotsLabel(l) {
  const total = l?.total_teams;
  const open = l?.open_teams;
  if (typeof total !== "number" || typeof open !== "number") return "—";
  return `${open}/${total}`;
}

async function getAuthToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function fetchSleeperLeagueMeta(leagueId) {
  const id = safeStr(leagueId).trim();
  if (!id) return null;

  const leagueRes = await fetch(`https://api.sleeper.app/v1/league/${id}`);
  if (!leagueRes.ok) throw new Error(`Sleeper league fetch failed (${leagueRes.status})`);
  const league = await leagueRes.json();

  let users = [];
  try {
    const usersRes = await fetch(`https://api.sleeper.app/v1/league/${id}/users`);
    if (usersRes.ok) users = await usersRes.json();
  } catch {
    // ignore
  }

  const total = typeof league?.total_rosters === "number" ? league.total_rosters : null;
  const filled = Array.isArray(users) ? users.length : null;
  const open = typeof total === "number" && typeof filled === "number" ? Math.max(0, total - filled) : null;

  const sleeperStatus = safeStr(league?.status || "").trim() || null;
  const avatarId = safeStr(league?.avatar || "").trim() || null;

  return {
    name: safeStr(league?.name || ""),
    sleeper_status: sleeperStatus,
    avatar_id: avatarId,
    total_teams: total,
    filled_teams: filled,
    open_teams: open,
  };
}

async function fetchAvatarFile(avatarId) {
  const id = safeStr(avatarId).trim();
  if (!id) return null;

  const candidates = [
    `https://sleepercdn.com/avatars/${id}`,
    `https://sleepercdn.com/avatars/${id}.png`,
    `https://sleepercdn.com/avatars/${id}.jpg`,
    `https://sleepercdn.com/avatars/${id}.jpeg`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const ct = safeStr(res.headers.get("content-type")).toLowerCase();
      let ext = "png";
      if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
      if (ct.includes("webp")) ext = "webp";
      return new File([blob], `avatar.${ext}`, { type: blob.type || ct || "image/png" });
    } catch {
      // ignore
    }
  }
  return null;
}

async function uploadBigGameLeagueAvatar({ token, season, divisionSlug, leagueOrder, file }) {
  if (!file) return null;

  const qs = new URLSearchParams({
    section: "biggame-league",
    season: String(season),
    divisionSlug: safeStr(divisionSlug),
    leagueOrder: String(leagueOrder),
  });

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`/api/admin/upload?${qs.toString()}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Upload failed (${res.status})`);
  }

  return { key: json.key, url: json.url };
}

function normalizeDivision(d, idx) {
  const id = safeStr(d?.id || "").trim() || uid();
  const title = safeStr(d?.title || d?.division || "Division").trim() || "Division";
  const code = safeStr(d?.code || d?.division_code || "").trim() || `DIV${idx + 1}`;
  const slug = safeStr(d?.slug || d?.division_slug || code).trim() || code;
  const order = safeNum(d?.order ?? d?.display_order ?? idx + 1, idx + 1);
  const image_key = safeStr(d?.image_key || d?.division_image_key || "").trim() || null;
  const image_url = safeStr(d?.image_url || d?.division_image_url || d?.division_image_path || "").trim() || null;

  const leagues = safeArray(d?.leagues).map((l, j) => {
    const lid = safeStr(l?.id || "").trim() || uid();
    const display_order = safeNum(l?.display_order ?? j + 1, j + 1);

    return {
      id: lid,
      display_order,
      league_name: safeStr(l?.league_name || l?.name || "League"),
      league_url: safeStr(l?.league_url || l?.url || ""),
      league_status: normalizeLeagueStatus(l?.league_status || l?.status || "TBD"),
      sleeper_league_id: safeStr(l?.sleeper_league_id || l?.leagueId || "").trim() || null,
      sleeper_url:
        safeStr(l?.sleeper_url || "").trim() ||
        (safeStr(l?.sleeper_league_id || l?.leagueId || "").trim()
          ? `https://sleeper.com/leagues/${safeStr(l?.sleeper_league_id || l?.leagueId).trim()}`
          : null),
      sleeper_status: safeStr(l?.sleeper_status || "").trim() || null,
      avatar_id: safeStr(l?.avatar_id || l?.avatarId || "").trim() || null,
      league_image_key: safeStr(l?.league_image_key || "").trim() || null,
      league_image_path: safeStr(l?.league_image_path || "").trim() || null,
      total_teams: l?.total_teams != null ? safeNum(l.total_teams, null) : null,
      filled_teams: l?.filled_teams != null ? safeNum(l.filled_teams, null) : null,
      open_teams: l?.open_teams != null ? safeNum(l.open_teams, null) : null,
      not_ready: safeBool(l?.not_ready, false),
      is_active: safeBool(l?.is_active, true),
    };
  });

  return {
    id,
    title,
    code,
    slug,
    order,
    image_key,
    image_url,
    leagues: leagues.sort((a, b) => a.display_order - b.display_order),
  };
}

export default function BigGameAdminClient() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [divisions, setDivisions] = useState([]);

  const msgTimer = useRef(null);
  const setToast = (m) => {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 3500);
  };

  const canRefresh = useMemo(() => {
    return divisions.some((d) => d.leagues.some((l) => l.sleeper_league_id));
  }, [divisions]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/big-game?season=${season}&type=divisions`, { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Failed to load");

      const rawDivisions = safeArray(j?.data?.divisions);
      const norm = rawDivisions.map((d, i) => normalizeDivision(d, i)).sort((a, b) => a.order - b.order);
      setDivisions(norm);
    } catch (e) {
      setToast({ type: "error", text: safeStr(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  async function save(nextDivisions) {
    setSaving(true);
    try {
      const payload = {
        type: "divisions",
        data: {
          season,
          divisions: safeArray(nextDivisions).map((d, i) => normalizeDivision(d, i)).sort((a, b) => a.order - b.order),
        },
      };

      const res = await fetch(`/api/admin/big-game?season=${season}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Save failed");

      setToast({ type: "ok", text: "Saved." });
      setDivisions(payload.data.divisions);
    } catch (e) {
      setToast({ type: "error", text: safeStr(e?.message || e) });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  function addDivision() {
    const next = [...divisions];
    const n = next.length + 1;
    next.push(
      normalizeDivision(
        {
          title: `Division ${n}`,
          code: `DIV${n}`,
          slug: `DIV${n}`,
          order: n,
          leagues: [],
        },
        next.length
      )
    );
    setDivisions(next);
  }

  function removeDivision(divId) {
    setDivisions(divisions.filter((d) => d.id !== divId));
  }

  function moveDivision(divId, dir) {
    const idx = divisions.findIndex((d) => d.id === divId);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= divisions.length) return;
    const next = [...divisions];
    const [it] = next.splice(idx, 1);
    next.splice(j, 0, it);
    // normalize order to match list
    next.forEach((d, i) => (d.order = i + 1));
    setDivisions(next);
  }

  function updateDivision(divId, patch) {
    setDivisions(divisions.map((d) => (d.id === divId ? { ...d, ...patch } : d)));
  }

  function updateLeague(divId, leagueId, patch) {
    setDivisions(
      divisions.map((d) => {
        if (d.id !== divId) return d;
        return {
          ...d,
          leagues: d.leagues.map((l) => (l.id === leagueId ? { ...l, ...patch } : l)).sort((a, b) => a.display_order - b.display_order),
        };
      })
    );
  }

  function addLeagueRow(divId) {
    setDivisions(
      divisions.map((d) => {
        if (d.id !== divId) return d;
        const next = [...d.leagues];
        const n = next.length + 1;
        next.push({
          id: uid(),
          display_order: n,
          league_name: `League ${n}`,
          league_url: "",
          league_status: "TBD",
          sleeper_league_id: null,
          sleeper_url: null,
          sleeper_status: null,
          avatar_id: null,
          league_image_key: null,
          league_image_path: null,
          total_teams: null,
          filled_teams: null,
          open_teams: null,
          not_ready: false,
          is_active: true,
        });
        return { ...d, leagues: next };
      })
    );
  }

  function removeLeagueRow(divId, leagueRowId) {
    setDivisions(
      divisions.map((d) => {
        if (d.id !== divId) return d;
        const next = d.leagues.filter((l) => l.id !== leagueRowId);
        next.forEach((l, i) => (l.display_order = i + 1));
        return { ...d, leagues: next };
      })
    );
  }

  function moveLeagueRow(divId, leagueRowId, dir) {
    setDivisions(
      divisions.map((d) => {
        if (d.id !== divId) return d;
        const idx = d.leagues.findIndex((l) => l.id === leagueRowId);
        if (idx < 0) return d;
        const j = idx + dir;
        if (j < 0 || j >= d.leagues.length) return d;
        const next = [...d.leagues];
        const [it] = next.splice(idx, 1);
        next.splice(j, 0, it);
        next.forEach((l, i) => (l.display_order = i + 1));
        return { ...d, leagues: next };
      })
    );
  }

  async function refreshSleeper() {
    if (!canRefresh) return;

    setLoading(true);
    try {
      const token = await getAuthToken();

      const next = JSON.parse(JSON.stringify(divisions));

      for (const d of next) {
        for (const l of d.leagues) {
          if (!l?.sleeper_league_id) continue;

          try {
            const meta = await fetchSleeperLeagueMeta(l.sleeper_league_id);
            if (!meta) continue;

            // Status mapping
            const sleeperStatus = safeStr(meta.sleeper_status || "").toLowerCase();
            let league_status = l.league_status;
            if (sleeperStatus === "drafting") league_status = "DRAFTING";
            else if (typeof meta.open_teams === "number") league_status = meta.open_teams <= 0 ? "FULL" : "FILLING";

            l.league_name = meta.name || l.league_name;
            l.sleeper_status = meta.sleeper_status;
            l.avatar_id = meta.avatar_id;
            l.total_teams = meta.total_teams;
            l.filled_teams = meta.filled_teams;
            l.open_teams = meta.open_teams;
            l.league_status = normalizeLeagueStatus(league_status);

            // Avatar upload to R2 (only if we have an avatar id)
            if (meta.avatar_id) {
              const file = await fetchAvatarFile(meta.avatar_id);
              if (file) {
                const uploaded = await uploadBigGameLeagueAvatar({
                  token,
                  season,
                  divisionSlug: d.slug,
                  leagueOrder: l.display_order,
                  file,
                });
                if (uploaded?.key) {
                  l.league_image_key = uploaded.key;
                  l.league_image_path = uploaded.url;
                }
              }
            }
          } catch {
            // keep going; one bad league shouldn't kill the whole refresh
          }
        }
      }

      setDivisions(next);
      await save(next);
      setToast({ type: "ok", text: "Refreshed Sleeper status + counts." });
    } catch (e) {
      setToast({ type: "error", text: safeStr(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  function LeagueAvatar({ league }) {
    const path = league?.league_image_path;
    const key = league?.league_image_key;
    const src = path ? r2Url(path) : key ? r2Url(key) : null;

    return (
      <div className="h-9 w-9 overflow-hidden rounded-xl border border-subtle bg-black/30">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">—</div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-2xl font-semibold">BIG Game Admin</div>
          <div className="text-sm text-white/60">Divisions + leagues (Sleeper sync, counts, and images)</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-white/70">Season</label>
          <input
            className="input w-28"
            type="number"
            value={season}
            onChange={(e) => setSeason(safeNum(e.target.value, DEFAULT_SEASON))}
          />

          <button className="btn" onClick={() => load()} disabled={loading}>
            Refresh
          </button>

          <button className="btn btn-primary" onClick={() => save(divisions)} disabled={saving || loading}>
            Save
          </button>

          <button className="btn btn-accent" onClick={refreshSleeper} disabled={loading || !canRefresh}>
            Refresh Status + Counts
          </button>

          <Link className="btn" href={`/admin/big-game/add-leagues?season=${season}`}>
            Add Leagues
          </Link>
        </div>
      </div>

      {msg ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            msg.type === "error" ? "border-red-500/40 bg-red-500/10 text-red-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="font-semibold">Divisions</div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={addDivision}>
              + Add Division
            </button>
          </div>
        </div>

        <div className="card-content space-y-4">
          {loading ? <div className="text-sm text-white/60">Loading…</div> : null}

          {!loading && divisions.length === 0 ? (
            <div className="text-sm text-white/60">No divisions yet.</div>
          ) : null}

          {divisions.map((d, idx) => (
            <div key={d.id} className="rounded-2xl border border-subtle bg-black/20">
              <div className="flex flex-col gap-3 border-b border-subtle p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="flex items-center gap-2">
                    <button className="icon-btn" onClick={() => moveDivision(d.id, -1)} disabled={idx === 0} title="Move up">
                      ↑
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => moveDivision(d.id, 1)}
                      disabled={idx === divisions.length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>

                  <input
                    className="input w-full md:w-64"
                    value={d.title}
                    onChange={(e) => updateDivision(d.id, { title: e.target.value })}
                    placeholder="Division name"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-white/50">slug</div>
                    <input
                      className="input w-40"
                      value={d.slug}
                      onChange={(e) => updateDivision(d.id, { slug: e.target.value })}
                      placeholder="slug"
                    />
                    <div className="text-xs text-white/50">code</div>
                    <input
                      className="input w-32"
                      value={d.code}
                      onChange={(e) => updateDivision(d.id, { code: e.target.value })}
                      placeholder="code"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn" onClick={() => addLeagueRow(d.id)}>
                    + League Row
                  </button>
                  <button className="btn btn-danger" onClick={() => removeDivision(d.id)}>
                    Remove
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 text-sm font-semibold text-white/80">Leagues</div>

                {d.leagues.length === 0 ? (
                  <div className="text-sm text-white/60">No leagues in this division yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="text-xs text-white/60">
                        <tr className="border-b border-subtle">
                          <th className="py-2 text-left">Order</th>
                          <th className="py-2 text-left">Avatar</th>
                          <th className="py-2 text-left">League Name</th>
                          <th className="py-2 text-left">Status</th>
                          <th className="py-2 text-left">Open</th>
                          <th className="py-2 text-left">Sleeper ID</th>
                          <th className="py-2 text-left">Links</th>
                          <th className="py-2 text-left">Flags</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.leagues.map((l, j) => (
                          <tr key={l.id} className="border-b border-subtle/60">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  className="icon-btn"
                                  onClick={() => moveLeagueRow(d.id, l.id, -1)}
                                  disabled={j === 0}
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  className="icon-btn"
                                  onClick={() => moveLeagueRow(d.id, l.id, 1)}
                                  disabled={j === d.leagues.length - 1}
                                  title="Move down"
                                >
                                  ↓
                                </button>
                                <div className="text-xs text-white/50">{l.display_order}</div>
                              </div>
                            </td>

                            <td className="py-3">
                              <LeagueAvatar league={l} />
                            </td>

                            <td className="py-3">
                              <input
                                className="input w-full"
                                value={l.league_name}
                                onChange={(e) => updateLeague(d.id, l.id, { league_name: e.target.value })}
                              />
                            </td>

                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <span className={badgeForStatus(l.league_status)}>{normalizeLeagueStatus(l.league_status)}</span>
                                <select
                                  className="select"
                                  value={normalizeLeagueStatus(l.league_status)}
                                  onChange={(e) => updateLeague(d.id, l.id, { league_status: e.target.value })}
                                >
                                  <option value="TBD">TBD</option>
                                  <option value="FILLING">FILLING</option>
                                  <option value="FULL">FULL</option>
                                  <option value="DRAFTING">DRAFTING</option>
                                </select>
                              </div>
                            </td>

                            <td className="py-3 text-white/80">{computeOpenSlotsLabel(l)}</td>

                            <td className="py-3">
                              <input
                                className="input w-52"
                                value={safeStr(l.sleeper_league_id || "")}
                                onChange={(e) => updateLeague(d.id, l.id, { sleeper_league_id: e.target.value })}
                                placeholder="Sleeper league id"
                              />
                              {l.sleeper_status ? <div className="mt-1 text-xs text-white/50">sleeper: {l.sleeper_status}</div> : null}
                            </td>

                            <td className="py-3">
                              <div className="flex flex-col gap-1">
                                <input
                                  className="input w-full"
                                  value={safeStr(l.league_url)}
                                  onChange={(e) => updateLeague(d.id, l.id, { league_url: e.target.value })}
                                  placeholder="External link"
                                />
                                {l.sleeper_league_id ? (
                                  <a
                                    className="text-xs text-accent hover:underline"
                                    href={`https://sleeper.com/leagues/${l.sleeper_league_id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Sleeper
                                  </a>
                                ) : null}
                              </div>
                            </td>

                            <td className="py-3">
                              <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 text-xs text-white/70">
                                  <input
                                    type="checkbox"
                                    checked={safeBool(l.is_active, true)}
                                    onChange={(e) => updateLeague(d.id, l.id, { is_active: e.target.checked })}
                                  />
                                  active
                                </label>
                                <label className="flex items-center gap-2 text-xs text-white/70">
                                  <input
                                    type="checkbox"
                                    checked={safeBool(l.not_ready, false)}
                                    onChange={(e) => updateLeague(d.id, l.id, { not_ready: e.target.checked })}
                                  />
                                  not ready
                                </label>
                              </div>
                            </td>

                            <td className="py-3 text-right">
                              <button className="btn btn-danger" onClick={() => removeLeagueRow(d.id, l.id)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-white/50">
        Tip: **Refresh Status + Counts** pulls the latest Sleeper status, player counts, and uploads the league avatar to R2 (so the public BIG Game page can show images).
      </div>
    </div>
  );
}
