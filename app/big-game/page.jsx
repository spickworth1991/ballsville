// app/big-game/page.jsx
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import BigGameDynamicBlocks from "@/components/big-game/BigGameDynamicBlocks";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: "The BIG Game | Ballsville",
  description:
    "The BALLSVILLE Game – our trademark Big Game format where big payouts meet great odds.",
};

export default function BigGamePage() {
  return (
    <main className="relative min-h-screen text-fg">
      {/* cyan / premium glow overlay (background image is handled by layout) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* HERO (Gauntlet-style card) */}
        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card-surface shadow-2xl shadow-black/40 px-6 py-8 sm:px-10 sm:py-10">
          {/* glow blobs */}
          <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            <div className="opacity-50 absolute -top-24 -left-5 h-56 w-56 rounded-full bg-green-500/50 blur-3xl" />
            <div className="opacity-50 absolute -top-24 -right-5 h-56 w-56 rounded-full bg-purple-500/50 blur-3xl" />
            <div className="opacity-65 absolute -bottom-24 -right-5 h-56 w-64 rounded-full bg-orange-400/40 blur-3xl" />
            <div className="opacity-55 absolute -bottom-24 -left-7 h-56 w-56 rounded-full bg-red-500/50 blur-3xl" />
            <div className="opacity-30 absolute left-1/2 top-1/2 h-56 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/50 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">
                The BALLSVILLE Game
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                The <span className="text-primary">BIG Game</span>
              </h1>

              <p className="text-sm sm:text-base text-muted max-w-prose">
                Our trademark game —{" "}
                <span className="font-semibold text-accent">
                  where BIG payouts meet great odds.
                </span>
              </p>

              <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  10-team BESTBALL
                </span>
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  Superflex · Redraft
                </span>
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  No waivers · No trades · Pure draft
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm">
                  <p className="font-semibold text-accent mb-1">Not a tournament</p>
                  <p className="text-muted">
                    You play and win in your league, with an optional BIG Game
                    layer on top.
                  </p>
                </div>

                <div className="chip-warning">
                  <span className="text-base">⚠️</span>
                  <span>
                    This wager is optional. League winners can choose to cash out
                    or step into the BIG Game.
                  </span>
                </div>
              </div>

              <div className="pt-2 py-3 flex flex-wrap gap-3">
                <Link
                  prefetch={false}
                  href="/constitution"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-muted hover:border-accent/80 hover:text-accent transition-colors"
                >
                  📜 Code of Conduct
                </Link>
                <Link
                  prefetch={false}
                  href="#divisions"
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-600/20 via-sky-600/10 to-purple-600/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 hover:shadow-xl hover:shadow-cyan-900/40 hover:-translate-y-0.5 transition"
                >
                  🏟️ View Divisions
                </Link>
              </div>
            </div>

            {/* Right column: owner block + quick facts (matches the premium hero vibe) */}
            <aside className="w-full py-3 lg:w-[360px] space-y-4">
        

              <div className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm overflow-hidden shadow-xl shadow-black/50">
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Quick Facts
                  </span>
                  <span className="text-[11px] text-muted">{CURRENT_SEASON}</span>
                </div>

                <div className="p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Buy-in</span>
                    <span className="font-semibold text-primary">$7</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">League size</span>
                    <span className="font-semibold">10 teams</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Format</span>
                    <span className="font-semibold">Bestball · SF</span>
                  </div>
                  <div className="h-px bg-border/60" />
                  <p className="text-xs text-muted">
                    Most points after Week 15 wins the league. League winners
                    can cash out or roll into Division + Championship weeks.
                  </p>
                </div>
              </div>

            </aside>
          </div>
          {/* Owner updates (manifest-gated for cache efficiency) */}
        <SectionManifestGate section="biggame" season={CURRENT_SEASON}>
          <BigGameDynamicBlocks season={CURRENT_SEASON} showDivisions={false} />
        </SectionManifestGate>
        </section>
        {/* DIVISIONS GRID (now dynamic from Supabase) */}
        <section id="divisions">
          <SectionManifestGate section="biggame" season={CURRENT_SEASON}>
            <BigGameDynamicBlocks season={CURRENT_SEASON} showOwner={false} />
          </SectionManifestGate>
        </section>
        

        {/* ESSENTIALLY / ODDS */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_minmax(0,1fr)] items-start">
          <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
            <h2 className="text-xl font-semibold mb-2 text-accent">Essentially…</h2>
            <ul className="space-y-1.5 text-sm">
              <li>• 1/10 odds of winning your league.</li>
              <li>• 1/8 (or better) odds of winning your division in Week 16.</li>
              <li>• 1/12 (or better) odds of winning the 🏆 Championship 👑 in Week 17.</li>
            </ul>

            <div className="mt-4 rounded-xl bg-subtle-surface border border-subtle p-4 text-sm space-y-2">
              <p className="font-semibold">
                Championship BONUS – <span className="text-primary">$200</span>
              </p>
              <p className="text-muted">
                Our custom wagering formula creates{" "}
                <span className="font-medium text-accent">outsized payout opportunities</span>.
              </p>
              <ul className="space-y-1">
                <li>• 2023: Mtost turned a $6 entry into ≈ $1,450.</li>
                <li>• 2024: Kros24 took home ≈ $1,450–$1,600 from a single run.</li>
                <li>• Plus dozens of other players banking hundreds with moderate hits.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
            <h3 className="text-lg font-semibold">Buy-in &amp; League Basics</h3>
            <ul className="text-sm space-y-1.5">
              <li>• <span className="font-semibold text-primary">$7 buy-in</span></li>
              <li>
                • Money held on <span className="font-medium">LeagueSafe (Majority rule)</span>
              </li>
              <li>• 10 teams per league</li>
              <li>• Bestball, Superflex, Redraft</li>
              <li>• <span className="font-medium text-accent">$50 for “League Winners”</span></li>
            </ul>
            <p className="mt-2 text-xs text-muted">⚠️ Most points after Week 15 wins the league.</p>
            <p className="mt-2 text-sm text-muted">
              League winners may keep their $50 and{" "}
              <span className="font-semibold text-fg">exit</span>, or roll into{" "}
              <span className="font-semibold text-primary">The BALLSVILLE Game</span>.
            </p>
          </div>
        </section>

        {/* HOW TO PLAY / WHAT YOU GET */}
        <section className="grid gap-6 lg:grid-cols-2 items-start">
          <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
            <h2 className="text-xl font-semibold">How to play the game</h2>
            <p className="text-sm text-muted">
              Grind your league, win your regular-season race by Week 15, and decide:
            </p>
            <ul className="text-sm space-y-1.5">
              <li>• Take your $50 and walk.</li>
              <li>• Or step into the BIG Game path through Division and Championship weeks.</li>
            </ul>
            <p className="text-sm text-muted">
              The odds stay friendly. You keep the same core chance to win your league,
              but add a high-upside overlay with structured, transparent odds.
            </p>
          </div>

          <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
            <h2 className="text-xl font-semibold text-accent">Your $7 entry also gets you:</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <ul className="space-y-1.5">
                <li>• Mini games</li>
                <li>• Free entry opportunities</li>
                <li>• Game Managers</li>
                <li>• The BALLSVILLE Pod</li>
                <li>• Community &amp; socials</li>
                <li>• Discord access</li>
              </ul>
              <ul className="space-y-1.5">
                <li>• Custom ADP &amp; trade analysis</li>
                <li>• This website + tools</li>
                <li>• Live scores in Weeks 16 &amp; 17</li>
                <li>• Expedited payouts</li>
                <li>• Some of the best players we can gather</li>
              </ul>
            </div>
            <p className="text-xs text-muted">
              We appreciate the smallness of our game, but we do hold it in high esteem.
              Most recruiting is <span className="font-semibold text-fg">invite only</span>.
            </p>
          </div>
        </section>

        {/* IF YOU'RE INVITED */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">If you’re invited to a league…</h2>
          <p className="text-sm text-muted">Each league has important pinned messages for you. These will include:</p>
          <ul className="text-sm space-y-1.5">
            <li>• A league-specific variant of this intro page</li>
            <li>• Wagering demo</li>
            <li>• Code of Conduct</li>
            <li>• Pay link</li>
            <li>• Discord link</li>
          </ul>
          <p className="text-sm text-muted">
            The pay link is usually posted when a league reaches 8/10 players. All money is held through{" "}
            <span className="font-semibold">LeagueSafe / Majority</span>.
          </p>
        </section>

        {/* SCORING & ROSTERS */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-4">
          <h2 className="text-xl font-semibold">Scoring &amp; Rosters</h2>
          <p className="text-sm text-muted">
            Scoring and settings are universal across all BIG Game Bestball leagues.
          </p>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
            <div className="rounded-xl bg-subtle-surface border border-subtle p-4 text-sm space-y-2 font-mono">
              <p className="text-accent font-semibold">Starting lineup</p>
              <ul className="space-y-1">
                <li>QB ( +6 per passing TD )</li>
                <li>2 × RB</li>
                <li>3 × WR</li>
                <li>TE (non-premium)</li>
                <li>2 × FLEX</li>
                <li>1 × SUPERFLEX</li>
                <li>+16 bench</li>
              </ul>
            </div>

            <div className="rounded-xl bg-subtle-surface border border-subtle p-4 text-sm space-y-2">
              <p className="text-accent font-semibold">Global rules</p>
              <ul className="space-y-1">
                <li>• No trading.</li>
                <li>• No auctions.</li>
                <li>• Odds need to be fair across all leagues.</li>
              </ul>
              <p className="text-xs text-muted mt-1">
                All leagues share the same scoring and roster configuration to keep the contest balanced.
              </p>
            </div>
          </div>
        </section>

        {/* IN CLOSING */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">In closing</h2>
          <p className="text-sm text-muted">
            Trash talk is tolerated, but we do have a{" "}
            <Link
              prefetch={false}
              href="/constitution"
              className="font-semibold text-accent underline underline-offset-2 hover:text-primary"
            >
              Code of Conduct
            </Link>{" "}
            that everyone is expected to read.
          </p>
          <p className="text-xs text-muted">
            ⚠️ If any league is inconsistent with the others, it may be excluded from the BALLSVILLE contest.
          </p>
          <p className="text-sm text-muted">
            Payments in will be tracked in each individual league. Payments go through{" "}
            <span className="font-semibold">three stages of verification</span> to keep the game clean.
          </p>
          <p className="text-sm text-muted">
            If you’re interested in joining, DM a manager to be added to the waiting list.
            The BIG Game kicks off each year after the NFL Draft.
          </p>
        </section>

        
      </div>
    </main>
  );
}
