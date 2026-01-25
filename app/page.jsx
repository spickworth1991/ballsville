// app/page.jsx
import Link from "next/link";
import LiteYouTube from "@/components/LiteYouTube";
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `${siteConfig.title}`;

export const metadata = {
  title: pageTitle,
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: pageTitle,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

function ReadableSection({ children, className = "" }) {
  return (
    <section className={`section ${className}`}>
      <div className="container-site">
        {/* subtle premium framing + glow */}
        <div className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-50 mix-blend-screen">
            <div className="absolute -top-24 -left-16 h-60 w-60 rounded-full bg-[color:var(--color-accent)]/15 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-60 w-60 rounded-full bg-[color:var(--color-primary)]/12 blur-3xl" />
          </div>
          <div className="relative">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  const videoId = siteConfig.heroVideoId;
  const mp4Src = siteConfig.heroVideoMp4;

  return (
    <>
      {/* HERO */}
      <ReadableSection className="pt-8 pb-6">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-primary leading-tight">
              {siteConfig.default} on{" "}
              <span className="text-accent">
                {siteConfig.platformLabel ?? "Sleeper!"}
              </span>
            </h1>

            <p className="mt-2 text-2xl md:text-3xl font-semibold text-primary">
              {siteConfig.brandslogan1}{" "}
              <span className="text-accent">{siteConfig.brandslogan2}</span>
            </p>

            <p className="mt-4 text-lg text-fg">{siteConfig.description}</p>

            {/* quick “wow” badges */}
            <div className="mt-5 flex flex-wrap gap-2 text-xs sm:text-sm">
              <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                ⚡ Live tools + content
              </span>
              <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                🏆 Payout formats that scale
              </span>
              <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                🎥 Shows + recaps
              </span>
            </div>

            <div className="mt-7 flex flex-wrap gap-4">
              <Link
                prefetch={false}
                href="https://youtube.com/@theballsvillegame?si=AaqiZ31C1a1pjVMh"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary rounded-xl"
              >
                Check out our YouTube!
              </Link>

              <Link prefetch={false} href="/constitution" className="btn btn-outline rounded-xl">
                View Code of Conduct
              </Link>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-xl border border-subtle bg-card-trans backdrop-blur-sm">
            <LiteYouTube id={videoId} mp4Src={mp4Src} title="Ballsville Games" />
          </div>
        </div>
      </ReadableSection>

      {/* GAMES OFFERED */}
      <ReadableSection className="py-6">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">
              Formats
            </p>
            <h2 className="text-3xl font-bold text-primary">Games Offered</h2>
          </div>

          <p className="text-lg text-fg leading-relaxed max-w-3xl mx-auto">
            <strong>{siteConfig.name}</strong> is proud to provide a full slate
            of <strong> fantasy football formats</strong> designed for every
            type of player — from competitive veterans to casual fans.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-8">
            <Link
              prefetch={false}
              href="/big-game/"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans backdrop-blur-sm">
                <img
                  src="/photos/biggame-v2.webp"
                  alt="Bestball tournaments"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="bg-card-surface p-4 flex-1 flex flex-col justify-between group-hover:bg-subtle-surface transition-colors">
                <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                  Bestball Tournaments
                </h3>
                <p className="mt-2 text-sm text-muted">
                  High-volume, high-upside contests with season-long sweat and
                  no weekly lineup stress.
                </p>
              </div>
            </Link>

            <Link
              prefetch={false}
              href="/redraft/"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans backdrop-blur-sm">
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
                  Classic one-year leagues with tiered buy-ins and a clean slate
                  every season.
                </p>
              </div>
            </Link>

            <Link
              prefetch={false}
              href="/dynasty"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans backdrop-blur-sm">
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
                  Long-term team building in the Dragons of Dynasty &amp;
                  Empire-style formats.
                </p>
              </div>
            </Link>

            <Link
              prefetch={false}
              href="/gauntlet"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans backdrop-blur-sm">
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
                  A Ballsville spin on fantasy: start in redraft, survive
                  guillotine, finish in bestball.
                </p>
              </div>
            </Link>

            <Link
              prefetch={false}
              href="/mini-leagues"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans backdrop-blur-sm">
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

            <Link
              prefetch={false}
              href="/highlander"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans backdrop-blur-sm">
                <img
                  src="/photos/biggame-v2.webp"
                  alt="Highlander elimination best ball"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="bg-card-surface p-4 flex-1 flex flex-col justify-between group-hover:bg-subtle-surface transition-colors">
                <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                  Highlander
                </h3>
                <p className="mt-2 text-sm text-muted">
                  18-team survival Best Ball — lowest score each week is eliminated.
                </p>
              </div>
            </Link>

            <Link
              prefetch={false}
              href="/news"
              className="group rounded-2xl overflow-hidden border border-subtle shadow-sm hover:shadow-lg transition flex flex-col text-left bg-transparent"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-card-trans backdrop-blur-sm">
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
                  Various minigames throughout the year. Check out the news for
                  a chance to win free entries!
                </p>
              </div>
            </Link>
          </div>
        </div>
      </ReadableSection>

      {/* LEAGUE SHOWS / PODCASTS */}
      <ReadableSection className="py-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="space-y-4 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">
              Shows
            </p>
            <h2 className="text-3xl font-bold text-primary">{siteConfig.name}</h2>
            <p className="text-lg text-fg">
              Welcome to <strong>{siteConfig.name}</strong> — your trusted
              resource for <strong>Fantasy Football.</strong>
            </p>
            <p className="text-fg max-w-2xl mx-auto">
              We&apos;re building more than leagues — we&apos;re building a show
              slate. Tune in for weekly recaps, soundboards, and league-specific
              content featuring trades, score leaders, and our best competitors.
            </p>
            <h3 className="text-xl font-bold text-primary">
              Check out our league podcasts &amp; live shows
            </h3>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Link
              prefetch={false}
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
                <p className="mt-3 text-xs text-muted">Click to watch on YouTube →</p>
              </div>
            </Link>

            <Link
              prefetch={false}
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
                <p className="mt-3 text-xs text-muted">Click to watch on YouTube →</p>
              </div>
            </Link>
          </div>
        </div>
      </ReadableSection>

      {/* HALL OF FAME / 2024 WINNERS */}
      <ReadableSection className="py-6 pb-10">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">
            History
          </p>

          <Link prefetch={false} href="/hall-of-fame" className="inline-block group">
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

          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <Link prefetch={false} href="/hall-of-fame" className="btn btn-outline rounded-xl">
              View Hall of Fame →
            </Link>
            <Link prefetch={false} href="/news" className="btn btn-primary rounded-xl">
              Latest Updates →
            </Link>
          </div>
        </div>
      </ReadableSection>
    </>
  );
}
