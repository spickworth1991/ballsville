"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/src/lib/supabaseClient";

const SEASON = 2025;

const DRAGONS_LEAGUES = [
  "Shenron","Alduin","Smaug","Bahamut","Charizard","Toothless","Deathwing","Skithryx",
  "Haku","Lareth","Alstewing","Tsunami","Ghidorah","Tiamat","Shadow","Blue Eyes",
];

const HEROES_LEAGUES = [
  "Goku","Dragonborn","Gandalf","Cloud","Ash Ketchum","Light Fury","The Wrynn of Stormwind",
  "Gideon","Chihiro","Lareth","Siegfried","Clay","Godzilla","The Bard","Holy Crusader","Yu Gi Oh",
];

function normalizeRow(seed) {
  return {
    id: seed.id ?? null,
    season: seed.season ?? SEASON,
    group_name: seed.group_name,
    league_name: seed.league_name,

    finalist1_name: seed.finalist1_name ?? "",
    finalist1_choice: seed.finalist1_choice ?? "bank",
    finalist1_score: seed.finalist1_score ?? "",

    finalist2_name: seed.finalist2_name ?? "",
    finalist2_choice: seed.finalist2_choice ?? "bank",
    finalist2_score: seed.finalist2_score ?? "",

    league_winner: seed.league_winner ?? "",
    notes: seed.notes ?? "",
  };
}

export default function DynastyWageringAdminClient() {
  const [tab, setTab] = useState("dragons");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const leagueList = useMemo(
    () => (tab === "heroes" ? HEROES_LEAGUES : DRAGONS_LEAGUES),
    [tab]
  );

  async function adminToken() {
    // Supabase is ONLY used for admin verification (JWT)
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setErr("");
    setOk("");
    setLoading(true);
    try {
      const token = await adminToken();
      const res = await fetch(`/api/admin/dynasty-wagering?season=${encodeURIComponent(SEASON)}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Failed to load (${res.status}): ${t}`);
      }
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json?.rows) ? json.rows : [];

      const map = new Map(list.map((d) => [d.league_name, d]));
      const merged = leagueList.map((league) => {
        const found = map.get(league);
        return normalizeRow(
          found || {
            id: null,
            season: SEASON,
            group_name: tab,
            league_name: league,
            finalist1_choice: "bank",
            finalist2_choice: "bank",
          }
        );
      });

      setRows(merged);
    } catch (e) {
      setErr(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function updateRow(idx, patch) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  async function saveAll() {
    setErr("");
    setOk("");
    setSaving(true);
    try {
      const token = await adminToken();
      const payload = {
        rows: rows.map((r) => ({
          season: SEASON,
          group_name: r.group_name,
          league_name: r.league_name,

          finalist1_name: r.finalist1_name || "",
          finalist1_choice: r.finalist1_choice || "bank",
          finalist1_score: r.finalist1_score === "" ? "" : Number(r.finalist1_score),

          finalist2_name: r.finalist2_name || "",
          finalist2_choice: r.finalist2_choice || "bank",
          finalist2_score: r.finalist2_score === "" ? "" : Number(r.finalist2_score),

          league_winner: r.league_winner || "",
          notes: r.notes || "",
        })),
      };

      const res = await fetch(`/api/admin/dynasty-wagering?season=${encodeURIComponent(String(SEASON))}`, {
        method: "PUT",
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Save failed (${res.status})`);

      setOk("Saved.");
      await load(); // refresh ids + normalized values
    } catch (e) {
      setErr(e?.message || "Save failed.");
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
                Dynasty Wager Tracker <span className="text-primary">(Editor)</span>
              </h1>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/dynasty/wagering-demo" className="btn btn-outline">
                  View Public Page →
                </Link>
                <Link href="/admin" className="btn btn-outline">
                  ← Admin Home
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

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTab("dragons")}
                  className={`btn ${tab === "dragons" ? "btn-primary" : "btn-outline"}`}
                >
                  🐉 Dragons
                </button>
                <button
                  type="button"
                  onClick={() => setTab("heroes")}
                  className={`btn ${tab === "heroes" ? "btn-primary" : "btn-outline"}`}
                >
                  🛡️ Heroes
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
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-subtle bg-card-surface shadow-sm">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="bg-subtle-surface">
                  <tr className="text-left">
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      League
                    </th>
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Finalist 1
                    </th>
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Choice
                    </th>
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Score
                    </th>
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Finalist 2
                    </th>
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Choice
                    </th>
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Score
                    </th>
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Winner
                    </th>
                    <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      Notes
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={`${r.group_name}:${r.league_name}`} className="hover:bg-subtle-surface/50 transition">
                      <td className="px-4 py-3 border-b border-subtle font-semibold">{r.league_name}</td>

                      <td className="px-4 py-3 border-b border-subtle">
                        <input
                          className="w-full rounded-lg border border-subtle bg-card-trans px-3 py-2"
                          value={r.finalist1_name}
                          onChange={(e) => updateRow(idx, { finalist1_name: e.target.value })}
                          placeholder="Name"
                        />
                      </td>

                      <td className="px-4 py-3 border-b border-subtle">
                        <select
                          className="w-full rounded-lg border border-subtle bg-card-trans px-3 py-2"
                          value={r.finalist1_choice}
                          onChange={(e) => updateRow(idx, { finalist1_choice: e.target.value })}
                        >
                          <option value="bank">bank</option>
                          <option value="wager">wager</option>
                        </select>
                      </td>

                      <td className="px-4 py-3 border-b border-subtle">
                        <input
                          className="w-full rounded-lg border border-subtle bg-card-trans px-3 py-2"
                          value={r.finalist1_score}
                          onChange={(e) => updateRow(idx, { finalist1_score: e.target.value })}
                          placeholder="0"
                        />
                      </td>

                      <td className="px-4 py-3 border-b border-subtle">
                        <input
                          className="w-full rounded-lg border border-subtle bg-card-trans px-3 py-2"
                          value={r.finalist2_name}
                          onChange={(e) => updateRow(idx, { finalist2_name: e.target.value })}
                          placeholder="Name"
                        />
                      </td>

                      <td className="px-4 py-3 border-b border-subtle">
                        <select
                          className="w-full rounded-lg border border-subtle bg-card-trans px-3 py-2"
                          value={r.finalist2_choice}
                          onChange={(e) => updateRow(idx, { finalist2_choice: e.target.value })}
                        >
                          <option value="bank">bank</option>
                          <option value="wager">wager</option>
                        </select>
                      </td>

                      <td className="px-4 py-3 border-b border-subtle">
                        <input
                          className="w-full rounded-lg border border-subtle bg-card-trans px-3 py-2"
                          value={r.finalist2_score}
                          onChange={(e) => updateRow(idx, { finalist2_score: e.target.value })}
                          placeholder="0"
                        />
                      </td>

                      <td className="px-4 py-3 border-b border-subtle">
                        <input
                          className="w-full rounded-lg border border-subtle bg-card-trans px-3 py-2"
                          value={r.league_winner}
                          onChange={(e) => updateRow(idx, { league_winner: e.target.value })}
                          placeholder="Winner"
                        />
                      </td>

                      <td className="px-4 py-3 border-b border-subtle">
                        <input
                          className="w-full rounded-lg border border-subtle bg-card-trans px-3 py-2"
                          value={r.notes}
                          onChange={(e) => updateRow(idx, { notes: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
