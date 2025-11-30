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
        {/* Header */}
        <header className="text-center space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">
            the BALLSVILLE game
          </p>
          <h1 className="h1 mt-1 text-primary">Live Leaderboards</h1>
          <p className="lead mt-1 text-muted max-w-2xl mx-auto">
            View real-time standings for the BIG Game, mini-Leagues, Gauntlet,
            and more — powered by our automated BALLSVILLE leaderboard engine.
          </p>
        </header>

        {/* Embedded leaderboard app */}
        <div className="card-lg bg-card-surface border border-subtle p-0 overflow-hidden">
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
