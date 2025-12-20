// app/redraft/page.jsx
import { siteConfig } from "@/app/config/siteConfig";
import RedraftUpdatesClient from "./RedraftUpdatesClient";
import RedraftLeaguesClient from "./RedraftLeaguesClient";

const pageTitle = `The Redraft Game | ${siteConfig.shortName}`;

export const metadata = {
  title: pageTitle,
  description:
    "Details for the BALLSVILLE redraft game: league settings, payouts, wagering formula, and championship structure.",
  alternates: { canonical: "/redraft" },
  openGraph: {
    url: "/redraft",
    title: pageTitle,
    description:
      "Learn how the BALLSVILLE redraft game works, including settings, payouts, and our custom wagering formula.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function RedraftPage() {
  return (
    <section className="section">
      <div className="container-site space-y-10">

         {/* Hero (hardcoded) — moved BELOW updates + live leagues */}
        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card-surface shadow-2xl shadow-black/40 px-6 py-8 sm:px-10 sm:py-10">
          {/* glow accents */}
          <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen">
            <div className="absolute -top-24 -left-10 h-56 w-56 rounded-full bg-rose-500/18 blur-3xl" />
            <div className="absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-sky-500/16 blur-3xl" />
            <div className="absolute top-10 right-20 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
          </div>

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)] lg:items-start">
            {/* left */}
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">
                THE REDRAFT GAME
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                How the <span className="text-primary">BALLSVILLE</span> Redraft Game Works
              </h1>

              <p className="text-sm sm:text-base text-muted max-w-prose">
                A 12-team Superflex redraft format with custom ADP, mini games, and our
                wagering system that turns league wins into Week 17 championship upside.
              </p>

              <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  12-team · SF · 3WR · 2 FLEX
                </span>
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  League Median · 6-team playoffs
                </span>
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  Derby startup (no draft trades)
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 pt-2">
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm">
                  <p className="font-semibold text-accent mb-1">Core idea</p>
                  <p className="text-muted">
                    Win in your league, then choose:{" "}
                    <span className="text-fg font-semibold">bank</span> your winnings or{" "}
                    <span className="text-fg font-semibold">wager</span> for higher Week 17 upside.
                  </p>
                </div>

                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm">
                  <p className="font-semibold text-accent mb-1">What you get</p>
                  <p className="text-muted">
                    Custom ADP, mini games, Discord community, pod coverage, and clean cash flow tracking.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <a href="#how-it-works" className="btn btn-primary">
                  🔥 Start Here
                </a>
                <a href="#wagering" className="btn btn-outline">
                  🪙 Wagering Formula
                </a>
              </div>
            </div>

            {/* right: quick facts panel */}
            <aside className="w-full">
              <div className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm overflow-hidden shadow-xl shadow-black/40">
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Quick Facts
                  </span>
                  <span className="text-[11px] text-muted">Redraft</span>
                </div>

                <div className="p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Buy-in</span>
                    <span className="font-semibold text-primary">$50</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Finals bonus</span>
                    <span className="font-semibold text-fg">+$75</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">League winner</span>
                    <span className="font-semibold text-fg">$300 🏆</span>
                  </div>
                  <div className="h-px bg-border/60" />
                  <p className="text-[11px] text-muted">
                    Wagering is optional. You can keep your guaranteed winnings or push it into the Week 17 pots for upside.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
        
        {/* Admin-managed updates (R2) */}
        <RedraftUpdatesClient />

        {/* Live leagues (R2) */}
        <RedraftLeaguesClient />

       

        {/* League description */}
        <article
          id="how-it-works"
          className="bg-card-surface rounded-3xl border border-subtle p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center"
        >
          <div className="space-y-3">
            <h2 className="h3">League description</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold tracking-wide uppercase text-accent">
                  Settings
                </h3>
                <ul className="mt-2 text-sm space-y-1">
                  <li>• 12-team</li>
                  <li>• SF</li>
                  <li>• 3WR</li>
                  <li>• 2x Flex</li>
                  <li>• (no TEP)</li>
                  <li>• 6 player Playoffs</li>
                  <li>• League Median</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-wide uppercase text-accent">
                  Draft
                </h3>
                <ul className="mt-2 text-sm space-y-1">
                  <li>• Derby Startup</li>
                  <li>• No draft trading</li>
                  <li>• Fast and Slow draft</li>
                </ul>

                <h3 className="mt-4 text-sm font-semibold tracking-wide uppercase text-accent">
                  Extras
                </h3>
                <ul className="mt-2 text-sm space-y-1">
                  <li>• Custom ADP</li>
                  <li>• Podcast coverage</li>
                  <li>• Minigames</li>
                  <li>• Free entry opportunities</li>
                  <li>• Discord</li>
                  <li>• the BALLSVILLE community</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(255,0,128,0.25),_transparent)] pointer-events-none" />
            <img
              src="/photos/redraft/redraft-league.jpg"
              alt="The REDRAFT game league description graphic"
              className="relative rounded-2xl w-full h-auto shadow-lg"
              loading="lazy"
              decoding="async"
            />
          </div>
        </article>

        {/* How the game works */}
        <article className="bg-card-surface rounded-3xl border border-subtle p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center">
          <div className="relative order-2 md:order-1">
            <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_bottom,_rgba(255,64,64,0.25),_transparent)] pointer-events-none" />
            <img
              src="/photos/redraft/how-it-works.jpg"
              alt="How the redraft game works graphic"
              className="relative rounded-2xl w-full h-auto shadow-lg"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="space-y-3 order-1 md:order-2">
            <h2 className="h3">How the game works</h2>
            <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm leading-relaxed">
              <p>
                You play and win in your league. After Week 16, if you make the
                finals, you take home{" "}
                <span className="font-semibold text-success">+ $75</span>.
              </p>
              <p className="mt-2">
                At this point you can{" "}
                <span className="font-semibold">bank that</span>, or{" "}
                <span className="font-semibold">wager with it</span>. (More on
                this later.)
              </p>
            </div>
            <p className="mt-2 text-sm">
              Wager or not, if you win your league you take home{" "}
              <span className="font-semibold text-success">$300</span> as the
              league winner 🏆 — and you&apos;re still eligible for the
              championship bonuses.
            </p>
          </div>
        </article>

        {/* BALLSVILLE formula / Year Five */}
        <article className="bg-card-surface rounded-3xl border border-subtle p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center">
          <div className="space-y-3">
            <h2 className="h3">The BALLSVILLE wagering formula</h2>
            <p>
              Our custom wagering method allows you to assess your roster and
              take a shot at a <span className="font-semibold">BIG payout</span>.
            </p>
            <p>
              When you make the finals in your league, you win{" "}
              <span className="font-semibold text-success">+ $75</span>.
            </p>
            <p>
              You can <span className="font-semibold">BANK</span> that, or{" "}
              <span className="font-semibold">WAGER</span> with your winnings to
              enter the wager pot, with an extra{" "}
              <span className="font-semibold text-success">+ $200 bonus</span>.
            </p>
            <p>
              That&apos;s an upside of{" "}
              <span className="font-semibold text-success">
                + $150 per league
              </span>
              , added to the Week 17 showdown.
            </p>
            <p className="text-sm text-muted">
              For wagering purposes, your +$75 is represented by 3 coins of $25.
              This is our custom Hold &apos;Em style formula — built for big
              payouts with great odds.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(147,51,234,0.3),_transparent)] pointer-events-none" />
            <img
              src="/photos/redraft/year5.jpg"
              alt="The BALLSVILLE game Year Five wagering formula graphic"
              className="relative rounded-2xl w-full h-auto shadow-lg"
              loading="lazy"
              decoding="async"
            />
          </div>
        </article>

        {/* Money flow */}
        <article className="bg-card-surface rounded-3xl border border-subtle p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center">
          <div className="relative order-2 md:order-1">
            <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_bottom,_rgba(34,197,94,0.25),_transparent)] pointer-events-none" />
            <img
              src="/photos/redraft/money.jpg"
              alt="How the money works graphic"
              className="relative rounded-2xl w-full h-auto shadow-lg"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="space-y-3 order-1 md:order-2">
            <h2 className="h3">How the money works</h2>
            <p className="text-sm">
              <span className="font-semibold text-success">$50 buy in</span> per
              league. Each league collects{" "}
              <span className="font-semibold text-success">$600</span>.
            </p>
            <ul className="text-sm space-y-1">
              <li>• $100 from each league goes to the championship pot.</li>
              <li>• $50 goes to support the BALLSVILLE game.</li>
            </ul>
            <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm">
              <p className="font-semibold mb-1">What the $50 covers:</p>
              <ul className="space-y-1">
                <li>• Website</li>
                <li>• Podcast</li>
                <li>• Mini-games</li>
                <li>• Free entry opportunities</li>
                <li>• Pro accounts (Discord, AI, editing)</li>
                <li>• Game managers (~1%)</li>
              </ul>
            </div>
            <p className="text-xs text-muted">
              We&apos;re transparent with our cash flow so you always know where
              the money goes.
            </p>
          </div>
        </article>

        {/* Championship + Wagering demo */}
        <article id="wagering" className="bg-card-surface rounded-3xl border border-subtle p-6 md:p-8 space-y-8">
          <div className="grid gap-6 md:grid-cols-2 items-center">
            <div className="space-y-3">
              <h2 className="h3 flex items-center gap-2">
                The Championship <span role="img" aria-label="trophy">🏆</span>
              </h2>
              <p className="text-sm">
                Each league contributes{" "}
                <span className="font-semibold text-success">+ $100</span> to
                the championship. This is split three ways:
              </p>
              <ul className="text-sm space-y-1">
                <li>• 🏆 Champion wins $70 per league</li>
                <li>• 💰 Wager winner takes home $20 per league</li>
                <li>• ↑ Runner up collects $10 per league</li>
              </ul>
              <p className="text-sm">
                These totals scale up with every league that joins the game.
              </p>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.35),_transparent)] pointer-events-none" />
              <img
                src="/photos/redraft/champ.jpg"
                alt="The Championship payouts graphic"
                className="relative rounded-2xl w-full h-auto shadow-lg"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 items-center">
            <div className="relative order-2 md:order-1">
              <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_bottom,_rgba(59,130,246,0.3),_transparent)] pointer-events-none" />
              <img
                src="/photos/redraft/wagering-demo.jpg"
                alt="Wagering demo table graphic"
                className="relative rounded-2xl w-full h-auto shadow-lg"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="space-y-3 order-1 md:order-2">
              <h3 className="text-lg font-semibold">Wagering demo</h3>
              <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm leading-relaxed">
                <p>
                  Every player can enter their{" "}
                  <span className="font-semibold">&quot;WAGER&quot;</span> before
                  Week 17.
                </p>
                <p className="mt-2">
                  All finalists are playing for the trophy and the runner-up
                  finish — but only wagering players can win the wager pots.
                </p>
              </div>
              <p className="text-xs text-muted">
                For wagering purposes, your $75 is represented by coins of $25.
                The demo table shows how $75 / $50 / $25 wagers map into the
                main pot and side pots.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
