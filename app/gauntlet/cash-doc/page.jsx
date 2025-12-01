// src/app/gauntlet/cash-doc/page.jsx
import Link from "next/link";

export const metadata = {
  title: "Gauntlet Cash Doc | Ballsville",
};

export default function GauntletCashDocPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-accent">
          GAUNTLET CASH DOC
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold">Cash Doc</h1>
        <p className="text-sm text-muted max-w-prose">
          The payout structure here gives us{" "}
          <strong>many payouts with big prizes</strong> to end the year. Our
          payouts and BONUSES are stackable.
        </p>
      </header>

      <section className="space-y-2">
        <p className="text-sm text-muted">
          One Champ will emerge from <strong>288 entries</strong>.
        </p>
        <p className="text-sm text-muted">
          The <span className="text-lg">🏆</span> can win as much as{" "}
          <strong>$2,342</strong> (including payouts and BONUS possibilities).
        </p>
        <ul className="text-sm text-muted space-y-1.5">
          <li>• 11 other God Champs will win $288–$333 (1/24 odds).</li>
          <li>• 12 other Semi-Finalists (1/12 odds).</li>
          <li>• 24 other Quarter-Finalists (1/6 odds).</li>
          <li>
            • 2 chances per league to win $30 by Week 13 (1/6 odds in each
            league).
          </li>
          <li>• Other game BONUSES and freebies along the way.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">The Math</h2>
        <ul className="text-sm text-muted space-y-1.5">
          <li>• 24 teams per God</li>
          <li>• 4 Gods per Legion</li>
          <li>• 3 Legions per Gauntlet game</li>
        </ul>
        <p className="text-sm text-muted">
          288 entries × dues of <strong>$30 + $3</strong>.
        </p>
        <p className="text-sm text-muted">
          Total balance: <strong>$8,640</strong>, with{" "}
          <strong>$864</strong> going to the game for{" "}
          <em>insurance of dues, freebies, conditional BONUSES, etc.</em>{" "}
          Details are shown below.
        </p>
        <p className="text-sm text-muted">
          The Ballsville game stays transparent about all cash affairs,
          including where any excess money goes. Players have the right to know
          what they&apos;re agreeing to.
        </p>
      </section>

      {/* Payouts */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Payouts</h2>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">Redraft Payout #1</h3>
          <p className="text-sm text-muted">
            After Week 8, <strong>$30</strong> goes to the league leader in{" "}
            <strong>standings</strong>.
          </p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>• &quot;League Leaders&quot; – 24</li>
            <li>• Payout – $30 each</li>
            <li>• Cost – $720 total</li>
          </ul>
          <p className="text-sm text-muted font-semibold">
            Bonus: “EARLY DOMINATOR”
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">Guillotine #2</h3>
          <p className="text-sm text-muted">
            After Week 12, <strong>$50</strong> goes to the league leader in{" "}
            <strong>total points</strong>.
          </p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>• League Leaders – 24</li>
            <li>• Payout – $50 each</li>
            <li>• Cost – $1,200 total</li>
          </ul>
          <p className="text-sm text-muted font-semibold">Bonus: “GOD MODE”</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">The Bracket #3</h3>
          <p className="text-sm text-muted">
            After Week 14, players who win their matchup receive{" "}
            <strong>+$50</strong>.
          </p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>• Quarter-Finalists – 4 players per God</li>
            <li>• Gods – 12</li>
            <li>• Players – 48</li>
            <li>• Payout – $50 each</li>
            <li>• Cost – $2,400 total</li>
          </ul>
          <p className="text-sm text-muted font-semibold">
            Bonuses: “The Lunch Money” + “King Slayer”
          </p>
          <p className="text-xs text-muted">
            Note: By now, payouts have reached 96 payouts out of 288 entries (~33%) by Payout #3.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">The Bracket #4</h3>
          <p className="text-sm text-muted">
            After Week 15, players who win their matchup receive{" "}
            <strong>+$75</strong>.
          </p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>• Semi-Finalists – 2 players per God</li>
            <li>• Gods – 12</li>
            <li>• Players – 24</li>
            <li>• Payout – $75 each</li>
            <li>• Cost – $1,800 total</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">The Bracket #5</h3>
          <p className="text-sm text-muted">
            After Week 16, players who win their matchup receive{" "}
            <strong>+$128</strong>.
          </p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>• God Champions – 12</li>
            <li>• Payout – $128 each</li>
            <li>• Cost – $1,536 total</li>
          </ul>
          <p className="text-sm text-muted">
            By this point, each champion has earned{" "}
            <strong>up to $253</strong> from the bracket portion, plus{" "}
            <strong>$0–$80</strong> from their league, for roughly $305–$333
            total.
          </p>
        </div>
      </section>

      {/* Gauntlet Championship */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Gauntlet Championship</h2>
        <p className="text-sm text-muted">
          <strong>God Champions – 12</strong>
        </p>
        <p className="text-sm text-muted">
          These players each have the option to{" "}
          <strong>wager $100 from their winnings</strong> to enter a wager pot
          with a +$100 BONUS.
        </p>
        <ul className="text-sm text-muted space-y-1.5">
          <li>• Highest points scored among the 12 wins +$400.</li>
          <li>
            • Highest points among wagering players wins all wagers (up to
            $1,200) plus the +$100 BONUS.
          </li>
        </ul>
        <p className="text-sm text-muted font-semibold">Bonus: “Champion’s Bump”</p>
        <p className="text-sm text-muted">
          Cost so far – <strong>$8,356</strong>  
          <br />
          Balance – <strong>$484</strong>
        </p>
      </section>

      {/* Badass Bonuses */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Badass Bonuses</h2>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">“EARLY DOMINATOR”</h3>
          <p className="text-sm text-muted">
            The team with the highest point total from each Legion receives a{" "}
            <strong>+ $50</strong> bonus after completion of Redraft (Week 8).
          </p>
          <p className="text-sm text-muted">
            3 Legions × $50 = <strong>$150</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">“GOD MODE”</h3>
          <p className="text-sm text-muted">
            During the Guillotine leg (Weeks 9–12), the most overall points{" "}
            <strong>game-wide each week</strong> earns <strong>+ $25</strong>.
          </p>
          <p className="text-sm text-muted">
            4 payouts total = <strong>$100</strong>
          </p>
          <p className="text-sm text-muted">Balance after these: $234</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Conditional Bonuses</h3>
          <p className="text-sm text-muted">
            These share their budget with the Triathlon Champion. If this{" "}
            <strong>$234 balance</strong> is not won, the remaining amount gets
            added to the Champion&apos;s payout. If these ARE won, the Ballsville
            game covers any extra balance.
          </p>

          <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
            <h4 className="text-sm font-semibold">“The Lunch Money”</h4>
            <p className="text-sm text-muted">
              If you enter the Bracket leg as the #1 seed in Week 13 and beat
              your #8-seed opponent by 50 points, you receive a{" "}
              <strong>+ $20</strong> bonus.
            </p>
            <p className="text-sm text-muted">
              Up to 12 × $20 = <strong>$480</strong> max
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
            <h4 className="text-sm font-semibold">“King Slayer”</h4>
            <p className="text-sm text-muted">
              In Week 13, during the Bracket, any #8 seed who beats the #1 seed
              in their matchup earns a <strong>$20</strong> BONUS.
            </p>
            <p className="text-sm text-muted">
              Up to 12 × $20 = <strong>$480</strong> max
            </p>
          </div>

          <p className="text-sm text-muted">
            Any remaining balance not used by conditional BONUSES is added to
            the Champion&apos;s payout as the final{" "}
            <strong>“Champion&apos;s Bump”</strong>, up to +$234.
          </p>
        </div>
      </section>

      {/* Game Costs */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Game Costs</h2>
        <p className="text-sm text-muted">
          The Ballsville game is designed for the players. We offer extra
          content including this website, our weekly podcast, managers and
          affiliates that help run the games, and more.
        </p>
        <p className="text-sm text-muted">
          <strong>$3</strong> from each entry goes to the game.
        </p>
        <p className="text-sm text-muted">
          288 × $3 = <strong>$864</strong> of &quot;game money&quot;.
        </p>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3">
          <p className="text-sm text-muted">Annual costs include:</p>
          <ul className="text-sm text-muted space-y-1.5 mt-2">
            <li>• StreamYard for the pod – ~$600</li>
            <li>• The website – ~$388 ($400)</li>
            <li>• Affiliates – $300+</li>
            <li>• Pro subscriptions for editing – ~$200</li>
          </ul>
          <p className="mt-2 text-sm text-muted">
            Total costs of Ballsville: <strong>~$1,500 annually</strong>. That
            balance is split across 5 games. The remaining balance from all
            games is assigned to game managers for a well-run year.
          </p>
        </div>
      </section>

      <footer className="pb-8">
        <Link
          href="/gauntlet"
          className="inline-flex items-center gap-2 text-sm text-accent hover:underline underline-offset-2"
        >
          ← Back to Gauntlet main page
        </Link>
      </footer>
    </main>
  );
}
