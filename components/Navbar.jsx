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
  FiHelpCircle,
  FiGrid,
  FiChevronDown,
} from "react-icons/fi";

const NAV_ITEMS = [
  { id: "home", name: "Home", to: "/", icon: FiHome },
  {
    id: "game-modes",
    name: "Game Modes",
    icon: FiGrid,
    children: [
      { name: "The BIG Game", to: "/big-game" },
      { name: "Redraft", to: "/redraft" }, // adjust if your route is different
    ],
  },
  { id: "leaderboards", name: "Leaderboards", to: "/leaderboards", icon: FiBarChart2 },
  { id: "about", name: "About", to: "/about", icon: FiUsers },
  { id: "constitution", name: "Constitution", to: "/constitution", icon: FiBriefcase },
  { id: "news", name: "News", to: "/news", icon: FiTrendingUp },
  { id: "faqs", name: "Faqs", to: "/faq", icon: FiHelpCircle },
];

export default function Navbar() {
  const pathname = usePathname();

  const [dark, setDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [visibleLinks, setVisibleLinks] = useState(NAV_ITEMS.length);

  const [openDesktopMenuId, setOpenDesktopMenuId] = useState(null);
  const [openMobileMenuId, setOpenMobileMenuId] = useState(null);

  const containerRef = useRef(null);
  const linksRef = useRef([]);
  const logoRef = useRef(null);
  const rightRef = useRef(null);

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

    const horizontalPadding = 32;
    const buffer = 60;

    const availableWidth =
      navWidth - logoWidth - rightWidth - horizontalPadding - buffer;

    if (availableWidth <= 0) {
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

      used += w + 16; // gap
      count++;
    }

    const MIN_VISIBLE = 1;
    setVisibleLinks(Math.max(count, MIN_VISIBLE));
  };

  useLayoutEffect(() => {
    updateVisibleLinks();
    const onResize = () => updateVisibleLinks();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateVisibleLinks();
  }, [dark]);

  // lock body scroll when sidebar open; auto-close if no overflow
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", open);
    if (open && overflow.length === 0) setOpen(false);
  }, [open, overflow.length]);

  // Close dropdowns/sidebar on route change
  useEffect(() => {
    setOpen(false);
    setOpenDesktopMenuId(null);
    setOpenMobileMenuId(null);
  }, [pathname]);

  // Also collapse mobile submenus when sidebar closes
  useEffect(() => {
    if (!open) {
      setOpenMobileMenuId(null);
    }
  }, [open]);

  const handleNavClick = () => {
    setOpen(false);
    setOpenDesktopMenuId(null);
    setOpenMobileMenuId(null);
  };

  return (
    <>
      <nav
        ref={containerRef}
        className={`navbar shadow-md transition-all duration-300 ${
          scrolled ? "h-12" : "h-16"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-full px-4 md:px-8">
          {/* Left: logo + links */}
          <div className="flex items-center flex-1 min-w-0">
            <Link
              href="/"
              className="flex items-center flex-shrink-0"
              ref={logoRef}
              onClick={handleNavClick}
            >
              <img
                src="/logo_navbar@2x.png"
                alt={siteConfig.name}
                width={scrolled ? 24 : 32}
                height={scrolled ? 24 : 32}
                className={`${scrolled ? "h-8 w-8" : "h-14 w-14"} transition-all`}
              />
            </Link>

            <ul className="flex items-center space-x-4 ml-6 flex-nowrap relative">
              {NAV_ITEMS.map((item, i) => {
                const hasChildren =
                  Array.isArray(item.children) && item.children.length > 0;
                const isActive = hasChildren
                  ? item.children.some((child) => pathname.startsWith(child.to))
                  : pathname === item.to;

                return (
                  <li
                    key={item.id}
                    ref={(el) => (linksRef.current[i] = el)}
                    className={`relative transition-all duration-300 ease-in-out ${
                      i < visibleLinks
                        ? "opacity-100 static pointer-events-auto"
                        : "opacity-0 absolute -z-10 pointer-events-none"
                    }`}
                  >
                    {/* Simple link item */}
                    {!hasChildren && (
                      <Link
                        href={item.to}
                        className={`flex items-center space-x-1 transition-colors duration-200 ${
                          isActive
                            ? "text-primary font-semibold"
                            : "text-fg hover:text-accent"
                        }`}
                        onClick={handleNavClick}
                      >
                        {item.icon && <item.icon className="w-5 h-5" />}
                        <span className="whitespace-nowrap">{item.name}</span>
                      </Link>
                    )}

                    {/* Menu item with dropdown (e.g. Game Modes) */}
                    {hasChildren && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDesktopMenuId((prev) =>
                              prev === item.id ? null : item.id
                            )
                          }
                          className={`flex items-center space-x-1 transition-colors duration-200 ${
                            isActive
                              ? "text-primary font-semibold"
                              : "text-fg hover:text-accent"
                          }`}
                        >
                          {item.icon && <item.icon className="w-5 h-5" />}
                          <span className="whitespace-nowrap">{item.name}</span>
                          <FiChevronDown
                            className={`w-4 h-4 transition-transform ${
                              openDesktopMenuId === item.id ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {openDesktopMenuId === item.id && (
                          <div className="absolute left-0 mt-2 w-56 rounded-xl border border-subtle bg-card-surface shadow-lg z-50 py-2">
                            {item.children.map((child) => (
                              <Link
                                key={child.to}
                                href={child.to}
                                className={`flex items-center px-4 py-2 text-sm transition-colors ${
                                  pathname === child.to
                                    ? "text-primary font-semibold"
                                    : "text-fg hover:text-accent"
                                }`}
                                onClick={handleNavClick}
                              >
                                <span>{child.name}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: controls */}
          <div
            className="flex items-center flex-shrink-0 space-x-2 pl-4"
            ref={rightRef}
          >
            <button
              onClick={() => setDark((prev) => !prev)}
              className="p-2 text-xl text-fg hover:text-accent transition"
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
        className={`fixed top-0 left-0 h-full w-3/4 max-w-xs z-50 transform transition-transform duration-300 ease-in-out bg-card-surface border border-subtle rounded-r-2xl shadow-md ${
          open ? "translate-x-0" : "-translate-x-full"
        } flex flex-col justify-between touch-none`}
        role="dialog"
        aria-modal="true"
      >
        <div>
          <div className="flex justify-end p-4">
            <button
              onClick={() => setOpen(false)}
              className="text-2xl text-muted hover:text-primary transition"
              aria-label="Close menu"
              type="button"
            >
              <FiX />
            </button>
          </div>

          <nav className="px-6 pb-8 space-y-6">
            {overflow.map((item) => {
              const hasChildren =
                Array.isArray(item.children) && item.children.length > 0;
              const isMenuOpen = openMobileMenuId === item.id;
              const isActive = hasChildren
                ? item.children.some((child) => pathname.startsWith(child.to))
                : pathname === item.to;

              // Simple link in sidebar
              if (!hasChildren) {
                return (
                  <Link
                    key={item.id}
                    href={item.to}
                    className={`flex items-center space-x-2 text-xl font-medium transition-colors duration-200 ${
                      isActive ? "text-accent" : "text-fg hover:text-primary"
                    }`}
                    onClick={handleNavClick}
                  >
                    {item.icon && <item.icon className="w-6 h-6" />}
                    <span>{item.name}</span>
                  </Link>
                );
              }

              // Menu with expandable children (Game Modes)
              return (
                <div key={item.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMobileMenuId((prev) =>
                        prev === item.id ? null : item.id
                      )
                    }
                    className={`flex w-full items-center justify-between text-xl font-medium transition-colors duration-200 ${
                      isActive ? "text-accent" : "text-fg hover:text-primary"
                    }`}
                  >
                    <span className="inline-flex items-center space-x-2">
                      {item.icon && <item.icon className="w-6 h-6" />}
                      <span>{item.name}</span>
                    </span>
                    <FiChevronDown
                      className={`w-5 h-5 transition-transform ${
                        isMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isMenuOpen && (
                    <div className="mt-1 pl-8 space-y-3">
                      {item.children.map((child) => (
                        <Link
                          key={child.to}
                          href={child.to}
                          className={`block text-base transition-colors ${
                            pathname === child.to
                              ? "text-primary font-semibold"
                              : "text-fg hover:text-accent"
                          }`}
                          onClick={handleNavClick}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Theme toggle inside sidebar */}
            <button
              onClick={() => setDark((prev) => !prev)}
              className="flex items-center space-x-2 text-xl p-2 mt-6 text-fg hover:text-accent transition"
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
