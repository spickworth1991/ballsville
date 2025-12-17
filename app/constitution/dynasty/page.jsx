// app/constitution/dynasty/page.jsx
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `Dynasty Bye-Laws & Code of Conduct | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/services`;

export const metadata = {
  title: pageTitle,
  description: "Dynasty Bye-Laws & Code of Conduct for the BALLSVILLE game leagues.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description: "Dynasty Bye-Laws & Code of Conduct for the BALLSVILLE game leagues.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

const dynSections = [
  { id: "waivers", label: "Waivers" },
  { id: "trading", label: "Trading" },
  { id: "draft-picks", label: "Draft Picks" },
  { id: "activity", label: "Activity" },
  { id: "conduct", label: "Code of Conduct" },
  { id: "collusion", label: "Collusion" },
  { id: "action", label: "Action" },
  { id: "forfeiture", label: "Forfeiture of Dues" },
  { id: "closing", label: "In Closing" },
];

export default function Page() {
  return (
    <main className="min-h-screen text-fg relative">
      {/* background vibe */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      {/* Hero / Title */}
      <section className="border-b border-subtle">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-accent">
            The BALLSVILLE Game
          </p>

          <h1 className="text-3xl md:text-4xl font-extrabold text-primary">
            Dynasty Bye-Laws &amp; Code of Conduct
          </h1>

          <p className="text-sm text-muted">
            the Dragons of Dynasty &amp; the Heroes of Dynasty Bylaws
          </p>

          <p className="text-xs text-muted">
            These are Common practices for all “Westlex” leagues, specified to the BALLSVILLE game.
          </p>

          {/* meta card (fixed: stays inside the container + centered) */}
          <div className="mt-6 bg-card-surface border border-subtle rounded-2xl p-5 shadow-sm text-sm text-muted space-y-1">
            <p className="font-semibold text-fg">Amendment 2025</p>
            <p>The Heroes expansion is included here and will be added to the wagering demo.</p>
            <p>“Wagering Demos will be in your leagues”</p>
          </div>
        </div>
      </section>

      {/* TOC + Content */}
      <section className="px-4 md:px-8 py-10">
        <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] items-start">
          {/* TOC Card */}
          <aside className="space-y-4">
            <div className="bg-card-surface border border-subtle rounded-2xl p-5 shadow-sm sticky top-4">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
                Table of Contents
              </h2>

              <nav className="text-sm space-y-1">
                {dynSections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block px-3 py-2 rounded-lg text-muted hover:text-primary hover:bg-subtle-surface transition"
                  >
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="space-y-6 leading-relaxed text-sm md:text-base">
            {/* NOTE: your existing sections below are unchanged — just wrapped correctly */}
            {/* WAIVERS */}
            <section
              id="waivers"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">WAIVERS</h2>
              <p>Durring the season..</p>
              <p>Custom waivers will run @ 11:59 pm EST.</p>
              <p>On</p>
              <p>TUESDAY</p>
              <p>WEDNESDAY</p>
              <p>FRIDAY</p>
              <p>SATURDAY</p>
              <p>During the season, Free agency will be OPEN</p>
              <p>THURSDAY</p>
              <p>SUNDAY</p>
              <p>MONDAY</p>
              <p>This is to allow last minute pivots before game time.</p>
              <p>Players will still be locked until Tuesday, once they have played their weekly game.</p>
              <p>
                During the off-season we will allow open FA until the NFL draft. After that, as news breaks
                about players, we will run all waivers at 11:59 pm EST each day.
              </p>
              <p>
                This will allow all owners equal chance to utilize their annual FAAB allowance of 100 to
                acquire players.
              </p>
              <p>FAAB will not reset until the season is over.</p>
            </section>

            {/* TRADING */}
            <section
              id="trading"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">TRADING</h2>
              <p>We have No trade deadline</p>
              <p>As of 2024, trades will only be restricted:</p>
              <p>– when there is a flagged trade, with suspicion (Someone dumping their team)</p>
              <p>– While a league trade issue is actively being resolved.</p>
              <p>-While a league has unsettled dues During the off season. </p>
              <p>
                –  In April, AFTER our payment date has passed, and If I’m expecting to replace a player
              </p>
              <p>I may set a review period, until new players are settled in.</p>
              <p>(Our due date is April 1st)</p>
              <p>– ⚠️ When a player has (Unofficially) clinched a playoff spot. </p>
              <p>
                Unofficially – Once it’s obvious you’re winning the matchup to clinch, you shouldn’t be
                trading.
              </p>
              <p>Your leaguemates can hold you accountable here. </p>
              <p>
                Whenever the league is filled, paid up, and free of any alarming issues, or pending changes,
                trading will be INSTANT
              </p>
              <p>
                During  RESTRICTION, there will be a waiting period. I will review and process trades as I
                see them and verify trade eligibility.
              </p>
              <p>On occasion an owner may be under review, or penalized, and a trade may be denied. </p>
              <p>All trades will be judged by the league, this is inevitable. We all have the right to complain. </p>
              <p>
                What we do not want, is any owner calling out offers in chat to shame another owner. SHAMING
                could result in action.
              </p>
              <p>
                Receiving offers is a luxury. Appreciate the effort, accept, decline, counter or negotiate
                privately. Don’t be the one who discourages trading.
              </p>
              <p>
                On the opposite end, If you’re sending the trade…  HARASSMENT is real. Do not spam trades if
                they’re unwanted. If this is brought to my attention, there could be action.
              </p>
            </section>

          {/* Draft Picks */}
          <section
            id="draft-picks"
            className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
          >
            <h2 className="text-xl md:text-2xl font-bold text-primary">Draft picks</h2>
            <p>
              Rookie draft order is the reverse order of your vet draft  for startups, unless otherwise
              determined by your league.
            </p>
            <p>Rookie drafts after the startup year is determined by MAX POINTS</p>
            <p>
              As expected, an owner must pay dues for the year, of any future draft pick they choose to
              trade away.
            </p>
            <p>
              (I.e. to trade away your 2027 1st round rookie pick, you’ll need to make a $25 deposit into
              the leagues leaguesafe account. Mid-season accounts differ from the main account.)
            </p>
            <p>
              Dues collected this way, do count for that year’s dues, when the time comes to pay annuals on
              April 1st of each year.
            </p>
            <p>
              If a trade is processed that includes future draft picks, that owner will be given 24 hours to
              pay dues, or the trade is reversed.
            </p>
            <p>
              If an owner repeatedly tried to trade future picks and does not pay these dues, there may be
              action
            </p>
          </section>

          {/* ACTIVITY */}
          <section
            id="activity"
            className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
          >
            <h2 className="text-xl md:text-2xl font-bold text-primary">ACTIVITY</h2>
            <p>⚠️ You must be active:</p>
            <p>Every 2 weeks, minimum. During the season</p>
            <p>In early April, to pay next year’s dues, and draft rookie players. (Or vote when to draft)</p>
            <p>In June, as a checkpoint.</p>
            <p>In August to start the season. </p>
            <p>
              Once the season kicks off, Teams are expected to show activity each week. Set a full
              lineup.. respond to tags and DMs. Ect.
            </p>
            <p>Activity in chat is not a requirement, however;</p>
            <p>⚠️ YOU MUST SET YOUR LINEUP </p>
            <p>In the event that an owner fails to set his lineup;</p>
            <p>Once is bad, but it’s understandable. Things happen.</p>
            <p>
              Failing to set your lineup for 2 consecutive weeks, will be noticed and I will attempt to
              reach out. Tags and DM
            </p>
            <p>If you do not respond, you will be suspended from control of your team.</p>
            <p>You will remain in the league as a spectator for 2 more weeks.</p>
            <p>
              A substitute owner will run your team with limited roster flexibility. They will Only be able
              to make moves in order to fill out the starting lineup. (No trades)
            </p>
            <p>
              If you return, you get your team back. ⚠️ If you do not, you WILL be removed from the league
              and forfeit your dues. ⚠️
            </p>
            <p>
              That’s a month of inactivity. In dynasty, mid season, and it’s reasonably considered
              ABANDONMENT.
            </p>
            <p>
              Should this occur, and the substitute owner wins a cash prize, they will be awarded 50% of
              their winnings, and the remaining 50% will roll over to the BALLSVILLE game. for the
              following year. This substitute will have the first chance to take over the team permanently.
            </p>
            <p>
              Should the inactive owner return, they will be given their team back without penalty.
            </p>
            <p>
              (These leagues are designed to be filled with active, experienced owners. This should not be
              a factor.)
            </p>
          </section>

          {/* CODE OF CONDUCT */}
          <section
            id="conduct"
            className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
          >
            <h2 className="text-xl md:text-2xl font-bold text-primary">CODE OF CONDUCT</h2>
            <p>Fantasy football is in fact, just a game. Games are meant to be fun.</p>
            <p>Owners are free to trash talk, But there is a thick cringy line between funny and toxic.</p>
            <p>I do not tolerate topics of;</p>
            <p>RACISM</p>
            <p>SEXISM</p>
            <p>POLITICS</p>
            <p>BODY SHAMING</p>
            <p>HARASSMENT </p>
            <p>Toxicity</p>
            <p>Bullying</p>
            <p>any other demeaning behaviour that I personally find repulsive</p>
            <p>Please maintain a level of maturity and we will all be grateful.</p>
            <p>We don’t need an antagonist.</p>
            <p>I’m aware some of you may run leagues. </p>
            <p>You’re all here as players, each of these leagues must be identical.</p>
            <p>You are free to post your own leagues in actively drafting leagues. </p>
            <p>Please keep these posts out of the Hub, where chat can get flooded.</p>
            <p>Offensive behaviour will result in a warning.</p>
            <p>Repeat offenders will be removed.</p>
            <p>
              Should an owner be removed, and his team still wins the contest, that owner MAY still be
              awarded their League winnings at the end of the year. Via Leaguesafe. (The league will vote)
            </p>
            <p>
              If they vote against the player, the money will go to BALLSVILLE game.
            </p>
            <p>All money is Leaguesafe Majority rule.</p>
            <p>⚠️ All players will be expected to have read the Code of Conduct.</p>
          </section>

          {/* COLLUSION */}
          <section
            id="collusion"
            className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
          >
            <h2 className="text-xl md:text-2xl font-bold text-primary">— COLLUSION –</h2>
            <p>We all know what collusion is. </p>
            <p>An unfair trade isn’t collusion.</p>
            <p>Vetos are the worse</p>
            <p>Oftentimes, trades only seem unfair in the moment. Unfair trades do not require any action. </p>
            <p>
              “Collusion” will be determined via league polls. If a trade causes an uproar, and a poll is
              triggered by 3 owners in agreement, both sides will state their case and a poll will be
              created, with options to take action.
            </p>
            <p>
              I will also be grading suspicIous trades with the assistance of various calculators. If I
              perceive a trade that is in extreme favor to one owner, then  trades between those owners will
              be monitored. A second trade of similar value will trigger action.
            </p>
            <p>
              (Any trade where there’s a 70% (via any site) or greater gain for either side, will be tagged
              in chat. If these 2 teams repeat the process it will be seen.)
            </p>
            <p>The league or Commish may oppose trades</p>
          </section>

          {/* ACTION */}
          <section
            id="action"
            className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
          >
            <h2 className="text-xl md:text-2xl font-bold text-primary">ACTION</h2>
            <p>
              If Something causes “uproar” in the league, we will discuss it openly. Via league chat, in a
              “Court”
            </p>
            <p>Both sides are heard, and a poll may or may not be created. </p>
            <p>In the cases involving trades,</p>
            <p>If a poll is created, trading will be restricted.</p>
            <p>The poll will stand 24 hrs. </p>
            <p>Participating majority will determine the outcome of most polls. </p>
            <p>In matters of high significance we may need a league majority of 7. </p>
            <p>Commish will not vote, unless to break a tie.</p>
            <p>
              (If the trade is reversed this way both owners will have trade privileges suspended for 7
              days, between the two.
            </p>
            <p>
              Any post sequential trades involving these assets will also be reversed.)
            </p>
            <p>
              If ANY owner has a trade reversed in this manner TWICE in the season, we may vote to;
              restrict, issue a fine or remove this owner.
            </p>
            <p>All dues will be forfeited, if an owner is removed in this manner.</p>
            <p>
              Any dues or fines collected this way will go to the game and distributed at commissioner
              discretion.
            </p>
            <p>These are extreme measures. hopefully they will never be enforced. </p>
            <p>Just play fair people. </p>
          </section>

          {/* FORFEITURE OF DUES */}
          <section
            id="forfeiture"
            className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
          >
            <h2 className="text-xl md:text-2xl font-bold text-primary">FORFEITURE OF DUES</h2>
            <p>Should an existing owner;</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Leave on their own accord</li>
              <li>Be removed for inactivity</li>
              <li>Be removed for violations of our bylaws </li>
              <li>Be voted out by league majority.</li>
              <li>“Abandon”  their team. Per our bylaws.</li>
            </ul>
            <p>This owner will FORFEIT all dues.</p>
            <p>
              (If this owner leaves for good cause, or if the league decides so, that owner may be refunded,
              or given a credit for this or an alternative westlex league.)
            </p>
            <p>
              Any forfeited dues will be added to the leagues account for future winnings. These funds will
              be distributed as the league sees fit.
            </p>
            <p>Any new coming owner will then pay for the current, and proceeding year upon entry.</p>
            <p>(Reiteration)</p>
            <p>
              *Rebuilds – incoming Players are allowed the Option to pay 1x for the following year, and take a
              year to rebuild an orphan rosters.
            </p>
            <p>*Rebuilds – are ineligible to win cash </p>
          </section>

          {/* IN CLOSING */}
          <section
            id="closing"
            className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
          >
            <h2 className="text-xl md:text-2xl font-bold text-primary">– IN CLOSING –</h2>
            <p>
              We are all held accountable for knowing and understanding there’s byelaws, including myself.
            </p>
            <p>Please check for pinned messages OFTEN.</p>
            <p>It’s a big game, so help keep everyone informed, by doing your part.</p>
            <p>If you notice inactivity, please notify  the commissioner.</p>
            <p>Keep yourself informed</p>
            <p>Answer tags and messages.</p>
            <p>Try not to aggravate others.</p>
            <p>
              Be fair with trades and utilize the trade block to give owners fair opportunities and maximize
              your players’ value.
            </p>
            <p>And please use calculator websites to help if you’re uncertain about trades</p>
            <p>That is all for now. Thanks and good luck</p>
          </section>
        </div>
        </div>
      </section>
    </main>
  );
}
