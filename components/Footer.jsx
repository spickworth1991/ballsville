"use client";

import { siteConfig } from "@/app/config/siteConfig";
import { FaDiscord } from "react-icons/fa";

export default function Footer() {
  // If you later add this into siteConfig, you can swap here:
  const youtubeUrl =
    siteConfig.youtubeUrl ||
    "https://youtube.com/@theballsvillegame?si=AaqiZ31C1a1pjVMh";

  const discordUrl =
    siteConfig.discordUrl || "https://discord.gg/ballsville"; // <-- replace with your real invite

  return (
    <>
      <footer className="bg-bg text-fg border-t border-subtle py-12 px-4 md:px-8 mt-16 md:mt-0">
        <div className="container-site grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Quick Links */}
          <div>
            <h2 className="h3 mb-4">Quick Links</h2>
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
                <a href="/faq" className="hover:text-primary">
                  FAQ
                </a>
              </li>
              <li>
                <a href="/contact" className="hover:text-primary">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* YouTube Feature */}
          <div>
            <h2 className="h3 mb-4">
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
              className="block w-full h-40 rounded-lg overflow-hidden card hover:shadow-lg transition"
              aria-label="Open the BALLSVILLE YouTube channel in a new tab"
            >
              <picture>
                {/* Update these paths to whatever thumbnail you drop in /public */}
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

            <p className="mt-2 text-sm text-muted">
              Game breakdowns, history, and highlight reels from{" "}
              <span className="font-semibold">the BALLSVILLE game</span>.
            </p>
          </div>

          {/* Social & Contact-ish */}
          <div>
            <h2 className="h3 mb-4">Connect With Us</h2>

            <div className="flex items-center gap-3 mb-4 text-xl">
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join our Discord — opens in a new tab"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-subtle hover:border-accent hover:text-accent transition"
              >
                <FaDiscord />
                <span className="sr-only">Discord</span>
              </a>
              <span className="text-sm text-muted">
                Join the BALLSVILLE Discord for updates, rule clarifications,
                and league chat.
              </span>
            </div>

            <div className="space-y-1 text-sm text-muted">
              <p className="font-semibold">{siteConfig.name}</p>
              <p>
                Questions or issues?{" "}
                <a
                  href="mailto:contact.ballsville@gmail.com"
                  className="underline decoration-accent underline-offset-2 hover:text-primary"
                >
                  contact.ballsville@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="container-site">
          <p className="mt-10 text-center text-sm text-muted">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
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

      {/* <CallNowBar />  — PT-only, so we leave this disabled */}
    </>
  );
}
