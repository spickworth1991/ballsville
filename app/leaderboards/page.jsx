// app/leaderboards/page.jsx
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `Leaderboards | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/leaderboards`;

export const metadata = {
  title: pageTitle,
  description:
    "Live BALLSVILLE standings and leaderboards for all divisions and games.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description:
      "Live BALLSVILLE standings and leaderboards for all divisions and games.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  return (
    <section className="section">
      <div className="container-site max-w-6xl mx-auto space-y-8">
        {/* HERO (match your newer pages) */}
        <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
            <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
          </div>

          <div className="relative space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">
              the BALLSVILLE game
            </p>
            <h1 className="h1 mt-1 text-primary">Live Leaderboards</h1>
            <p className="lead mt-1 text-muted max-w-2xl mx-auto">
              View real-time standings for the BIG Game, mini-Leagues, Gauntlet,
              and more — powered by our automated BALLSVILLE leaderboard engine.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs sm:text-sm">
              <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                ⚡ Auto-updating
              </span>
              <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                📊 Divisions + formats
              </span>
              <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                🧠 Built by Ballsville
              </span>
            </div>
          </div>
        </header>

        {/* EMBED */}
        <div className="card-lg bg-card-surface border border-subtle p-0 overflow-hidden rounded-3xl shadow-md">
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-subtle">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted">
                Embedded App
              </p>
              <p className="text-sm text-muted">
                If anything looks weird, open it in a new tab.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <a
                className="btn btn-outline"
                href="https://ballsville-leaderboard.pages.dev/"
                target="_blank"
                rel="noreferrer"
              >
                Open in a new tab
              </a>
            </div>
          </div>

          <iframe
            src="https://ballsville-leaderboard.pages.dev/"
            title="BALLSVILLE Leaderboards"
            loading="lazy"
            allowFullScreen
            className="w-full h-[150vh] min-h-[600px] border-0"
          />
        </div>
      </div>
    </section>
  );
}
