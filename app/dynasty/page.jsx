// app/dynasty/page.jsx
import Image from "next/image";
import Link from "next/link";
import DynastyLeaguesClient from "@/lib/DynastyLeaguesClient";
export const metadata = {
  title: "The Dynasty Game | Ballsville",
  description:
    "The Heroes & Dragons of Dynasty – BALLSVILLE's Dynasty Empire leagues, rules, payouts, and league list.",
};

const DYNASTY_DOCS = [
  {
    label: "Game Intro",
    description: "Start here to understand the Heroes & Dragons of Dynasty.",
    href: "#", // optional: link to a doc or article
  },
  {
    label: "Bye-Laws & Code of Conduct",
    description: "All BALLSVILLE Dynasty Empire leagues follow these documents.",
    href: "/constitution/dynasty",
  },
  {
    label: "Wagering Demo (Optional)",
    description: "See how wagers map to the big upside in Week 17.",
    href: "#",
  },
  {
    label: "Leaguesafe Collective (Majority Rule)",
    description: "How funds are managed and protected.",
    href: "#",
  },
  {
    label: "All Dyno Rosters",
    description: "Reference doc for every roster across the Dynasty Empire.",
    href: "#",
  },
];

const MANAGERS = [
  {
    name: "Kenneth",
    role: "Game Manager – Heroes of Dynasty Expansion Leagues",
    sleeper: "TheDealerisBack",
    image: "/photos/managers/kenneth.jpg", // TODO: replace with real path
  },
  {
    name: "Alex",
    role: "Game Creator & Co-Manager alongside Kenneth",
    sleeper: "Westlex",
    image: "/photos/managers/alex.jpg", // TODO: replace with real path
  },
];

export default function DynastyPage() {
  return (
    <main className="min-h-screen text-fg">
      {/* cosmic glow overlay */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* HERO SECTION */}
        <section className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-accent">
              Heroes &amp; Dragons of Dynasty
            </p>
            <h1 className="mt-2 text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight">
              The <span className="text-primary">Dynasty</span> Game
            </h1>

            <p className="mt-4 text-sm sm:text-base text-muted max-w-prose">
              The Heroes of Dynasty are characters that correspond with the
              Dragons of Dynasty. All BALLSVILLE Dynasty Empire Leagues follow
              the same core documents and structure. Anyone who joins is
              expected to have read them.
            </p>

            <div className="mt-4 inline-flex flex-wrap gap-3 text-xs sm:text-sm">
              <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                12-team · Superflex · 3WR
              </span>
              <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                Dynasty Empire · $25 annually
              </span>
              <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                Championship week verification across all leagues
              </span>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-muted">
              <span className="font-semibold">Westlex – Welcome to 2025.</span>{" "}
              Our Dynasty game is in high demand, which lets us hand-select
              managers we want with us long-term. It creates better leagues,
              better stories, and bigger upside.
            </p>

            <ul className="mt-4 text-xs sm:text-sm text-muted space-y-1 max-w-prose list-disc list-inside">
              <li>All listed leagues are currently full and active.</li>
              <li>
                If orphan teams become available, they will appear at the top of
                this page.
              </li>
              <li>
                All leagues play a full season with a shared focus on Week 17
                outcomes and cross-league verification.
              </li>
            </ul>

            <div className="mt-6 rounded-xl bg-card-surface border border-subtle px-4 py-3 text-xs sm:text-sm text-muted">
              Drafts are{" "}
              <span className="font-semibold">4-hour timers</span>, paused
              overnight from <span className="font-semibold">11pm–9am EST</span>{" "}
              (9pm–6am PST). These are slow drafts unless your league votes to
              speed it up. Startup style is a{" "}
              <span className="font-semibold">Derby</span>: one shuffle, then
              managers choose draft spots, which also sets rookie draft order
              (reverse order, a BALLSVILLE setting).
            </div>
          </div>

          <div className="relative h-56 sm:h-64 md:h-80 rounded-2xl overflow-hidden border border-subtle bg-card-surface">
            <Image
              src="/photos/dynasty.webp"
              alt="The Heroes & Dragons of Dynasty"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-bg/30 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-xs sm:text-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-bg/80 px-3 py-1 border border-subtle">
                <span className="text-[11px] tracking-[0.25em] uppercase text-accent">
                  🐉 Dynasty Empire
                </span>
              </div>
              <p className="mt-2 font-semibold">
                The Heroes of Dynasty &amp; the Dragons of Dynasty
              </p>
              <p className="text-[11px] text-muted">
                Vets draft now. Rookies draft post-NFL Draft. Derby style
                startup sets both drafts.
              </p>
            </div>
          </div>
        </section>

        {/* DOCS / CORE DOCUMENTS */}
        <section>
          <h2 className="text-xl sm:text-2xl font-semibold">
            Read to get to know the Game
          </h2>
          <p className="mt-1 text-sm text-muted max-w-prose">
            All BALLSVILLE Dynasty Empire leagues follow these documents. Anyone
            who joins will be expected to have read them.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DYNASTY_DOCS.map((doc) => (
              <Link
                key={doc.label}
                href={doc.href}
                className="group rounded-xl border border-subtle bg-card-surface p-4 hover:border-accent hover:-translate-y-0.5 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{doc.label}</h3>
                  <span className="text-[11px] text-muted group-hover:text-accent">
                    View →
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">{doc.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* DYNAMIC LEAGUES / ORPHANS / DIRECTORY (Supabase-driven) */}
        <DynastyLeaguesClient />

        {/* ABOUT THE MANAGERS */}
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold">
              About the Managers
            </h2>
            <p className="mt-1 text-sm text-muted max-w-prose">
              Your Game Manager for the Heroes of Dynasty expansion leagues and
              the Game Creator overseeing the Dynasty Empire.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {MANAGERS.map((m) => (
              <div
                key={m.name}
                className="flex gap-4 rounded-xl border border-subtle bg-card-surface p-4"
              >
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-full border border-subtle bg-panel">
                  <Image
                    src={m.image}
                    alt={m.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">{m.name}</h3>
                  <p className="text-xs sm:text-sm text-muted">{m.role}</p>
                  <p className="text-xs text-muted">
                    Sleeper name:{" "}
                    <span className="font-mono text-[11px] bg-panel px-1.5 py-0.5 rounded">
                      {m.sleeper}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
