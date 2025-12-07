// app/page.jsx
import Link from "next/link";
import LiteYouTube from "@/components/LiteYouTube";
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `${siteConfig.title}`;
const pageUrl = `${siteConfig.domain}/`;

export const metadata = {
  title: pageTitle,
  description: siteConfig.description,
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  const videoId = siteConfig.heroVideoId;
  const mp4Src = siteConfig.heroVideoMp4;

  return (
    <>
      {/* HERO */}
      <section className="">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid md:grid-cols-2 gap-10 items-center">
          <div>
            {/* SEO H1 */}
            <h1 className="text-4xl md:text-5xl font-extrabold text-primary leading-tight">
              {siteConfig.default} on{" "}
              <span className="text-accent">{siteConfig.platformLabel ?? "Sleeper!"}</span>
            </h1>

            {/* Brand slogan */}
            <p className="mt-2 text-2xl md:text-3xl font-semibold text-primary">
              {siteConfig.brandslogan1}{" "}
              <span className="text-accent">{siteConfig.brandslogan2}</span>
            </p>

            <p className="mt-4 text-lg text-fg">
              {siteConfig.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="https://youtube.com/@theballsvillegame?si=AaqiZ31C1a1pjVMh"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary rounded-xl"
              >
                Check out our YouTube!
              </Link>

              <Link
                href="/constitution"
                className="btn btn-outline rounded-xl"
              >
                View Code of Conduct
              </Link>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-xl border border-subtle bg-subtle-surface">
            <LiteYouTube id={videoId} mp4Src={mp4Src} title="Ballsville Games" />
          </div>
        </div>
      </section>

      {/* GAMES OFFERED */}
      <section className="px-4 py-16 ">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold text-primary">Games Offered</h2>

          <p className="text-lg text-fg leading-relaxed max-w-3xl mx-auto">
            <strong>{siteConfig.name}</strong> is proud to provide a full slate of
            <strong> fantasy football formats</strong> designed for every type of player —{" "}
            from competitive veterans to casual fans.
          </p>

          {/* Game Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-10">
            {/* Bestball */}
            <Link
              href="/big-game/"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              {/* IMAGE AREA – shows page background through the PNG */}
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans">
                <img
                  src="/photos/biggame-v2.webp"
                  alt="Bestball tournaments"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>

              {/* TEXT AREA – uses card surface so it still feels like a card */}
              <div className="bg-card-surface p-4 flex-1 flex flex-col justify-between group-hover:bg-subtle-surface transition-colors">
                <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                  Bestball Tournaments
                </h3>
                <p className="mt-2 text-sm text-muted">
                  High-volume, high-upside contests with season-long sweat and no weekly lineup stress.
                </p>
              </div>
            </Link>


            {/* Redraft */}
            <Link
              href="/redraft/"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans">
                <img
                  src="/photos/redraft-v2.webp"
                  alt="Redraft leagues"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="bg-card-surface p-4 flex-1 flex flex-col justify-between group-hover:bg-subtle-surface transition-colors">
                <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                  Redraft
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Classic one-year leagues with tiered buy-ins and a clean slate every season.
                </p>
              </div>
            </Link>

            {/* Dynasty */}
            <Link
              href="/dynasty"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans">
                <img
                  src="/photos/dynasty-v2.webp"
                  alt="Dynasty / Empire leagues"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="bg-card-surface p-4 flex-1 flex flex-col justify-between group-hover:bg-subtle-surface transition-colors">
                <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                  Dynasty / Empire
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Long-term team building in the Dragons of Dynasty &amp; Empire-style formats.
                </p>
              </div>
            </Link>

            {/* Gauntlet Leagues */}
            <Link
              href="/gauntlet"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans">
                <img
                  src="/photos/thegauntlet-v2.webp"
                  alt="Gauntlet leagues"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="bg-card-surface p-4 flex-1 flex flex-col justify-between group-hover:bg-subtle-surface transition-colors">
                <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                  Gauntlet Leagues
                </h3>
                <p className="mt-2 text-sm text-muted">
                  A Ballsville spin on fantasy: start in redraft, survive guillotine, finish in
                  bestball.
                </p>
              </div>
            </Link>

            {/* Mini Leagues */}
            <Link
              href="/games/mini"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans">
                <img
                  src="/photos/minileagues-v2.webp"
                  alt="Mini bestball leagues"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="bg-card-surface p-4 flex-1 flex flex-col justify-between group-hover:bg-subtle-surface transition-colors">
                <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                  Mini Leagues
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Budget-friendly mini-leagues to keep you drafting year-round.
                </p>
              </div>
            </Link>

            {/* Mini Games */}
            <Link
              href="/news"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans">
                <img
                  src="/photos/minigames-v2.webp"
                  alt="Mini Extras & Challenges"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="bg-card-surface p-4 flex-1 flex flex-col justify-between group-hover:bg-subtle-surface transition-colors">
                <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                  Mini Games
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Various minigames throughout the year. Check out the news for a chance to win
                  free entries!
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* LEAGUE SHOWS / PODCASTS */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Intro copy */}
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold text-primary">{siteConfig.name}</h2>
            <p className="text-lg text-fg">
              Welcome to <strong>{siteConfig.name}</strong> — your trusted resource for{" "}
              <strong>Fantasy Football.</strong>
            </p>
            <p className="text-fg max-w-2xl mx-auto">
              We&apos;re building more than leagues — we&apos;re building a show slate.
              Tune in for weekly recaps, soundboards, and league-specific content
              featuring trades, score leaders, and our best competitors.
            </p>
            <h3 className="text-xl font-bold text-primary">
              Check out our league podcasts &amp; live shows
            </h3>
          </div>

          {/* Show cards */}
          <div className="grid gap-8 md:grid-cols-2">
            {/* The Gauntlet Recap */}
            <Link
              href="https://youtube.com/@theballsvillegame?si=AaqiZ31C1a1pjVMh"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl overflow-hidden border border-subtle bg-card-surface hover:bg-subtle-surface backdrop-blur-sm shadow-sm hover:shadow-lg transition flex flex-col md:flex-row"
            >
              <div className="md:w-1/2">
                <div className="relative w-full h-full aspect-[16/9] bg-black/80 overflow-hidden">
                  <picture>
                    <source
                      type="image/webp"
                      srcSet="/photos/gauntlet-640.webp 640w, /photos/gauntlet-1280.webp 1280w"
                    />
                    <img
                      src="/photos/gauntlet-640.webp"
                      alt="The Gauntlet Recap artwork"
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                  </picture>
                </div>
              </div>

              <div className="md:w-1/2 p-5 flex flex-col justify-center text-left">
                <h4 className="text-lg font-semibold text-primary">
                  The Gauntlet Recap
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-fg">
                  <li>• Tuesday Nights</li>
                  <li>• Weekly Gauntlet breakdowns &amp; storylines</li>
                  <li>• @8:30 PM EST (subject to change)</li>
                </ul>
                <p className="mt-3 text-xs text-muted">
                  Click to watch on YouTube →
                </p>
              </div>
            </Link>

            {/* FF SoundBoard */}
            <Link
              href="https://youtube.com/@theballsvillegame?si=AaqiZ31C1a1pjVMh"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl overflow-hidden border border-subtle bg-card-surface hover:bg-subtle-surface backdrop-blur-sm shadow-sm hover:shadow-lg transition flex flex-col md:flex-row"
            >
              <div className="md:w-1/2 order-1 md:order-none">
                <div className="relative w-full h-full aspect-[16/9] bg-black/80 overflow-hidden">
                  <picture>
                    <source
                      type="image/webp"
                      srcSet="/photos/soundboard-640.webp 640w, /photos/soundboard-1280.webp 1280w"
                    />
                    <img
                      src="/photos/soundboard-640.webp"
                      alt="FF SoundBoard artwork"
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                  </picture>
                </div>
              </div>

              <div className="md:w-1/2 p-5 flex flex-col justify-center text-left">
                <h4 className="text-lg font-semibold text-primary">
                  The FF SoundBoard
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-fg">
                  <li>• Wednesday Nights</li>
                  <li>• Clips, reactions, and league sound drops</li>
                  <li>• @8:30 PM EST (subject to change)</li>
                </ul>
                <p className="mt-3 text-xs text-muted">
                  Click to watch on YouTube →
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* HALL OF FAME / 2024 WINNERS */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Link href="/winners/2024" className="inline-block group">
            <picture>
              <source
                type="image/webp"
                srcSet="/photos/halloffame-640.webp 640w, /photos/halloffame-1280.webp 1280w"
                sizes="(max-width: 768px) 90vw, 640px"
              />
              <img
                src="/photos/halloffame-640.webp"
                alt="BALLSVILLE Hall of Fame corridor"
                className="mx-auto w-full max-w-xl rounded-3xl shadow-xl border border-subtle group-hover:border-accent group-hover:shadow-2xl transition"
                loading="lazy"
              />
            </picture>
          </Link>

          <h2 className="text-3xl font-bold text-primary">
            Our Game Winners For 2024
          </h2>
        </div>
      </section>
    </>
  );
}
