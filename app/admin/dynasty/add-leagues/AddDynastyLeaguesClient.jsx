// app/admin/dynasty/add-leagues/AddDynastyLeaguesClient.jsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

const DEFAULT_SEASON = CURRENT_SEASON;

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
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
  } catch {}
  const text = await res.text().catch(() => "");
  if (!text) return `Request failed (${res.status})`;
  if (text.trim().startsWith("<")) return `Request failed (${res.status}). Check Cloudflare Pages function logs.`;
  return text;
}

async function apiGETDynastyLeagues() {
  // dynasty leagues are global (all years) in data/dynasty/leagues.json
  const res = await fetch(`/r2/data/dynasty/leagues.json?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return { updatedAt: "", rows: [] };
  return res.json();
}

async function apiPUTDynastyLeagues(rows) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not logged in.");
  const res = await fetch(`/api/admin/dynasty?season=${encodeURIComponent(String(DEFAULT_SEASON))}`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: "leagues", rows }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const out = await res.json().catch(() => ({}));
  if (!out?.ok) throw new Error(out?.error || "Save failed.");
  return out;
}

async function uploadDynastyLeagueImage({ season, leagueId, file }) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not logged in.");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("section", "dynasty-league");
  fd.append("season", String(season));
  fd.append("leagueId", String(leagueId));
  const res = await fetch("/api/admin/upload", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: fd });
  if (!res.ok) throw new Error(await readApiError(res));
  const out = await res.json().catch(() => ({}));
  if (!out?.ok) throw new Error(out?.error || "Upload failed.");
  return out.key || "";
}

async function sleeperUser(username) {
  const u = safeStr(username).trim();
  if (!u) throw new Error("Enter a Sleeper username.");
  const res = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(u)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sleeper user not found (${res.status}).`);
  return res.json();
}

async function sleeperLeaguesByUser(userId, season) {
  const res = await fetch(
    `https://api.sleeper.app/v1/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(String(season))}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch leagues (${res.status}).`);
  return res.json();
}

async function sleeperLeagueInfo(leagueId) {
  const id = safeStr(leagueId).trim();
  const res = await fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load league ${id} (${res.status}).`);
  return res.json();
}

async function fetchAvatarFile(avatarId) {
  const a = safeStr(avatarId).trim();
  if (!a) return null;
  const url = `https://sleepercdn.com/avatars/${encodeURIComponent(a)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const blob = await res.blob();
  const type = blob.type || "image/png";
  return new File([blob], `${a}.png`, { type });
}

function dynastyStatusFromSleeper(raw) {
  const s = safeStr(raw).toLowerCase().trim();
  if (s === "pre_draft" || s === "predraft" || s === "pre-draft") return "CURRENTLY FILLING";
  if (s === "drafting") return "DRAFTING";
  if (s === "in_season" || s === "inseason" || s === "in-season") return "FULL & ACTIVE";
  if (s === "complete") return "FULL & ACTIVE";
  return "TBD";
}

function normalizeRow(r) {
  const year = Number(r?.year);
  return {
    id: safeStr(r?.id),
    year: Number.isFinite(year) ? year : DEFAULT_SEASON,
    theme_name: safeStr(r?.theme_name),
    theme_blurb: safeStr(r?.theme_blurb),
    theme_imageKey: safeStr(r?.theme_imageKey || r?.theme_image_key || ""),
    theme_image_url: safeStr(r?.theme_image_url || ""),
    name: safeStr(r?.name),
    sleeper_url: safeStr(r?.sleeper_url),
    url: safeStr(r?.url || ""),
    status: safeStr(r?.status || "TBD"),
    fill_note: r?.fill_note ?? null,
    is_orphan: typeof r?.is_orphan === "boolean" ? r.is_orphan : false,
    is_active: typeof r?.is_active === "boolean" ? r.is_active : true,
    imageKey: safeStr(r?.imageKey || r?.image_key || ""),
    image_url: safeStr(r?.image_url || ""),
    // optional fields (kept if present)
    league_id: safeStr(r?.league_id || r?.leagueId || ""),
    avatarId: safeStr(r?.avatarId || ""),
    is_theme_stub: Boolean(r?.is_theme_stub),
  };
}

