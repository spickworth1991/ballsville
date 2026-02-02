"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";

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

function miniStatusFromSleeper({ sleeperStatus, openTeams, notReady }) {
  if (notReady) return "tbd";
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
  return res.text();
}

async function apiGET(type, season) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/mini-leagues?type=${encodeURIComponent(type)}&season=${encodeURIComponent(String(season))}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const j = await res.json();
  if (!j?.ok) throw new Error(j?.error || "Request failed");
  return j?.data;
}

async function apiPUT(type, data, season) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/mini-leagues?season=${encodeURIComponent(String(season))}`, {
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

async function uploadMiniLeagueImage(file, { season, divisionCode, leagueOrder }) {
  const token = await getAccessToken();
  const fd = new FormData();
  fd.append("file", file);
  fd.append("section", "mini-leagues-league");
  fd.append("season", String(season));
  fd.append("divisionCode", String(divisionCode));
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

function normDivisionList(divisionsRaw) {
  const list = Array.isArray(divisionsRaw?.divisions)
    ? divisionsRaw.divisions
    : Array.isArray(divisionsRaw)
      ? divisionsRaw
      : [];
  return list
    .map((d, idx) => ({
      divisionCode: safeStr(d?.divisionCode || d?.code || `${(idx + 1) * 100}`),
      title: safeStr(d?.title || `Division ${safeStr(d?.divisionCode || (idx + 1) * 100)}`),
      order: Number.isFinite(Number(d?.order)) ? Number(d.order) : idx + 1,
      leagues: Array.isArray(d?.leagues) ? d.leagues : [],
    }))
    .sort((a, b) => a.order - b.order);
}

export default function AddMiniLeaguesClient() {
  const params = useSearchParams();
  const seasonFromUrl = Number(params?.get("season") || "");
  const [season, setSeason] = useState(Number.isFinite(seasonFromUrl) ? seasonFromUrl : new Date().getFullYear());

  const [loadingDivs, setLoadingDivs] = useState(true);
  const [divisions, setDivisions] = useState([]);
  const [divisionCode, setDivisionCode] = useState("");

  const [username, setUsername] = useState("");
  const [searching, setSearching] = useState(false);
  const [userLabel, setUserLabel] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [adding, setAdding] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const selectedCount = selected.size;

  useEffect(() => {
    let live = true;
    (async () => {
      setLoadingDivs(true);
      setErr("");
      try {
        const divData = await apiGET("divisions", season);
        const list = normDivisionList(divData);
        if (!live) return;
        setDivisions(list);
        setDivisionCode((prev) => prev || (list[0]?.divisionCode || ""));
      } catch (e) {
        if (live) setErr(e?.message || "Failed to load divisions.");
      } finally {
        if (live) setLoadingDivs(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [season]);

  const selectedDivision = useMemo(() => divisions.find((d) => String(d.divisionCode) === String(divisionCode)), [divisions, divisionCode]);

  async function onSearch() {
    setOk("");
    setErr("");
    setSearching(true);
    setResults([]);
    setSelected(new Set());
    try {
      const user = await sleeperUserByUsername(username);
      const leagues = await sleeperUserLeagues(user.user_id, season);
      const normalized = (Array.isArray(leagues) ? leagues : []).map((l) => ({
        leagueId: safeStr(l?.league_id),
        name: safeStr(l?.name),
        statusRaw: safeStr(l?.status),
        status: normalizeSleeperStatus(l?.status),
        totalRosters: Number(l?.total_rosters) || 0,
        avatarId: safeStr(l?.avatar),
      }));
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
    if (!selectedDivision) {
      setErr("Select a division first.");
      return;
    }
    if (selectedCount === 0) {
      setErr("Select at least one league.");
      return;
    }

    setAdding(true);
    try {
      const divData = await apiGET("divisions", season);
      const list = Array.isArray(divData?.divisions) ? divData.divisions : Array.isArray(divData) ? divData : [];
      const nextDivisions = list.map((d) => ({ ...d, leagues: Array.isArray(d?.leagues) ? d.leagues.map((l) => ({ ...l })) : [] }));

      const divIdx = nextDivisions.findIndex((d) => String(d?.divisionCode) === String(selectedDivision.divisionCode));
      if (divIdx < 0) throw new Error("Division not found in data.");

      const div = nextDivisions[divIdx];
      const existingOrders = (Array.isArray(div.leagues) ? div.leagues : [])
        .map((l) => Number(l?.order))
        .filter((n) => Number.isFinite(n));
      let nextOrder = existingOrders.length ? Math.max(...existingOrders) + 1 : 1;

      const toAdd = results.filter((r) => selected.has(String(r.leagueId)));
      for (const r of toAdd) {
        const leagueId = String(r.leagueId);
        if (!leagueId) continue;

        // Pull rosters to compute open slots.
        const rosters = await sleeperLeagueRosters(leagueId);
        const counts = computeFillCounts({ total_rosters: r.totalRosters }, rosters);

        const status = miniStatusFromSleeper({ sleeperStatus: r.status, openTeams: counts.openTeams, notReady: false });

        const entry = {
          leagueId,
          sleeperUrl: `https://sleeper.com/leagues/${leagueId}`,
          avatarId: r.avatarId || "",
          name: r.name || `League ${nextOrder}`,
          url: "",
          status,
          notReady: false,
          active: true,
          order: nextOrder,
          imageKey: "",
          imageUrl: "",
          totalTeams: counts.totalTeams,
          filledTeams: counts.filledTeams,
          openTeams: counts.openTeams,
        };

        // Upload avatar (if any)
        if (entry.avatarId) {
          const file = await fetchAvatarFile(entry.avatarId);
          if (file) {
            const up = await uploadMiniLeagueImage(file, { season, divisionCode: selectedDivision.divisionCode, leagueOrder: nextOrder });
            if (up?.key) entry.imageKey = up.key;
          }
        }

        div.leagues.push(entry);
        nextOrder += 1;
      }

      await apiPUT("divisions", { season, divisions: nextDivisions }, season);
      setOk(`Added ${toAdd.length} league(s) to ${selectedDivision.title}.`);

      // Reload divisions so the dropdown order stays accurate.
      const reloaded = await apiGET("divisions", season);
      setDivisions(normDivisionList(reloaded));
      setSelected(new Set());
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
                  Mini-Leagues <span className="text-primary">Add Leagues</span>
                </h1>
                <p className="text-sm text-muted">
                  Search a Sleeper username, pick leagues, and we’ll auto-fill name, status, avatar, and player counts.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link prefetch={false} href="/admin/mini-leagues" className="btn btn-outline">
                  ← Back to Mini-Leagues CMS
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
                <input className="input w-full" type="number" value={season} onChange={(e) => setSeason(Number(e.target.value))} />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-muted">Target Division</label>
                <select
                  className="input w-full"
                  value={divisionCode}
                  onChange={(e) => setDivisionCode(e.target.value)}
                  disabled={loadingDivs}
                >
                  {divisions.map((d) => (
                    <option key={d.divisionCode} value={d.divisionCode}>
                      {d.title} ({d.divisionCode})
                    </option>
                  ))}
                </select>
                {loadingDivs ? <div className="text-xs text-muted">Loading divisions…</div> : null}
              </div>

              <div className="space-y-2">
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

            {results.length ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted">
                    Found <strong>{results.length}</strong> leagues • Selected <strong>{selectedCount}</strong>
                  </div>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => setSelected(new Set(results.map((r) => String(r.leagueId))))}
                    disabled={!results.length}
                  >
                    Select All
                  </button>
                </div>

                <div className="grid gap-3">
                  {results.map((r) => {
                    const checked = selected.has(String(r.leagueId));
                    return (
                      <button
                        key={r.leagueId}
                        type="button"
                        onClick={() => toggleSel(r.leagueId)}
                        className={[
                          "text-left rounded-2xl border border-subtle bg-black/20 p-4 transition",
                          checked ? "ring-1 ring-[color:var(--color-accent)]/60" : "hover:bg-black/30",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={["inline-flex h-5 w-5 items-center justify-center rounded-md border", checked ? "bg-white/10" : "bg-transparent"].join(" ")}>
                                {checked ? "✓" : ""}
                              </span>
                              <div className="font-semibold truncate">{r.name || r.leagueId}</div>
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              ID: {r.leagueId} • Status: {r.statusRaw || r.status}
                              {r.totalRosters ? <span className="text-white/45"> • Teams: {r.totalRosters}</span> : null}
                            </div>
                          </div>
                          <div className="text-xs text-muted">{checked ? "Selected" : "Click to select"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-muted">
                    Note: we only set the public Invite URL to blank — paste your Sleeper invite link in the CMS later.
                  </div>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={onAddSelected}
                    disabled={adding || selectedCount === 0 || !selectedDivision}
                  >
                    {adding ? "Adding…" : `Add ${selectedCount} to ${selectedDivision?.title || "division"}`}
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
