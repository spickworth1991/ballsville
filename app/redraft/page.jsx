// app/redraft/page.jsx
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `The Redraft Game | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/redraft`;

export const metadata = {
  title: pageTitle,
  description:
    "Details for the BALLSVILLE redraft game: league settings, payouts, wagering formula, and championship structure.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
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
        {/* Hero */}
        <header className="text-center mb-4">
          <span className="badge">the REDRAFT game</span>
          <h1 className="h1 mt-3">How the BALLSVILLE Redraft Game Works</h1>
          <p className="lead mt-3 max-w-2xl mx-auto">
            A 12-team Superflex redraft format with custom ADP, mini games, and
            our unique wagering system that turns league wins into championship
            upside.
          </p>
        </header>

        {/* League description */}
        <article className="bg-card-surface p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center">
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
        <article className="bg-card-surface p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center">
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
        <article className="bg-card-surface p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center">
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
        <article className="bg-card-surface p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center">
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
        <article className="bg-card-surface p-6 md:p-8 space-y-8">
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
