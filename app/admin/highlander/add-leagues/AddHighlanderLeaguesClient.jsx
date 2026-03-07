"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalizeSleeperStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "predraft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "inseason" || s === "in-season") return "inseason";
  if (s === "complete") return "complete";
  return s || "predraft";
}

function highlanderStatusFromSleeper({ sleeperStatus, openTeams }) {
  const s = String(sleeperStatus || "").toLowerCase().trim();
  if (s === "drafting") return "drafting";
  if (Number(openTeams) <= 0) return "full";
  return "filling";
}

async function sleeperUserByUsername(username) {
  const u = String(username || "").trim();
  if (!u) throw new Error("Enter a Sleeper username.");
  const res = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(u)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper user not found (${res.status})`);
  return res.json();
}

async function sleeperUserLeagues(userId, season) {
  const uid = String(userId || "").trim();
  if (!uid) throw new Error("Missing user id.");
  const y = Number(season);
  const res = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(uid)}/leagues/nfl/${encodeURIComponent(String(y))}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Sleeper leagues request failed (${res.status})`);
  return res.json();
}

async function sleeperLeagueRosters(leagueId) {
  const id = String(leagueId || "").trim();
  if (!id) throw new Error("Missing league id.");
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(id)}/rosters`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper rosters request failed (${res.status})`);
  return res.json();
}

function computeFillCounts(league, rosters) {
  const totalTeams = Number(league?.total_rosters) || (Array.isArray(rosters) ? rosters.length : 0);
  const filledTeams = Array.isArray(rosters) ? rosters.filter((r) => r && r.owner_id).length : 0;
  const openTeams = Math.max(0, totalTeams - filledTeams);
  return { totalTeams, filledTeams, openTeams };
}

