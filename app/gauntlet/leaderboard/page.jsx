import Link from "next/link";

const SCOREBOARD_URL =
  "https://docs.google.com/spreadsheets/d/1UuAI4mNQtcnnZZiYyybfIGoczFCZRvuhTzXqk-h2RLQ/edit?usp=drivesdk";

const SCOREBOARD_EMBED_URL =
  "https://docs.google.com/spreadsheets/d/1UuAI4mNQtcnnZZiYyybfIGoczFCZRvuhTzXqk-h2RLQ/htmlembed?widget=true&headers=false";

export const metadata = {
  title: "Gauntlet Scoreboard",
  description:
    "Live tracking, standings, and stacked winnings for the 2026 BALLSVILLE Gauntlet game.",
};

export default function GauntletScoreboardPage() {
  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface p-6 shadow-xl md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
              <div className="absolute right-1/3 top-10 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
            </div>

            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-3xl space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">
                  THE BALLSVILLE GAME #5 · 2026
                </p>
                <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                  Gauntlet <span className="text-primary">Scoreboard</span>
                </h1>
                <p className="max-w-2xl text-sm text-muted sm:text-base">
                  Follow the full Gauntlet field, stacked winnings, and game results from one live scoreboard.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link prefetch={false} href="/gauntlet" className="btn btn-outline">
                  ← Back to Gauntlet
                </Link>
                <a
                  href={SCOREBOARD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                >
                  Open in Google Sheets ↗
                </a>
              </div>
            </div>
          </header>

          <section className="overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-fg">Live Gauntlet Scoreboard</h2>
                <p className="mt-1 text-xs text-muted">
                  Updates made to the official scoreboard appear here automatically.
                </p>
              </div>

              <a
                href={SCOREBOARD_URL}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-accent hover:underline underline-offset-4"
              >
                Fullscreen view →
              </a>
            </div>

            <div className="bg-white">
              <iframe
                title="2026 BALLSVILLE Gauntlet Scoreboard"
                src={SCOREBOARD_EMBED_URL}
                className="h-[72vh] min-h-[560px] w-full md:h-[80vh] md:min-h-[680px]"
                loading="eager"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>

          <p className="px-2 text-center text-xs text-muted">
            On a smaller screen, swipe inside the scoreboard to move across columns or use the fullscreen view.
          </p>
        </div>
      </section>
    </main>
  );
}
