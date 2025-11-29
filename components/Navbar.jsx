"use client";
import { siteConfig } from "@/app/config/siteConfig";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiMenu,
  FiX,
  FiHome,
  FiUsers,
  FiBriefcase,
  FiSun,
  FiMoon,
  FiBarChart2,
  FiTrendingUp,
} from "react-icons/fi";

const NAV_ITEMS = [
  { name: "Home", to: "/", icon: FiHome },
  { name: "Leaderboards", to: "/leaderboards", icon: FiBarChart2 },
  { name: "About", to: "/about", icon: FiUsers },
  { name: "Constitution", to: "/constitution", icon: FiBriefcase },
  { name: "News", to: "/news", icon: FiTrendingUp  },
  
];

export default function Navbar() {
  const pathname = usePathname();

  const [dark, setDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [visibleLinks, setVisibleLinks] = useState(NAV_ITEMS.length);

  const containerRef = useRef(null);   // whole <nav>
  const linksRef = useRef([]);         // each <li>
  const logoRef = useRef(null);        // logo block
  const rightRef = useRef(null);       // theme + menu buttons

  const overflow = NAV_ITEMS.slice(visibleLinks);

  // ---------------- THEME ----------------
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    setDark(saved ? saved === "dark" : !!prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);

  // ---------------- SCROLL SHRINK ----------------
  useLayoutEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ---------------- LINK MEASUREMENT ----------------
  const updateVisibleLinks = () => {
    if (!containerRef.current) return;

    const navWidth = containerRef.current.offsetWidth || 0;
    const logoWidth = logoRef.current?.offsetWidth || 0;
    const rightWidth = rightRef.current?.offsetWidth || 0;

    // How much room the UL realistically has
    const horizontalPadding = 32; // accounts for px-4 on the inner div
    const buffer = 60;            // tweak this to hide links earlier/later

    const availableWidth =
      navWidth - logoWidth - rightWidth - horizontalPadding - buffer;

    if (availableWidth <= 0) {
      // Nothing fits; we still want *at least* 1 link
      setVisibleLinks(1);
      return;
    }

    let used = 0;
    let count = 0;

    for (let i = 0; i < NAV_ITEMS.length; i++) {
      const el = linksRef.current[i];
      if (!el) break;
      const w = el.offsetWidth || 0;

      if (used + w > availableWidth) break;

      used += w + 16; // 16px "gap" between links
      count++;
    }

    const MIN_VISIBLE = 1;
    setVisibleLinks(Math.max(count, MIN_VISIBLE));
  };

  // run once + on resize
  useLayoutEffect(() => {
    updateVisibleLinks();
    const onResize = () => updateVisibleLinks();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-measure when dark mode might change font metrics slightly
  useEffect(() => {
    updateVisibleLinks();
  }, [dark]);

  // lock body scroll when sidebar open; auto-close if no overflow
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", open);
    if (open && overflow.length === 0) setOpen(false);
  }, [open, overflow.length]);

  return (
    <>
      <nav
        ref={containerRef}
        className={`navbar shadow-md transition-all duration-300 ${
          scrolled ? "h-12" : "h-16"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-full px-4 md:px-8 overflow-hidden">
          {/* Left: logo + links */}
          <div className="flex items-center flex-1 min-w-0">
            <Link
              href="/"
              className="flex items-center flex-shrink-0"
              ref={logoRef}
            >
              <img
                src="/logo_navbar@2x.png"
                alt={siteConfig.name}
                width={scrolled ? 24 : 32}
                height={scrolled ? 24 : 32}
                className={`${scrolled ? "h-8 w-8" : "h-14 w-14"} transition-all`}
              />
              {/* If you re-add text here later, it's included in logoWidth */}
              {/* <span className="ml-2 font-bold">{siteConfig.shortName}</span> */}
            </Link>

            <ul className="flex items-center space-x-4 ml-6 overflow-hidden flex-nowrap relative">
              {NAV_ITEMS.map((item, i) => (
                <li
                  key={item.to}
                  ref={(el) => (linksRef.current[i] = el)}
                  className={`transition-all duration-300 ease-in-out ${
                    i < visibleLinks
                      ? "opacity-100 static pointer-events-auto"
                      : "opacity-0 absolute -z-10 pointer-events-none"
                  }`}
                >
                  <Link
                    href={item.to}
                    className={`flex items-center space-x-1 transition-colors duration-200 ${
                      pathname === item.to
                        ? "text-primary font-semibold"
                        : "text-fg dark:text-muted hover:text-accent dark:hover:text-primary"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="whitespace-nowrap">{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: controls */}
          <div
            className="flex items-center flex-shrink-0 space-x-2 pl-4"
            ref={rightRef}
          >
            <button
              onClick={() => setDark((prev) => !prev)}
              className="p-2 text-xl text-fg dark:text-muted hover:text-accent dark:hover:text-primary transition"
              aria-label="Toggle dark mode"
              type="button"
            >
              {dark ? <FiSun /> : <FiMoon />}
            </button>

            {overflow.length > 0 && (
              <button
                className="p-2 text-2xl text-primary"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                aria-controls="mobile-menu"
                aria-expanded={open ? "true" : "false"}
                type="button"
              >
                <FiMenu />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {open && (
        <div
          className="fixed inset-0 scrim backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Slide-in Sidebar (overflow links) */}
      <aside
        id="mobile-menu"
        className={`fixed top-0 left-0 h-full w-3/4 max-w-xs z-50 transform transition-transform duration-300 ease-in-out card ${
          open ? "translate-x-0" : "-translate-x-full"
        } flex flex-col justify-between touch-none`}
        role="dialog"
        aria-modal="true"
      >
        <div>
          <div className="flex justify-end p-4">
            <button
              onClick={() => setOpen(false)}
              className="text-2xl text-muted dark:text-muted hover:text-primary transition"
              aria-label="Close menu"
              type="button"
            >
              <FiX />
            </button>
          </div>

          <nav className="px-6 space-y-6">
            {overflow.map((item) => (
              <Link
                key={item.to}
                href={item.to}
                className={`flex items-center space-x-2 text-xl font-medium transition-colors duration-200 ${
                  pathname === item.to
                    ? "text-accent"
                    : "text-fg dark:text-muted hover:text-primary dark:hover:text-accent"
                }`}
                onClick={() => setOpen(false)}
              >
                <item.icon className="w-6 h-6" />
                <span>{item.name}</span>
              </Link>
            ))}

            <button
              onClick={() => setDark((prev) => !prev)}
              className="flex items-center space-x-2 text-xl p-2 mt-6 text-fg dark:text-muted hover:text-accent dark:hover:text-primary transition"
              type="button"
            >
              {dark ? <FiSun className="w-6 h-6" /> : <FiMoon className="w-6 h-6" />}
              <span>{dark ? "Light Mode" : "Dark Mode"}</span>
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
}