export default function AddDynastyLeaguesClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const year = Number(sp.get("year") || DEFAULT_SEASON);
  const themeName = safeStr(sp.get("theme") || "").trim();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  const canSearch = themeName.length >= 2;
  
  const filtered = useMemo(() => {
    // hide non-commissioner leagues? leave all; sort by name
    const list = Array.isArray(leagues) ? leagues : [];
    return list
      .map((l) => ({
        league_id: safeStr(l?.league_id || l?.leagueId || ""),
        name: safeStr(l?.name || ""),
        avatar: safeStr(l?.avatar || ""),
        status: safeStr(l?.status || ""),
        total_rosters: l?.total_rosters,
      }))
      .filter((l) => l.league_id && l.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leagues]);

  async function onSearch() {
    setErr("");
    setInfo("");
    setLoading(true);
    setSelected(new Set());
    try {
      if (!canSearch) throw new Error("Theme name is required before adding leagues.");
      const u = await sleeperUser(username);
      setUser(u);
      const ls = await sleeperLeaguesByUser(u.user_id, year);
      setLeagues(Array.isArray(ls) ? ls : []);
      setInfo(`Found ${Array.isArray(ls) ? ls.length : 0} leagues for ${year}.`);
    } catch (e) {
      setErr(e?.message || "Failed to load leagues.");
      setUser(null);
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }
  

  function toggleSelect(leagueId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leagueId)) next.delete(leagueId);
      else next.add(leagueId);
      return next;
    });
  }

  async function onAddSelected() {
    setErr("");
    setInfo("");
    setSaving(true);
    try {
      if (!canSearch) throw new Error("Theme name is required.");
      const ids = Array.from(selected.values());
      if (!ids.length) throw new Error("Select at least one league.");

      // Load existing dynasty leagues JSON
      const existingPayload = await apiGETDynastyLeagues();
      const existingRowsRaw = Array.isArray(existingPayload?.rows) ? existingPayload.rows : [];
      const existingRows = existingRowsRaw.map(normalizeRow);

      // Find the theme's existing metadata (blurb/image), even if it's a stub.
      const themeRow = existingRows.find((r) => Number(r.year) === Number(year) && safeStr(r.theme_name) === themeName);
      const theme_blurb = themeRow ? safeStr(themeRow.theme_blurb) : "";
      const theme_imageKey = themeRow ? safeStr(themeRow.theme_imageKey) : "";
      const theme_image_url = themeRow ? safeStr(themeRow.theme_image_url) : "";

      // Remove any theme stub rows for this theme/year (we'll replace with real leagues).
      const rowsWithoutStub = existingRows.filter(
        (r) => !(Number(r.year) === Number(year) && safeStr(r.theme_name) === themeName && r.is_theme_stub)
      );

      const newRows = [];
      for (const leagueId of ids) {
        const info = await sleeperLeagueInfo(leagueId);
        const name = safeStr(info?.name || "");
        const status = dynastyStatusFromSleeper(info?.status);
        const avatarId = safeStr(info?.avatar || "");

        // If this league already exists in this theme/year, skip it.
        const already = rowsWithoutStub.some((r) => Number(r.year) === Number(year) && safeStr(r.theme_name) === themeName && safeStr(r.league_id) === safeStr(leagueId));
        if (already) continue;

        const row = normalizeRow({
          id: `dyn_${year}_${leagueId}`,
          year,
          theme_name: themeName,
          theme_blurb,
          theme_imageKey,
          theme_image_url,
          name: name || `League ${leagueId}`,
          sleeper_url: `https://sleeper.app/league/${leagueId}`,
          status,
          is_active: true,
          is_orphan: status.toUpperCase().includes("ORPHAN"),
          fill_note: null,
          league_id: leagueId,
          avatarId,
          imageKey: "",
          image_url: "",
        });

        // Upload avatar (if present) as the league image.
        if (avatarId) {
          const f = await fetchAvatarFile(avatarId);
          if (f) {
            const key = await uploadDynastyLeagueImage({ season: year, leagueId, file: f });
            row.imageKey = key;
          }
        }

        newRows.push(row);
      }

      const nextRows = [...rowsWithoutStub, ...newRows].map(normalizeRow);

      await apiPUTDynastyLeagues(nextRows);

      setInfo(`Added ${newRows.length} league(s) to “${themeName}”.`);
      // back to admin
      router.push(`/admin/dynasty?year=${encodeURIComponent(String(year))}&openTheme=${encodeURIComponent(themeName)}`);
    } catch (e) {
      setErr(e?.message || "Failed to add leagues.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-white">
      <div className="mb-6">
        <div className="text-xs text-white/60">Dynasty / Add leagues</div>
        <h1 className="text-2xl font-semibold">Add leagues to theme</h1>
        <p className="mt-1 text-white/60">
          Year: <span className="text-white/80">{year}</span>{" "}
          <span className="mx-2 text-white/30">•</span>
          Theme: <span className="text-white/80">{themeName || "—"}</span>
        </p>
      </div>

      {(info || err) && (
        <div className="mb-5 grid gap-2">
          {info && <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-emerald-100">{info}</div>}
          {err && <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-100">{err}</div>}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-card-surface p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <div className="mb-1 text-xs text-white/60">Sleeper username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. stickypicky"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20"
            />
            {!canSearch && (
              <div className="mt-1 text-[11px] text-white/45">Theme name is required before you can search.</div>
            )}
          </label>

          <button
            type="button"
            onClick={onSearch}
            disabled={loading || !canSearch}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {loading ? "Searching…" : "Find leagues"}
          </button>
        </div>

        {user && (
          <div className="mt-4 text-xs text-white/60">
            User: <span className="text-white/80">{safeStr(user?.display_name || user?.username || "")}</span>
          </div>
        )}

        {filtered.length > 0 && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm font-semibold">Select leagues</div>
              <button
                type="button"
                onClick={onAddSelected}
                disabled={saving || selected.size === 0}
                className="rounded-xl bg-card-surface px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-60"
              >
                {saving ? "Adding…" : `Add selected (${selected.size})`}
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              {filtered.map((l) => {
                const checked = selected.has(l.league_id);
                const avatar = safeStr(l.avatar);
                const img = avatar ? `https://sleepercdn.com/avatars/${encodeURIComponent(avatar)}` : "";
                return (
                  <label
                    key={l.league_id}
                    className={
                      "flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 transition " +
                      (checked ? "border-[var(--color-accent)]/40 bg-white/5" : "hover:bg-white/5")
                    }
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-accent)]"
                      checked={checked}
                      onChange={() => toggleSelect(l.league_id)}
                    />
                    {img ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        <Image src={img} alt={l.name} fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-xl border border-white/10 bg-black/30" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white/90">{l.name}</div>
                      <div className="mt-0.5 text-xs text-white/60">
                        ID: <span className="text-white/70">{l.league_id}</span>
                        <span className="mx-2 text-white/25">•</span>
                        Status: <span className="text-white/70">{safeStr(l.status || "—")}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-white/60">
        <button
          type="button"
          onClick={() => router.push("/admin/dynasty")}
          className="rounded-xl bg-card-surface px-4 py-2 font-semibold hover:bg-white/15"
        >
          ← Back
        </button>
        <div>Avatars are pulled from Sleeper and saved to R2 automatically.</div>
      </div>
    </div>
  );
}
