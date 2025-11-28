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
  FiHelpCircle,
  FiCreditCard,
  FiBookOpen,
  FiPhone,
  FiSun,
  FiMoon,
  FiMapPin
} from "react-icons/fi";
import { FaFacebookF, FaInstagram, FaLinkedinIn } from "react-icons/fa";

const NAV_ITEMS = [
  { name: "Home", to: "/", icon: FiHome },
  { name: "About", to: "/about", icon: FiUsers },
  { name: "Constitution", to: "/constitution", icon: FiBriefcase },
  // { name: "FAQ", to: "/faq", icon: FiHelpCircle },
  // { name: "Insurance", to: "/insurance", icon: FiCreditCard },
  // { name: "Resources", to: "/resources", icon: FiBookOpen },
  // { name: "Location", to: "/location", icon: FiMapPin },
  // { name: "Careers", to: "/careers", icon: FiBriefcase },
  // { name: "Contact", to: "/contact", icon: FiPhone }
];

export default function Navbar() {
  const pathname = usePathname();

  // state mirrors your original component
  const [dark, setDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [visibleLinks, setVisibleLinks] = useState(NAV_ITEMS.length);

  const containerRef = useRef(null);
  const linksRef = useRef([]);

  const visible = NAV_ITEMS.slice(0, visibleLinks);
  const overflow = NAV_ITEMS.slice(visibleLinks);

  // theme: read from localStorage or prefers-color-scheme
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
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

  // shrink on scroll
  useLayoutEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // measure visible links with ResizeObserver
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => updateVisibleLinks());
    if (containerRef.current) {
      updateVisibleLinks(); // immediate on mount
      ro.observe(containerRef.current);
    }
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // also listen to window resize (belt & suspenders)
  useLayoutEffect(() => {
    const onResize = () => updateVisibleLinks();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // lock body scroll when sidebar open; auto-close if no overflow
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", open);
    if (open && overflow.length === 0) setOpen(false);
  }, [open, overflow.length]);

  const updateVisibleLinks = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const buffer = 320; // space for theme + menu buttons
    let used = buffer;
    let count = 0;

    for (let i = 0; i < NAV_ITEMS.length; i++) {
      const el = linksRef.current[i];
      if (!el) break;
      used += el.offsetWidth + 20;
      if (used > containerWidth) break;
      count++;
    }
    setVisibleLinks(count);
  };

  return (
    <>
      <nav
        ref={containerRef}
        className={`navbar shadow-md transition-all duration-300 ${scrolled ? "h-12" : "h-16"}`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-full px-4 md:px-8 overflow-hidden">
          {/* Left: logo + links */}
          <div className="flex items-center flex-1 min-w-0">
            <Link href="/" className="flex items-center flex-shrink-0">
              <img
                src="/logo_navbar@2x.png"
                alt="Stay in Motion Physical Therapy"
                width={scrolled ? 24 : 32}
                height={scrolled ? 24 : 32}
                className={`${scrolled ? "h-8 w-8" : "h-14 w-14"} transition-all`}
              />
              <span
                className={`ml-2 font-bold transition-all ${
                  scrolled ? "text-lg" : "text-xl"
                } text-primary dark:text-fg`}
              >
                {siteConfig.shortName}
              </span>
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
          <div className="flex items-center flex-shrink-0 space-x-2 pl-4">
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

        <div className="px-6 pb-8 flex space-x-4">
          {/* <a
            href="#"
            aria-label="Facebook"
            className="text-accent hover:text-primary transition text-2xl"
          >
            <FaFacebookF />
          </a>
          <a
            href="#"
            aria-label="Instagram"
            className="text-accent hover:text-primary transition text-2xl"
          >
            <FaInstagram />
          </a> */}
          <a
            href="https://www.linkedin.com/in/amanda-pickworth-chrusciel/"
            aria-label="LinkedIn"
            className="text-accent hover:text-primary transition text-2xl"
          >
            <FaLinkedinIn />
          </a>
        </div>
      </aside>
    </>
  );
}
