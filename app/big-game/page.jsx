// app/big-game/page.jsx
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "The BIG Game | Ballsville",
  description:
    "The BALLSVILLE Game – our trademark Big Game format where big payouts meet great odds.",
};

const DIVISIONS = [
  {
    id: "D1",
    name: "Game of Thrones",
    status: "FULL",
    image: "/photos/biggame/game-of-thrones.jpg",
    href: "/hub/game-of-thrones",
  },
  {
    id: "D2",
    name: "Star Wars",
    status: "FULL",
    image: "/photos/biggame/star-wars.jpg",
    href: "/hub/star-wars",
  },
  {
    id: "D3",
    name: "Avengers",
    status: "FULL",
    image: "/photos/biggame/avengers.jpg",
    href: "/hub/avengers",
  },
  {
    id: "D4",
    name: "Gamer Realms",
    status: "FULL",
    image: "/photos/biggame/gamer-realms.jpg",
    href: "/hub/gamer-realms",
  },
  {
    id: "D5",
    name: "Villains",
    status: "FULL",
    image: "/photos/biggame/villains.jpg",
    href: "/hub/villains",
  },
  {
    id: "D6",
    name: "Heroes",
    status: "FULL",
    image: "/photos/biggame/heroes.jpg",
    href: "/hub/heroes",
  },
  {
    id: "D7",
    name: "Wizards & Warriors",
    status: "FULL",
    image: "/photos/biggame/wizards-warriors.jpg",
    href: "/hub/wizards-warriors",
  },
  {
    id: "D8",
    name: "All-Stars",
    status: "PRIVATE",
    image: "/photos/biggame/all-stars.jpg",
    href: "/hub/all-stars",
  },
  {
    id: "D9",
    name: "Pokémon",
    status: "FULL",
    image: "/photos/biggame/pokemon.jpg",
    href: "/hub/pokemon",
  },
  {
    id: "D10",
    name: "Transformers",
    status: "FULL",
    image: "/photos/biggame/transformers.jpg",
    href: "/hub/transformers",
  },
  {
    id: "D11",
    name: "Character Unlock",
    status: "FULL",
    image: "/photos/biggame/character-unlock.jpg",
    href: "/hub/character-unlock",
  },
  {
    id: "D12",
    name: "The Boys",
    status: "FULL",
    image: "/photos/biggame/the-boys.jpg",
    href: "/hub/the-boys",
  },
];

function statusClass(status) {
  if (status === "FULL") return "badge-status badge-status-full";
  if (status === "PRIVATE") return "badge-status badge-status-private";
  return "badge-status badge-status-default";
}

