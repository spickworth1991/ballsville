import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `Dynasty Intro | ${siteConfig.shortName}`;
const pageDesc =
  "Year-round Empire (Dynasty) leagues with big upside, great odds, and shared BALLSVILLE rules across Dragons and Heroes.";

export const metadata = {
  title: pageTitle,
  description: pageDesc,
  alternates: { canonical: "/dynasty/intro" },
  openGraph: {
    url: "/dynasty/intro",
    title: pageTitle,
    description: pageDesc,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

// No hard-coded "Updated:" dates on-page (they go stale and create yearly work).

const DRAGONS_ORIGINAL = [
  { name: "Shenron", img: "/photos/dynasty/shenron.webp" },
  { name: "Alduin", img: "/photos/dynasty/alduin.webp" },
  { name: "Smaug", img: "/photos/dynasty/smaug.webp" },
  { name: "Bahamut", img: "/photos/dynasty/bahamut.webp" },
];

const DRAGONS_EXP_V1 = [
  { name: "Charizard", img: "/photos/dynasty/charizard.webp" },
  { name: "Toothless", img: "/photos/dynasty/toothless.webp" },
  { name: "Deathwing", img: "/photos/dynasty/deathwing.webp" },
  { name: "Skithryx", img: "/photos/dynasty/skithryx.webp" },
  { name: "Haku", img: "/photos/dynasty/haku.webp" },
  { name: "Lareth", img: "/photos/dynasty/lareth.webp" },
];

const DRAGONS_EXP_V2 = [
  { name: "Alstewing", img: "/photos/dynasty/alstewing.webp", note: "Podcasters" },
  { name: "Tsunami", img: "/photos/dynasty/tsunami.webp" },
  { name: "Ghidorah", img: "/photos/dynasty/ghidorah.webp" },
  { name: "Tiamat", img: "/photos/dynasty/tiamat.webp" },
  { name: "Shadow", img: "/photos/dynasty/shadow.webp" },
  { name: "Blue Eyes", img: "/photos/dynasty/blueeyes.webp" },
];

// 2025 Expansion: The Heroes mirror the Dragons core settings.
const HEROES_2025 = [
  { name: "Goku", img: "/photos/dynasty/goku.webp" },
  { name: "Dragonborn", img: "/photos/dynasty/dragonborn.webp" },
  { name: "Gandalf", img: "/photos/dynasty/gandalf.webp" },
  { name: "Cloud", img: "/photos/dynasty/cloud.webp" },
  { name: "Ash Ketchum", img: "/photos/dynasty/ketchum.webp" },
  { name: "Light Fury", img: "/photos/dynasty/lightfury.webp" },
  { name: "Thrall", img: "/photos/dynasty/thrall.webp" },
  { name: "Gideon", img: "/photos/dynasty/gideon.webp" },
  { name: "Drizzt", img: "/photos/dynasty/drizzt.webp" },
  { name: "Siegfried", img: "/photos/dynasty/siegfried.webp" },
  { name: "Clay", img: "/photos/dynasty/clay.webp" },
  { name: "Godzilla", img: "/photos/dynasty/godzilla.webp" },
  { name: "The Bard", img: "/photos/dynasty/thebard.webp" },
  { name: "Holy Crusader", img: "/photos/dynasty/holycrusader.webp" },
  { name: "Yu-Gi-Oh", img: "/photos/dynasty/yugioh.webp" },
  { name: "Link", img: "/photos/dynasty/link.webp" },
];

function LeagueGrid({ title, items }) {
  return (
    <section className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h3 className="text-lg sm:text-xl font-semibold text-primary">{title}</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.name}
            className="group rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden"
          >
            <div className="relative h-32 sm:h-36">
              <Image
                src={it.img}
                alt={`${it.name} Dynasty league`}
                fill
                className="object-contain p-3 group-hover:scale-[1.02] transition"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold">{it.name}</p>
              {it.note ? <p className="text-xs text-muted">{it.note}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DynastyIntroPage() {
  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
              <div className="absolute top-10 right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">
                  BALLSVILLE Dynasty Empire · Year 5
                </p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                  The <span className="text-primary">Dynasty</span> Intro
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">
                  Welcome to the BALLSVILLE Dynasty Empire: well-organized, year-round dynasty leagues
                  that stay active and don’t fold. The Dragons and Heroes run in parallel with shared
                  rules, shared documents, and shared verification — but your league competition stays
                  in your lane.
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link prefetch={false} href="/dynasty" className="btn btn-outline">
                    ← Back to Dynasty
                  </Link>
                  <Link prefetch={false} href="/dynasty/wagering-demo" className="btn btn-primary">
                    Wagering Demo →
                  </Link>
                </div>

                <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                  
                  {/* intentionally no hard-coded "Updated" badge */}
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden shadow-lg">
                <div className="relative h-52 sm:h-60">
                  <Image
                    src="/photos/dynasty-v2.webp"
                    alt="The Heroes & Dragons of Dynasty"
                    fill
                    className="object-contain p-4"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold">
                    Game #1: The Dragons of Dynasty &amp; The Heroes of Dynasty
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Expansion leagues mirror the core settings so the whole Dynasty Empire stays consistent.
                  </p>
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Join &amp; Dues
              </h2>
              <p className="text-sm text-muted">
                Startup year: <span className="font-semibold text-fg">$25</span> · Plus next year:{" "}
                <span className="font-semibold text-fg">$25</span>
              </p>
              <p className="text-xs text-muted">
                Orphans can join to rebuild for $25 (ineligible for payouts) or buy in fully for $50.
              </p>
            </div>

            <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                League Payouts
              </h2>
              <ul className="text-sm text-muted space-y-1 list-disc list-inside">
                <li>$50 🪙 credit for making the finals (Top 2)</li>
                <li>+$125 to the league winner</li>
                <li>Passive Empire mechanics can unlock bigger upside</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Game Payouts
              </h2>
              <ul className="text-sm text-muted space-y-1 list-disc list-inside">
                <li>🏆 $250 Championship Bonus (overall Week 17 high score)</li>
                <li>🥈 $100 (2nd overall) · 🥉 $50 (3rd overall)</li>
                <li>💰 $200 Wager Bonus (among those who wager)</li>
              </ul>
            </div>
          </section>

          <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm space-y-4">
            <h2 className="text-2xl sm:text-3xl font-semibold">How the Empire Element Works</h2>
            <p className="text-sm sm:text-base text-muted max-w-prose">
              You play and win in your league as normal — except if one person reaches the{" "}
              <span className="font-semibold text-fg">Pedestal</span> (🏆, 🥈, or 🥉){" "}
              <span className="font-semibold text-fg">two years in a row</span>. When that happens,
              they collect future payouts from <span className="font-semibold text-fg">their league only</span> for
              the following year and that league resets. Other leagues are not affected.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted">
                <p className="font-semibold text-fg">Why it’s fun</p>
                <p className="mt-1">
                  This creates huge payout opportunities while keeping your odds strong compared to traditional tournaments.
                </p>
              </div>
              <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted">
                <p className="font-semibold text-fg">Dragons vs Heroes</p>
                <p className="mt-1">
                  The Dragons champion faces the Heroes champion in Week 18 head-to-head. The leagues do not encroach on each other.
                </p>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <LeagueGrid title="Original Dragons (Year 3)" items={DRAGONS_ORIGINAL} />
            <LeagueGrid title="Dragons Expansion v1" items={DRAGONS_EXP_V1} />
            <LeagueGrid title="Dragons Expansion v2" items={DRAGONS_EXP_V2} />
            <LeagueGrid title="The Heroes of Dynasty (2025 Expansion)" items={HEROES_2025} />
          </div>

          <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm">
            <h2 className="text-2xl sm:text-3xl font-semibold">Next Steps</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Link
                prefetch={false}
                href="/constitution/dynasty"
                className="rounded-2xl border border-subtle bg-subtle-surface p-4 hover:border-accent transition"
              >
                <p className="text-sm font-semibold">Read the Bylaws</p>
                <p className="mt-1 text-xs text-muted">
                  Rules, protections, and code of conduct for Dynasty Empire leagues.
                </p>
              </Link>

              <Link
                prefetch={false}
                href="/dynasty/wagering-demo"
                className="rounded-2xl border border-subtle bg-subtle-surface p-4 hover:border-accent transition"
              >
                <p className="text-sm font-semibold">See the Wagering Demo</p>
                <p className="mt-1 text-xs text-muted">
                  Understand the Week 17 credit, wagering, and bonuses.
                </p>
              </Link>

              <Link
                prefetch={false}
                href="/dynasty/rosters"
                className="rounded-2xl border border-subtle bg-subtle-surface p-4 hover:border-accent transition"
              >
                <p className="text-sm font-semibold">Browse All Rosters</p>
                <p className="mt-1 text-xs text-muted">
                  Reference the full roster sheets for Dragons and Heroes.
                </p>
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