async function fetchAvatarFile(avatarId) {
  const a = String(avatarId || "").trim();
  if (!a) return null;
  const url = `https://sleepercdn.com/avatars/${encodeURIComponent(a)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const blob = await res.blob();
  const type = blob.type || "image/png";
  return new File([blob], `${a}.png`, { type });
}

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return "";
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
  const text = await res.text().catch(() => "");
  if (!text) return `Request failed (${res.status})`;
  if (text.trim().startsWith("<")) return `Request failed (${res.status}). Check Cloudflare Pages function logs.`;
  return text;
}

async function apiGET(type, season) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/highlander?type=${encodeURIComponent(type)}&season=${encodeURIComponent(String(season))}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function apiPUT(type, data, season) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/highlander?season=${encodeURIComponent(String(season))}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type, data }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const j = await res.json();
  if (!j?.ok) throw new Error(j?.error || "Request failed");
  return j;
}

async function uploadHighlanderLeagueImage(file, { season, leagueOrder }) {
  const token = await getAccessToken();
  const fd = new FormData();
  fd.append("file", file);
  fd.append("section", "highlander-league");
  fd.append("season", String(season));
  fd.append("leagueOrder", String(leagueOrder));

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const j = await res.json();
  if (!j?.ok) throw new Error(j?.error || "Upload failed");
  return j;
}

export default function AddHighlanderLeaguesClient() {
  const params = useSearchParams();
  const seasonFromUrl = Number(params?.get("season") || "");
  const [season, setSeason] = useState(Number.isFinite(seasonFromUrl) ? seasonFromUrl : CURRENT_SEASON);

  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existing, setExisting] = useState([]);

  const [username, setUsername] = useState("");
  const [searching, setSearching] = useState(false);
  const [userLabel, setUserLabel] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const existingLeagueIds = useMemo(
    () =>
      new Set(
        (Array.isArray(existing) ? existing : [])
          .map((l) => safeStr(l?.leagueId || l?.league_id))
          .filter(Boolean)
      ),
    [existing]
  );

  const selectedCount = selected.size;

  useEffect(() => {
    let live = true;
    (async () => {
      setLoadingExisting(true);
      setErr("");
      try {
        const data = await apiGET("leagues", season);
        if (!live) return;
        const list = Array.isArray(data?.leagues) ? data.leagues : [];
        list.sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0));
        setExisting(list);
      } catch (e) {
        if (live) setErr(e?.message || "Failed to load existing Highlander leagues.");
      } finally {
        if (live) setLoadingExisting(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [season]);

  async function onSearch() {
    setOk("");
    setErr("");
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    try {
      const user = await sleeperUserByUsername(username);
      const leagues = await sleeperUserLeagues(user.user_id, season);
      const normalized = (Array.isArray(leagues) ? leagues : [])
        .map((l) => ({
          leagueId: safeStr(l?.league_id),
          name: safeStr(l?.name),
          statusRaw: safeStr(l?.status),
          status: normalizeSleeperStatus(l?.status),
          totalRosters: Number(l?.total_rosters) || 0,
          avatarId: safeStr(l?.avatar),
        }))
        .filter((l) => l.leagueId)
        .sort((a, b) => a.name.localeCompare(b.name));
      setUserLabel(safeStr(user?.display_name || user?.username || username));
      setResults(normalized);
    } catch (e) {
      setErr(e?.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function toggleSel(id) {
    const key = String(id || "");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onAddSelected() {
    setOk("");
    setErr("");
    if (selectedCount === 0) {
      setErr("Select at least one league.");
      return;
    }

    setAdding(true);
    try {
      const existingData = await apiGET("leagues", season);
      const nextLeagues = Array.isArray(existingData?.leagues)
        ? existingData.leagues.map((l) => ({ ...l }))
        : [];

      const existingOrders = nextLeagues.map((l) => Number(l?.order)).filter((n) => Number.isFinite(n));
      let nextOrder = existingOrders.length ? Math.max(...existingOrders) + 1 : 1;

      const toAdd = results.filter((r) => selected.has(String(r.leagueId)) && !existingLeagueIds.has(String(r.leagueId)));
      for (const r of toAdd) {
        const leagueId = String(r.leagueId);
        if (!leagueId) continue;

        const rosters = await sleeperLeagueRosters(leagueId);
        const counts = computeFillCounts({ total_rosters: r.totalRosters }, rosters);
        const status = highlanderStatusFromSleeper({ sleeperStatus: r.status, openTeams: counts.openTeams });

        const entry = {
          id: `hl_${leagueId}`,
          leagueId,
          sleeperUrl: `https://sleeper.com/leagues/${leagueId}`,
          avatarId: r.avatarId || "",
          name: r.name || `League ${nextOrder}`,
          url: "",
          status,
          active: true,
          order: nextOrder,
          imageKey: "",
          imageUrl: "",
          totalTeams: counts.totalTeams,
          filledTeams: counts.filledTeams,
          openTeams: counts.openTeams,
        };

        if (entry.avatarId) {
          const file = await fetchAvatarFile(entry.avatarId);
          if (file) {
            const up = await uploadHighlanderLeagueImage(file, { season, leagueOrder: nextOrder });
            if (up?.key) entry.imageKey = up.key;
          }
        }

        nextLeagues.push(entry);
        nextOrder += 1;
      }

      await apiPUT("leagues", { season, leagues: nextLeagues }, season);
      setExisting(nextLeagues);
      setSelected(new Set());
      setOk(`Added ${toAdd.length} league(s) to Highlander.`);
    } catch (e) {
      setErr(e?.message || "Failed to add leagues.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">Admin</p>
                <h1 className="text-3xl font-semibold">
                  Highlander <span className="text-primary">Add Leagues</span>
                </h1>
                <p className="text-sm text-muted">
                  Search a Sleeper username, select leagues, and auto-fill Highlander league name, status, avatar, and fill counts.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link prefetch={false} href={`/admin/highlander?season=${encodeURIComponent(String(season))}`} className="btn btn-outline">
                  ← Back to Highlander CMS
                </Link>
                <Link prefetch={false} href="/admin" className="btn btn-primary">
                  Admin Home
                </Link>
              </div>
            </div>
          </header>

          {err ? <div className="rounded-2xl border border-subtle bg-red-950/30 p-4 text-sm text-red-200">{err}</div> : null}
          {ok ? <div className="rounded-2xl border border-subtle bg-emerald-950/25 p-4 text-sm text-emerald-200">{ok}</div> : null}

          <section className="rounded-3xl border border-subtle bg-card-surface p-6 shadow-sm space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-sm text-muted">Season</label>
                <input className="input w-full" type="number" value={season} onChange={(e) => setSeason(Number(e.target.value) || CURRENT_SEASON)} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm text-muted">Sleeper Username</label>
                <div className="flex gap-2">
                  <input className="input w-full" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. sticky-picky" />
                  <button className="btn btn-primary" type="button" onClick={onSearch} disabled={searching || !username.trim()}>
                    {searching ? "Searching…" : "Search"}
                  </button>
                </div>
                {userLabel ? <div className="text-xs text-muted">Results for: <span className="text-white/80">{userLabel}</span></div> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-subtle bg-black/20 p-4 text-sm text-muted">
              Existing Highlander leagues this season: <strong>{existing.length}</strong>
              {loadingExisting ? <span className="text-white/50"> • Loading current list…</span> : null}
            </div>

            {results.length ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted">
                    Found <strong>{results.length}</strong> leagues • Selected <strong>{selectedCount}</strong>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => setSelected(new Set(results.filter((r) => !existingLeagueIds.has(String(r.leagueId))).map((r) => String(r.leagueId))))}
                      disabled={!results.length}
                    >
                      Select New Only
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => setSelected(new Set(results.map((r) => String(r.leagueId))))}
                      disabled={!results.length}
                    >
                      Select All
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {results.map((r) => {
                    const id = String(r.leagueId);
                    const checked = selected.has(id);
                    const already = existingLeagueIds.has(id);
                    return (
                      <button
                        key={r.leagueId}
                        type="button"
                        onClick={() => !already && toggleSel(r.leagueId)}
                        className={[
                          "text-left rounded-2xl border border-subtle bg-black/20 p-4 transition",
                          already ? "opacity-60 cursor-not-allowed" : checked ? "ring-1 ring-[color:var(--color-accent)]/60" : "hover:bg-black/30",
                        ].join(" ")}
                        disabled={already}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={["inline-flex h-5 w-5 items-center justify-center rounded-md border", checked ? "bg-white/10" : "bg-transparent"].join(" ")}>
                                {already ? "•" : checked ? "✓" : ""}
                              </span>
                              <div className="font-semibold truncate">{r.name || r.leagueId}</div>
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              ID: {r.leagueId} • Status: {r.statusRaw || r.status}
                              {r.totalRosters ? <span className="text-white/45"> • Teams: {r.totalRosters}</span> : null}
                            </div>
                          </div>
                          <div className="text-xs text-muted">{already ? "Already added" : checked ? "Selected" : "Click to select"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-muted">
                    Invite links stay blank so you can still paste the exact public Sleeper invite URL later in the Highlander CMS.
                  </div>
                  <button className="btn btn-primary" type="button" onClick={onAddSelected} disabled={adding || selectedCount === 0}>
                    {adding ? "Adding…" : `Add ${selectedCount} to Highlander`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-subtle bg-black/20 p-4 text-sm text-muted">
                Search a username to load leagues.
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