export default function BigGamePage() {
  return (
    <main className="min-h-screen text-fg">
      {/* cyan / premium glow overlay (background image is handled by layout) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* HERO */}
        <section className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-accent">
            The BALLSVILLE Game
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight">
            The <span className="text-primary">BIG Game</span>
          </h1>
          <p className="text-lg text-muted max-w-2xl">
            Our trademark game –{" "}
            <span className="font-semibold text-accent">
              where BIG payouts meet great odds.
            </span>
          </p>

          <div className="mt-4 inline-flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
              10-team BESTBALL
            </span>
            <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
              Superflex · Redraft
            </span>
            <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
              No waivers · No trades · Pure draft
            </span>
          </div>

          <p className="mt-3 text-sm text-muted">
            This is <span className="font-semibold text-fg">not</span> a
            tournament. You play and win in your league, with an optional BIG
            Game layer on top.
          </p>

          <p className="chip-warning mt-1">
            <span className="text-base">⚠️</span>
            <span>
              This game is optional. League winners can choose to cash out or
              step into the BIG Game.
            </span>
          </p>
        </section>

        {/* ESSENTIALLY / ODDS */}
        <section className="grid gap-6 lg:grid-cols-[1.1fr_minmax(0,1fr)] items-start">
          <div className="rounded-2xl border border-subtle bg-card-surface p-6 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
            <h2 className="text-xl font-semibold mb-2 text-accent">
              Essentially…
            </h2>
            <ul className="space-y-1.5 text-sm">
              <li>• 1/10 odds of winning your league.</li>
              <li>• 1/8 (or better) odds of winning your division in Week 16.</li>
              <li>
                • 1/12 (or better) odds of winning the 🏆 Championship 👑 in
                Week 17.
              </li>
            </ul>

            <div className="mt-4 rounded-xl bg-subtle-surface border border-subtle p-4 text-sm space-y-2">
              <p className="font-semibold">
                Championship BONUS –{" "}
                <span className="text-primary">$200</span>
              </p>
              <p className="text-muted">
                Our custom wagering formula creates{" "}
                <span className="font-medium text-accent">
                  outsized payout opportunities
                </span>
                .
              </p>
              <ul className="space-y-1">
                <li>• 2023: Mtost turned a $6 entry into ≈ $1,450.</li>
                <li>
                  • 2024: Kros24 took home ≈ $1,450–$1,600 from a single run.
                </li>
                <li>
                  • Plus dozens of other players banking hundreds with moderate
                  hits.
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
            <h3 className="text-lg font-semibold">Buy-in &amp; League Basics</h3>
            <ul className="text-sm space-y-1.5">
              <li>
                • <span className="font-semibold text-primary">$7 buy-in</span>
              </li>
              <li>
                • Money held on{" "}
                <span className="font-medium">
                  LeagueSafe (Majority rule)
                </span>
              </li>
              <li>• 10 teams per league</li>
              <li>• Bestball, Superflex, Redraft</li>
              <li>
                •{" "}
                <span className="font-medium text-accent">
                  $50 for “League Winners”
                </span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted">
              ⚠️ Most points after Week 15 wins the league.
            </p>
            <p className="mt-2 text-sm text-muted">
              League winners may keep their $50 and{" "}
              <span className="font-semibold text-fg">exit</span>, or roll into{" "}
              <span className="font-semibold text-primary">
                The BALLSVILLE Game
              </span>
              .
            </p>
          </div>
        </section>

        {/* HOW TO PLAY / WHAT YOU GET */}
        <section className="grid gap-6 lg:grid-cols-2 items-start">
          <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
            <h2 className="text-xl font-semibold">How to play the game</h2>
            <p className="text-sm text-muted">
              Grind your league, win your regular-season race by Week 15, and
              decide:
            </p>
            <ul className="text-sm space-y-1.5">
              <li>• Take your $50 and walk.</li>
              <li>
                • Or step into the BIG Game path through Division and
                Championship weeks.
              </li>
            </ul>
            <p className="text-sm text-muted">
              The odds stay friendly. You keep the same core chance to win your
              league, but add a high-upside overlay with structured, transparent
              odds.
            </p>
          </div>

          <div className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
            <h2 className="text-xl font-semibold text-accent">
              Your $7 entry also gets you:
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <ul className="space-y-1.5">
                <li>• Mini games</li>
                <li>• Free entry opportunities</li>
                <li>• Game Managers</li>
                <li>• The BALLSVILLE Pod</li>
                <li>• Community &amp; socials</li>
                <li>• Discord access</li>
              </ul>
              <ul className="space-y-1.5">
                <li>• Custom ADP &amp; trade analysis</li>
                <li>• This website + tools</li>
                <li>• Live scores in Weeks 16 &amp; 17</li>
                <li>• Expedited payouts</li>
                <li>• Some of the best players we can gather</li>
              </ul>
            </div>
            <p className="text-xs text-muted">
              We appreciate the smallness of our game, but we do hold it in high
              esteem. Most recruiting is{" "}
              <span className="font-semibold text-fg">invite only</span>.
            </p>
          </div>
        </section>

        {/* IF YOU'RE INVITED */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">If you’re invited to a league…</h2>
          <p className="text-sm text-muted">
            Each league has important pinned messages for you. These will
            include:
          </p>
          <ul className="text-sm space-y-1.5">
            <li>• A league-specific variant of this intro page</li>
            <li>• Wagering demo</li>
            <li>• Code of Conduct</li>
            <li>• Pay link</li>
            <li>• Discord link</li>
          </ul>
          <p className="text-sm text-muted">
            The pay link is usually posted when a league reaches 8/10 players.
            All money is held through{" "}
            <span className="font-semibold">LeagueSafe / Majority</span>.
          </p>
        </section>

        {/* SCORING & ROSTERS */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-4">
          <h2 className="text-xl font-semibold">Scoring &amp; Rosters</h2>
          <p className="text-sm text-muted">
            Scoring and settings are universal across all BIG Game Bestball
            leagues.
          </p>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
            <div className="rounded-xl bg-subtle-surface border border-subtle p-4 text-sm space-y-2 font-mono">
              <p className="text-accent font-semibold">Starting lineup</p>
              <ul className="space-y-1">
                <li>QB ( +6 per passing TD )</li>
                <li>2 × RB</li>
                <li>3 × WR</li>
                <li>TE (non-premium)</li>
                <li>2 × FLEX</li>
                <li>1 × SUPERFLEX</li>
                <li>+16 bench</li>
              </ul>
            </div>

            <div className="rounded-xl bg-subtle-surface border border-subtle p-4 text-sm space-y-2">
              <p className="text-accent font-semibold">Global rules</p>
              <ul className="space-y-1">
                <li>• No trading.</li>
                <li>• No auctions.</li>
                <li>• Odds need to be fair across all leagues.</li>
              </ul>
              <p className="text-xs text-muted mt-1">
                All leagues share the same scoring and roster configuration to
                keep the contest balanced.
              </p>
            </div>
          </div>
        </section>

        {/* IN CLOSING */}
        <section className="rounded-2xl border border-subtle bg-card-surface p-6 space-y-3">
          <h2 className="text-xl font-semibold">In closing</h2>
          <p className="text-sm text-muted">
            Trash talk is tolerated, but we do have a{" "}
            <Link
              href="/constitution"
              className="font-semibold text-accent underline underline-offset-2 hover:text-primary"
            >
              Code of Conduct
            </Link>{" "}
            that everyone is expected to read.
          </p>
          <p className="text-xs text-muted">
            ⚠️ If any league is inconsistent with the others, it may be excluded
            from the BALLSVILLE contest.
          </p>
          <p className="text-sm text-muted">
            Payments in will be tracked in each individual league. Payments go
            through <span className="font-semibold">three stages of verification</span>{" "}
            to keep the game clean.
          </p>
          <p className="text-sm text-muted">
            If you’re interested in joining, DM a manager to be added to the
            waiting list. The BIG Game kicks off each year after the NFL Draft.
          </p>
        </section>

        {/* DIVISIONS GRID */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-semibold">12 Divisions</h2>
              <p className="text-sm text-muted">
                Each division has its own theme, artwork, and hub.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DIVISIONS.map((division) => (
              <div
                key={division.id}
                className="group rounded-2xl border border-subtle bg-card-surface overflow-hidden flex flex-col shadow-[0_0_25px_rgba(15,23,42,0.8)] hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] transition-all"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={division.image}
                    alt={division.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/70 border border-white/10 text-white">
                      {division.id}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white drop-shadow">
                      {division.name}
                    </h3>
                    <span className={statusClass(division.status)}>
                      {division.status}
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col gap-3 text-sm">
                  <p className="text-muted text-xs">
                    Division {division.id} theme:{" "}
                    <span className="font-semibold text-fg">
                      {division.name}
                    </span>
                    .
                  </p>
                  <div className="mt-auto flex justify-between items-center gap-3">
                    <Link
                      href={division.href}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 transition-colors"
                    >
                      View Hub
                      <span aria-hidden>↗</span>
                    </Link>
                    <span className="text-[11px] text-muted">
                      Bestball · BIG Game
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
