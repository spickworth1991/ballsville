"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeStr } from "@/lib/safe";
import { getSupabase } from "@/lib/supabaseClient";

const R2_KEY = "data/dynasty/leagues.json";
const STATUS_OPTIONS = [
  "FULL & ACTIVE",
  "CURRENTLY FILLING",
  "DRAFTING",
  "ORPHAN OPEN",
  "TBD",
];

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function safeNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function slugify(input) {
  return safeStr(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function newId(prefix = "dyn") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

function statusFromSleeper(sleeperStatus) {
  const s = safeStr(sleeperStatus).toLowerCase();
  if (s === "drafting") return "DRAFTING";
  if (s === "pre_draft") return "CURRENTLY FILLING";
  if (s === "complete" || s === "in_season") return "FULL & ACTIVE";
  return "TBD";
}

function parseLeagueId(url) {
  const u = safeStr(url);
  const m = u.match(/sleeper\.com\/leagues\/(\d+)/i);
  return m ? m[1] : "";
}

export default function AddDynastyLeaguesClient() {
  const search = useSearchParams();
  const router = useRouter();

  const year = safeNum(search.get("year"), new Date().getFullYear());
  const theme = safeStr(search.get("theme")).trim();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const [leagues, setLeagues] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  const canSearch = theme.length >= 2 && Number(year) >= 2000;

  useEffect(() => {
    setSelected(new Set());
  }, [year, theme]);

  const selectedCount = selected.size;

  const selectedLeagues = useMemo(() => {
    const ids = new Set(Array.from(selected));
    return leagues.filter((l) => ids.has(String(l.league_id)));
  }, [leagues, selected]);

  async function fetchLeaguesForUser() {
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);
    try {
      const u = safeStr(username).trim();
      if (!u) throw new Error("Enter a Sleeper username.");
      if (!canSearch) throw new Error("Missing year/theme.");

      const userRes = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(u)}`);
      if (!userRes.ok) throw new Error("User not found on Sleeper.");
      const user = await userRes.json();
      const userId = safeStr(user?.user_id);
      if (!userId) throw new Error("Sleeper user_id missing.");

      const leaguesRes = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${encodeURIComponent(String(year))}`);
      if (!leaguesRes.ok) throw new Error("Failed to fetch leagues.");
      const list = await leaguesRes.json();
      const arr = Array.isArray(list) ? list : [];

      // keep only dynasty-ish leagues? (Sleeper doesn't label perfectly). We'll show all and let you pick.
      arr.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

      setLeagues(arr);
      setSelected(new Set());
      setInfoMsg(`Found ${arr.length} leagues for ${u} (${year}). Select leagues to add to “${theme}”.`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to fetch leagues.");
      setLeagues([]);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  function toggle(leagueId) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = String(leagueId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function addSelectedToDynasty() {
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);
    try {
      if (selectedCount === 0) throw new Error("Select at least one league.");

      const token = await getAccessToken();
      if (!token) throw new Error("Not logged in.");

      // Load existing dynasty rows (R2)
      const bust = `v=${Date.now()}`;
      const existingRes = await fetch(`/r2/${R2_KEY}?${bust}`, { cache: "no-store" });
      const existingJson = existingRes.ok ? await existingRes.json().catch(() => ({})) : {};
      const existingRows = Array.isArray(existingJson?.rows)
        ? existingJson.rows
        : Array.isArray(existingJson)
        ? existingJson
        : [];

      // Find max display_order in this theme/year
      const themeRows = existingRows.filter(
        (r) => Number(r?.year) === Number(year) && safeStr(r?.theme_name).trim() === theme
      );
      const maxOrder = themeRows.reduce((m, r) => Math.max(m, Number(r?.display_order) || 0), 0);

      // Build a duplicate guard across all rows by Sleeper league id
      const existingLeagueIds = new Set(
        existingRows
          .map((r) => parseLeagueId(r?.sleeper_url))
          .filter(Boolean)
      );

      let order = maxOrder;
      const toAdd = [];

      for (const lg of selectedLeagues) {
        const leagueId = safeStr(lg?.league_id);
        if (!leagueId) continue;
        if (existingLeagueIds.has(leagueId)) continue;

        order += 1;

        const sleeperStatus = safeStr(lg?.status);
        const status = statusFromSleeper(sleeperStatus);

        toAdd.push({
          id: newId(`dyn_${slugify(theme)}`),
          year: Number(year),
          theme_name: theme,
          theme_blurb: "",
          name: safeStr(lg?.name),
          status: STATUS_OPTIONS.includes(status) ? status : "TBD",
          sleeper_url: `https://sleeper.com/leagues/${leagueId}`,
          imageKey: "",
          image_url: "",
          theme_imageKey: "",
          theme_image_url: "",
          display_order: order,
          is_active: true,
          is_orphan: false,
        });
      }

      if (toAdd.length === 0) throw new Error("No new leagues to add (duplicates filtered).");

      const payload = {
        updatedAt: nowIso(),
        rows: [...existingRows, ...toAdd],
      };

      const res = await fetch(`/api/admin/dynasty`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) throw new Error(out?.error || `Save failed (${res.status})`);

      setInfoMsg(`Added ${toAdd.length} leagues to “${theme}” (${year}).`);

      // Back to dynasty admin
      router.push("/admin/dynasty");
    } catch (e) {
      setErrorMsg(e?.message || "Failed to add leagues.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Add Dynasty Leagues (from Sleeper)</h1>
          <p className="text-sm text-muted">
            Target: <span className="font-semibold text-fg">{theme || "(missing theme)"}</span> · {year}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/dynasty" className="btn btn-outline">← Back</Link>
        </div>
      </div>

      {(errorMsg || infoMsg) && (
        <div className="space-y-1 text-sm">
          {errorMsg && <p className="text-danger">{errorMsg}</p>}
          {infoMsg && !errorMsg && <p className="text-accent">{infoMsg}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-subtle bg-card-surface p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-muted">Season (year)</span>
            <input className="input" value={year ?? ""} readOnly />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted">Theme</span>
            <input className="input" value={theme} readOnly />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="space-y-1">
            <span className="text-xs text-muted">Sleeper username</span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., stickypicky"
              disabled={loading}
            />
          </label>
          <button
            className="btn btn-primary self-end"
            type="button"
            onClick={fetchLeaguesForUser}
            disabled={loading || !canSearch}
            title={!canSearch ? "Theme name must be at least 2 characters." : ""}
          >
            {loading ? "Loading…" : "Fetch leagues"}
          </button>
        </div>
      </div>

      {leagues.length > 0 && (
        <div className="rounded-2xl border border-subtle bg-card-surface p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold">Select leagues to add</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={addSelectedToDynasty}
              disabled={loading || selectedCount === 0}
            >
              Add selected ({selectedCount})
            </button>
          </div>

          <div className="grid gap-3">
            {leagues.map((lg) => {
              const id = String(lg?.league_id || "");
              const name = safeStr(lg?.name || "");
              const status = safeStr(lg?.status || "");
              const checked = selected.has(id);

              return (
                <label
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-subtle bg-panel p-4 cursor-pointer hover:bg-black/10"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{name || `League ${id}`}</p>
                    <p className="text-xs text-muted truncate">{id} · Sleeper status: {status || "—"}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(id)}
                    className="h-5 w-5"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
