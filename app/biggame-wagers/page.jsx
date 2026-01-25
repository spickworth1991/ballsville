import Link from "next/link";
import BigGameWagerTracker from "@/components/big-game/BigGameWagerTracker";
import { CURRENT_SEASON } from "@/lib/season2";

export const metadata = {
  title: "Big Game Wager Tracker | Ballsville",
  description:
    "Track Big Game division wagers and championship wagers.",
};

export default function BigGameWagersPage() {
  return (
    <main className="no-chrome relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <header className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm p-6 shadow-xl shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-accent">BALLSVILLE</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
                Big Game Wager Tracker
              </h1>
              <p className="mt-2 text-sm text-muted">
                Division wager pots (Week 16) and Big Game championship wagers (Week 17).
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                prefetch={false}
                href="/big-game"
                className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-muted hover:border-accent/80 hover:text-white transition"
              >
                ← Back to Big Game
              </Link>
              <Link
                prefetch={false}
                href="/big-game/divisions"
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-600/20 via-sky-600/10 to-purple-600/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 hover:shadow-xl hover:shadow-cyan-900/40 hover:-translate-y-0.5 transition"
              >
                🏟️ Divisions
              </Link>
            </div>
          </div>
        </header>

        <BigGameWagerTracker season={CURRENT_SEASON} />
      </div>
    </main>
  );
}
