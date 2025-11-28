// app/constitution/page.jsx
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `League Constitution | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/constitution`;

export const metadata = {
  title: pageTitle,
  description:
    "Core constitution and governance framework for all BALLSVILLE / Westlex fantasy leagues.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description:
      "Core constitution and governance framework for all BALLSVILLE / Westlex fantasy leagues.",
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
  { id: "section-7", label: "7. Conduct & Fair Play" },
  { id: "section-8", label: "8. Replacing Managers" },
  { id: "section-9", label: "9. League Finances" },
  { id: "section-10", label: "10. Amendments & Disputes" },
];

export default function Page() {
  return (
    <>
      {/* Hero */}
      <section className="bg-bg border-b border-subtle">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-accent">
            the BALLSVILLE game · Westlex Leagues
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-primary">
            League Constitution
          </h1>
          <p className="text-sm md:text-base text-muted max-w-2xl mx-auto">
            This Constitution defines the core rules, protections, and expectations
            that apply across all BALLSVILLE / Westlex fantasy league formats —
            including dynasty, redraft, best ball, tournaments, and custom leagues.
          </p>
          <p className="text-[11px] text-muted max-w-3xl mx-auto leading-snug">
            <strong>Scope & Applicability.</strong> Not every section will apply
            to every league. Some formats may disable trading, waivers, FAAB,
            or certain playoff structures. In those cases, the platform settings
            and the league’s specific bylaws / addendum take priority, and the
            relevant parts of this Constitution are considered{" "}
            <span className="italic">“where applicable.”</span>
          </p>
          <p className="text-xs text-muted">
            Individual league pages may add format-specific bylaws, but may not
            override the spirit of this document without clear, written approval.
          </p>
        </div>
      </section>

      {/* Main layout */}
      <section className="bg-bg px-4 md:px-8 py-10">
        <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
          {/* TOC Card */}
          <aside className="space-y-4">
            <div className="bg-card border border-subtle rounded-2xl p-5 shadow-sm sticky top-4">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
                Table of Contents
              </h2>
              <nav className="space-y-2 text-sm">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block rounded-lg px-3 py-2 text-left text-muted hover:text-primary hover:bg-bg transition"
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
          <div className="space-y-6 text-fg leading-relaxed">
            {/* Section 1 */}
            <section
              id="section-1"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                1. League Governance
              </h2>
              <p>
                1.1 <strong>Commissioner Role.</strong> Each league will have one
                or more Commissioners (“Commish”) responsible for administering
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
                1.3 <strong>Authority & Discretion.</strong> The Commish has final
                say on interpreting ambiguous situations, applying penalties, and
                making emergency adjustments when the platform, NFL schedule, or
                unforeseen events would otherwise cause league-breaking issues.
                Wherever possible, major decisions will be discussed in league
                chat and/or put to a vote.
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
                rosters, scores, and transactions. In the rare case where the
                app’s behavior clearly conflicts with this Constitution, the Commish
                may manually correct results in a reasonable manner.
              </p>
            </section>

            {/* Section 2 */}
            <section
              id="section-2"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                2. League Formats & Rosters
              </h2>
              <p>
                2.1 <strong>Supported Formats.</strong> BALLSVILLE / Westlex
                leagues may include redraft, dynasty, best ball, multi-copy,
                tournaments, and other custom structures. Each league’s specific
                format (including year-over-year carryover of players, picks, or
                standings) will be documented on that league’s info page or
                bylaws.
              </p>
              <p>
                2.2 <strong>Roster Breakdown.</strong> Default roster size,
                positional requirements, and IR / Taxi / Bench spots will be
                defined per league. Managers must always comply with roster limits
                set in the app and may be required to drop players to become
                roster-compliant.
              </p>
              <p>
                2.3 <strong>Position Eligibility.</strong> A player’s eligible
                positions are determined by the host platform. The Commish will
                generally not override position designations unless there is a
                clear platform error that materially impacts the league.
              </p>
              <p>
                2.4 <strong>Lineup Responsibility (Where Applicable).</strong> In
                formats where managers set lineups (e.g. redraft, dynasty, most
                custom leagues), managers must make a good-faith effort to set a
                valid lineup every week, using available players who are active and
                not on bye. In best ball formats where lineups are optimized
                automatically, this responsibility is limited to maintaining a
                legal roster.
              </p>
              <p>
                2.5 <strong>IR / Injury / Suspension.</strong> Use of IR / NFI /
                PUP / suspension / COVID or similar slots must follow the
                platform’s eligibility rules. Stashing ineligible players in these
                slots for roster advantage is prohibited and may be corrected by
                the Commish, regardless of format.
              </p>
            </section>

            {/* Section 3 */}
            <section
              id="section-3"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                3. Transactions (Where Applicable)
              </h2>
              <p>
                <em>
                  This section applies in leagues where trades, waivers, FAAB, or
                  in-season pickups are enabled. In formats that disable one or
                  more of these features (e.g. locked best ball tournaments),
                  those items are simply not in effect.
                </em>
              </p>
              <p>
                3.1 <strong>Trades Encouraged (If Enabled).</strong> In leagues
                where trading is turned on, trades are a core part of the game and
                are encouraged. Trades may include players, draft picks, and
                (where enabled) FAAB or other approved assets. Real-life cash or
                favors outside the league are strictly prohibited.
              </p>
              <p>
                3.2 <strong>Trade Process.</strong> The league will use either
                instant-processing trades or a short review period, based on
                settings announced before the season. The Commish reserves the
                right to temporarily pause trading during investigations,
                ownership changes, or off-season restructuring.
              </p>
              <p>
                3.3 <strong>Collusion & Lending.</strong> Trades that involve
                collusion, “loaning” players with the expectation of returning
                them, or obvious manipulation of league outcomes may be reversed,
                and the managers involved may face penalties up to removal. See
                Section 7 (Conduct) for more detail.
              </p>
              <p>
                3.4 <strong>Waivers / FAAB (If Enabled).</strong> In leagues that
                use waivers or FAAB, the type of system (rolling, FAAB-based, or
                hybrid), processing days, and free-agency windows will be clearly
                posted before the season. Managers are responsible for
                understanding the waiver schedule in their specific league.
              </p>
              <p>
                3.5 <strong>Drops & Locking.</strong> Dropped players may be
                subject to a temporary lock or waiver period as defined by league
                settings. Intentionally “churning” players (adding/dropping
                repeatedly just to block access) may be treated as misconduct,
                especially in formats with FAAB or limited transaction windows.
              </p>
            </section>

            {/* Section 4 */}
            <section
              id="section-4"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                4. Drafts & Player Acquisition
              </h2>
              <p>
                4.1 <strong>Startup & Seasonal Drafts.</strong> Each league’s
                startup draft and any seasonal drafts (redraft, best ball, etc.)
                will have a published structure (snake, auction, 3rd-round
                reversal, slow draft, etc.) and timer length. Draft orders and
                tie-breakers will be announced before the draft begins.
              </p>
              <p>
                4.2 <strong>Rookie & Supplemental Drafts (If Used).</strong>{" "}
                Dynasty or keeper leagues may include rookie or supplemental
                drafts. Orders may be based on standings, potential points / Max
                PF, toilet bowl results, or other systems as defined in that
                league’s bylaws.
              </p>
              <p>
                4.3 <strong>Draft Day Trades.</strong> Where the platform allows,
                draft picks may be traded, subject to any limits on how many years
                ahead can be traded and any requirement that future dues are
                prepaid before moving future picks.
              </p>
              <p>
                4.4 <strong>Extenuating Circumstances.</strong> If the NFL
                postpones or cancels games, or the host platform fails to handle
                the draft or player pool correctly, the Commish may pause drafts,
                adjust timers, or manually assign fair outcomes in a way that
                preserves competitive balance for that league’s format.
              </p>
            </section>

            {/* Section 5 */}
            <section
              id="section-5"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                5. Scoring & Results
              </h2>
              <p>
                5.1 <strong>Scoring Settings.</strong> Each league’s exact scoring
                settings (PPR, bonuses, first downs, return yards, best ball
                optimization, etc.) will be posted in the host platform and/or on
                that league’s info page. Those settings are considered part of
                this Constitution for that league.
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
                games, cancellations, or platform outages, the Commish may
                manually adjust scores using a transparent method (e.g. seasonal
                average points per game) applied consistently to all affected
                managers in that league.
              </p>
            </section>

            {/* Section 6 */}
            <section
              id="section-6"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                6. Postseason & Tiebreakers
              </h2>
              <p>
                6.1 <strong>Playoff Structure.</strong> Each league will define
                how many teams make the playoffs, which weeks are used, whether
                it’s head-to-head, total points, best ball, or tournament style,
                and whether there are consolation brackets or toilet bowls. This
                structure must be set before Week 1 and should not change
                mid-season except for extreme NFL scheduling changes.
              </p>
              <p>
                6.2 <strong>Seeding.</strong> Typical ordering will be by record,
                then points for, then additional tie-breakers such as head-to-head
                record or points against. The exact order of tiebreakers will be
                posted on the league info page or bylaws.
              </p>
              <p>
                6.3 <strong>Prizes & Side Pots.</strong> Cash payouts and side
                games (e.g. weekly high score, median win bonuses, survivor
                pools, multi-league tournaments) must be clearly documented
                before the season. All prize structures are subject to the
                financial rules in Section 9.
              </p>
            </section>

            {/* Section 7 */}
            <section
              id="section-7"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                7. Conduct & Fair Play
              </h2>
              <p>
                7.1 <strong>Good Sportsmanship.</strong> Fantasy is supposed to be
                fun. Friendly trash talk is welcome; harassment, bigotry, and
                personal attacks are not. The Commish may mute, warn, or remove
                managers whose behavior is toxic to the league.
              </p>
              <p>
                7.2 <strong>Collusion.</strong> Any attempt by two or more
                managers to manipulate outcomes in a way that does not reflect an
                honest attempt to improve their own teams (e.g. gifting players,
                “loaning” studs for a week, coordinated tanking) is prohibited
                and may result in trade reversal, loss of picks, fines, or
                removal.
              </p>
              <p>
                7.3 <strong>Tanking & Inactivity.</strong> Rebuilding in dynasty
                is allowed; intentionally starting empty or obviously non-playing
                lineups to lose on purpose is not. Repeated failure to follow
                basic responsibilities (set lineups where required, respond to
                tags, pay dues) may result in intervention, temporary control by a
                substitute manager, or removal (see Section 8).
              </p>
              <p>
                7.4 <strong>Churning.</strong> Repeatedly adding/dropping players
                solely to keep them off other rosters, without any intention of
                using them, may be treated as unfair play and addressed at the
                Commish’s discretion.
              </p>
              <p>
                7.5 <strong>Public Shaming.</strong> Critiquing trades and
                strategies is part of the game; targeted harassment, call-out
                posts meant to embarrass specific managers, or dog-piling in chat
                may lead to warnings or removal.
              </p>
            </section>

            {/* Section 8 */}
            <section
              id="section-8"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                8. Replacing Managers
              </h2>
              <p>
                8.1 <strong>Grounds for Removal.</strong> Managers may be removed
                for repeated inactivity, confirmed collusion, non-payment of
                dues, or behavior that seriously damages the league experience.
                Removal is considered a last resort, but the Commish is empowered
                to act when needed to protect the league.
              </p>
              <p>
                8.2 <strong>Process.</strong> When possible, the Commish will
                warn the manager privately first. If issues persist, the Commish
                may call for a vote of the remaining managers. A simple majority
                or specified super-majority (e.g. 2/3) may be required depending
                on the severity of the situation and the league’s bylaws.
              </p>
              <p>
                8.3 <strong>Replacement Managers.</strong> When a team becomes
                orphaned, the Commish will seek a replacement manager who
                understands the format and is able to commit for the appropriate
                term (especially in dynasty). Entry terms, discounts, or rebuild
                clauses may be offered and will be clearly communicated to both
                the league and incoming manager.
              </p>
              <p>
                8.4 <strong>Forfeiture of Dues.</strong> Managers removed for
                cause or who abandon their team may forfeit part or all of their
                dues, which may be added to league prizes or rolled into the next
                season at the Commish’s discretion and/or league vote, consistent
                with posted bylaws.
              </p>
            </section>

            {/* Section 9 */}
            <section
              id="section-9"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                9. League Finances
              </h2>
              <p>
                9.1 <strong>Dues & Payment.</strong> Each league will publish its
                buy-in amount (if any), payment deadline, and payment platform
                (e.g. LeagueSafe, potless/for-fun, tournament credit). All
                managers in a paid league must be paid in full by the posted
                deadline, or their spot may be offered to a replacement.
              </p>
              <p>
                9.2 <strong>Payouts.</strong> Payout structures (1st, 2nd, 3rd,
                side pots, tournament bonuses, etc.) will be published before the
                season and should not change mid-year except by majority vote in
                response to extreme circumstances.
              </p>
              <p>
                9.3 <strong>Fines & Credits.</strong> Late-payment penalties,
                forfeited dues, or disciplinary fines may be added to the prize
                pool, rolled over to a future season, or used for league
                enhancements (e.g. trophies, graphics), as decided by the Commish
                and/or league vote and stated transparently.
              </p>
              <p>
                9.4 <strong>Transparency.</strong> Where a third-party platform
                like LeagueSafe is used, all managers will have visibility into
                the funds and payout approvals, in accordance with that
                platform’s rules.
              </p>
            </section>

            {/* Section 10 */}
            <section
              id="section-10"
              className="bg-card border border-subtle rounded-2xl p-6 shadow-sm space-y-3"
            >
              <h2 className="text-xl md:text-2xl font-bold text-primary">
                10. Amendments & Disputes
              </h2>
              <p>
                10.1 <strong>Off-Season Changes.</strong> Any manager may propose
                rule changes in the off-season. This does not mean it will be voted on.
                Unless otherwise specified, a simple majority vote is required to 
                amend this Constitution or a league’s addendum, with changes taking 
                effect the following season. Generally this has to be something that
                improves competitive balance, fairness, or the overall league experience.
              </p>
              <p>
                10.2 <strong>In-Season Changes.</strong> In-season rule changes
                are strongly discouraged and will only be made to address
                league-breaking issues (e.g. major NFL schedule changes, platform
                bugs, or clear loopholes). The Commish may implement temporary
                fixes with clear communication and, when time allows, league
                feedback.
              </p>
              <p>
                10.3 <strong>Dispute Resolution.</strong> Disputes should first
                be raised privately with the Commish. If needed, a poll may be
                held among non-involved managers. The goal is always to preserve
                fairness, fun, and the long-term health of the league or
                tournament.
              </p>
              <p>
                10.4 <strong>Final Word.</strong> Where this Constitution is
                silent, ambiguous, or conflicts with platform behavior, the
                Commish may make a final ruling. Participating in the league
                constitutes agreement to abide by these decisions in good faith.
              </p>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
