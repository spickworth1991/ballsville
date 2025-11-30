"use client";

import { siteConfig } from "@/app/config/siteConfig";
import { FaDiscord } from "react-icons/fa";

export default function Footer() {
  const youtubeUrl =
    siteConfig.youtubeUrl ||
    "https://youtube.com/@theballsvillegame?si=AaqiZ31C1a1pjVMh";

  const discordUrl =
    siteConfig.discordUrl || "https://discord.gg/ballsville";

  return (
    <>
      <footer className="footer text-fg border-t border-subtle py-12 px-4 md:px-8 mt-16 md:mt-0">
        <div className="container-site grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Quick Links */}
          <div className="space-y-3">
            <h2 className="h3 mb-2">Quick Links</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="hover:text-primary">
                  Home
                </a>
              </li>
              <li>
                <a href="/about" className="hover:text-primary">
                  About
                </a>
              </li>
              <li>
                <a href="/constitution" className="hover:text-primary">
                  Constitution
                </a>
              </li>
              <li>
                <a href="/leaderboards" className="hover:text-primary">
                  Leaderboards
                </a>
              </li>
              <li>
                <a href="/news" className="hover:text-primary">
                  News
                </a>
              </li>
            </ul>
          </div>

          {/* YouTube Feature */}
          <div className="space-y-3">
            <h2 className="h3 mb-2">
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary underline decoration-accent underline-offset-4"
              >
                Watch on YouTube
              </a>
            </h2>

            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full h-40 rounded-lg overflow-hidden bg-subtle-surface border border-subtle hover:border-accent hover:shadow-lg transition"
              aria-label="Open the BALLSVILLE YouTube channel in a new tab"
            >
              <picture>
                <source
                  type="image/webp"
                  srcSet="/photos/ballsville-youtube-640.webp 1x, /photos/ballsville-youtube-1280.webp 2x"
                />
                <img
                  src="/photos/ballsville-youtube-640.webp"
                  alt="BALLSVILLE game highlight reel preview"
                  className="w-full h-full object-cover"
                  width="640"
                  height="360"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </a>

            <p className="text-sm text-muted">
              Game breakdowns, history, and highlight reels from{" "}
              <span className="font-semibold">the BALLSVILLE game</span>.
            </p>
          </div>

          {/* Social & Contact-ish */}
          <div className="space-y-4">
            <h2 className="h3 mb-2">Connect With Us</h2>

            <div className="flex items-center gap-3 text-sm">
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join our Discord — opens in a new tab"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-subtle bg-subtle-surface hover:border-accent hover:text-accent transition"
              >
                <FaDiscord />
                <span className="sr-only">Discord</span>
              </a>
              <span className="text-muted">
                Join the BALLSVILLE Discord for updates, rule clarifications,
                and league chat.
              </span>
            </div>

            <div className="space-y-1 text-sm text-muted">
              <p className="font-semibold">{siteConfig.name}</p>
              <p>
                Questions or issues?{" "}
                <a
                  href="mailto:theballsvillegame@gmail.com"
                  className="underline decoration-accent underline-offset-2 hover:text-primary"
                >
                  theballsvillegame@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="container-site">
          <p className="mt-10 text-center text-sm text-muted">
            © {new Date().getFullYear()} {siteConfig.name}. All rights
            reserved.
            <br />
            <span>
              Developed by{" "}
              <a
                href="mailto:contact.stickypicky@gmail.com"
                className="hover:text-primary underline decoration-accent decoration-1 underline-offset-2"
              >
                StickyPicky
              </a>
            </span>
          </p>
        </div>
      </footer>

    </>
  );
}
