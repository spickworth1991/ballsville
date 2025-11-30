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
  const videoId = siteConfig.heroVideoId;       // maybe "" for no YouTube
  const mp4Src  = siteConfig.heroVideoMp4; 

 

  return (
    <>
      {/* Hero Section */}

      <section className="">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            {/* SEO H1 */}
            <h1 className="text-4xl md:text-5xl font-extrabold text-primary dark:text-accent leading-tight">
              {siteConfig.default} on <span className="text-accent dark:text-primary">Sleeper!</span>
            </h1>

            {/* Brand slogan */}
            <p className="mt-2 text-2xl md:text-3xl font-semibold text-primary dark:text-accent">
              {siteConfig.brandslogan1} <span className="text-accent dark:text-primary">{siteConfig.brandslogan2}</span>
            </p>

            <p className="mt-4 text-lg text-fg dark:text-gray-200">
              {siteConfig.description}
            </p>

            <div className="mt-8 flex gap-4">
              <Link 
              href="https://youtube.com/@theballsvillegame?si=AaqiZ31C1a1pjVMh" 
              target="_blank"
              rel="noopener noreferrer" 
              className="px-6 py-3 rounded-xl border border-primary hover:border-accent bg-card dark:bg-card text-primary hover:text-accent dark:hover-text-primary hover:opacity-90 transition">
                Check out our Youtube!
              </Link>
              <Link 
              href="/constitution" 
              className="px-6 py-3 rounded-xl border border-accent hover:border-primary bg-card dark:bg-card text-accent hover:text-primary transition">
                View Code of Conduct
              </Link>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-xl">
            <LiteYouTube id={videoId} mp4Src={mp4Src} title="Ballsville Games" />
          </div>
        </div>
      </section>
        
        {/* Games Offered */}
          <section className="px-4 py-16 border-t border-subtle">
            <div className="max-w-5xl mx-auto text-center space-y-6">
              <h2 className="text-3xl font-bold text-primary">Games Offered</h2>

              <p className="text-lg text-fg dark:text-gray-200 leading-relaxed max-w-3xl mx-auto">
                <strong>{siteConfig.name}</strong> is proud to provide a full slate of
                <strong> fantasy football formats</strong> designed for every type of player — 
                from competitive veterans to casual fans.
              </p>

              {/* Game Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-10">

                {/* Bestball */}
                <Link
                  href="/games/bestball"
                  className="group card overflow-hidden rounded-xl border border-subtle hover:border-accent bg-bg/70 hover:bg-bg transition flex flex-col text-left"
                >
                  <div className="relative w-full aspect-square bg-black/80 overflow-hidden">
                    <img
                      src="/photos/biggame.webp"
                      alt="Bestball tournaments"
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
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
                  href="/games/redraft"
                  className="group card overflow-hidden rounded-xl border border-subtle hover:border-accent bg-bg/70 hover:bg-bg transition flex flex-col text-left"
                >
                  <div className="relative w-full aspect-square bg-black/80 overflow-hidden">
                    <img
                      src="/photos/redraft.webp"
                      alt="Redraft leagues"
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
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
                  href="/games/dynasty"
                  className="group card overflow-hidden rounded-xl border border-subtle hover:border-accent bg-bg/70 hover:bg-bg transition flex flex-col text-left"
                >
                  <div className="relative w-full aspect-square bg-black/80 overflow-hidden">
                    <img
                      src="/photos/dynasty.webp"
                      alt="Dynasty / Empire leagues"
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
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
                  href="/games/custom"
                  className="group card overflow-hidden rounded-xl border border-subtle hover:border-accent bg-bg/70 hover:bg-bg transition flex flex-col text-left"
                >
                  <div className="relative w-full aspect-square bg-black/80 overflow-hidden">
                    <img
                      src="/photos/thegauntlet.webp"
                      alt="Gauntlet leagues"
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                      Gauntlet Leagues
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      A Ballsville spin on fantasy: start in redraft, survive guillotine, finish in bestball.
                    </p>
                  </div>
                </Link>

                {/* Mini Games */}
                <Link
                  href="/games/mini"
                  className="group card overflow-hidden rounded-xl border border-subtle hover:border-accent bg-bg/70 hover:bg-bg transition flex flex-col text-left"
                >
                  <div className="relative w-full aspect-square bg-black/80 overflow-hidden">
                    <img
                      src="/photos/minileagues.webp"
                      alt="Mini bestball leagues"
                      className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <h3 className="text-lg font-semibold text-primary group-hover:text-accent">
                      Mini Games
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      Budget-friendly mini-leagues to keep you drafting year-round.
                    </p>
                  </div>
                </Link>

              </div>
            </div>
          </section>

          {/* League Shows / Podcasts */}
          <section className="py-16 px-4">
            <div className="max-w-5xl mx-auto space-y-10">
              {/* Intro copy */}
              <div className="space-y-4 text-center">
                <h2 className="text-3xl font-bold text-primary">{siteConfig.name}</h2>
                <p className="text-lg text-fg dark:text-gray-200">
                  Welcome to <strong>{siteConfig.name}</strong> — your trusted resource for{" "}
                  <strong>Fantasy Football.</strong>
                </p>
                <p className="text-fg dark:text-gray-200 max-w-2xl mx-auto">
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
                  className="card group flex flex-col md:flex-row overflow-hidden border border-subtle bg-card/70 hover:border-accent hover:shadow-lg transition"
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
                    <ul className="mt-2 space-y-1 text-sm text-fg dark:text-gray-200">
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
                  className="card group flex flex-col md:flex-row overflow-hidden border border-subtle bg-card/70 hover:border-accent hover:shadow-lg transition"
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
                    <ul className="mt-2 space-y-1 text-sm text-fg dark:text-gray-200">
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



      {/* Hall of Fame / 2024 Winners */}
        <section className="px-4 py-16 border-t border-subtle">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <Link
              href="/winners/2024"
              className="inline-block group"
            >
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
