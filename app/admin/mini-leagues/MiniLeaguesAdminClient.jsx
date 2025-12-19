// app/admin/mini-leagues/MiniLeaguesAdminClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabaseClient";

const STATUS_OPTIONS = ["FULL", "FILLING", "TBD", "DRAFTING"];

function emptyLeague() {
  return { name: "", url: "", image: "" };
}

function emptyDivision(id = "100", order = 100) {
  return { id, order, status: "TBD", image: "", leagues: Array.from({ length: 10 }, emptyLeague) };
}

export default function MiniLeaguesAdminClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  async function getAccessToken() {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setError("");
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/mini-leagues", {
        headers: { authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      // If empty, create a usable default
      if (!json) {
        setData({
          updated: "2025-01-23",
          hero: {
            title: "Welcome to the Mini-Leagues Game",
            subtitle:
              "Way-too-early, rookie-inclusive, budget best ball redraft leagues. Season ends after Week 14. Game ends after Week 15.",
            image: "/photos/minileagues-v2.webp",
          },
          settings: [],
          howItWorks: [],
          wagering: { withoutWager: [], withWager: [] },
          cash: [],
          etiquette: [],
          divisions: [emptyDivision("100", 100), emptyDivision("200", 200), emptyDivision("400", 400)],
          lastYear: { title: "Last Year’s Winners", image: "" },
        });
      } else {
        // Ensure divisions have 10 league slots
        const fixed = {
          ...json,
          divisions: (json.divisions || []).map((d) => {
            const leagues = Array.isArray(d.leagues) ? [...d.leagues] : [];
            while (leagues.length < 10) leagues.push(emptyLeague());
            return { ...d, leagues: leagues.slice(0, 10) };
          }),
        };
        setData(fixed);
      }
    } catch (e) {
      setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/mini-leagues", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data, null, 2),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Save failed");

      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const divisions = useMemo(() => {
    const arr = Array.isArray(data?.divisions) ? [...data.divisions] : [];
    arr.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
    return arr;
  }, [data]);

  if (loading) {
    return (
      <main className="section">
        <div className="container-site">
          <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Mini-Leagues Admin</h1>
            <p className="mt-2 text-sm text-muted">Loading…</p>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="section">
        <div className="container-site">
          <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
            <h1 className="text-2xl font-semibold">Mini-Leagues Admin</h1>
            <p className="mt-2 text-sm text-muted">No data loaded.</p>
            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="container-site space-y-6">
        <header className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Mini-Leagues Admin</h1>
              <p className="mt-1 text-sm text-muted">
                Edits save to R2: <span className="font-semibold">admin/mini-leagues.json</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/mini-leagues" className="btn btn-outline">
                View Public Page
              </Link>
              <button
                type="button"
                onClick={save}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </header>

        {/* HERO */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm space-y-3">
          <h2 className="text-xl font-semibold text-primary">Hero</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="md:col-span-1">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">Title</div>
              <input
                className="mt-2 w-full rounded-xl border border-subtle bg-card-trans p-3"
                value={data.hero?.title || ""}
                onChange={(e) =>
                  setData((d) => ({ ...d, hero: { ...(d.hero || {}), title: e.target.value } }))
                }
              />
            </label>

            <label className="md:col-span-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">Subtitle</div>
              <input
                className="mt-2 w-full rounded-xl border border-subtle bg-card-trans p-3"
                value={data.hero?.subtitle || ""}
                onChange={(e) =>
                  setData((d) => ({ ...d, hero: { ...(d.hero || {}), subtitle: e.target.value } }))
                }
              />
            </label>

            <label className="md:col-span-3">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">Hero Image Path (temporary)</div>
              <input
                className="mt-2 w-full rounded-xl border border-subtle bg-card-trans p-3"
                placeholder="/photos/minileagues-v2.webp"
                value={data.hero?.image || ""}
                onChange={(e) =>
                  setData((d) => ({ ...d, hero: { ...(d.hero || {}), image: e.target.value } }))
                }
              />
            </label>
          </div>
        </section>

        {/* DIVISIONS */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-primary">Divisions</h2>
              <p className="text-sm text-muted mt-1">
                Each division has 10 leagues. Each league has name + Sleeper link + image path (for now).
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                const next = String(
                  Math.max(0, ...divisions.map((d) => Number(d.id) || 0)) + 100
                );
                const order = Math.max(0, ...divisions.map((d) => Number(d.order) || 0)) + 100;

                setData((prev) => ({
                  ...prev,
                  divisions: [...(prev.divisions || []), emptyDivision(next, order)],
                }));
              }}
            >
              + Add Division
            </button>
          </div>

          <div className="space-y-6">
            {divisions.map((div, divIdx) => (
              <div key={`${div.id}-${divIdx}`} className="rounded-2xl border border-subtle bg-card-trans p-5 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-3 items-center">
                    <label>
                      <div className="text-xs uppercase tracking-[0.18em] text-muted">Division ID</div>
                      <input
                        className="mt-2 w-32 rounded-xl border border-subtle bg-card-surface p-3"
                        value={div.id || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setData((prev) => {
                            const copy = [...(prev.divisions || [])];
                            copy[divIdx] = { ...copy[divIdx], id: v };
                            return { ...prev, divisions: copy };
                          });
                        }}
                      />
                    </label>

                    <label>
                      <div className="text-xs uppercase tracking-[0.18em] text-muted">Order</div>
                      <input
                        type="number"
                        className="mt-2 w-28 rounded-xl border border-subtle bg-card-surface p-3"
                        value={div.order ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setData((prev) => {
                            const copy = [...(prev.divisions || [])];
                            copy[divIdx] = { ...copy[divIdx], order: v };
                            return { ...prev, divisions: copy };
                          });
                        }}
                      />
                    </label>

                    <label>
                      <div className="text-xs uppercase tracking-[0.18em] text-muted">Status</div>
                      <select
                        className="mt-2 rounded-xl border border-subtle bg-card-surface p-3"
                        value={div.status || "TBD"}
                        onChange={(e) => {
                          const v = e.target.value;
                          setData((prev) => {
                            const copy = [...(prev.divisions || [])];
                            copy[divIdx] = { ...copy[divIdx], status: v };
                            return { ...prev, divisions: copy };
                          });
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setData((prev) => {
                        const copy = [...(prev.divisions || [])];
                        copy.splice(divIdx, 1);
                        return { ...prev, divisions: copy };
                      });
                    }}
                  >
                    Delete Division
                  </button>
                </div>

                <label className="block mt-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted">Division Image Path (optional)</div>
                  <input
                    className="mt-2 w-full rounded-xl border border-subtle bg-card-surface p-3"
                    value={div.image || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((prev) => {
                        const copy = [...(prev.divisions || [])];
                        copy[divIdx] = { ...copy[divIdx], image: v };
                        return { ...prev, divisions: copy };
                      });
                    }}
                  />
                </label>

                <div className="mt-5 overflow-x-auto rounded-xl border border-subtle bg-card-surface">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-subtle-surface">
                      <tr className="text-left">
                        <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          #
                        </th>
                        <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          League Name
                        </th>
                        <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Sleeper URL
                        </th>
                        <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Image Path (temporary)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(div.leagues || []).slice(0, 10).map((lg, lgIdx) => (
                        <tr key={`${div.id}-lg-${lgIdx}`} className="hover:bg-subtle-surface/50 transition">
                          <td className="px-4 py-3 border-b border-subtle text-muted">
                            {lgIdx + 1}
                          </td>
                          <td className="px-4 py-3 border-b border-subtle">
                            <input
                              className="w-full rounded-lg border border-subtle bg-card-trans p-2"
                              value={lg?.name || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setData((prev) => {
                                  const copy = [...(prev.divisions || [])];
                                  const divCopy = { ...copy[divIdx] };
                                  const leagues = [...(divCopy.leagues || [])];
                                  leagues[lgIdx] = { ...(leagues[lgIdx] || emptyLeague()), name: v };
                                  divCopy.leagues = leagues;
                                  copy[divIdx] = divCopy;
                                  return { ...prev, divisions: copy };
                                });
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 border-b border-subtle">
                            <input
                              className="w-full rounded-lg border border-subtle bg-card-trans p-2"
                              value={lg?.url || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setData((prev) => {
                                  const copy = [...(prev.divisions || [])];
                                  const divCopy = { ...copy[divIdx] };
                                  const leagues = [...(divCopy.leagues || [])];
                                  leagues[lgIdx] = { ...(leagues[lgIdx] || emptyLeague()), url: v };
                                  divCopy.leagues = leagues;
                                  copy[divIdx] = divCopy;
                                  return { ...prev, divisions: copy };
                                });
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 border-b border-subtle">
                            <input
                              className="w-full rounded-lg border border-subtle bg-card-trans p-2"
                              value={lg?.image || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setData((prev) => {
                                  const copy = [...(prev.divisions || [])];
                                  const divCopy = { ...copy[divIdx] };
                                  const leagues = [...(divCopy.leagues || [])];
                                  leagues[lgIdx] = { ...(leagues[lgIdx] || emptyLeague()), image: v };
                                  divCopy.leagues = leagues;
                                  copy[divIdx] = divCopy;
                                  return { ...prev, divisions: copy };
                                });
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-3 text-xs text-muted">
                  Image upload to R2 comes next — this is just the “keep working now” version.
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* LAST YEAR */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm space-y-3">
          <h2 className="text-xl font-semibold text-primary">Last Year</h2>

          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Title</div>
            <input
              className="mt-2 w-full rounded-xl border border-subtle bg-card-trans p-3"
              value={data.lastYear?.title || ""}
              onChange={(e) =>
                setData((d) => ({ ...d, lastYear: { ...(d.lastYear || {}), title: e.target.value } }))
              }
            />
          </label>

          <label className="block">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Image Path</div>
            <input
              className="mt-2 w-full rounded-xl border border-subtle bg-card-trans p-3"
              value={data.lastYear?.image || ""}
              onChange={(e) =>
                setData((d) => ({ ...d, lastYear: { ...(d.lastYear || {}), image: e.target.value } }))
              }
            />
          </label>
        </section>
      </div>
    </main>
  );
}
