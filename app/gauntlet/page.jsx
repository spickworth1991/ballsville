// src/app/gauntlet/page.jsx
import Link from "next/link";

function Card({ children, id }) {
  return (
    <section
      id={id}
      className="scroll-mt-28 bg-card-surface border border-subtle shadow-md rounded-2xl p-6 md:p-8"
    >
      {children}
    </section>
  );
}

function SubCard({ children, className = "" }) {
  return (
    <div className={`bg-subtle-surface border border-subtle rounded-2xl p-5 md:p-6 ${className}`}>
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="rounded-full border border-subtle bg-card-surface px-3 py-1 text-[11px] font-semibold text-fg">
      {children}
    </span>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.25em] text-muted">{label}</div>
      <div className="mt-1 font-semibold text-fg">{value}</div>
    </div>
  );
}

const listClass = "mt-3 space-y-2 text-sm text-muted leading-relaxed list-disc pl-5";

export default function GauntletPage() {
  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card-surface shadow-2xl shadow-black/40 p-6 md:p-10">
          <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            <div className="opacity-50 absolute -top-24 -left-5 h-56 w-56 rounded-full bg-green-500/50 blur-3xl" />
            <div className="opacity-50 absolute -top-24 -right-5 h-56 w-56 rounded-full bg-purple-500/50 blur-3xl" />
            <div className="opacity-65 absolute -bottom-24 -right-5 h-56 w-64 rounded-full bg-orange-400/40 blur-3xl" />
            <div className="opacity-55 absolute -bottom-24 -left-7 h-56 w-56 rounded-full bg-red-500/50 blur-3xl" />
            <div className="opacity-30 absolute left-1/2 top-1/2 h-56 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/50 blur-3xl" />
          </div>

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:items-start">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">THE BALLSVILLE GAME #5</p>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                The <span className="text-primary">GAUNTLET</span> Game
              </h1>

              <p className="text-sm sm:text-base text-muted max-w-prose">
                A 2026, 14-team challenge that evolves through Redraft, Pirate, Guillotine,
                Playoffs, and a custom Week 17 Championship.
              </p>

              <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                <Pill>$20 buy-in</Pill>
                <Pill>14 teams</Pill>
                <Pill>Five trials</Pill>
                <Pill>Weeks 1–17</Pill>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <a href="#opening-phase" className="btn btn-primary">
                  Opening Rules
                </a>
                <a href="#trials" className="btn btn-outline">
                  View All Trials
                </a>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                <Stat label="Buy-in" value="$20" />
                <Stat label="Season FAAB" value="$250" />
                <Stat label="Rosters Chopped" value="8" />
                <Stat label="Max Upside" value="$2,450" />
              </div>
            </div>

            <div className="space-y-4 py-4">
              <div className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm overflow-hidden shadow-xl shadow-black/40">
                <div className="px-4 py-3 border-b border-border/60">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    2026 GAME FORMAT
                  </span>
                  <span className="block text-[11px] text-muted">
                    Build, survive, adapt, then decide how much to wager.
                  </span>
                </div>

                <ol className="p-5 sm:p-6 space-y-3 text-sm">
                  <li className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-fg">Trial 1 · Redraft</span>
                    <span className="text-muted">Weeks 1–5</span>
                  </li>
                  <li className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-fg">Trial 2 · Pirate</span>
                    <span className="text-muted">Weeks 6–10</span>
                  </li>
                  <li className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-fg">Trial 3 · Guillotine</span>
                    <span className="text-muted">Weeks 11–14</span>
                  </li>
                  <li className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-fg">Trial 4 · Playoffs</span>
                    <span className="text-muted">Weeks 15–16</span>
                  </li>
                  <li className="flex items-center justify-between gap-4 border-t border-border/60 pt-3">
                    <span className="font-semibold text-primary">Trial 5 · Championship</span>
                    <span className="text-muted">Week 17</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </header>

        <Card id="opening-phase">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">OPENING PHASE · PRE-DRAFT</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
              Build the Team You’ll Carry Through the Game
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed max-w-3xl">
              Rosters stay constant through every phase, with one six-spot bench expansion after Week 10.
              Trades are intentionally restricted, and the same $250 FAAB budget must last all season.
            </p>
          </header>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">The Cash</div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Buy-in</dt><dd className="font-semibold">$20</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Players</dt><dd className="font-semibold">14</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Total collected</dt><dd className="font-semibold">$280</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">League payout</dt><dd className="font-semibold">$210</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Game payout</dt><dd className="font-semibold">$600</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Game collects</dt><dd className="font-semibold">$240</dd></div>
              </dl>
              <p className="mt-4 text-xs text-muted leading-relaxed">
                The game balance is itemized in the semi-annual Cash Doc. Expenses include free cash
                mini-games, free entries, and other BALLSVILLE extras.
              </p>
            </SubCard>

            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">Constant Roster</div>
              <ul className={listClass}>
                <li>QB &amp; Superflex</li>
                <li>2 RB</li>
                <li>3 WR</li>
                <li>Tri-Flex</li>
                <li>6 bench</li>
                <li>2 IR</li>
              </ul>
              <div className="mt-4 rounded-xl border border-subtle bg-card-surface p-3 text-xs text-muted leading-relaxed">
                <span className="font-semibold text-fg">Bench expansion:</span> Six additional bench spots,
                executed first thing Tuesday after Week 10.  11/11/2026.
              </div>
            </SubCard>

            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">Scoring &amp; Draft</div>
              <ul className={listClass}>
                <li>+6 points per passing TD</li>
                <li>-2 points per interception</li>
                <li>League median</li>
                <li>Snake draft with no third-round reversal</li>
                <li>Three shuffles unless otherwise specified</li>
                <li>Drafts begin as soon as possible</li>
                <li>Draft timers default to four hours but may vary</li>
              </ul>
            </SubCard>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SubCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-primary">Trade Rules</h3>
                <Pill>Heavily restricted</Pill>
              </div>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                This game is built around struggle. Trades are restricted so no advantage can be gained
                through friends or weaker players.
              </p>
              <ul className={listClass}>
                <li>No draft trading.</li>
                <li>No FAAB trades.</li>
                <li>Every trade will be heavily scrutinized.</li>
                <li>
                  Trades must fall within a <span className="font-semibold text-fg">30%–70% value balance</span>{" "}
                  according to a popular trade calculator or the BALLSVILLE website.
                </li>
                <li>
                  If you cannot provide a site showing that balance, the trade is eligible for automatic
                  reversal without a league vote.
                </li>
              </ul>
              <div className="mt-4 rounded-xl border border-orange-400/40 bg-orange-400/10 p-4 text-sm text-muted leading-relaxed">
                <span className="font-semibold text-fg">Important:</span> If an ineligible traded player’s game
                begins, that player will be removed from your roster and you are responsible for filling the spot. Keep trades fair and this will not affect gameplay.
                 <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">This practice is a Safeguard for the games integrity. 
                  As harsh as this rule seems, we find it necessary for this particular game.</dt></div>
                
              </dl>
              
              </div>
            </SubCard>

            <SubCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-primary">Waivers &amp; Chops</h3>
                <Pill>$250 for the full season</Pill>
              </div>
              <ul className={listClass}>
                <li>Waivers clear Wednesday at 12:00 p.m. EST.</li>
                <li>Team cuts happen by Tuesday morning, giving players 24 hours to make claims.</li>
                <li>Your $250 FAAB does not reset.</li>
                <li>Eight total rosters will be chopped over six cut weeks: after Weeks 5, 10, 11, 12, 13, and 14.</li>
              </ul>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                Spend carefully. Every chopped roster is dumped to waivers, and your one FAAB budget has to
                survive the entire game.
              </p>
            </SubCard>
          </div>
        </Card>

        <Card id="trials">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">THE FIVE TRIALS</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
              The Format Changes as the Field Shrinks
            </h2>
            <p className="text-sm sm:text-base text-muted leading-relaxed max-w-3xl">
              Each trial tests something different: drafting, lineup strategy, roster theft, FAAB discipline,
              weekly survival, Best Ball depth, and finally your willingness to wager what you won.
            </p>
          </header>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SubCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs tracking-widest text-muted uppercase">TRIAL 1</div>
                  <h3 className="mt-1 text-lg font-semibold text-primary">Redraft</h3>
                </div>
                <Pill>Weeks 1–5</Pill>
              </div>
              <ul className={listClass}>
                <li>Five weeks of standard Redraft play.</li>
                <li>League median scoring.</li>
                <li>Start 11.</li>
                <li>After Week 5, the bottom two teams in the standings are chopped.</li>
                <li>Their rosters are dumped to waivers and the owners remain as spectators only.</li>
              </ul>
              <p className="mt-4 text-xs text-muted leading-relaxed">
                Teams eliminated during the Playoff trial are not chopped, and their rosters do not dump.
                During Weeks 6–10, the schedule will be adjusted for players who would otherwise face an
                eliminated opponent.
              </p>

              <div className="mt-4 rounded-xl border border-orange-400/40 bg-orange-400/10 p-4 text-sm text-muted leading-relaxed">
                <span className="font-semibold text-fg">Strategy Note:</span> There will be SIX weeks of CHOPPED teams, after week 5, 10, and 11-14. You need to use FAAB wisely. 
              </div>
            </SubCard>

            <SubCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs tracking-widest text-muted uppercase">TRIAL 2</div>
                  <h3 className="mt-1 text-lg font-semibold text-primary">Pirate</h3>
                </div>
                <Pill>Weeks 6–10</Pill>
              </div>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Beat your opponent and choose one of two rewards: <span className="font-semibold text-fg">Plunder</span>{" "}
                a player or <span className="font-semibold text-fg">Pilfer</span> part of their FAAB.
              </p>

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-subtle bg-card-surface p-4">
                  <div className="text-sm font-semibold text-fg">PLUNDER · Take an Asset</div>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted leading-relaxed list-disc pl-4">
                    <li>Swap a player from your starting lineup for any player on the loser’s roster.</li>
                    <li>The swap must use the same skill position.</li>
                    <li>The losing team has no player locks.</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-subtle bg-card-surface p-4">
                  <div className="text-sm font-semibold text-fg">PILFER · Take the Treasure</div>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted leading-relaxed list-disc pl-4">
                    <li>Steal 25% of the loser’s current FAAB.</li>
                    <li>The amount is rounded up to the nearest whole number.</li>
                  </ul>
                </div>
              </div>

              <ul className={listClass}>
                <li>The matchup winner sends the offer, and the loser must accept by Tuesday evening.</li>
                <li>If it is not accepted, tag WESTLEX or a Game Manager with the details so it can be forced.</li>
                <li>After Week 10, the bottom two teams in the standings are chopped, leaving ten teams.</li>
              </ul>
              <p className="mt-4 text-xs text-muted leading-relaxed">
                Strategy note: If you are locked into a win, you may substitute a bench player into your lineup
                to make that player eligible to swap. This can also help navigate late bye weeks.
              </p>
            </SubCard>

            <SubCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs tracking-widest text-muted uppercase">TRIAL 3</div>
                  <h3 className="mt-1 text-lg font-semibold text-primary">Guillotine</h3>
                </div>
                <Pill>Weeks 11–14</Pill>
              </div>
              <ul className={listClass}>
                <li>Trades are disabled after Week 10.</li>
                <li>Six additional bench spots are added.</li>
                <li>Head-to-head matchups no longer matter; the game switches to weekly points.</li>
                <li>The lowest-scoring team each week is chopped.</li>
                <li>Chops happen after Weeks 11, 12, 13, and 14.</li>
                <li>Teams are dropped Tuesday and waivers run Wednesday.</li>
              </ul>
              <div className="mt-4 rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-muted">
                <span className="font-semibold text-fg">One bad week ends your season.</span>
              </div>
            </SubCard>

            <SubCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs tracking-widest text-muted uppercase">TRIAL 4</div>
                  <h3 className="mt-1 text-lg font-semibold text-primary">Playoffs</h3>
                </div>
                <Pill>Weeks 15–16</Pill>
              </div>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Best Ball activates after Week 14. Waivers continue, and you can still manage your roster,
                but you no longer need to set a lineup.
              </p>

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-subtle bg-card-surface p-4">
                  <div className="text-sm font-semibold text-fg">Week 15</div>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted leading-relaxed list-disc pl-4">
                    <li>Six teams enter the Playoff trial.</li>
                    <li>The bottom three in weekly points are eliminated.</li>
                    <li>Their rosters are not chopped.</li>
                    <li>The top three advance and bank $20.</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-subtle bg-card-surface p-4">
                  <div className="text-sm font-semibold text-fg">Week 16</div>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted leading-relaxed list-disc pl-4">
                    <li>The remaining three teams play the week.</li>
                    <li>The bottom two are eliminated.</li>
                    <li>The highest Week 16 score becomes League Winner.</li>
                    <li>The winner receives $150 to bank or wager in three $50 increments.</li>
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted leading-relaxed">
                Game Managers will enter the league and ask the winner how much they want to keep and how much
                they want to play in the Championship.
              </p>
            </SubCard>
          </div>
        </Card>

        <Card id="championship">
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-muted">TRIAL 5 · WEEK 17</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
                “The BALLSVILLE Game” Custom Championship
              </h2>
              <p className="mt-2 text-sm sm:text-base text-muted leading-relaxed max-w-3xl">
                Up to 12 League Winners may enter. Each winner chooses how much of their League winnings to
                bank and how much to wager across the three Championship pots.
              </p>
            </div>
            <Pill>$600 Main Pot Bonus</Pill>
          </header>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
            <SubCard>
              <h3 className="text-lg font-semibold text-primary">Choose Your Wager</h3>
              <ul className={listClass}>
                <li>Wager $50, $100, or $150 from your League winnings.</li>
                <li>Bank everything you do not wager.</li>
                <li>All $50 wagers places one $50 coin in the Main Pot.</li>
                <li>A $100 wager places one $50 coin in the Main Pot and one $50 coin in Side Pot 1.</li>
                <li>A $150 wager places one $50 coin in the Main Pot and one $50 coin in Side Pot 1 and one $50 coin in Side Pot 2.</li>
                <li>You must be entered in a pot to win it.</li>
              </ul>
              <p className="mt-4 text-xs text-muted leading-relaxed">
                Example: A $50 wager can win the Main Pot but cannot win either Side Pot.
              </p>
            </SubCard>

            <SubCard>
              <h3 className="text-lg font-semibold text-primary">Championship Pots</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.2em] text-muted border-b border-subtle">
                      <th className="py-3 pr-4 text-left font-semibold">Pot</th>
                      <th className="py-3 px-4 text-left font-semibold">Funded By</th>
                      <th className="py-3 pl-4 text-left font-semibold">Awarded To</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-subtle">
                      <td className="py-3 pr-4 font-medium">Main Pot 🏆</td>
                      <td className="py-3 px-4 text-muted">$50 × all entrants + $600 bonus</td>
                      <td className="py-3 pl-4">Main Pot winner</td>
                    </tr>
                    <tr className="border-b border-subtle">
                      <td className="py-3 pr-4 font-medium">Side Pot 1</td>
                      <td className="py-3 px-4 text-muted">$50 × all $100/$150 entrants</td>
                      <td className="py-3 pl-4">Side Pot 1 winner</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-medium">Side Pot 2</td>
                      <td className="py-3 px-4 text-muted">$50 × all $150 entrants</td>
                      <td className="py-3 pl-4">Side Pot 2 winner</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-muted">
                The number of coins in each pot depends on how many League Winners choose that wager level.
              </p>
            </SubCard>
          </div>
        </Card>

        <Card id="closing-phase">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">CLOSING PHASE</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
              Tracking, Verification &amp; Payouts
            </h2>
          </header>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">Scoreboard</div>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Follow the Gauntlet scoreboard for full-game tracking and stacked winnings.
              </p>
              <a
                href="https://docs.google.com/spreadsheets/d/1UuAI4mNQtcnnZZiYyybfIGoczFCZRvuhTzXqk-h2RLQ/edit?usp=drivesdk"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline underline-offset-4"
              >
                Open Gauntlet Scoreboard →
              </a>
            </SubCard>

            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">Verification</div>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Winning leagues will be opened so players can verify results firsthand. The spreadsheet will
                remain available for review, and unknown LeagueSafe names will be verified before allocation.
              </p>
            </SubCard>

            <SubCard>
              <div className="text-xs tracking-widest text-muted uppercase">Payouts</div>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Payouts will be assigned promptly after the game ends. They will be allocated and submitted in
                each league for review after results and player names are verified.
              </p>
            </SubCard>
          </div>

          <div className="mt-6 rounded-2xl border border-border/60 bg-card-trans p-5 md:p-6">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <h3 className="text-lg font-semibold text-fg">The BALLSVILLE Game #5</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed max-w-3xl">
                  BALLSVILLE has six games—one for each year it has been around. The Gauntlet is designed to be
                  the most challenging game in the BALLSVILLE universe, with a maximum possible upside
                  of $2,450 and 3-in-14 odds to win a prize.
                </p>
                <p className="mt-2 text-sm text-muted leading-relaxed max-w-3xl">
                  If the game does not reach its 12-league goal, the Championship prize will decrease. If it
                  exceeds the goal, the prize will grow and a second-place award will be added to preserve strong odds.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link prefetch={false} href="/constitution" className="btn btn-outline">
                  Bylaws &amp; Code of Conduct
                </Link>
                <a href="#opening-phase" className="btn btn-primary">
                  Back to Rules
                </a>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted text-center">
            Players are responsible for reading all BALLSVILLE bylaws and the Code of Conduct.
          </p>

          <p className="mt-6 text-center text-sm font-semibold text-fg">
            Thank you for reading, and good luck in there.
          </p>
        </Card>
      </div>
    </main>
  );
}
