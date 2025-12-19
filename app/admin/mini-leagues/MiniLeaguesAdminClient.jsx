"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/src/lib/supabaseClient";

const SEASON = 2025;

const STATUS_OPTIONS = [
  { value: "tbd", label: "TBD" },
  { value: "filling", label: "FILLING" },
  { value: "drafting", label: "DRAFTING" },
  { value: "full", label: "FULL" },
];

function emptyDivision(division_code) {
  const base = {
    season: SEASON,
    division_code,
    division_name: "",
    division_order: 0,
    division_image_path: "",
    active: true,
    status: "tbd",
    league_size: 12,
    notes: "",
  };

  for (let i = 1; i <= 10; i++) {
    base[`league${i}_name`] = "";
    base[`league${i}_url`] = "";
    base[`league${i}_status`] = "tbd";
    base[`league${i}_active`] = true;
    base[`league${i}_order`] = i;
    base[`league${i}_image_path`] = "";
  }

  return base;
}

export default function MiniLeaguesAdminClient() {
  const [divs, setDivs] = useState([]);
  const [creatingCode, setCreatingCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("minileagues_divisions")
        .select("*")
        .eq("season", SEASON)
        .order("division_order", { ascending: true })
        .order("division_code", { ascending: true });

      if (error) throw error;
      setDivs(data || []);
    } catch (e) {
      setErr(e?.message || "Failed to load.");
      setDivs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function patchRow(idx, patch) {
    setDivs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  async function createDivision() {
    setErr("");
    setOk("");

    const code = Number(creatingCode);
    if (!Number.isFinite(code)) {
      setErr("Enter a valid division code (ex: 100, 200, 400).");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabase();
      const payload = emptyDivision(code);

      const { error } = await supabase.from("minileagues_divisions").insert(payload);
      if (error) throw error;

      setCreatingCode("");
      setOk(`Created Division ${code}.`);
      await load();
    } catch (e) {
      setErr(e?.message || "Create failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(""), 2500);
    }
  }

  async function saveAll() {
    setErr("");
    setOk("");
    setSaving(true);

    try {
      const supabase = getSupabase();

      const cleaned = divs.map((d) => {
        const out = {
          season: SEASON,
          division_code: Number(d.division_code),
          division_name: d.division_name || null,
          division_order: Number.isFinite(Number(d.division_order)) ? Number(d.division_order) : 0,
          division_image_path: d.division_image_path || null,
          active: d.active !== false,
          status: (d.status || "tbd"),
          league_size: Number.isFinite(Number(d.league_size)) ? Number(d.league_size) : 12,
          notes: d.notes || null,
        };

        for (let i = 1; i <= 10; i++) {
          out[`league${i}_name`] = d[`league${i}_name`] || null;
          out[`league${i}_url`] = d[`league${i}_url`] || null;

          const s = d[`league${i}_status`];
          out[`league${i}_status`] = (s === "full" || s === "filling" || s === "drafting" || s === "tbd") ? s : "tbd";

          out[`league${i}_active`] = d[`league${i}_active`] !== false;

          const ord = Number(d[`league${i}_order`]);
          out[`league${i}_order`] = Number.isFinite(ord) ? ord : i;

          out[`league${i}_image_path`] = d[`league${i}_image_path`] || null;
        }

        return out;
      });

      const { error } = await supabase
        .from("minileagues_divisions")
        .upsert(cleaned, { onConflict: "season,division_code" });

      if (error) throw error;

      setOk("Saved.");
      await load();
    } catch (e) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(""), 2500);
    }
  }

  async function deleteDivision(season, division_code) {
    setErr("");
    setOk("");
    setSaving(true);

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("minileagues_divisions")
        .delete()
        .eq("season", season)
        .eq("division_code", division_code);

      if (error) throw error;

      setOk(`Deleted Division ${division_code}.`);
      await load();
    } catch (e) {
      setErr(e?.message || "Delete failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setOk(""), 2500);
    }
  }

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">Admin</p>
              <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
                Mini-Leagues Divisions <span className="text-primary">(Editor)</span>
              </h1>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/admin" className="btn btn-outline">
                  ← Admin Home
                </Link>
                <Link href="/mini-leagues" className="btn btn-outline">
                  View Public Page →
                </Link>
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={saving || loading}
                  className="btn btn-primary"
                >
                  {saving ? "Saving…" : "Save All"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 items-center">
                <input
                  className="rounded-xl border border-subtle bg-card-trans px-3 py-2 w-56"
                  value={creatingCode}
                  onChange={(e) => setCreatingCode(e.target.value)}
                  placeholder="New division code (ex: 100)"
                />
                <button
                  type="button"
                  onClick={createDivision}
                  disabled={saving}
                  className="btn btn-outline"
                >
                  + Create Division
                </button>
              </div>

              {err ? (
                <div className="rounded-2xl border border-subtle bg-card-surface p-3 text-sm text-red-300">
                  {err}
                </div>
              ) : null}
              {ok ? (
                <div className="rounded-2xl border border-subtle bg-card-surface p-3 text-sm text-green-300">
                  {ok}
                </div>
              ) : null}
            </div>
          </header>

          {loading ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">
              Loading…
            </div>
          ) : divs.length === 0 ? (
            <div className="rounded-2xl border border-subtle bg-card-surface p-6 text-sm text-muted">
              No divisions yet. Create one (ex: 100) to start.
            </div>
          ) : (
            <div className="space-y-6">
              {divs.map((d, idx) => (
                <div
                  key={`${d.season}-${d.division_code}`}
                  className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-subtle flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">Division {d.division_code}</div>
                      <div className="text-xs text-muted">Season {d.season}</div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        className="rounded-xl border border-subtle bg-card-trans px-3 py-2"
                        value={d.status || "tbd"}
                        onChange={(e) => patchRow(idx, { status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>

                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input
                          type="checkbox"
                          checked={d.active !== false}
                          onChange={(e) => patchRow(idx, { active: e.target.checked })}
                        />
                        Active
                      </label>

                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => deleteDivision(d.season, d.division_code)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="p-5 grid gap-4">
                    {/* Division fields */}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-xs uppercase tracking-[0.18em] text-muted">
                          Division Name (optional)
                        </label>
                        <input
                          className="mt-1 w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                          value={d.division_name || ""}
                          onChange={(e) => patchRow(idx, { division_name: e.target.value })}
                          placeholder="Example: Early Bird"
                        />
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-[0.18em] text-muted">
                          Division Order
                        </label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                          value={d.division_order ?? 0}
                          onChange={(e) => patchRow(idx, { division_order: e.target.value })}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-[0.18em] text-muted">
                          League Size (display)
                        </label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                          value={d.league_size ?? 12}
                          onChange={(e) => patchRow(idx, { league_size: e.target.value })}
                          placeholder="12"
                        />
                      </div>

                      <div className="md:col-span-2 lg:col-span-2">
                        <label className="text-xs uppercase tracking-[0.18em] text-muted">
                          Division Image Path (optional)
                        </label>
                        <input
                          className="mt-1 w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                          value={d.division_image_path || ""}
                          onChange={(e) => patchRow(idx, { division_image_path: e.target.value })}
                          placeholder="/photos/divisions/div-100.webp"
                        />
                        {d.division_image_path ? (
                          <div className="mt-2 rounded-2xl border border-subtle overflow-hidden">
                            <div className="relative h-28 w-full">
                              <Image
                                src={d.division_image_path}
                                alt="Division preview"
                                fill
                                className="object-cover"
                                sizes="100vw"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="text-xs uppercase tracking-[0.18em] text-muted">
                          Notes (optional)
                        </label>
                        <input
                          className="mt-1 w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                          value={d.notes || ""}
                          onChange={(e) => patchRow(idx, { notes: e.target.value })}
                          placeholder="Optional notes shown on public page"
                        />
                      </div>
                    </div>

                    {/* 10 leagues */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const n = i + 1;
                        const active = d[`league${n}_active`] !== false;
                        return (
                          <div
                            key={n}
                            className="rounded-2xl border border-subtle bg-subtle-surface p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                                League {n}
                              </div>
                              <label className="flex items-center gap-2 text-xs text-muted">
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={(e) => patchRow(idx, { [`league${n}_active`]: e.target.checked })}
                                />
                                Active
                              </label>
                            </div>

                            <input
                              className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                              value={d[`league${n}_name`] || ""}
                              onChange={(e) => patchRow(idx, { [`league${n}_name`]: e.target.value })}
                              placeholder="League name"
                            />

                            <input
                              className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                              value={d[`league${n}_url`] || ""}
                              onChange={(e) => patchRow(idx, { [`league${n}_url`]: e.target.value })}
                              placeholder="Sleeper URL"
                            />

                            <select
                              className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                              value={d[`league${n}_status`] || "tbd"}
                              onChange={(e) => patchRow(idx, { [`league${n}_status`]: e.target.value })}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                                value={d[`league${n}_order`] ?? n}
                                onChange={(e) => patchRow(idx, { [`league${n}_order`]: e.target.value })}
                                placeholder={`${n}`}
                              />
                              <div className="text-xs text-muted flex items-center">
                                Order
                              </div>
                            </div>

                            <input
                              className="w-full rounded-xl border border-subtle bg-card-trans px-3 py-2"
                              value={d[`league${n}_image_path`] || ""}
                              onChange={(e) => patchRow(idx, { [`league${n}_image_path`]: e.target.value })}
                              placeholder="/photos/leagues/league.webp"
                            />

                            {d[`league${n}_image_path`] ? (
                              <div className="rounded-xl border border-subtle overflow-hidden">
                                <div className="relative h-20 w-full">
                                  <Image
                                    src={d[`league${n}_image_path`]}
                                    alt={`League ${n} preview`}
                                    fill
                                    className="object-cover"
                                    sizes="20vw"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
