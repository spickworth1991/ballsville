// app/about/page.jsx  (Server Component)
import LiteYouTube from "@/components/LiteYouTube";
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `About | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/about`;

export const metadata = {
  title: pageTitle,
  description: `About the BALLSVILLE game and Westlex fantasy leagues.`,
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description: `Learn the history and structure of the BALLSVILLE game and Westlex fantasy leagues.`,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  // Let this be flexible: if you add aboutVideoId/aboutVideoMp4 later, it’ll use those;
  // otherwise it falls back to the hero video config.
  const aboutVideoId =
    siteConfig.aboutVideoId || siteConfig.heroVideoId || "";
  const aboutMp4 =
    siteConfig.aboutVideoMp4 || siteConfig.heroVideoMp4 || "";

  return (
    <section className="section">
      <div className="container-site  space-y-8">
        {/* Hero */}
        <header className="text-center mb-4">
          <span className="badge">About the BALLSVILLE game</span>
          <h1 className="h1 mt-3">How BALLSVILLE Became a Game of Games</h1>
          <p className="lead mt-3 max-w-2xl mx-auto">
            From a handful of best ball leagues to a full ecosystem of
            tournaments, dynasty empires, and redraft tiers — all built around
            big ceilings and fair odds.
          </p>
        </header>

        {/* Origins / History card */}
        <article className="card p-6 md:p-8 space-y-4">
          <h2 className="h3">The BALLSVILLE game</h2>

          <p>
            The BALLSVILLE game began in 2020 with eight bestball leagues.
            Westlex created the original Game of Thrones leagues. These leagues
            played from weeks 1–15 of the NFL season, and faced off by wagering
            with their winnings in Week 16. A full demo can be seen below.
          </p>

          <p>
            Over the years, our game has expanded to 96 leagues for{" "}
            <span className="font-semibold">“the BIG game”</span>, our
            trademark game of bestball.
          </p>

          <p>
            We also introduced 40 leagues of{" "}
            <span className="font-semibold">“Way-too-early” bestball</span>. We
            call these the <span className="font-semibold">“mini-Leagues”</span>
            . These are budget friendly leagues that keep us busy until the NFL
            Draft.
          </p>

          <p>
            Our <span className="font-semibold">Dynasty / Empire</span> game has
            been a main attraction as well. This game includes 16 leagues, and
            we call that <span className="font-semibold">“the Dragons of Dynasty”</span>.
          </p>

          <p>
            Lastly, we have the <span className="font-semibold">Redraft game</span>.
            This game includes 30 leagues, divided into three tiers:{" "}
            <span className="font-semibold">$100 buy-in</span>,{" "}
            <span className="font-semibold">$50</span>, and{" "}
            <span className="font-semibold">$25</span>.
          </p>

          <p>
            All of these games have a large max upside, while maintaining the
            same odds to win your leagues. The BALLSVILLE formula was developed
            to facilitate this combination of big payouts and great odds.
          </p>

          <h3 className="mt-6 text-lg font-semibold">
            Our BALLSVILLE game&apos;s history
          </h3>

          {(aboutVideoId || aboutMp4) && (
            <div className="mt-4">
              <LiteYouTube
                id={aboutVideoId}
                mp4Src={aboutMp4}
                title="Our BALLSVILLE game's history"
              />
            </div>
          )}
        </article>

        {/* Today / Code card */}
        <article className="card p-6 md:p-8 space-y-4">
          <h2 className="h3">How the game runs today</h2>

          <p>
            Today our games are well run, with the help of{" "}
            <span className="font-semibold">Game Managers</span>. These managers
            are assigned to a set number of leagues. Together, we monitor for
            fairness and violations of our Code of Conduct.
          </p>

          <p>
            The code applies to all players, and outlines behavior and trade
            practices. Our code is designed to protect players who join from
            being bullied, or having to deal with unfair trading or suspicious
            practices.
          </p>

          <p className="text-sm text-muted">
            For the full framework that covers trading, activity expectations,
            and league-wide behavior standards, please see our{" "}
            <a
              href="/constitution"
              className="underline underline-offset-4 decoration-accent hover:text-accent"
            >
              League Constitution &amp; Code of Conduct
            </a>
            .
          </p>
        </article>
      </div>
    </section>
  );
}
