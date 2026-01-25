// src/app/gauntlet/page.jsx
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import GauntletDynamicBlocks from "@/components/gauntlet/GauntletDynamicBlocks";
import { CURRENT_SEASON } from "@/lib/season";

function Card({ children }) {
  return (
    <section className="bg-card-surface border border-subtle shadow-md rounded-2xl p-6 md:p-8">
      {children}
    </section>
  );
}

function SubCard({ children }) {
  return (
    <div className="bg-subtle-surface border border-subtle rounded-2xl p-5 md:p-6">
      {children}
    </div>
  );
}

export default function GauntletPage() {
  return (
    <main className="relative min-h-screen text-fg">
      {/* cosmic glow overlay (match Big Game layout) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* HERO */}
        <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card-surface shadow-2xl shadow-black/40 p-6 md:p-10">
          {/* premium glow */}
          <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            <div className="opacity-50 absolute -top-24 -left-5 h-56 w-56 rounded-full bg-green-500/50 blur-3xl" />
            <div className="opacity-50 absolute -top-24 -right-5 h-56 w-56 rounded-full bg-purple-500/50 blur-3xl" />
            <div className="opacity-65 absolute -bottom-24 -right-5 h-56 w-64 rounded-full bg-orange-400/40 blur-3xl" />
            <div className="opacity-55 absolute -bottom-24 -left-7 h-56 w-56 rounded-full bg-red-500/50 blur-3xl" />
            <div className="opacity-30 absolute left-1/2 top-1/2 h-56 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/50 blur-3xl" />
          </div>

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:items-start">
            {/* left */}
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">BALLSVILLE GAUNTLET</p>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                3 Legions. 12 Gods. <span className="text-primary">1 Grand Champion</span>.
              </h1>

              <p className="text-sm sm:text-base text-muted max-w-prose">
                24 teams per <span className="text-fg font-semibold">God</span>, four Gods per{" "}
                <span className="text-fg font-semibold">Legion</span>: Egyptians, Greeks, and Romans.
                Survive all legs — the 12 God Champions collide in Week 17 for the Grand Championship.
              </p>

              <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  Redraft → Guillotine → Pirate Playoffs → Championships
                </span>
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">288 total entries</span>
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  Week 17 Grand Championship
                </span>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link prefetch={false} href="/gauntlet/intro" className="btn btn-primary">
                  ⚔️ Gauntlet Game Intro
                </Link>
                <Link prefetch={false} href="/gauntlet/cash-doc" className="btn btn-outline">
                  💸 View Cash Doc
                </Link>
              </div>

              {/* quick stats (kept) */}
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Entries</div>
                  <div className="mt-1 font-semibold text-fg">288</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-muted">God Champs</div>
                  <div className="mt-1 font-semibold text-fg">12</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Payouts</div>
                  <div className="mt-1 font-semibold text-fg">133+</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-muted">Max Winnings</div>
                  <div className="mt-1 font-semibold text-fg">$2,342</div>
                </div>
              </div>
            </div>

            {/* right: compact at-a-glance (NO rules in hero) */}
            <div className="space-y-4 py-4">
              <div className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm overflow-hidden shadow-xl shadow-black/40">
                <div className="px-4 py-3 border-b border-border/60">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    2026 GAUNTLET GAME
                  </span>
                  <span className="block text-[11px] text-muted">
                    3 legs + championships • 12 Gods • 3 Legions • Light & Dark leagues
                  </span>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 font-semibold text-fg">
                      $200 FAAB
                    </span>
                    <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 font-semibold text-fg">
                      Redraft W1–W9
                    </span>
                    <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 font-semibold text-fg">
                      Guillotine W10–W12
                    </span>
                    <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 font-semibold text-fg">
                      Pirate W13–W15
                    </span>
                    <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 font-semibold text-fg">
                      Champs W16–W17
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-muted leading-relaxed">
                    Quick view only — full rules are below.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Owner updates (still part of hero; manifest-gated for cache efficiency) */}
          <SectionManifestGate section="gauntlet" season={CURRENT_SEASON}>
            <GauntletDynamicBlocks season={CURRENT_SEASON} showLegions={false} />
          </SectionManifestGate>
        </header>

        {/* RULES (separate section below hero) */}
        <Card>
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">2026 GAUNTLET GAME</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
              Welcome to the 2026 Gauntlet Game
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed max-w-3xl">
              This game integrates aspects from <span className="text-fg font-semibold">three</span> popular fantasy football styles.
              The season runs in <span className="text-fg font-semibold">three legs</span>, followed by the Championship stage.
            </p>
          </header>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">Structure</div>
              <div className="mt-2 text-sm text-muted leading-relaxed">
                <span className="text-fg font-semibold">12 GODS</span> across{" "}
                <span className="text-fg font-semibold">3 LEGIONS</span> (4 Gods per Legion).
                Each God has <span className="text-fg font-semibold">two 12-team leagues</span>:{" "}
                <span className="text-fg font-semibold">Light</span> and{" "}
                <span className="text-fg font-semibold">Dark</span>.
              </div>
            </SubCard>

            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">FAAB</div>
              <div className="mt-2 text-sm text-muted leading-relaxed">
                Each team gets <span className="text-fg font-semibold">$200 FAAB</span> after the draft.
                FAAB <span className="text-fg font-semibold">cannot</span> be included in trades.
                It can be used on waivers until the{" "}
                <span className="text-fg font-semibold">Wednesday following Week 12</span> (end of Guillotine).
              </div>
            </SubCard>

            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">Season Format</div>
              <div className="mt-2 text-sm text-muted leading-relaxed">
                <span className="text-fg font-semibold">LEG 1:</span> Redraft (W1–W9) <br />
                <span className="text-fg font-semibold">LEG 2:</span> Guillotine (W10–W12) <br />
                <span className="text-fg font-semibold">LEG 3:</span> Pirate Playoffs (W13–W15) <br />
                <span className="text-primary font-bold"> Championships (W16–W17)</span>
              </div>
            </SubCard>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEG 1 */}
            <div className="lg:col-span-6">
              <SubCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs tracking-widest text-muted uppercase">LEG 1</div>
                    <div className="mt-1 text-lg font-semibold text-primary">Redraft (Weeks 1–9)</div>
                  </div>
                  <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 text-[11px] font-semibold text-fg">
                    Trade Deadline: End of Week 9
                  </span>
                </div>

                <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed list-disc pl-5">
                  <li>Weeks 1–9: set your lineup to the best of your ability.</li>
                  <li>
                    End of Week 9: the team that is{" "}
                    <span className="text-fg font-semibold">last in the standings</span> is eliminated.
                    Their entire roster is dropped and available for waivers.
                  </li>
                  <li>
                    If it becomes{" "}
                    <span className="text-fg font-semibold">mathematically impossible</span> to move from the bottom prior to the end of Week 9,
                    that team owner will not be able to make trades.
                  </li>
                </ul>
              </SubCard>
            </div>

            {/* LEG 2 */}
            <div className="lg:col-span-6">
              <SubCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs tracking-widest text-muted uppercase">LEG 2</div>
                    <div className="mt-1 text-lg font-semibold text-primary">Guillotine (Weeks 10–12)</div>
                  </div>
                  <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 text-[11px] font-semibold text-fg">
                    1 eliminated each week
                  </span>
                </div>

                <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed list-disc pl-5">
                  <li>
                    Weeks 10–12: at the end of each week (10, 11, 12), the{" "}
                    <span className="text-fg font-semibold">lowest weekly score</span> is eliminated.
                  </li>
                  <li>The eliminated team’s roster is dropped and available for waivers.</li>
                  <li>
                    Waivers run until the{" "}
                    <span className="text-fg font-semibold">Wednesday following Week 12</span>.
                  </li>
                </ul>
              </SubCard>
            </div>

            {/* LEG 3 */}
            <div className="lg:col-span-12">
              <SubCard>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-xs tracking-widest text-muted uppercase">LEG 3</div>
                    <div className="mt-1 text-lg font-semibold text-primary">
                      Best Ball Pirate Playoffs (Weeks 13–15)
                    </div>
                  </div>
                  <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 text-[11px] font-semibold text-fg">
                    Pirate deadline: Thu 7:00pm ET
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                    <div className="text-sm font-semibold text-fg">Week 13</div>
                    <div className="mt-1 text-sm text-muted leading-relaxed">
                      8 teams enter playoffs (each league). Winners “Pirate” 1 player from the losing team.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                    <div className="text-sm font-semibold text-fg">Week 14</div>
                    <div className="mt-1 text-sm text-muted leading-relaxed">
                      4 teams remain. Winners “Pirate” 1 player from the losing team.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                    <div className="text-sm font-semibold text-fg">Week 15</div>
                    <div className="mt-1 text-sm text-muted leading-relaxed">
                      Finals. Winner “Pirate” 1 player from the losing team.
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-muted leading-relaxed">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      The league manager will move the chosen player{" "}
                      <span className="text-fg font-semibold">prior to the Thursday night game</span>.
                    </li>
                    <li>
                      If the winner fails to pick a player before{" "}
                      <span className="text-fg font-semibold">Thursday at 7:00pm ET</span>,
                      they forfeit the right to pirate that week.
                    </li>
                  </ul>
                </div>
              </SubCard>
            </div>

            {/* LEG 4 */}
            <div className="lg:col-span-12">
              <SubCard>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    
                    <div className="mt-1 text-lg font-semibold text-primary">Championships (Weeks 16–17)</div>
                  </div>
                  <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 text-[11px] font-semibold text-fg">
                    No Pirating
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-subtle bg-card-trans p-4">
                    <div className="text-xs tracking-widest text-muted uppercase">Week 16</div>
                    <div className="mt-1 text-sm text-muted leading-relaxed">
                      The <span className="text-fg font-semibold">Light</span> champion and{" "}
                      <span className="text-fg font-semibold">Dark</span> champion for each God face off for the{" "}
                      <span className="text-fg font-semibold">God Championship</span>. No player is stolen at this stage.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-subtle bg-card-trans p-4">
                    <div className="text-xs tracking-widest text-muted uppercase">Week 17</div>
                    <div className="mt-1 text-sm text-muted leading-relaxed">
                      Each God Champion (12 of you) enters a winner-take-all{" "}
                      <span className="text-fg font-semibold">GAUNTLET GRAND CHAMPIONSHIP</span>.
                    </div>
                  </div>
                </div>
              </SubCard>
            </div>
          </div>
        </Card>

        {/* LEGIONS */}
        <section className="space-y-4 relative overflow-hidden rounded-3xl border border-border/70 bg-card-surface shadow-2xl shadow-black/40 p-6 md:p-10">
          <header>
            <h2 className="h2">The Legions</h2>
            <p className="text-sm text-muted mt-2 max-w-2xl">
              Three Legions — Egyptians, Greeks, and Romans — each with four Gods and 24 teams per God.
              Join a God, fill your league, and fight your way toward the Gauntlet.
            </p>
          </header>

          <SectionManifestGate section="gauntlet" season={CURRENT_SEASON}>
            <GauntletDynamicBlocks season={CURRENT_SEASON} showOwner={false} showLegions embeddedLegions={false} />
          </SectionManifestGate>
        </section>

        {/* PAYOUTS + BONUSES MINI CHART */}
        <Card>
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="h2">Payouts & Bonuses Everywhere</h2>
              <p className="text-sm text-muted mt-2 max-w-2xl">
                Redraft Weeks 1–9, Guillotine Weeks 10–12, Pirate Playoffs Weeks 13–15, Championships Weeks 16–17.
                Payouts and BONUSES are stackable across all stages.
              </p>
            </div>

            <Link prefetch={false} href="/gauntlet/cash-doc" className="btn btn-outline">
              CASH DOC →
            </Link>
          </header>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[520px] text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.2em] text-muted border-b border-subtle">
                  <th className="py-2 pr-4 text-left font-semibold">Stage</th>
                  <th className="py-2 px-4 text-left font-semibold">Weeks</th>
                  <th className="py-2 px-4 text-left font-semibold">Payouts</th>
                  <th className="py-2 pl-4 text-left font-semibold">Bonuses</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-subtle">
                  <td className="py-2 pr-4 font-medium">Redraft</td>
                  <td className="py-2 px-4 text-muted">Weeks 1–9</td>
                  <td className="py-2 px-4">24 Payouts</td>
                  <td className="py-2 pl-4">12 BONUSES</td>
                </tr>
                <tr className="border-b border-subtle">
                  <td className="py-2 pr-4 font-medium">Guillotine</td>
                  <td className="py-2 px-4 text-muted">Weeks 10–12</td>
                  <td className="py-2 px-4">24 Payouts</td>
                  <td className="py-2 pl-4">4 BONUSES</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">Playoffs + Championships</td>
                  <td className="py-2 px-4 text-muted">Weeks 13–17</td>
                  <td className="py-2 px-4">85 Payouts</td>
                  <td className="py-2 pl-4">Up to 24 BONUSES</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-muted">
            For the full breakdown of every payout, BONUS, and conditional upside, read the{" "}
            <Link prefetch={false} href="/gauntlet/cash-doc" className="text-accent hover:underline underline-offset-2">
              Gauntlet Cash Doc
            </Link>
            .
          </p>
        </Card>

        {/* BRACKET EXPLAINER */}
        <Card>
          <header className="space-y-2">
            <h2 className="h2">The Bracket & Championships</h2>
            <p className="text-sm text-muted max-w-2xl">
              Weeks 1–12 run inside your individual leagues. Weeks 13–15 become Pirate Playoffs inside each Light/Dark league.
              Week 16 is the God Championship (Light champ vs Dark champ). Week 17 is the Grand Championship with all 12 God Champs.
            </p>
          </header>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {/* CLICKABLE LIVE BRACKET CARD */}
            <Link
              prefetch={false}
              href="/gauntlet/leaderboard"
              className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <SubCard>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">BRACKET PROTOTYPE</p>
                <p className="mt-2 text-sm text-muted">
                  This is where your God-level progression will live — follow matchups, see who advances,
                  and track which Gods remain as the season moves into Pirate Playoffs and then Championships.
                </p>

                <div className="mt-3 text-xs font-semibold text-accent">View Live Bracket →</div>
              </SubCard>
            </Link>

            {/* STATIC INFO CARD */}
            <SubCard>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">LIGHT & DARK LEAGUES</p>
              <p className="mt-2 text-sm text-muted">
                Each God has a <span className="text-fg font-semibold">Light</span> and{" "}
                <span className="text-fg font-semibold">Dark</span> league. They run as 12-team leagues Weeks 1–12,
                then continue into Pirate Playoffs, and culminate with a Light vs Dark God Championship in Week 16.
              </p>
              <ul className="mt-3 text-xs text-muted space-y-1.5">
                <li>• Pirate Playoffs happen Weeks 13–15 (winner steals a player).</li>
                <li>• Week 16: Light champion vs Dark champion for the God Championship.</li>
                <li>• Week 17: 12 God Champions enter the winner-take-all Grand Championship.</li>
              </ul>
            </SubCard>
          </div>
        </Card>
      </div>
    </main>
  );
}
