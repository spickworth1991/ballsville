// src/app/admin/gauntlet/seeds/page.jsx
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season2";
import AdminGuard from "@/components/AdminGuard";

const YEAR = CURRENT_SEASON;
const TABLE_NAME = `gauntlet_seeds_${YEAR}`;
const MAX_TEAMS_PER_LEAGUE = 12;

// Small helper
function classNames(...cls) {
  return cls.filter(Boolean).join(" ");
}

export default function GauntletSeedsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [leagues, setLeagues] = useState([]); // flat list of league objects
  const [expandedLeagueId, setExpandedLeagueId] = useState(null);

  // draftSeeds: leagueId -> { rowId -> seedString }
  const [draftSeeds, setDraftSeeds] = useState({});
  const [dirtyLeagueId, setDirtyLeagueId] = useState(null);
  const [draftNames, setDraftNames] = useState({});
  // newOwners: leagueId -> [{ name: string, seed: string }]
  const [newOwners, setNewOwners] = useState({});

  const [showNewModal, setShowNewModal] = useState(false);
  const [newLeagueForm, setNewLeagueForm] = useState({
    division: "",
    godName: "",
    side: "light",
    leagueId: "",
  });

  // ====== LOAD DATA ======
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IMPORTANT: return the computed leagueList so callers can safely use it immediately
  async function loadData() {
    setError("");
    setLoading(true);
    setExpandedLeagueId(null);
    setDirtyLeagueId(null);
    setDraftSeeds({});
    setDraftNames({});
    setNewOwners({});

    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError("Supabase client not available. Open this in a browser.");
        setLoading(false);
        return [];
      }

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("id, year, division, god_name, god, side, league_id, league_name, owner_id, owner_name, seed")
        .eq("year", YEAR)
        .order("division", { ascending: true })
        .order("god_name", { ascending: true })
        .order("side", { ascending: true })
        .order("seed", { ascending: true });

      if (error) {
        console.error(error);
        setError(error.message || "Failed to load seeds.");
        setLoading(false);
        return [];
      }

      const leaguesMap = new Map();

      for (const row of data || []) {
        const leagueId = String(row.league_id);
        if (!leaguesMap.has(leagueId)) {
          leaguesMap.set(leagueId, {
            leagueId,
            leagueName: row.league_name || null,
            division: row.division || "Unknown",
            godName: row.god_name || row.god || "Unknown God",
            side: row.side || "light",
            rows: [],
          });
        }
        leaguesMap.get(leagueId).rows.push({
          id: row.id,
          ownerId: row.owner_id ? String(row.owner_id) : null,
          ownerName: row.owner_name || row.owner_id || "Unknown owner",
          seed: row.seed != null ? Number(row.seed) : null,
        });
      }

      const leagueList = Array.from(leaguesMap.values()).map((league) => {
        const seededCount = league.rows.filter((r) => r.seed != null).length;
        return {
          ...league,
          seededCount,
          teamCount: league.rows.length,
        };
      });

      setLeagues(leagueList);
      setLoading(false);
      return leagueList;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load seeds.");
      setLoading(false);
      return [];
    }
  }

  function leagueNeedsSeeds(league) {
    // "seeded" = 12+ non-null seeds
    return (league.seededCount || 0) < 12;
  }

  // ====== EDITING ======

  // IMPORTANT: accept an optional league list so we don't depend on async React state timing
  function startEditLeague(leagueId, leagueListOverride) {
    const source = leagueListOverride || leagues;
    const league = source.find((l) => l.leagueId === leagueId);
    if (!league) return;

    // Initialize seeds map for existing rows by row.id
    const seeds = {};
    const names = {}; // for owner_id null rows ONLY

    for (const row of league.rows) {
      seeds[row.id] = row.seed != null ? String(row.seed) : "";
      if (!row.ownerId) {
        names[row.id] = row.ownerName || "";
      }
    }

    // Initialize manual owner slots for this league
    const extraSlots = Math.max(0, MAX_TEAMS_PER_LEAGUE - league.rows.length);

    setDraftSeeds((prev) => ({
      ...prev,
      [leagueId]: seeds,
    }));

    setDraftNames((prev) => ({
      ...prev,
      [leagueId]: names,
    }));

    setNewOwners((prev) => {
      const existing = prev[leagueId] || [];
      const updated = [...existing];
      while (updated.length < extraSlots) {
        updated.push({ name: "", seed: "" });
      }
      return {
        ...prev,
        [leagueId]: updated,
      };
    });
  }

  function handleToggleLeague(leagueId) {
    if (dirtyLeagueId && dirtyLeagueId !== leagueId) {
      const leave = window.confirm("You have unsaved changes for another league. Discard them and switch?");
      if (!leave) return;
      setDirtyLeagueId(null);
    }

    if (expandedLeagueId === leagueId) {
      // closing
      if (dirtyLeagueId === leagueId) {
        const leave = window.confirm("You have unsaved changes. Close anyway and discard them?");
        if (!leave) return;
      }
      setExpandedLeagueId(null);
      setDirtyLeagueId(null);
      return;
    }

    setExpandedLeagueId(leagueId);
    setDirtyLeagueId(null);
    startEditLeague(leagueId);
  }

  function handleSeedChange(leagueId, rowId, value) {
    setDraftSeeds((prev) => {
      const curr = prev[leagueId] || {};
      return {
        ...prev,
        [leagueId]: {
          ...curr,
          [rowId]: value,
        },
      };
    });
    setDirtyLeagueId(leagueId);
  }

  function handleNameChange(leagueId, rowId, value) {
    setDraftNames((prev) => {
      const curr = prev[leagueId] || {};
      return {
        ...prev,
        [leagueId]: {
          ...curr,
          [rowId]: value,
        },
      };
    });
    setDirtyLeagueId(leagueId);
  }

  function handleNewOwnerChange(leagueId, index, field, value) {
    setNewOwners((prev) => {
      const curr = prev[leagueId] ? [...prev[leagueId]] : [];
      while (curr.length <= index) {
        curr.push({ name: "", seed: "" });
      }
      curr[index] = {
        ...curr[index],
        [field]: value,
      };
      return {
        ...prev,
        [leagueId]: curr,
      };
    });
    setDirtyLeagueId(leagueId);
  }

  async function handleSaveLeague(leagueId) {
    const league = leagues.find((l) => l.leagueId === leagueId);
    if (!league) return;

    const seedsForLeague = draftSeeds[leagueId] || {};
    const newSlots = newOwners[leagueId] || [];

    setSaving(true);
    setError("");

    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError("Supabase client not available.");
        setSaving(false);
        return;
      }

      const updates = [];
      const inserts = [];

      // === Existing rows → UPDATE by id ===
      const namesForLeague = draftNames[leagueId] || {};

      for (const row of league.rows) {
        const raw = seedsForLeague[row.id];
        const seed = raw === "" || raw == null ? null : Math.max(1, Number(raw) || 1);

        // Only manual DB rows (owner_id null) can rename owner_name
        let nextName = null;
        let nameChanged = false;

        if (!row.ownerId) {
          const proposed = (namesForLeague[row.id] ?? row.ownerName ?? "").trim();
          // keep NOT NULL constraint safe
          nextName = proposed || "TBD";
          nameChanged = nextName !== (row.ownerName || "");
        }

        // Only send update if changed
        if (row.seed !== seed || nameChanged) {
          const payload = { id: row.id, seed };
          if (nameChanged) payload.owner_name = nextName;
          updates.push(payload);
        }
      }

      // === Manual extra owners (no owner_id) → INSERT ===
      // We only care about slots with a non-empty name.
      const extraSlotsAllowed = Math.max(0, MAX_TEAMS_PER_LEAGUE - league.rows.length);
      const effectiveSlots = newSlots.slice(0, extraSlotsAllowed);

      for (const slot of effectiveSlots) {
        const name = (slot.name || "").trim();
        if (!name) continue; // skip empty rows

        const rawSeed = slot.seed;
        const seed = rawSeed === "" || rawSeed == null ? null : Math.max(1, Number(rawSeed) || 1);

        inserts.push({
          year: YEAR,
          division: league.division,
          god: league.godName, // ensure god is filled
          god_name: league.godName, // keep god_name in sync
          side: league.side,
          league_id: league.leagueId,
          league_name: league.leagueName,
          owner_id: null,
          owner_name: name,
          seed,
        });
      }

      // Perform updates first
      if (updates.length) {
        const results = await Promise.all(
          updates.map((u) =>
            supabase
              .from(TABLE_NAME)
              .update(u.owner_name != null ? { seed: u.seed, owner_name: u.owner_name } : { seed: u.seed })
              .eq("id", u.id)
          )
        );

        const firstError = results.find((r) => r.error)?.error;
        if (firstError) {
          console.error("Supabase update error (save seeds):", firstError);
          setError(firstError.message || "Failed to save seeds.");
          setSaving(false);
          return;
        }
      }

      // Then inserts for manual owners
      if (inserts.length) {
        const { error: insertError } = await supabase.from(TABLE_NAME).insert(inserts);

        if (insertError) {
          console.error("Supabase insert error (manual owners):", insertError);
          setError(insertError.message || "Failed to save manual owners.");
          setSaving(false);
          return;
        }
      }

      setDirtyLeagueId(null);
      // Clear manual slots for this league; they will reload from DB
      setNewOwners((prev) => ({
        ...prev,
        [leagueId]: [],
      }));

      // IMPORTANT: use returned leagueList to avoid state timing flakiness
      const leagueList = await loadData();
      setExpandedLeagueId(leagueId);
      startEditLeague(leagueId, leagueList);
    } catch (err) {
      console.error("handleSaveLeague error:", err);
      setError(err.message || "Failed to save seeds.");
    } finally {
      setSaving(false);
    }
  }

  // ====== CREATE / SYNC LEAGUES ======

  function openNewLeagueModal() {
    setNewLeagueForm({
      division: "",
      godName: "",
      side: "light",
      leagueId: "",
    });
    setShowNewModal(true);
  }

  async function handleCreateLeague(e) {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError("Supabase client not available.");
        setCreating(false);
        return;
      }

      const { division, godName, side, leagueId } = newLeagueForm;
      if (!division || !godName || !side || !leagueId) {
        setError("Please fill division, god name, side, and league ID.");
        setCreating(false);
        return;
      }

      // 1) Fetch league info + rosters from Sleeper
      const baseUrl = `https://api.sleeper.app/v1/league/${leagueId}`;
      const [leagueInfo, users, rosters] = await Promise.all([
        fetch(baseUrl).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch league ${leagueId} from Sleeper (info)`);
          return r.json();
        }),
        fetch(`${baseUrl}/users`).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch league ${leagueId} users from Sleeper`);
          return r.json();
        }),
        fetch(`${baseUrl}/rosters`).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch league ${leagueId} rosters from Sleeper`);
          return r.json();
        }),
      ]);

      const userMap = {};
      (users || []).forEach((u) => {
        userMap[u.user_id] = u.display_name;
      });

      // IMPORTANT:
      // Sleeper can return open rosters with owner_id = null.
      // owner_name is NOT NULL and onConflict won't de-dupe NULL owner_id rows.
      // So ONLY seed real owners here. Open/manual slots are handled in this UI.
      const rows = (rosters || [])
        .filter((r) => !!r?.owner_id)
        .map((r) => {
          const oid = String(r.owner_id);
          const oname = (userMap[oid] || `Owner ${oid}` || "").trim() || `Owner ${oid}`;
          return {
            year: YEAR,
            division,
            god: godName,
            god_name: godName,
            side,
            league_id: leagueId,
            league_name: leagueInfo?.name || null,
            owner_id: oid,
            owner_name: oname,
            seed: null,
          };
        });

      if (!rows.length) {
        throw new Error("No owned rosters returned from Sleeper (all owner_id were null); cannot sync owners.");
      }

      const { error } = await supabase.from(TABLE_NAME).upsert(rows, {
        onConflict: "year,league_id,owner_id",
      });

      if (error) {
        console.error("Supabase syncOwners error:", error);
        setError(error.message || "Failed to sync owners.");
        setCreating(false);
        return;
      }

      setShowNewModal(false);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create league seeds.");
    } finally {
      setCreating(false);
    }
  }

  // Sync owners for an existing league
  async function handleSyncOwners(league) {
    if (!league?.leagueId) return;

    if (
      !window.confirm(
        `Sync owners for ${league.leagueName || league.leagueId} from Sleeper?\n` +
          "This will add any missing owners; existing seeds stay as-is."
      )
    ) {
      return;
    }

    setCreating(true);
    setError("");

    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError("Supabase client not available.");
        setCreating(false);
        return;
      }

      const { division, godName, side, leagueId } = league;
      const baseUrl = `https://api.sleeper.app/v1/league/${leagueId}`;

      const [leagueInfo, users, rosters] = await Promise.all([
        fetch(baseUrl).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch league ${leagueId} from Sleeper (info)`);
          return r.json();
        }),
        fetch(`${baseUrl}/users`).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch league ${leagueId} users from Sleeper`);
          return r.json();
        }),
        fetch(`${baseUrl}/rosters`).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch league ${leagueId} rosters from Sleeper`);
          return r.json();
        }),
      ]);

      const userMap = {};
      (users || []).forEach((u) => {
        userMap[u.user_id] = u.display_name;
      });

      // IMPORTANT:
      // Sleeper can return open rosters with owner_id = null.
      // Your DB has owner_name NOT NULL, and onConflict can't de-dupe NULL owner_id rows.
      // So ONLY upsert real owners here. Open/manual slots are handled via the UI.
      const rows = (rosters || [])
        .filter((r) => !!r?.owner_id)
        .map((r) => {
          const oid = String(r.owner_id);
          const oname = (userMap[oid] || `Owner ${oid}` || "").trim() || `Owner ${oid}`;
          return {
            year: YEAR,
            division,
            god: godName,
            god_name: godName,
            side,
            league_id: leagueId,
            league_name: leagueInfo?.name || null,
            owner_id: oid,
            owner_name: oname,
            seed: null, // don't overwrite existing seeds
          };
        });

      if (!rows.length) {
        throw new Error("No owned rosters returned from Sleeper (all owner_id were null); cannot sync owners.");
      }

      const { error } = await supabase.from(TABLE_NAME).upsert(rows, {
        onConflict: "year,league_id,owner_id",
      });

      if (error) {
        console.error(error);
        setError(error.message || "Failed to sync owners.");
        setCreating(false);
        return;
      }

      // IMPORTANT: use returned leagueList to avoid state timing flakiness
      const leagueList = await loadData();
      setExpandedLeagueId(leagueId);
      startEditLeague(leagueId, leagueList);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to sync owners.");
    } finally {
      setCreating(false);
    }
  }

  // ====== RENDER HELPERS ======

  const leaguesNeedingSeeds = leagues.filter(leagueNeedsSeeds);
  const leaguesSeeded = leagues.filter((l) => !leagueNeedsSeeds(l));

  function renderLeagueCard(league, type) {
    const isExpanded = expandedLeagueId === league.leagueId;
    const owners = league.rows.slice().sort((a, b) => {
      const sa = a.seed ?? 999;
      const sb = b.seed ?? 999;
      if (sa !== sb) return sa - sb;
      return (a.ownerName || "").localeCompare(b.ownerName || "");
    });

    const extraSlots = Math.max(0, MAX_TEAMS_PER_LEAGUE - owners.length);
    const manualSlots = (newOwners[league.leagueId] || []).slice(0, extraSlots);

    return (
      <div key={`${type}-${league.leagueId}`} className="border border-slate-700 rounded-xl bg-slate-900/70 shadow-md">
        {/* Header row (clickable to expand) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleToggleLeague(league.leagueId)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggleLeague(league.leagueId);
            }
          }}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/80 rounded-t-xl cursor-pointer"
        >
          <div className="flex flex-col gap-0.5">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              {league.division} · {league.godName} · {league.side === "light" ? "Light" : "Dark"}
            </div>
            <div className="font-semibold text-slate-50">
              {league.leagueName || "(No league name)"}{" "}
              <span className="text-xs text-slate-400">({league.leagueId})</span>
            </div>
            <div className="text-xs text-slate-400">
              Seeds: {league.seededCount}/{MAX_TEAMS_PER_LEAGUE} • Teams in table: {league.teamCount}
              {leagueNeedsSeeds(league) && " • needs more seeds"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSyncOwners(league);
              }}
              className="text-xs rounded-full border border-amber-400 px-2 py-1 text-amber-300 hover:bg-amber-400 hover:text-slate-900"
            >
              Sync owners
            </button>
            <span
              className={classNames(
                "inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                isExpanded ? "border-amber-400 text-amber-300" : "border-slate-600 text-slate-400"
              )}
            >
              {isExpanded ? "−" : "+"}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-800 rounded-b-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-100">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                    <th className="px-2 py-1 text-left">Owner</th>
                    <th className="px-2 py-1 text-left">Owner ID</th>
                    <th className="px-2 py-1 text-left">Seed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {/* Existing owners (from DB) */}
                  {owners.map((o) => (
                    <tr key={o.id}>
                      <td className="px-2 py-1">
                        {!o.ownerId ? (
                          <input
                            type="text"
                            value={(draftNames[league.leagueId] || {})[o.id] ?? o.ownerName ?? ""}
                            onChange={(e) => handleNameChange(league.leagueId, o.id, e.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            placeholder="Manual owner name"
                          />
                        ) : (
                          <div className="truncate max-w-[180px] text-slate-100">{o.ownerName}</div>
                        )}
                      </td>

                      <td className="px-2 py-1 text-xs text-slate-400">{o.ownerId || "—"}</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={(draftSeeds[league.leagueId] || {})[o.id] ?? (o.seed != null ? o.seed.toString() : "")}
                          onChange={(e) => handleSeedChange(league.leagueId, o.id, e.target.value)}
                          className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}

                  {/* Manual extra owners up to 12 teams total */}
                  {manualSlots.map((slot, index) => (
                    <tr key={`manual-${league.leagueId}-${index}`}>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={slot.name}
                          onChange={(e) => handleNewOwnerChange(league.leagueId, index, "name", e.target.value)}
                          placeholder="Manual owner name"
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </td>
                      <td className="px-2 py-1 text-xs text-slate-500">(manual)</td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={slot.seed}
                          onChange={(e) => handleNewOwnerChange(league.leagueId, index, "seed", e.target.value)}
                          className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSaveLeague(league.leagueId)}
                disabled={saving || dirtyLeagueId !== league.leagueId}
                className={classNames(
                  "inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium",
                  dirtyLeagueId === league.leagueId
                    ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    : "bg-slate-700 text-slate-300 cursor-not-allowed opacity-60"
                )}
              >
                {saving && dirtyLeagueId === league.leagueId ? "Saving…" : "Save seeds"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ====== RENDER PAGE ======

  return (
  <AdminGuard>
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Gauntlet – Manual Seeds ({YEAR})</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Set and edit Leg 1 seeds for each league. A league is considered{" "}
            <span className="font-semibold text-amber-300">seeded</span> when it has at least 12 non-empty seeds. You can
            also add manual teams for leagues that are missing owners in Sleeper.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Table: <code className="text-slate-300">{TABLE_NAME}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={openNewLeagueModal}
            className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            + New league (from Sleeper)
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/60 bg-red-900/40 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-sm text-slate-300">Loading seeds…</div>
      ) : leagues.length === 0 ? (
        <div className="mt-10 text-sm text-slate-300">
          No leagues found in <code>{TABLE_NAME}</code> for {YEAR}. Create leagues using the button above.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Leagues needing seeds */}
          <section>
            <h2 className="text-lg font-semibold text-amber-300 mb-2">Leagues needing seeds</h2>
            <p className="text-xs text-slate-400 mb-3">
              These leagues have fewer than 12 seeds set. Fix these before running the Leg 3 script. You can use manual
              slots if Sleeper is missing owners.
            </p>
            {leaguesNeedingSeeds.length === 0 ? (
              <div className="text-xs text-slate-500">All leagues have at least 12 seeds.</div>
            ) : (
              <div className="grid gap-3">{leaguesNeedingSeeds.map((league) => renderLeagueCard(league, "needs"))}</div>
            )}
          </section>

          {/* Seeded leagues */}
          <section>
            <h2 className="text-lg font-semibold text-emerald-300 mb-2">Seeded leagues</h2>
            <p className="text-xs text-slate-400 mb-3">
              These leagues have at least 12 seeds. You can still edit them if needed.
            </p>
            {leaguesSeeded.length === 0 ? (
              <div className="text-xs text-slate-500">No leagues are fully seeded yet.</div>
            ) : (
              <div className="grid gap-3">{leaguesSeeded.map((league) => renderLeagueCard(league, "seeded"))}</div>
            )}
          </section>
        </div>
      )}

      {/* New League Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-50">Add Gauntlet League (from Sleeper)</h2>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateLeague} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Division</label>
                <input
                  type="text"
                  value={newLeagueForm.division}
                  onChange={(e) => setNewLeagueForm((f) => ({ ...f, division: e.target.value }))}
                  placeholder="Egyptians / Greeks / Romans"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">God name</label>
                <input
                  type="text"
                  value={newLeagueForm.godName}
                  onChange={(e) => setNewLeagueForm((f) => ({ ...f, godName: e.target.value }))}
                  placeholder="Amun-Rah / Osiris / Zeus / …"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Side</label>
                <select
                  value={newLeagueForm.side}
                  onChange={(e) => setNewLeagueForm((f) => ({ ...f, side: e.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Sleeper League ID</label>
                <input
                  type="text"
                  value={newLeagueForm.leagueId}
                  onChange={(e) => setNewLeagueForm((f) => ({ ...f, leagueId: e.target.value }))}
                  placeholder="123456789012345678"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create from Sleeper"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </AdminGuard>
  );
}
