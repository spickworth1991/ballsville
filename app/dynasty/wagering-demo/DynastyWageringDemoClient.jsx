"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/src/lib/supabaseClient";
import { CURRENT_SEASON } from "@/src/lib/season";

const SEASON = CURRENT_SEASON;

const DRAGONS_LEAGUES = [
  "Shenron","Alduin","Smaug","Bahamut","Charizard","Toothless","Deathwing","Skithryx",
  "Haku","Lareth","Alstewing","Tsunami","Ghidorah","Tiamat","Shadow","Blue Eyes",
];

const HEROES_LEAGUES = [
  "Goku","Dragonborn","Gandalf","Cloud","Ash Ketchum","Light Fury","The Wrynn of Stormwind",
  "Gideon","Chihiro","Lareth","Siegfried","Clay","Godzilla","The Bard","Holy Crusader","Yu Gi Oh",
];

function fmtNum(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2).replace(/\.00$/, "");
}

function choiceBadge(choice) {
  if (choice === "wager") return <span className="rounded-full px-2 py-0.5 text-xs border border-subtle bg-subtle-surface">WAGER</span>;
  return <span className="rounded-full px-2 py-0.5 text-xs border border-subtle bg-card-trans backdrop-blur-sm">BANK</span>;
}

function LeagueTable({ rows }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-subtle bg-card-surface shadow-sm">
      <table className="min-w-[1100px] w-full text-sm">
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
              Score (Wk 17)
            </th>
            <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Finalist 2
            </th>
            <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Choice
            </th>
            <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Score (Wk 17)
            </th>
            <th className="px-4 py-3 border-b border-subtle text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              League Winner 🥇
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-subtle-surface/50 transition">
              <td className="px-4 py-3 border-b border-subtle font-semibold">{r.league_name}</td>

              <td className="px-4 py-3 border-b border-subtle text-muted">
                {r.finalist1_name || "Player 1 🪙"}
              </td>
              <td className="px-4 py-3 border-b border-subtle">{choiceBadge(r.finalist1_choice)}</td>
              <td className="px-4 py-3 border-b border-subtle text-muted">{fmtNum(r.finalist1_score)}</td>

              <td className="px-4 py-3 border-b border-subtle text-muted">
                {r.finalist2_name || "Player 2 🪙"}
              </td>
              <td className="px-4 py-3 border-b border-subtle">{choiceBadge(r.finalist2_choice)}</td>
              <td className="px-4 py-3 border-b border-subtle text-muted">{fmtNum(r.finalist2_score)}</td>

              <td className="px-4 py-3 border-b border-subtle text-muted">
                {r.league_winner || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DynastyWageringDemoClient() {
  const [tab, setTab] = useState("dragons");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const leaguesForTab = useMemo(
    () => (tab === "heroes" ? HEROES_LEAGUES : DRAGONS_LEAGUES),
    [tab]
  );

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const supabase = getSupabase();

      // Pull rows for this season + group
      const { data, error } = await supabase
        .from("dynasty_wager_tracker")
        .select("*")
        .eq("season", SEASON)
        .eq("group_name", tab)
        .order("league_name", { ascending: true });

      if (error) throw error;

      // Ensure all leagues exist in view even if admin hasn't filled them yet
      const map = new Map((data || []).map((d) => [d.league_name, d]));
      const merged = leaguesForTab.map((league) => {
        const found = map.get(league);
        return (
          found || {
            id: `${tab}:${league}`,
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
      setErr(e?.message || "Failed to load tracker.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">
                The BALLSVILLE Game
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                Dynasty Wagering Method <span className="text-primary">(Week 17)</span>
              </h1>

              <p className="text-sm sm:text-base text-muted max-w-prose">
                The Heroes of Dynasty expansion mirrors these settings for the Dragons of Dynasty.
                This page explains how the $50 credit works — and tracks wagers, banking, and scores.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/dynasty" className="btn btn-outline">← Back to Dynasty</Link>
                <Link href="/dynasty/intro" className="btn btn-outline">Dynasty Intro</Link>
                <Link href="/dynasty/rosters" className="btn btn-outline">All Rosters</Link>
              </div>

              <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                  Public view (read-only)
                </span>
                <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                  Admin updates live
                </span>
              </div>
            </div>
          </header>

          {/* Explanation — grammar fixed */}
          <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm space-y-4">
            <h2 className="text-2xl sm:text-3xl font-semibold">How it Works</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 space-y-2">
                <p className="text-sm font-semibold">The $50 credit (🪙)</p>
                <ul className="text-sm text-muted space-y-1 list-disc list-inside">
                  <li>Top 2 teams in each league receive a $50 credit (🪙).</li>
                  <li>Each finalist chooses to <span className="font-semibold text-fg">Wager</span> or <span className="font-semibold text-fg">Bank</span> by Week 17 kickoff (declared in chat).</li>
                  <li>If someone doesn’t reply, they bank by default.</li>
                  <li>If you wager, you accept the risk of a $0 outcome on the credit.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 space-y-2">
                <p className="text-sm font-semibold">Bonuses (Week 17)</p>
                <ul className="text-sm text-muted space-y-1 list-disc list-inside">
                  <li>💰 <span className="font-semibold text-fg">$200 Wager Bonus</span>: highest scorer among those who wagered.</li>
                  <li>🏆 <span className="font-semibold text-fg">$250 Championship Bonus</span>: highest scorer overall among all finalists (passive — no wagering required).</li>
                  <li>🥈 $100 for 2nd overall · 🥉 $50 for 3rd overall.</li>
                  <li>League winner earns +$125 for outscoring their opponent in Week 17.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4">
              <p className="text-sm text-muted">
                Big payout opportunities while maintaining great odds. If you win the 🏆 a second year in a row, it triggers the Empire upside
                (+$225 potential) and resets your league only (other leagues are unaffected).
              </p>
            </div>

            <p className="text-sm text-muted">
              The Heroes champion will face the Dragons champion in Week 18 head-to-head. Parameters are decided by the two champs.
            </p>
          </section>

          {/* Tracker */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold">Wager Tracker</h2>
                <p className="mt-1 text-sm text-muted max-w-prose">
                  This is the live Week 17 tracker. Admin fills in finalists, wager/bank choices, scores, and league winners.
                </p>
              </div>

              <div className="flex gap-2">
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
            </div>

            {err ? (
              <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-red-300">
                {err}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">
                Loading tracker…
              </div>
            ) : (
              <LeagueTable rows={rows} />
            )}

            <p className="text-xs text-muted">
              Want edit access? Use the admin screen. This public page is read-only on purpose.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
