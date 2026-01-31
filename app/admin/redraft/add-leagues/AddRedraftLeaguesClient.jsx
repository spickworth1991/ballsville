// app/admin/redraft/add-leagues/AddRedraftLeaguesClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

const SEASON = CURRENT_SEASON;

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

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (v === "pre_draft" || v === "predraft" || v === "pre-draft") return "predraft";
  if (v === "drafting") return "drafting";
  if (v === "in_season" || v === "inseason" || v === "in-season") return "inseason";
  if (v === "complete") return "complete";
  return v || "predraft";
}

function statusLabel(v) {
  const s = normalizeStatus(v);
  if (s === "predraft") return "PRE-DRAFT";
  if (s === "drafting") return "DRAFTING";
  if (s === "inseason") return "IN-SEASON";
  if (s === "complete") return "COMPLETE";
  return String(v || "").toUpperCase() || "—";
}

async function apiGETLeagues() {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/redraft?season=${SEASON}&type=leagues`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function apiPUTLeagues(data) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/redraft?season=${SEASON}`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: "leagues", data }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function uploadRedraftLeagueImage(file, leagueOrder) {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", file);
  form.append("section", "redraft-league");
  form.append("season", String(SEASON));
  form.append("leagueOrder", String(leagueOrder));
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function sleeperFetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper request failed (${res.status})`);
  return res.json();
}

async function sleeperUserId(username) {
  const u = String(username || "").trim();
  if (!u) throw new Error("Enter a Sleeper username.");
  const user = await sleeperFetchJson(`https://api.sleeper.com/v1/user/${encodeURIComponent(u)}`);
  const id = user?.user_id;
  if (!id) throw new Error("Sleeper user not found.");
  return { userId: id, display: user?.display_name || u };
}

async function sleeperUserLeagues(userId) {
  const arr = await sleeperFetchJson(`https://api.sleeper.com/v1/user/${encodeURIComponent(userId)}/leagues/nfl/${SEASON}`);
  return Array.isArray(arr) ? arr : [];
}

async function sleeperLeagueInfo(leagueId) {
  return sleeperFetchJson(`https://api.sleeper.com/v1/league/${encodeURIComponent(leagueId)}`);
}

function leagueAvatarUrl(avatarId) {
  const a = String(avatarId || "").trim();
  if (!a) return "";
  return `https://sleepercdn.com/avatars/${a}`;
}

