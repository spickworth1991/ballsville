// src/app/gauntlet/intro/page.jsx
import Link from "next/link";

export const metadata = {
  title: "Gauntlet Game Intro | Ballsville",
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

export default function GauntletIntroPage() {
  return (
    <section className="section">
      <div className="container-site space-y-8">
        {/* HERO */}
        <header className="bg-card-surface border border-subtle shadow-md rounded-2xl p-6 md:p-10 overflow-hidden relative">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-25 blur-3xl bg-[color:var(--color-accent)]" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl bg-[color:var(--color-primary)]" />

          <div className="relative">
            <span className="badge">Gauntlet Game Intro</span>
            <h1 className="h1 mt-4">How the Gauntlet Game Works</h1>
            <p className="lead mt-3 max-w-3xl">
              You play and win in your leagues. We combine those great odds with{" "}
              <span className="text-fg font-semibold">big payout opportunities</span>.
              The season starts as 12-team leagues, then in Week 13 two leagues merge
              into a bracket for the final stretch.
            </p>

            {/* Quick Nav */}
            <div className="mt-6 flex flex-wrap gap-2">
              <a className="btn btn-outline" href="#draft">The Draft</a>
              <a className="btn btn-outline" href="#play">How to Play</a>
              <a className="btn btn-outline" href="#legs">3 Legs</a>
              <a className="btn btn-primary" href="#money">Money & Payouts</a>
            </div>

            <p className="mt-4 text-sm text-muted">
              Tip: This page is built to skim — hit the buttons above to jump to the section you want.
            </p>
          </div>
        </header>

        {/* DRAFT */}
        <Card>
          <div id="draft" className="space-y-4 scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="h2">The Draft</h2>
              <div className="flex flex-wrap gap-2">
                <Pill>LeagueSafe majority rule</Pill>
                <Pill>Buy-in: $33</Pill>
                <Pill>24 entries per God</Pill>
              </div>
            </div>

            <div className="bg-subtle-surface border border-subtle rounded-2xl p-5 md:p-6">
              <ul className="text-sm text-muted space-y-2">
                <li>• 24 players are randomly split into two separate 12-team leagues.</li>
                <li>• Half play in the initial league; the other half may spectate or rejoin later for the bracket.</li>
                <li>• The second 12-team league forms the other side of the God.</li>
                <li>• In Week 13, Light + Dark combine into a <strong className="text-fg">God Bracket</strong>.</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <SubCard>
                <h3 className="h3">Scheduling</h3>
                <p className="text-sm text-muted mt-2">
                  Ready “Gods” will be scheduled to draft together in June. The bracket demo
                  will be updated to match the players in each God. This repeats for each God.
                </p>
              </SubCard>

              <SubCard>
                <h3 className="h3">Rules</h3>
                <p className="text-sm text-muted mt-2">
                  Drafts begin as 4-hour slow drafts, derby startup. No 3rd-round reversal and no pick trading.
                </p>
              </SubCard>
            </div>

            <div className="text-sm text-muted space-y-2">
              <p>
                One God from each Legion will be open at any time until all Legions are full.
                Each God has a Light and Dark league.
              </p>
              <p>
                Preregistration is open now. Join a Legion by joining a God using the Sleeper links
                provided by your Game Managers. Once a God has 24 paid entries, we can begin.
              </p>
              <p>
                Only one entry per player for each God, but you can claim an entry in each of the 12 Gods as they are released.
              </p>
            </div>
          </div>
        </Card>

        {/* HOW TO PLAY */}
        <Card>
          <div id="play" className="space-y-4 scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="h2">How to Play</h2>
              <Pill>~ 1 in 3 chance at an early payout</Pill>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <SubCard>
                <h3 className="h3">Structure</h3>
                <p className="text-sm text-muted mt-2">
                  The game begins with 3 separate Legions. Each Legion has 4 Gods.
                  Each God is a 24-player subdivision — a <strong className="text-fg">God Bracket</strong>.
                </p>
              </SubCard>

              <SubCard>
                <h3 className="h3">Timeline</h3>
                <p className="text-sm text-muted mt-2">
                  Two leagues (Light and Dark) run from Weeks 1–12, then merge in Week 13 to form the bracket.
                  Everything after Week 12 is upside.
                </p>
              </SubCard>
            </div>
          </div>
        </Card>

        {/* THE 3 LEGS */}
        <Card>
          <div id="legs" className="space-y-5 scroll-mt-28">
            <h2 className="h2">The 3 Legs of the Gauntlet</h2>

            <div className="grid gap-4">
              <SubCard>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="h3">Leg 1 — Redraft</h3>
                  <Pill>Weeks 1–8</Pill>
                </div>

                <p className="text-sm text-muted mt-2">
                  Standard redraft play. League median will play a role.
                  You begin with <strong className="text-fg">$200 FAAB</strong>, and FAAB <strong className="text-fg">does not reset</strong>.
                </p>

                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div className="bg-card-surface border border-subtle rounded-2xl p-4">
                    <div className="text-sm font-semibold">Roster</div>
                    <ul className="text-sm text-muted mt-2 space-y-1.5">
                      <li>• 1 QB</li>
                      <li>• 2 RB</li>
                      <li>• 3 WR</li>
                      <li>• 1 TE</li>
                      <li>• 1 Flex</li>
                      <li>• 1 Superflex</li>
                      <li>• 7 Bench</li>
                    </ul>
                  </div>

                  <div className="bg-card-surface border border-subtle rounded-2xl p-4">
                    <div className="text-sm font-semibold">Notes</div>
                    <p className="text-sm text-muted mt-2">
                      Draft well, manage FAAB, and get through the first stage strong — it sets you up for the chaos later.
                    </p>
                  </div>
                </div>
              </SubCard>

              <SubCard>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="h3">Leg 2 — Guillotine</h3>
                  <Pill>Weeks 9–12</Pill>
                </div>

                <p className="text-sm text-muted mt-2">
                  Week 9 starts the Guillotine phase. The <strong className="text-fg">lowest team in total points</strong> gets cut each week.
                </p>

                <div className="mt-3 bg-card-surface border border-subtle rounded-2xl p-4">
                  <ul className="text-sm text-muted space-y-2">
                    <li>
                      • After Weeks 9, 10, 11, and 12, the lowest-scoring team from <strong className="text-fg">each league</strong> must drop their roster by Tuesday night.
                    </li>
                    <li>• Waivers run Wednesday night — make your claims during this window.</li>
                  </ul>
                </div>

                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  <div className="bg-card-surface border border-subtle rounded-2xl p-4">
                    <div className="text-sm font-semibold">Roster expands (after Week 10)</div>
                    <ul className="text-sm text-muted mt-2 space-y-1.5">
                      <li>• 1 QB</li>
                      <li>• 2 RB</li>
                      <li>• 3 WR</li>
                      <li>• 1 TE</li>
                      <li>• 2 Flex</li>
                      <li>• 1 Superflex</li>
                      <li>• 10 Bench</li>
                    </ul>
                  </div>

                  <div className="bg-card-surface border border-subtle rounded-2xl p-4">
                    <div className="text-sm font-semibold">Strategy</div>
                    <p className="text-sm text-muted mt-2">
                      This is where FAAB and timing matter most. Survive the cuts, then you’re battle-ready for the bracket.
                    </p>
                  </div>
                </div>
              </SubCard>

              <SubCard>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="h3">Leg 3 — The Bracket</h3>
                  <Pill>Weeks 13–17</Pill>
                </div>

                <p className="text-sm text-muted mt-2">
                  In Week 13, the format converts to <strong className="text-fg">Best Ball</strong>.
                  Your team is now permanent — you built it through Redraft and Guillotine.
                </p>

                <div className="mt-3 bg-card-surface border border-subtle rounded-2xl p-4">
                  <div className="text-sm font-semibold">Seeding</div>
                  <p className="text-sm text-muted mt-2">
                    Managers seed each player in the God Bracket as #1–#16 based on points
                    (#1 vs #16, #2 vs #15, etc).
                  </p>
                  <p className="text-sm text-muted mt-2">
                    Update 08/28/25: Seeding will occur within the leagues (Light 1–8 vs Dark 8–1).
                  </p>
                </div>

                <p className="text-sm text-muted mt-3">
                  Your only job each week is to outscore your opponent to move on.
                  There is no reseeding — the bracket determines your opponents. Win in Week 14
                  to unlock the next payouts, and each win adds more money.
                </p>
              </SubCard>
            </div>
          </div>
        </Card>

        {/* MONEY */}
        <Card>
          <div id="money" className="space-y-3 scroll-mt-28">
            <h2 className="h2">Money & Payouts</h2>
            <p className="text-sm text-muted">
              All payouts, BONUSES, and conditional upside are fully detailed in the Cash Doc.
              Your Game Managers are available for questions — ask away, you might help us catch loose ends.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/gauntlet/cash-doc" className="btn btn-primary">
                💸 View the Gauntlet Cash Doc
              </Link>
              <Link href="/gauntlet" className="btn btn-outline">
                Back to Gauntlet
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
