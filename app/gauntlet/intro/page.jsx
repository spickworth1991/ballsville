// src/app/gauntlet/intro/page.jsx
import Link from "next/link";

export const metadata = {
  title: "Gauntlet Game Intro | Ballsville",
};

export default function GauntletIntroPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-accent">
          GAUNTLET GAME INTRO
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold">
          How the Gauntlet Game Works
        </h1>
        <p className="text-sm text-muted max-w-prose">
          You play and win in your leagues. We combine those great odds with{" "}
          <span className="font-semibold">big payout opportunities</span>. These
          are 12-team leagues to start the year, until Week 13 when two leagues
          come together to form a bracket for the final weeks.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The Draft</h2>
        <p className="text-sm text-muted">
          24 players will join a league and buy in via LeagueSafe (majority
          rule). Buy-in is <strong>$33</strong>.
        </p>
        <ul className="text-sm text-muted space-y-1.5">
          <li>• 24 players randomly split into two separate 12-team leagues.</li>
          <li>
            • Half play in the initial league; the other half may remain as
            spectators or rejoin later for the bracket.
          </li>
          <li>
            • The remaining twelve will form the second league, and others can
            join to spectate.
          </li>
          <li>
            • These leagues combine again in Week 13 to form a{" "}
            <strong>God Bracket</strong>.
          </li>
        </ul>
        <p className="text-sm text-muted">
          Ready “Gods” will be scheduled to draft together in June, and the
          Bracket demo will be updated to represent the players in each God.
          This process repeats for each God.
        </p>
        <p className="text-sm text-muted">
          One God from each Legion will be open at any time until all Legions
          are full. Each God has a Light and Dark league. Drafts will be 4-hour
          slow drafts to begin, derby startup, with no 3rd-round reversal and no
          pick trading.
        </p>
        <p className="text-sm text-muted">
          Preregistration is open now. You can join a Legion by joining a God
          using the Sleeper links provided by your Game Managers. Once a God
          has 24 paid entries, we can begin.
        </p>
        <p className="text-sm text-muted">
          Only one entry per player for each God, but you can claim an entry in
          each of the 12 Gods as they are released.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How to Play</h2>
        <p className="text-sm text-muted">
          If you draft well and play the game, you have roughly a{" "}
          <strong>1 in 3 chance</strong> at winning a payout before Week 13.
          Everything after that is upside.
        </p>
        <p className="text-sm text-muted">
          The game begins with 3 separate Legions, each Legion has 4 Gods. Each
          God represents a 24-player subdivision — a{" "}
          <strong>God Bracket</strong>.
        </p>
        <p className="text-sm text-muted">
          Two individual leagues (Light and Dark) run from Weeks 1–12. These
          leagues come together in Week 13 to form a God Bracket.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The 3 Legs of the Gauntlet</h2>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">Leg 1 – Redraft (Weeks 1–8)</h3>
          <p className="text-sm text-muted">
            You play a standard redraft game from Weeks 1–8. League median will
            play a role. You begin with <strong>$200 FAAB</strong>, and FAAB{" "}
            <strong>does not reset</strong>.
          </p>
          <p className="text-sm text-muted">Roster for Leg 1:</p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>• 1 QB</li>
            <li>• 2 RB</li>
            <li>• 3 WR</li>
            <li>• 1 TE</li>
            <li>• 1 Flex</li>
            <li>• 1 Superflex</li>
            <li>• 7 Bench</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">
            Leg 2 – Guillotine (Weeks 9–12)
          </h3>
          <p className="text-sm text-muted">
            Week 9 starts the Guillotine phase. The{" "}
            <strong>lowest player in total points</strong> will be cut for the
            next four weeks.
          </p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>
              • After Weeks 9, 10, 11, and 12, the lowest-scoring team from{" "}
              <strong>each league</strong> must drop their roster (or have it
              dropped) by Tuesday night.
            </li>
            <li>
              • Waivers run Wednesday night — make your claims during this
              window.
            </li>
          </ul>
          <p className="text-sm text-muted">
            Rosters expand once after Week 10, before waivers for Week 11:
          </p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>• 1 QB</li>
            <li>• 2 RB</li>
            <li>• 3 WR</li>
            <li>• 1 TE</li>
            <li>• 2 Flex</li>
            <li>• 1 Superflex</li>
            <li>• 10 Bench</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border/70 bg-surface/80 px-4 py-3 space-y-2">
          <h3 className="text-lg font-semibold">
            Leg 3 – The Bracket (Weeks 13–17)
          </h3>
          <p className="text-sm text-muted">
            In Week 13, the format converts to <strong>Best Ball</strong> for
            the bracket portion. Your team is now permanent — you built it
            through Redraft and Guillotine, and now you cast it off into battle
            head-to-head until Week 17.
          </p>
          <p className="text-sm text-muted">
            Managers will seed each player in the God Bracket as #1–#16 based
            on points:
          </p>
          <ul className="text-sm text-muted space-y-1.5">
            <li>• #1 vs #16</li>
            <li>• #2 vs #15</li>
            <li>• and so on…</li>
          </ul>
          <p className="text-sm text-muted">
            Update 08/28/25: Seeding will occur within the leagues (Light 1–8
            vs Dark 8–1).
          </p>
          <p className="text-sm text-muted">
            Your only job each week is to outscore your opponent to move on.
            There is no reseeding — the bracket determines your opponents. Win
            again in Week 14 to unlock the next payouts, and each win adds more
            money.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Money & Payouts</h2>
        <p className="text-sm text-muted">
          All payouts, BONUSES, and conditional upside are fully detailed in
          the Cash Doc. As always, your Game Managers are available for any
          questions. Don&apos;t hesitate to ask — you might help us catch loose
          ends or missing details.
        </p>
        <Link
          href="/gauntlet/cash-doc"
          className="inline-flex items-center gap-2 text-sm text-accent hover:underline underline-offset-2"
        >
          💸 View the Gauntlet Cash Doc
        </Link>
      </section>
    </main>
  );
}