export default function AddRedraftLeaguesClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [existing, setExisting] = useState([]); // current leagues_<season>.json
  const [username, setUsername] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupDisplay, setLookupDisplay] = useState("");
  const [results, setResults] = useState([]); // leagues from username
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const j = await apiGETLeagues();
        const list = Array.isArray(j?.data?.leagues) ? j.data.leagues : [];
        list.sort((a, b) => Number(a.order) - Number(b.order));
        setExisting(list);
      } catch (e) {
        setErr(e?.message || "Failed to load existing Redraft leagues.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const existingIds = useMemo(() => new Set(existing.map((l) => String(l.leagueId || l.league_id || "").trim()).filter(Boolean)), [existing]);

  const filteredResults = useMemo(() => {
    const q = username.trim().toLowerCase();
    // no filtering by name here; keep as-is (Sleeper can return many)
    return results.map((l) => {
      const id = String(l.league_id || l.leagueId || "").trim();
      return {
        id,
        name: l.name || "(unnamed)",
        status: l.status || "",
        season: l.season,
        already: existingIds.has(id),
      };
    });
  }, [results, existingIds, username]);

  async function onLookup() {
    setErr("");
    setOk("");
    setLookupBusy(true);
    setResults([]);
    setSelected(new Set());
    setLookupDisplay("");
    try {
      const { userId, display } = await sleeperUserId(username);
      setLookupDisplay(display);
      const leagues = await sleeperUserLeagues(userId);

      // keep only leagues that actually have a draft_id (redraft context)
      const cleaned = leagues
        .filter((l) => l && (l.draft_id || l.draftId || l.draft_id === ""))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

      setResults(cleaned);
      if (!cleaned.length) setOk("No leagues found for that user/season.");
    } catch (e) {
      setErr(e?.message || "Lookup failed.");
    } finally {
      setLookupBusy(false);
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onAddSelected() {
    setErr("");
    setOk("");
    const ids = Array.from(selected);
    if (!ids.length) {
      setErr("Select at least one league.");
      return;
    }

    setSaving(true);
    try {
      // compute next order start
      const maxOrder = existing.length ? Math.max(...existing.map((l) => Number(l.order) || 0)) : 0;
      let order = maxOrder;

      // build new entries
      const newLeagues = [];
      for (const leagueId of ids) {
        if (!leagueId) continue;
        if (existingIds.has(leagueId)) continue;

        const info = await sleeperLeagueInfo(leagueId);
        order += 1;

        const name = info?.name || "Unnamed League";
        const status = normalizeStatus(info?.status);
        const avatarId = String(info?.avatar || "").trim();

        let imageKey = "";
        if (avatarId) {
          // fetch avatar as blob and upload via existing admin upload endpoint (deterministic by order)
          const url = leagueAvatarUrl(avatarId);
          const imgRes = await fetch(url, { cache: "no-store" });
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const ext = (blob.type || "").includes("png") ? "png" : (blob.type || "").includes("jpeg") ? "jpg" : "png";
            const file = new File([blob], `sleeper-avatar-${leagueId}.${ext}`, { type: blob.type || "image/png" });
            const up = await uploadRedraftLeagueImage(file, order);
            imageKey = up?.key || "";
          }
        }

        newLeagues.push({
          leagueId,
          sleeperUrl: `https://sleeper.com/league/${leagueId}`,
          avatarId,
          name,
          status, // predraft|drafting|inseason|complete
          url: "", // invite link manual
          active: true,
          order,
          imageKey,
          imageUrl: "", // optional legacy fallback
        });
      }

      if (!newLeagues.length) {
        setOk("Nothing new to add (already added).");
        setSaving(false);
        return;
      }

      const merged = [...existing, ...newLeagues].sort((a, b) => Number(a.order) - Number(b.order));
      await apiPUTLeagues({ season: SEASON, leagues: merged });

      setOk(`Added ${newLeagues.length} league(s). Now set invite links in Redraft Admin.`);
      // refresh existing
      const j = await apiGETLeagues();
      const list = Array.isArray(j?.data?.leagues) ? j.data.leagues : [];
      list.sort((a, b) => Number(a.order) - Number(b.order));
      setExisting(list);

      setSelected(new Set());
    } catch (e) {
      setErr(e?.message || "Failed to add leagues.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-white/70">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Loading…</div>
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Add Redraft Leagues</h1>
          <p className="text-white/60">Pull leagues from Sleeper for season {SEASON}. We’ll auto-sync name/status/avatar.</p>
        </div>

        <Link
          href="/admin/redraft"
          className="inline-flex w-fit items-center justify-center rounded-xl bg-card-surface px-4 py-2 text-sm font-semibold hover:bg-white/15"
        >
          ← Back to Redraft Admin
        </Link>
      </div>

      {(ok || err) && (
        <div className="mb-5 grid gap-2">
          {ok && <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-emerald-100">{ok}</div>}
          {err && <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-100">{err}</div>}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-card-surface p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <div className="mb-1 text-xs text-white/60">Sleeper username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20"
              placeholder="stickyPicky"
            />
            {lookupDisplay && <div className="mt-1 text-[11px] text-white/40">Found: {lookupDisplay}</div>}
          </label>

          <button
            type="button"
            onClick={onLookup}
            disabled={lookupBusy || !username.trim()}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {lookupBusy ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {!results.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              Search a username to show their leagues.
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-white/70">
                  Found <span className="text-white">{results.length}</span> league(s).
                </div>
                <button
                  type="button"
                  onClick={onAddSelected}
                  disabled={saving || selectedCount === 0}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
                >
                  {saving ? "Adding…" : `Add selected (${selectedCount})`}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {filteredResults.map((l) => {
                  const checked = selected.has(l.id);
                  const disabled = !l.id || l.already;
                  return (
                    <button
                      key={l.id || l.name}
                      type="button"
                      onClick={() => !disabled && toggle(l.id)}
                      className={[
                        "flex w-full items-start gap-3 rounded-2xl border bg-black/20 p-4 text-left transition",
                        disabled ? "cursor-not-allowed border-white/5 opacity-60" : "border-white/10 hover:bg-white/5",
                        checked ? "ring-2 ring-[var(--color-accent)]" : "",
                      ].join(" ")}
                      disabled={disabled}
                    >
                      <div className="mt-1 h-4 w-4 shrink-0 rounded border border-white/20 bg-black/30">
                        {checked && <div className="h-full w-full bg-[var(--color-accent)]" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold">{l.name}</div>
                          <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                            {statusLabel(l.status)}
                          </div>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                          <span>League ID: {l.id}</span>
                          {l.already && <span className="text-emerald-200/80">Already added</span>}
                          <a
                            href={`https://sleeper.com/league/${l.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--color-accent)] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open in Sleeper
                          </a>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-white/45">
                Note: We only auto-sync name/status/avatar. You’ll set the invite link manually back in Redraft Admin.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
