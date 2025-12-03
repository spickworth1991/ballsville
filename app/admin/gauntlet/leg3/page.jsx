// src/app/admin/gauntlet/leg3/page.jsx
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/src/lib/supabaseClient";
import GauntletUpdateButton from "@/components/GauntletUpdateButton";

function formatDateTime(dt) {
  if (!dt) return "Never";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString();
}

export default function GauntletLeg3Page() {
  const [payload, setPayload] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // ===== Auth guard – like your other admin pages =====
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const supabase = getSupabase();
        if (!supabase) {
          // if supabase client isn’t available, treat as not authed
          if (!cancelled) {
            setIsAdmin(false);
            setAuthChecked(true);
          }
          return;
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("Supabase auth error:", error);
        }

        if (!cancelled) {
          if (user) {
            setIsAdmin(true);
            setAuthChecked(true);
          } else {
            setIsAdmin(false);
            setAuthChecked(true);
            // redirect to your existing admin login page
            if (typeof window !== "undefined") {
              window.location.href = "/admin/login";
            }
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (!cancelled) {
          setIsAdmin(false);
          setAuthChecked(true);
          if (typeof window !== "undefined") {
            window.location.href = "/admin/login";
          }
        }
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadData() {
    setError("");
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("gauntlet_leg3")
        .select("year, payload, updated_at")
        .eq("year", "2025")
        .maybeSingle();

      if (error) {
        console.error(error);
        setError("Failed to load Gauntlet data.");
      } else if (!data) {
        setPayload(null);
        setUpdatedAt(null);
      } else {
        setPayload(data.payload);
        setUpdatedAt(data.updated_at);
      }
    } catch (err) {
      console.error(err);
      setError("Unexpected error loading data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const divisions = payload?.divisions || {};

  // While we’re checking auth, show a simple shell
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          <p className="text-sm text-slate-400">Checking admin access…</p>
        </div>
      </div>
    );
  }

  // If authChecked and not admin, we’ve already redirected, but keep a fallback:
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Redirecting to admin login…
        </p>
      </div>
    );
  }

  // ===== Normal Leg 3 UI (admin only) =====
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Gauntlet Leg 3 – Bracket View
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Romans, Greeks, and Egyptians &mdash; seeded via Leg 1/2 rules,
              scored with Leg 3 Best Ball.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Last updated:{" "}
              <span className="font-mono">
                {formatDateTime(updatedAt)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {error && (
              <span className="text-xs text-red-400 max-w-xs text-right">
                {error}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium shadow-md transition
                ${
                  refreshing || loading
                    ? "bg-slate-700 text-slate-300 cursor-wait"
                    : "bg-amber-400 text-slate-950 hover:bg-amber-300"
                }`}
            >
              {refreshing || loading ? "Refreshing…" : "Refresh"}
            </button>
            {/* Update button stays in header, admin-only */}
            <GauntletUpdateButton />
          </div>
        </header>

        {/* Loading / Empty states */}
        {loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
          </div>
        ) : !payload ? (
          <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-300">
            No Gauntlet Leg 3 data found yet.
            <br />
            Run the{" "}
            <span className="font-semibold">
              buildgauntlet.mjs
            </span>{" "}
            script (or GitHub Action) to generate it, then click{" "}
            <span className="font-semibold">Refresh</span>.
          </div>
        ) : (
          <main className="space-y-8">
            {/* Overall summary */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-lg font-semibold tracking-tight">
                {payload.name}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Year:{" "}
                <span className="font-mono text-amber-300">
                  {payload.year}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Data is precomputed from Sleeper and stored in Supabase.
                This view is read-only; use the GitHub Action / update
                button to rebuild Leg 3.
              </p>
            </section>

            {/* Legions grid */}
            <section className="grid gap-6 md:grid-cols-3">
              {Object.entries(divisions).map(
                ([divisionName, division]) => (
                  <div
                    key={divisionName}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-md flex flex-col"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {divisionName}
                      </h3>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                        {division.gods?.length || 0} Gods
                      </span>
                    </div>

                    <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1">
                      {(division.gods || []).map((god) => (
                        <div
                          key={god.index}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-100">
                              God {god.index}
                            </div>
                            <div className="flex flex-col text-[0.7rem] text-slate-400 text-right">
                              <span className="truncate max-w-[180px]">
                                Light:{" "}
                                <span className="text-slate-200">
                                  {god.lightLeagueName}
                                </span>
                              </span>
                              <span className="truncate max-w-[180px]">
                                Dark:{" "}
                                <span className="text-slate-200">
                                  {god.darkLeagueName}
                                </span>
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
                            <div className="grid grid-cols-5 bg-slate-900/80 px-2 py-1 text-[0.65rem] font-medium text-slate-300">
                              <span className="text-center">Match</span>
                              <span className="text-center">
                                Light (Seed)
                              </span>
                              <span className="text-center">Score</span>
                              <span className="text-center">
                                Dark (Seed)
                              </span>
                              <span className="text-center">Score</span>
                            </div>
                            <div className="divide-y divide-slate-800 text-[0.7rem]">
                              {(god.pairings || []).map((m) => (
                                <div
                                  key={m.match}
                                  className="grid grid-cols-5 px-2 py-1.5 items-center"
                                >
                                  <div className="text-center font-mono text-slate-300">
                                    {m.match}
                                  </div>
                                  <div className="text-center">
                                    <div className="truncate text-slate-100">
                                      {m.lightOwnerName}
                                    </div>
                                    <div className="text-[0.6rem] text-amber-300">
                                      Seed {m.lightSeed}
                                    </div>
                                  </div>
                                  <div className="text-center font-mono text-xs text-slate-100">
                                    {m.lightLeg3Total.toFixed(2)}
                                  </div>
                                  <div className="text-center">
                                    <div className="truncate text-slate-100">
                                      {m.darkOwnerName}
                                    </div>
                                    <div className="text-[0.6rem] text-sky-300">
                                      Seed {m.darkSeed}
                                    </div>
                                  </div>
                                  <div className="text-center font-mono text-xs text-slate-100">
                                    {m.darkLeg3Total.toFixed(2)}
                                  </div>
                                </div>
                              ))}

                              {(!god.pairings ||
                                god.pairings.length === 0) && (
                                <div className="px-2 py-2 text-center text-xs text-slate-500">
                                  No pairings available yet.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {(!division.gods ||
                        division.gods.length === 0) && (
                        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-3 text-center text-xs text-slate-400">
                          No Gods built for this Legion yet.
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
