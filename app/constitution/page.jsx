// app/constitution/page.jsx
import Image from "next/image";
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `League Constitution | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/constitution`;

export const metadata = {
  title: pageTitle,
  description:
    "Core constitution, code of conduct, and governance framework for all BALLSVILLE / Westlex fantasy leagues.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description:
      "Core constitution, code of conduct, and governance framework for all BALLSVILLE / Westlex fantasy leagues.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

const sections = [
  { id: "section-1", label: "1. League Governance" },
  { id: "section-2", label: "2. League Formats & Rosters" },
  { id: "section-3", label: "3. Transactions (Where Applicable)" },
  { id: "section-4", label: "4. Drafts & Player Acquisition" },
  { id: "section-5", label: "5. Scoring & Results" },
  { id: "section-6", label: "6. Postseason & Tiebreakers" },
  { id: "section-7", label: "7. Code of Conduct & Fair Play" },
  { id: "section-8", label: "8. Replacing Managers" },
  { id: "section-9", label: "9. League Finances" },
  { id: "section-10", label: "10. Amendments & Disputes" },
];

export default function Page() {
  return (
    <main className="min-h-screen text-fg relative">
      {/* background vibe */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      {/* Hero */}
      <section className="border-b border-subtle">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-accent">
            The BALLSVILLE Game
          </p>

          <h1 className="text-3xl md:text-4xl font-extrabold text-primary flex items-center justify-center gap-3 flex-wrap">
            League Code of Conduct
            <Image
              src="/photos/bylaws.webp"
              alt="BALLSVILLE game & code of conduct rulebook"
              width={120}
              height={80}
              className="inline-block mb-1 rounded-md"
              priority
            />
          </h1>

          <p className="text-sm md:text-base text-muted max-w-2xl mx-auto">
            This Constitution defines the core rules, protections, and expectations
            that apply across all BALLSVILLE / Westlex fantasy league formats —
            including dynasty, redraft, best ball, tournaments, and custom leagues.
          </p>

          <p className="text-[11px] text-muted max-w-3xl mx-auto leading-snug">
            <strong>Scope &amp; Applicability.</strong> Not every section will apply
            to every league. Some formats may disable trading, waivers, FAAB, or
            certain playoff structures. In those cases, the platform settings and
            a league’s specific bylaws / addendum take priority, and the relevant
            parts of this Constitution are considered{" "}
            <span className="italic">“where applicable.”</span>
          </p>

          <p className="text-xs text-muted">
            Individual league pages may add format-specific bylaws, but may not
            override the spirit of this document without clear, written approval.
          </p>
        </div>
      </section>

      {/* Main layout */}
      <section className="px-4 md:px-8 py-10">
        <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] items-start">
          {/* TOC Card */}
          <aside className="space-y-4">
            <div className="bg-card-surface border border-subtle rounded-2xl p-5 shadow-sm sticky top-4">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
                Table of Contents
              </h2>

              <nav className="space-y-2 text-sm">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-lg px-3 py-2 text-left text-muted hover:text-accent hover:bg-subtle-surface transition"
                  >
                    {s.label}
                  </a>
                ))}
              </nav>

              <p className="mt-4 text-[11px] text-muted leading-snug">
                Use this Constitution as the baseline. Each league’s{" "}
                <span className="font-semibold">League Info</span> page and any
                posted bylaws will clarify which options are enabled (trades, FAAB,
                best ball rules, etc.) for that specific league.
              </p>
            </div>
          </aside>

          {/* Content Cards */}
          <div className="space-y-6 leading-relaxed text-sm md:text-base">
            {/* (your sections unchanged below) */}
            {/* Section 1 */}
            <section
              id="section-1"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                1. League Governance
              </h2>
              <p>
                1.1 <strong>Commissioner Role.</strong> Each league will have one or
                more Commissioners (“Commish”) responsible for administering
                settings, enforcing rules, resolving disputes, and preserving the
                competitive integrity of the league, regardless of format.
              </p>
              <p>
                1.2 <strong>League Owners.</strong> Each team is controlled by one
                manager (with optional co-managers where permitted). All managers
                are expected to read and understand this Constitution and any
                league-specific addenda before the season begins.
              </p>
              <p>
                1.3 <strong>Authority &amp; Discretion.</strong> The Commish has
                final say on interpreting ambiguous situations, applying penalties,
                and making emergency adjustments when the platform, NFL schedule, or
                unforeseen events would otherwise cause league-breaking issues.
                Wherever possible, major decisions will be discussed in league chat
                and/or put to a vote.
              </p>
              <p>
                1.4 <strong>Voting.</strong> Unless otherwise specified, league
                votes are decided by a simple majority of active, non-suspended
                managers. Some topics (e.g. buying out a manager, raising dues) may
                require a higher threshold, as described later in this document or
                in league-specific bylaws.
              </p>
              <p>
                1.5 <strong>Platform of Record.</strong> The Sleeper app (or other
                specified host platform) is the primary system of record for
                rosters, scores, and transactions. In the rare case where the app’s
                behavior clearly conflicts with this Constitution, the Commish may
                manually correct results in a reasonable manner.
              </p>
            </section>

            {/* Section 2 */}
            <section
              id="section-2"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                2. League Formats &amp; Rosters
              </h2>
              <p>
                2.1 <strong>Supported Formats.</strong> BALLSVILLE / Westlex leagues
                may include redraft, dynasty, best ball, multi-copy, tournaments,
                and other custom structures. Each league’s specific format
                (including year-over-year carryover of players, picks, or standings)
                will be documented on that league’s info page or bylaws.
              </p>
              <p>
                2.2 <strong>Roster Breakdown.</strong> Default roster size,
                positional requirements, and IR / Taxi / Bench spots will be defined
                per league. Managers must always comply with roster limits set in
                the app and may be required to drop players to become
                roster-compliant.
              </p>
              <p>
                2.3 <strong>Position Eligibility.</strong> A player’s eligible
                positions are determined by the host platform. The Commish will
                generally not override position designations unless there is a clear
                platform error that materially impacts the league.
              </p>
              <p>
                2.4 <strong>Lineup Responsibility (Where Applicable).</strong> In
                formats where managers set lineups (e.g. redraft, dynasty, most
                custom leagues), managers must make a good-faith effort to set a
                valid lineup every week, using available players who are active and
                not on bye. In best ball formats where lineups are optimized
                automatically, this responsibility is limited to maintaining a legal
                roster.
              </p>
              <p>
                2.5 <strong>IR / Injury / Suspension.</strong> Use of IR / NFI / PUP
                / suspension / COVID or similar slots must follow the platform’s
                eligibility rules. Stashing ineligible players in these slots for
                roster advantage is prohibited and may be corrected by the Commish,
                regardless of format.
              </p>
              <p>
                2.6 <strong>Identical Rules Across Linked Leagues.</strong> Where
                leagues share a common tournament or hub (e.g. BIG Game divisions),
                scoring and roster settings are expected to be identical unless
                clearly stated otherwise in advance.
              </p>
            </section>

            {/* Section 3 */}
            <section
              id="section-3"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                3. Transactions (Where Applicable)
              </h2>
              <p>
                <em>
                  This section applies in leagues where trades, waivers, FAAB, or
                  in-season pickups are enabled. In formats that disable one or more
                  of these features (e.g. locked best ball tournaments), those items
                  are simply not in effect.
                </em>
              </p>
              <p>
                3.1 <strong>Trades Encouraged (If Enabled).</strong> In leagues
                where trading is turned on, trades are a core part of the game and
                are encouraged. Trades may include players, draft picks, and (where
                enabled) FAAB or other approved assets. Real-life cash or favors
                outside the league are strictly prohibited.
              </p>
              <p>
                3.2 <strong>Trade Process.</strong> The league will use either
                instant-processing trades or a short review period, based on
                settings announced before the season. The Commish reserves the right
                to temporarily pause trading during investigations, ownership
                changes, or off-season restructuring.
              </p>
              <p>
                3.3 <strong>Collusion &amp; Lending.</strong> Trades that involve
                collusion, “loaning” players with the expectation of returning them,
                or obvious manipulation of league outcomes may be reversed, and the
                managers involved may face penalties up to removal. See Section 7
                (Code of Conduct) for more detail.
              </p>
              <p>
                3.4 <strong>Waivers / FAAB (If Enabled).</strong> In leagues that
                use waivers or FAAB, the type of system (rolling, FAAB-based, or
                hybrid), processing days, and free-agency windows will be clearly
                posted before the season. Managers are responsible for understanding
                the waiver schedule in their specific league.
              </p>
              <p>
                3.5 <strong>Drops &amp; Locking.</strong> Dropped players may be
                subject to a temporary lock or waiver period as defined by league
                settings. Intentionally “churning” players (adding/dropping
                repeatedly just to block access) may be treated as misconduct,
                especially in formats with FAAB or limited transaction windows.
              </p>
            </section>

            {/* Section 4 */}
            <section
              id="section-4"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                4. Drafts &amp; Player Acquisition
              </h2>
              <p>
                4.1 <strong>Startup &amp; Seasonal Drafts.</strong> Each league’s
                startup draft and any seasonal drafts (redraft, best ball, etc.)
                will have a published structure (snake, auction, 3rd-round reversal,
                slow draft, etc.) and timer length. Draft orders and tie-breakers
                will be announced before the draft begins.
              </p>
              <p>
                4.2 <strong>Rookie &amp; Supplemental Drafts (If Used).</strong>{" "}
                Dynasty or keeper leagues may include rookie or supplemental drafts.
                Orders may be based on standings, potential points / Max PF, toilet
                bowl results, or other systems as defined in that league’s bylaws.
              </p>
              <p>
                4.3 <strong>Draft Day Trades.</strong> Where the platform allows,
                draft picks may be traded, subject to any limits on how many years
                ahead can be traded and any requirement that future dues are prepaid
                before moving future picks.
              </p>
              <p>
                4.4 <strong>Extenuating Circumstances.</strong> If the NFL postpones
                or cancels games, or the host platform fails to handle the draft or
                player pool correctly, the Commish may pause drafts, adjust timers,
                or manually assign fair outcomes in a way that preserves competitive
                balance for that league’s format.
              </p>
            </section>

            {/* Section 5 */}
            <section
              id="section-5"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                5. Scoring &amp; Results
              </h2>
              <p>
                5.1 <strong>Scoring Settings.</strong> Each league’s exact scoring
                settings (PPR, bonuses, first downs, return yards, best ball
                optimization, etc.) will be posted in the host platform and/or on
                that league’s info page. Those settings are considered part of this
                Constitution for that league.
              </p>
              <p>
                5.2 <strong>Stat Corrections.</strong> Official NFL stat changes
                applied by the platform within its correction window will stand,
                even if they alter prior matchup outcomes. Once the platform’s
                correction window is closed, results are final unless there is a
                clear technical error.
              </p>
              <p>
                5.3 <strong>Manual Adjustments.</strong> In the event of partial
                games, cancellations, or platform outages, the Commish may manually
                adjust scores using a transparent method (e.g. seasonal average
                points per game) applied consistently to all affected managers in
                that league.
              </p>
            </section>

            {/* Section 6 */}
            <section
              id="section-6"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                6. Postseason &amp; Tiebreakers
              </h2>
              <p>
                6.1 <strong>Playoff Structure.</strong> Each league will define how
                many teams make the playoffs, which weeks are used, whether it’s
                head-to-head, total points, best ball, or tournament style, and
                whether there are consolation brackets or toilet bowls. This
                structure must be set before Week 1 and should not change mid-season
                except for extreme NFL scheduling changes.
              </p>
              <p>
                6.2 <strong>Seeding.</strong> Typical ordering will be by record,
                then points for, then additional tie-breakers such as head-to-head
                record or points against. The exact order of tiebreakers will be
                posted on the league info page or bylaws.
              </p>
              <p>
                6.3 <strong>Prizes &amp; Side Pots.</strong> Cash payouts and side
                games (e.g. weekly high score, median win bonuses, survivor pools,
                multi-league tournaments) must be clearly documented before the
                season. All prize structures are subject to the financial rules in
                Section 9.
              </p>
            </section>

            {/* Section 7 – merged Code of Conduct */}
            <section
              id="section-7"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                7. Code of Conduct &amp; Fair Play
              </h2>
              <p>
                7.1 <strong>Fantasy Is Just a Game.</strong> The BALLSVILLE game is
                meant to be <strong>fun, safe, and fair</strong>. You are here as a
                player first. Everyone is expected to compete hard while still
                treating other managers like real people on the other side of the
                screen.
              </p>
              <p>
                7.2 <strong>Trash Talk vs. Toxicity.</strong> Owners are free to
                joke and talk trash. However, there is a very clear line between
                funny and toxic. Harassment, bullying, stalking, or deliberately
                trying to make other managers uncomfortable is not allowed in any
                league chat, hub, or DM related to our game.
              </p>
              <p>
                7.3 <strong>Zero-Tolerance Topics.</strong> The following are not
                tolerated in team names, avatars, chats, DMs, or posted images:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Racism or hate speech based on race or ethnicity</li>
                <li>Sexism or gender-based harassment</li>
                <li>
                  Attacks on sexuality, gender identity, or expression (homophobia,
                  transphobia, etc.)
                </li>
                <li>Body shaming or mocking someone’s appearance or health</li>
                <li>Targeted harassment, doxxing, or real-world threats</li>
                <li>
                  Any other demeaning behavior that the Commish reasonably finds
                  repulsive or unsafe
                </li>
              </ul>
              <p>
                7.4 <strong>Politics &amp; Off-Topic Fighting.</strong> Political
                debates and other high-conflict topics are strongly discouraged in
                league spaces. If conversations become divisive or derail the league
                environment, the Commish may delete messages, redirect the
                conversation, or mute participants.
              </p>
              <p>
                7.5 <strong>Community Hubs &amp; Self-Promotion.</strong> Many
                managers run their own leagues. You may share other leagues or
                opportunities in the appropriate channels (e.g. “actively drafting”
                or designated hub spaces) when those exist. Spamming links, poaching
                managers from active BALLSVILLE leagues, or derailing chats with
                promotions is not allowed.
              </p>
              <p>
                7.6 <strong>Collusion, Tanking, &amp; Sabotage.</strong> Any attempt
                by one or more managers to manipulate outcomes in a way that does
                not reflect an honest attempt to improve their own team (gifting
                players, “loaning” studs, coordinated tanking, or sabotage of
                leagues or hubs) is prohibited. Penalties may include trade
                reversal, loss of picks, expulsion from current and future leagues,
                and reporting to the host platform.
              </p>
              <p>
                7.7 <strong>Multi-Accounting &amp; Ban Evasion.</strong> Using
                multiple Sleeper accounts to evade bans, join the same contest under
                different aliases, or otherwise game the system may lead to removal
                from all BALLSVILLE-related leagues and hubs. Prior attempts to
                sabotage the game have resulted in permanent bans across multiple
                accounts.
              </p>
              <p>
                7.8 <strong>Reporting Issues.</strong> If you feel harassed, see
                hateful content, or notice behavior that could damage the league,
                contact a Commish or manager directly with screenshots. Public
                “call-out” campaigns are discouraged; the goal is to quietly fix the
                problem and protect everyone involved.
              </p>
              <p>
                7.9 <strong>Hubs Are Optional.</strong> Divisional hubs, Discord
                servers, and the “Main Hub” are optional community spaces for active
                and reliable players. No one is required to join, and not every
                manager will be invited to every hub. Removal from hubs may be part
                of the response to conduct issues.
              </p>
            </section>

            {/* Section 8 */}
            <section
              id="section-8"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                8. Replacing Managers
              </h2>
              <p>
                8.1 <strong>Grounds for Removal.</strong> Managers may be removed
                for repeated inactivity, confirmed collusion, non-payment of dues,
                or behavior that seriously damages the league experience. Removal is
                considered a last resort, but the Commish is empowered to act when
                needed to protect the league.
              </p>
              <p>
                8.2 <strong>Process.</strong> When possible, the Commish will warn
                the manager privately first. If issues persist, the Commish may call
                for a vote of the remaining managers. A simple majority or specified
                super-majority (e.g. 2/3) may be required depending on the severity
                of the situation and the league’s bylaws.
              </p>
              <p>
                8.3 <strong>Replacement Managers.</strong> When a team becomes
                orphaned, the Commish will seek a replacement manager who understands
                the format and is able to commit for the appropriate term (especially
                in dynasty). Entry terms, discounts, or rebuild clauses may be
                offered and will be clearly communicated to both the league and
                incoming manager.
              </p>
              <p>
                8.4 <strong>Forfeiture of Dues.</strong> Managers removed for cause
                or who abandon their team may forfeit part or all of their dues,
                which may be added to league prizes or rolled into the next season at
                the Commish’s discretion and/or league vote, consistent with posted
                bylaws.
              </p>
            </section>

            {/* Section 9 */}
            <section
              id="section-9"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                9. League Finances
              </h2>
              <p>
                9.1 <strong>Dues &amp; Payment.</strong> Each league will publish its
                buy-in amount (if any), payment deadline, and payment platform (e.g.
                LeagueSafe, potless/for-fun, tournament credit). All managers in a
                paid league must be paid in full by the posted deadline, or their
                spot may be offered to a replacement.
              </p>
              <p>
                9.2 <strong>Payouts.</strong> Payout structures (1st, 2nd, 3rd, side
                pots, tournament bonuses, etc.) will be published before the season
                and should not change mid-year except by majority vote in response to
                extreme circumstances.
              </p>
              <p>
                9.3 <strong>Fines &amp; Credits.</strong> Late-payment penalties,
                forfeited dues, or disciplinary fines may be added to the prize pool,
                rolled over to a future season, or used for league enhancements
                (e.g. trophies, graphics), as decided by the Commish and/or league
                vote and stated transparently.
              </p>
              <p>
                9.4 <strong>Transparency.</strong> Where a third-party platform like
                LeagueSafe is used, all managers will have visibility into the funds
                and payout approvals, in accordance with that platform’s rules.
              </p>
              <p>
                9.5 <strong>Mid-Season Refunds &amp; Abandonment.</strong> If a
                manager in a paid league requests or receives a mid-season refund and
                abandons their team, the BALLSVILLE game may:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Absorb that entry into the overall prize structure, and/or</li>
                <li>
                  Take control of the orphaned roster to protect the integrity of
                  the league, and/or
                </li>
                <li>
                  Reroll or restructure the league or division, if multiple exits
                  make the format unfair.
                </li>
              </ul>
              <p>
                Exact handling will be communicated clearly for each contest, but the
                guiding principle is always protecting the competitive balance and
                the players who stayed committed.
              </p>
            </section>

            {/* Section 10 */}
            <section
              id="section-10"
              className="bg-card-surface border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                10. Amendments &amp; Disputes
              </h2>
              <p>
                10.1 <strong>Off-Season Changes.</strong> Any manager may propose
                rule changes in the off-season. This does not guarantee a vote.
                Unless otherwise specified, a simple majority vote is required to
                amend this Constitution or a league’s addendum, with changes taking
                effect the following season. In general, proposals should improve
                competitive balance, fairness, or the overall league experience.
              </p>
              <p>
                10.2 <strong>In-Season Changes.</strong> In-season rule changes are
                strongly discouraged and will only be made to address league-breaking
                issues (e.g. major NFL schedule changes, platform bugs, or clear
                loopholes). The Commish may implement temporary fixes with clear
                communication and, when time allows, league feedback.
              </p>
              <p>
                10.3 <strong>Dispute Resolution.</strong> Disputes should first be
                raised privately with the Commish. If needed, a poll may be held
                among non-involved managers. The goal is always to preserve fairness,
                fun, and the long-term health of the league or tournament.
              </p>
              <p>
                10.4 <strong>Final Word.</strong> Where this Constitution is silent,
                ambiguous, or conflicts with platform behavior, the Commish may make
                a final ruling. Participating in the league constitutes agreement to
                abide by these decisions in good faith.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
