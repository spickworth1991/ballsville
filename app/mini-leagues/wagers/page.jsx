import Link from "next/link";
import MiniLeaguesWagerTracker from "@/components/mini-leagues/MiniLeaguesWagerTracker";
import { CURRENT_SEASON } from "@/lib/season";

export const metadata = {
  title: "Mini Leagues Wager Tracker | Ballsville",
  description: "Track Mini Leagues Week 14 coins and Week 15 wagers/bonuses.",
};

export default function MiniLeaguesWagersPage() {
  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <header className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm p-6 shadow-xl shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-accent">BALLSVILLE</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">Mini Leagues Wager Tracker</h1>
              <p className="mt-2 text-sm text-muted">
                Week 14 league-winner coins ($30) + Week 15 wagers and bonuses.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                prefetch={false}
                href="/mini-leagues"
                className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-muted hover:border-accent/80 hover:text-white transition"
              >
                ← Back to Mini Leagues
              </Link>
            </div>
          </div>
        </header>

        <MiniLeaguesWagerTracker season={CURRENT_SEASON} />
      </div>
    </main>
  );
}
