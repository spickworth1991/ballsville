// src/app/gauntlet/cash-doc/page.jsx
import Link from "next/link";

export const metadata = {
  title: "Gauntlet Cash Doc | Ballsville",
};

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

function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border border-subtle bg-subtle-surface">
      {children}
    </span>
  );
}

export default function GauntletCashDocPage() {
  return (
    <section className="section">
      <div className="container-site space-y-8">
        {/* HERO */}
        <header className="bg-card-surface border border-subtle shadow-md rounded-2xl p-6 md:p-10 overflow-hidden relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-25 blur-3xl bg-[color:var(--color-accent)]" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl bg-[color:var(--color-primary)]" />

          <div className="relative">
            <span className="badge">Gauntlet Cash Doc</span>

            <h1 className="h1 mt-4">Cash Doc</h1>

            <p className="lead mt-3 max-w-3xl">
              The payout structure gives us <span className="text-fg font-semibold">many payouts</span>{" "}
              with <span className="text-fg font-semibold">big prizes</span> to end the year.
              Payouts and BONUSES are stackable.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Pill>288 entries</Pill>
              <Pill>Stackable payouts</Pill>
              <Pill>Max: $2,342</Pill>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/gauntlet" className="btn btn-outline">
                ← Back to Gauntlet
              </Link>
              <Link href="/gauntlet/intro" className="btn btn-outline">
                ⚔️ Game Intro
              </Link>
            </div>
          </div>
        </header>

        {/* SUMMARY */}
        <Card>
          <div className="space-y-3">
            <h2 className="h2">At a glance</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <SubCard>
                <p className="text-sm text-muted">
                  One Champ will emerge from <strong className="text-fg">288 entries</strong>.
                </p>
                <p className="text-sm text-muted mt-2">
                  The <span className="text-lg">🏆</span> can win as much as{" "}
                  <strong className="text-fg">$2,342</strong> (including payouts and BONUS possibilities).
                </p>
              </SubCard>

              <SubCard>
                <ul className="text-sm text-muted space-y-1.5">
                  <li>• 11 other God Champs will win $288–$333 (1/24 odds).</li>
                  <li>• 12 other Semi-Finalists (1/12 odds).</li>
                  <li>• 24 other Quarter-Finalists (1/6 odds).</li>
                  <li>• 2 chances per league to win $30 by Week 13 (1/6 odds in each league).</li>
                  <li>• Other game BONUSES and freebies along the way.</li>
                </ul>
              </SubCard>
            </div>
          </div>
        </Card>

        {/* THE MATH */}
        <Card>
          <div className="space-y-3">
            <h2 className="h2">The Math</h2>

            <div className="flex flex-wrap gap-2">
              <Pill>24 teams per God</Pill>
              <Pill>4 Gods per Legion</Pill>
              <Pill>3 Legions</Pill>
            </div>

            <p className="text-sm text-muted">
              288 entries × dues of <strong className="text-fg">$30 + $3</strong>.
            </p>
            <p className="text-sm text-muted">
              Total balance: <strong className="text-fg">$8,640</strong>, with{" "}
              <strong className="text-fg">$864</strong> going to the game for{" "}
              <em>insurance of dues, freebies, conditional BONUSES, etc.</em>
            </p>
            <p className="text-sm text-muted">
              The Ballsville game stays transparent about all cash affairs, including where any excess money goes.
              Players have the right to know what they&apos;re agreeing to.
            </p>
          </div>
        </Card>

        {/* PAYOUTS */}
        <Card>
          <div className="space-y-4">
            <h2 className="h2">Payouts</h2>

            <SubCard>
              <h3 className="h3">Redraft Payout #1</h3>
              <p className="text-sm text-muted mt-2">
                After Week 8, <strong className="text-fg">$30</strong> goes to the league leader in{" "}
                <strong className="text-fg">standings</strong>.
              </p>
              <ul className="text-sm text-muted mt-3 space-y-1.5">
                <li>• “League Leaders” – 24</li>
                <li>• Payout – $30 each</li>
                <li>• Cost – $720 total</li>
              </ul>
              <p className="text-sm text-muted font-semibold mt-3">Bonus: “EARLY DOMINATOR”</p>
            </SubCard>

            <SubCard>
              <h3 className="h3">Guillotine #2</h3>
              <p className="text-sm text-muted mt-2">
                After Week 12, <strong className="text-fg">$50</strong> goes to the league leader in{" "}
                <strong className="text-fg">total points</strong>.
              </p>
              <ul className="text-sm text-muted mt-3 space-y-1.5">
                <li>• League Leaders – 24</li>
                <li>• Payout – $50 each</li>
                <li>• Cost – $1,200 total</li>
              </ul>
              <p className="text-sm text-muted font-semibold mt-3">Bonus: “GOD MODE”</p>
            </SubCard>

            <SubCard>
              <h3 className="h3">The Bracket #3</h3>
              <p className="text-sm text-muted mt-2">
                After Week 14, players who win their matchup receive <strong className="text-fg">+$50</strong>.
              </p>
              <ul className="text-sm text-muted mt-3 space-y-1.5">
                <li>• Quarter-Finalists – 4 players per God</li>
                <li>• Gods – 12</li>
                <li>• Players – 48</li>
                <li>• Payout – $50 each</li>
                <li>• Cost – $2,400 total</li>
              </ul>
              <p className="text-sm text-muted font-semibold mt-3">
                Bonuses: “The Lunch Money” + “King Slayer”
              </p>
              <p className="text-xs text-muted mt-2">
                Note: By now, payouts have reached 96 payouts out of 288 entries (~33%) by Payout #3.
              </p>
            </SubCard>

            <SubCard>
              <h3 className="h3">The Bracket #4</h3>
              <p className="text-sm text-muted mt-2">
                After Week 15, players who win their matchup receive <strong className="text-fg">+$75</strong>.
              </p>
              <ul className="text-sm text-muted mt-3 space-y-1.5">
                <li>• Semi-Finalists – 2 players per God</li>
                <li>• Gods – 12</li>
                <li>• Players – 24</li>
                <li>• Payout – $75 each</li>
                <li>• Cost – $1,800 total</li>
              </ul>
            </SubCard>

            <SubCard>
              <h3 className="h3">The Bracket #5</h3>
              <p className="text-sm text-muted mt-2">
                After Week 16, players who win their matchup receive <strong className="text-fg">+$128</strong>.
              </p>
              <ul className="text-sm text-muted mt-3 space-y-1.5">
                <li>• God Champions – 12</li>
                <li>• Payout – $128 each</li>
                <li>• Cost – $1,536 total</li>
              </ul>
              <p className="text-sm text-muted mt-3">
                By this point, each champion has earned <strong className="text-fg">up to $253</strong> from the bracket portion,
                plus <strong className="text-fg">$0–$80</strong> from their league, for roughly $305–$333 total.
              </p>
            </SubCard>
          </div>
        </Card>

        {/* CHAMPIONSHIP */}
        <Card>
          <div className="space-y-3">
            <h2 className="h2">Gauntlet Championship</h2>
            <p className="text-sm text-muted">
              <strong className="text-fg">God Champions – 12</strong>
            </p>
            <p className="text-sm text-muted">
              These players each have the option to <strong className="text-fg">wager $100 from their winnings</strong> to enter a wager pot
              with a +$100 BONUS.
            </p>
            <ul className="text-sm text-muted space-y-1.5">
              <li>• Highest points scored among the 12 wins +$400.</li>
              <li>• Highest points among wagering players wins all wagers (up to $1,200) plus the +$100 BONUS.</li>
            </ul>
            <p className="text-sm text-muted font-semibold">Bonus: “Champion’s Bump”</p>
            <p className="text-sm text-muted">
              Cost so far – <strong className="text-fg">$8,356</strong>
              <br />
              Balance – <strong className="text-fg">$484</strong>
            </p>
          </div>
        </Card>

        {/* BONUSES */}
        <Card>
          <div className="space-y-4">
            <h2 className="h2">Badass Bonuses</h2>

            <SubCard>
              <h3 className="h3">“EARLY DOMINATOR”</h3>
              <p className="text-sm text-muted mt-2">
                The team with the highest point total from each Legion receives a <strong className="text-fg">+ $50</strong> bonus after completion of Redraft (Week 8).
              </p>
              <p className="text-sm text-muted mt-2">
                3 Legions × $50 = <strong className="text-fg">$150</strong>
              </p>
            </SubCard>

            <SubCard>
              <h3 className="h3">“GOD MODE”</h3>
              <p className="text-sm text-muted mt-2">
                During the Guillotine leg (Weeks 9–12), the most overall points <strong className="text-fg">game-wide each week</strong> earns <strong className="text-fg">+ $25</strong>.
              </p>
              <p className="text-sm text-muted mt-2">
                4 payouts total = <strong className="text-fg">$100</strong>
              </p>
              <p className="text-sm text-muted mt-2">Balance after these: $234</p>
            </SubCard>

            <SubCard>
              <h3 className="h3">Conditional Bonuses</h3>
              <p className="text-sm text-muted mt-2">
                These share their budget with the Triathlon Champion. If this <strong className="text-fg">$234 balance</strong> is not won,
                the remaining amount gets added to the Champion&apos;s payout. If these ARE won, the Ballsville game covers any extra balance.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="bg-card-surface border border-subtle rounded-2xl p-4">
                  <h4 className="text-sm font-semibold">“The Lunch Money”</h4>
                  <p className="text-sm text-muted mt-2">
                    If you enter the Bracket leg as the #1 seed in Week 13 and beat your #8-seed opponent by 50 points, you receive a <strong className="text-fg">+ $20</strong> bonus.
                  </p>
                  <p className="text-sm text-muted mt-2">
                    Up to 12 × $20 = <strong className="text-fg">$480</strong> max
                  </p>
                </div>

                <div className="bg-card-surface border border-subtle rounded-2xl p-4">
                  <h4 className="text-sm font-semibold">“King Slayer”</h4>
                  <p className="text-sm text-muted mt-2">
                    In Week 13, during the Bracket, any #8 seed who beats the #1 seed in their matchup earns a <strong className="text-fg">$20</strong> BONUS.
                  </p>
                  <p className="text-sm text-muted mt-2">
                    Up to 12 × $20 = <strong className="text-fg">$480</strong> max
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted mt-4">
                Any remaining balance not used by conditional BONUSES is added to the Champion&apos;s payout as the final{" "}
                <strong className="text-fg">“Champion&apos;s Bump”</strong>, up to +$234.
              </p>
            </SubCard>
          </div>
        </Card>

        {/* COSTS */}
        <Card>
          <div className="space-y-3">
            <h2 className="h2">Game Costs</h2>
            <p className="text-sm text-muted">
              The Ballsville game is designed for the players. We offer extra content including this website, our weekly podcast,
              managers and affiliates that help run the games, and more.
            </p>
            <p className="text-sm text-muted">
              <strong className="text-fg">$3</strong> from each entry goes to the game.
            </p>
            <p className="text-sm text-muted">
              288 × $3 = <strong className="text-fg">$864</strong> of “game money”.
            </p>

            <SubCard>
              <p className="text-sm text-muted">Annual costs include:</p>
              <ul className="text-sm text-muted space-y-1.5 mt-2">
                <li>• StreamYard for the pod – ~$600</li>
                <li>• The website – ~$388 ($400)</li>
                <li>• Affiliates – $300+</li>
                <li>• Pro subscriptions for editing – ~$200</li>
              </ul>
              <p className="mt-3 text-sm text-muted">
                Total costs of Ballsville: <strong className="text-fg">~$1,500 annually</strong>. That balance is split across 5 games.
                The remaining balance from all games is assigned to game managers for a well-run year.
              </p>
            </SubCard>
          </div>
        </Card>

        {/* FOOTER */}
        <footer className="pb-6">
          <Link href="/gauntlet" className="btn btn-outline">
            ← Back to Gauntlet main page
          </Link>
        </footer>
      </div>
    </section>
  );
}
