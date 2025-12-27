// app/dynasty/page.jsx
import Image from "next/image";
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import DynastyLeaguesClient from "@/components/dynasty/DynastyLeaguesClient";
import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: "The Dynasty Game | Ballsville",
  description:
    "The Heroes & Dragons of Dynasty – BALLSVILLE's Dynasty Empire leagues, rules, payouts, and league list.",
};

const DYNASTY_DOCS = [
  {
    label: "Game Intro",
    description: "Start here to understand the Heroes & Dragons of Dynasty.",
    href: "/dynasty/intro",
  },
  {
    label: "Bye-Laws & Code of Conduct",
    description: "All BALLSVILLE Dynasty Empire leagues follow these documents.",
    href: "/constitution/dynasty",
  },
  // {
  //   label: "Wagering Tracker (Optional)",
  //   description: "See how wagers map to the big upside in Week 17.",
  //   href: "/dynasty/wagering-demo",
  // },
  {
    label: "All Dyno Rosters",
    description: "Reference doc for every roster across the Dynasty Empire.",
    href: "/dynasty/rosters",
  },
];

const MANAGERS = [
  {
    name: "Kenneth",
    role: "Game Manager – Heroes of Dynasty Expansion Leagues",
    sleeper: "TheDealerisBack",
    image: "/photos/managers/kenneth.jpg",
  },
  {
    name: "Alex",
    role: "Game Creator & Co-Manager alongside Kenneth",
    sleeper: "Westlex",
    image: "/photos/managers/alex.jpg",
  },
];

function PremiumFrame({ title, subtitle, kicker, children, className = "" }) {
  return (
    <section
      className={[
        "mt-6 relative overflow-hidden rounded-3xl  bg-card-surface",
        "shadow-2xl shadow-black/30",
        "px-6 py-6 sm:px-10 sm:py-8",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen">
        <div className="absolute -top-24 -left-10 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <header className="space-y-2">
          {kicker ? (
            <p className="text-xs uppercase tracking-[0.35em] text-accent">{kicker}</p>
          ) : null}
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="text-sm text-muted mx-auto">{subtitle}</p> : null}
        </header>

        <div>{children}</div>
      </div>
    </section>
  );
}

export default function DynastyPage() {
  return (
    <main className="relative min-h-screen text-fg">
      {/* cosmic glow overlay */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* HERO (premium framed) */}
        <section className="relative overflow-hidden rounded-3xl bg-card-surface shadow-2xl shadow-black/40 px-6 py-8 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            <div className="opacity-50 absolute -top-24 -left-5 h-56 w-56 rounded-full bg-green-500/50 blur-3xl" />
            <div className="opacity-50 absolute -top-24 -right-5 h-56 w-56 rounded-full bg-purple-500/50 blur-3xl" />
            <div className="opacity-65 absolute -bottom-24 -right-5 h-56 w-64 rounded-full bg-orange-400/40 blur-3xl" />
            <div className="opacity-55 absolute -bottom-24 -left-7 h-56 w-56 rounded-full bg-red-500/50 blur-3xl" />
            <div className="opacity-30 absolute left-1/2 top-1/2 h-56 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/50 blur-3xl" />
          </div>

          <div className="relative py-2 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">
                Heroes &amp; Dragons of Dynasty
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                The <span className="text-primary">Dynasty</span> Game
              </h1>

              <p className="text-sm sm:text-base text-muted max-w-prose">
                The Heroes of Dynasty are characters that correspond with the Dragons of Dynasty.
                All BALLSVILLE Dynasty Empire Leagues follow the same core documents and structure.
                Anyone who joins is expected to have read them.
              </p>

              <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  12-team · Superflex · 3WR
                </span>
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  Dynasty Empire · $25 annually
                </span>
                <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                  Championship verification across leagues
                </span>
              </div>

              <div className="mt-6 rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted space-y-3">
                <p>
                  <span className="font-semibold text-fg">Welcome to {CURRENT_SEASON}.</span>{" "}
                  Our Dynasty game is in high demand, which lets us hand-select
                  managers we want with us long-term.
                </p>
                <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
                  <li>All listed leagues are currently full and active.</li>
                  <li>If orphan teams become available, they will appear at the top of this page.</li>
                  <li>
                    All leagues play a full season with a shared focus on Week 17 outcomes and cross-league verification.
                  </li>
                </ul>
              </div>
            </div>

            {/* right hero art + owner block */}
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card-trans shadow-xl shadow-black/40">
                <div className="relative h-56 sm:h-64 md:h-72">
                  <Image
                    src="/photos/dynasty-v2.webp"
                    alt="The Heroes & Dragons of Dynasty"
                    fill
                    className="object-contain"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white">
                      🐉 Dynasty Empire
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <p className="font-semibold">The Heroes of Dynasty &amp; the Dragons of Dynasty</p>
                  <p className="mt-1 text-[11px] text-muted">
                    Vets draft now. Rookies draft post–NFL Draft. Derby style startup sets both drafts.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-card-surface px-4 py-3 text-xs sm:text-sm text-muted">
                Drafts are <span className="font-semibold">4-hour timers</span>, paused overnight from{" "}
                <span className="font-semibold">11pm–9am EST</span> (9pm–6am PST). Startup style is a{" "}
                <span className="font-semibold">Derby</span>: one shuffle, then managers choose draft spots, which also
                sets rookie draft order (reverse order).
              </div>
            </div>
          </div>

          <OwnerHeroBlock mode="dynasty" season={CURRENT_SEASON} title="Owner Updates" />
        </section>

        {/* DOCS / CORE DOCUMENTS */}
        <PremiumFrame
          kicker="Core Docs"
          title="Read to get to know the Game"
          subtitle="All BALLSVILLE Dynasty Empire leagues follow these documents. Anyone who joins will be expected to have read them."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DYNASTY_DOCS.map((doc) => (
              <Link
                key={doc.label}
                href={doc.href}
                className="group rounded-2xl border border-subtle bg-card-surface p-4 hover:border-accent hover:-translate-y-0.5 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{doc.label}</h3>
                  <span className="text-[11px] text-muted group-hover:text-accent">View →</span>
                </div>
                <p className="mt-2 text-xs text-muted">{doc.description}</p>
              </Link>
            ))}
          </div>
        </PremiumFrame>

        {/* DYNAMIC LEAGUES / ORPHANS / DIRECTORY */}
        <SectionManifestGate section="dynasty" season={CURRENT_SEASON}>
          <DynastyLeaguesClient />
        </SectionManifestGate>

        {/* ABOUT THE MANAGERS */}
        <PremiumFrame
          kicker="Staff"
          title="About the Managers"
          subtitle="Your Game Manager for the Heroes of Dynasty expansion leagues and the Game Creator overseeing the Dynasty Empire."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {MANAGERS.map((m) => (
              <div
                key={m.name}
                className="flex gap-4 rounded-2xl border border-subtle bg-card-surface p-4"
              >
                <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-full border border-subtle bg-panel">
                  <Image src={m.image} alt={m.name} fill className="object-cover" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
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
        </PremiumFrame>
      </div>
    </main>
  );
}
