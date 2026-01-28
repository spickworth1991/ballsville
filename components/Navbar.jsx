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
  FiAward,
  FiFileText,
  FiLayers,
} from "react-icons/fi";

/**
 * Add `isNew: true` or `isUpdate: true` to any item (or child/sub-child)
 * to show a "NEW" or "UPDATE" pill.
 */

const NAV_ITEMS = [
  { id: "home", name: "Home", to: "/"},
  {
    id: "game-modes",
    name: "Game Modes",
    icon: FiGrid,
    isUpdate: true,
    children: [
      {
        id: "leaderboards",
        name: "Leaderboards",
        to: "/leaderboards",
      },

      {
        id: "big-game",
        name: "The BIG Game",
        to: "/big-game",
        children: [
          { name: "Wagers", to: "/big-game/wagers",}, 
        ],
      },
      {
        id: "mini-leagues",
        name: "Mini-Leagues",
        to: "/mini-leagues",
        children: [{ name: "Wagers", to: "/mini-leagues/wagers" }],
      },
      // {
      //   id: "highlander",
      //   name: "Highlander",
      //   to: "/highlander",
      //   isNew: true,
      // },
      {
        id: "redraft",
        name: "Redraft",
        to: "/redraft",
      },
      {
        id: "dynasty",
        name: "Dynasty",
        to: "/dynasty",
        children: [{ name: "Wagers", to: "/dynasty/wagers" },{name: "Constitution", to: "/constitution/dynasty", isUpdate: true}],
      },
      {
        id: "gauntlet",
        name: "Gauntlet",
        to: "/gauntlet",
        isUpdate: true,
        children: [{ name: "Gauntlet Bracket", to: "/gauntlet/leaderboard" }],
      },
    ],
  },

  { id: "adp", name: "ADP", to: "/draft-compare", icon: FiLayers, isNew: true },

  {
    id: "joe-street-journal",
    name: "Joe Street Journal",
    to: "/joe-street-journal",
    icon: FiFileText,
  },
  { id: "about", name: "About", to: "/about", icon: FiUsers },
  {
    id: "constitution",
    name: "Constitution",
    to: "/constitution",
    icon: FiBriefcase,
  },
  { id: "news", name: "News", to: "/news", icon: FiTrendingUp },
  { id: "faqs", name: "Faqs", to: "/faq", icon: FiHelpCircle },
  { id: "hall-of-fame", name: "Hall of Fame", to: "/hall-of-fame", icon: FiAward },
];

function hasKids(node) {
  return Array.isArray(node?.children) && node.children.length > 0;
}

function isNodeActive(node, pathname) {
  if (!node) return false;

  // exact match
  if (node.to && pathname === node.to) return true;

  // section match
  if (node.to && pathname.startsWith(node.to + "/")) return true;

  // recursive match
  if (hasKids(node)) return node.children.some((c) => isNodeActive(c, pathname));

  return false;
}

function UpdatePill() {
  return (
    <span
      className="ml-2 inline-flex items-center rounded-full border border-subtle bg-white/5 px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-primary"
      aria-label="Update"
    >
      UPDATE
    </span>
  );
}

function NewPill() {
  return (
    <span
      className="ml-2 inline-flex items-center rounded-full border border-subtle bg-white/5 px-2 py-0.5 text-[8px] font-semibold tracking-wide text-accent"
      aria-label="New"
    >
      NEW
    </span>
  );
}

function NavPills({ node }) {
  return (
    <>
      {node?.isNew && <NewPill />}
      {node?.isUpdate && <UpdatePill />}
    </>
  );
}



export default function Navbar() {
  const pathname = usePathname();

  // const [dark, setDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // ✅ Start conservative to prevent initial overlap stealing clicks
  const [visibleLinks, setVisibleLinks] = useState(1);

  const [openDesktopMenuId, setOpenDesktopMenuId] = useState(null);
  const [openMobileMenuId, setOpenMobileMenuId] = useState(null);
  const [openMobileSubMenuId, setOpenMobileSubMenuId] = useState(null);

  const containerRef = useRef(null);
  const linksRef = useRef([]);
  const rightRef = useRef(null);
  const innerRef = useRef(null);

  const overflow = NAV_ITEMS.slice(visibleLinks);

  // Mobile rotation can report stale widths briefly. Schedule (and de-dupe)
  // re-measurements with a double rAF so layout/styles settle before we decide
  // which links fit.
  const measureRaf1Ref = useRef(0);
  const measureRaf2Ref = useRef(0);

  const scheduleMeasure = () => {
    if (typeof window === "undefined") return;
    if (measureRaf1Ref.current) cancelAnimationFrame(measureRaf1Ref.current);
    if (measureRaf2Ref.current) cancelAnimationFrame(measureRaf2Ref.current);

    measureRaf1Ref.current = requestAnimationFrame(() => {
      updateVisibleLinks();
      measureRaf2Ref.current = requestAnimationFrame(() => {
        updateVisibleLinks();
      });
    });
  };

  // ---------------- SCROLL SHRINK ----------------
  useLayoutEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ---------------- LINK MEASUREMENT ----------------
  const updateVisibleLinks = () => {
    if (!innerRef.current) return;

    const rowWidth = innerRef.current.offsetWidth || 0;
    const logoWidth = 0; // no logo, so zero

    // right side measured width (theme + maybe hamburger)
    let rightWidth = rightRef.current?.offsetWidth || 0;

    // If hamburger currently exists, subtract its real width so rightWidth is stable
    const burgerBtn = rightRef.current?.querySelector(
      "button[aria-label='Open menu']"
    );
    if (burgerBtn) {
      rightWidth -= burgerBtn.offsetWidth || 0;
      // subtract the gap between theme + burger (space-x-2)
      rightWidth -= 8;
    }

    const buffer = 64;
    const gap = 16; // space-x-4

    const countThatFit = (availableWidth) => {
      let used = 0;
      let count = 0;

      for (let i = 0; i < NAV_ITEMS.length; i++) {
        const el = linksRef.current[i];
        if (!el) break;

        const sizer = el.querySelector("span[aria-hidden='true'] span");
        const w = sizer?.offsetWidth || el.offsetWidth || 0;

        const addGap = count === 0 ? 0 : gap;
        if (used + addGap + w > availableWidth) break;

        used += addGap + w;
        count++;
      }
      return count;
    };

    // PASS 1: assume NO hamburger
    const availableNoBurger = rowWidth - logoWidth - rightWidth - buffer;
    let count = countThatFit(availableNoBurger);

    // PASS 2: if not all fit, reserve hamburger and re-count
    if (count < NAV_ITEMS.length) {
      const hamburgerReserve = 48; // 40px button + ~8px spacing
      const availableWithBurger =
        rowWidth - logoWidth - rightWidth - hamburgerReserve - buffer;

      count = countThatFit(availableWithBurger);
    }

    const MIN_VISIBLE = 1;
    setVisibleLinks(Math.max(MIN_VISIBLE, Math.min(count, NAV_ITEMS.length)));
  };

  // ✅ Measure immediately (layout) + re-measure on rotation/resizes.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    scheduleMeasure();

    const onResize = () => scheduleMeasure();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    // Some mobile browsers resize via visualViewport without firing a normal resize
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", onResize);

    // Observe the navbar container itself (covers cases where fonts swap / layout shifts)
    let ro;
    if (typeof ResizeObserver !== "undefined" && innerRef.current) {
      ro = new ResizeObserver(() => scheduleMeasure());
      ro.observe(innerRef.current);
    }

    // If fonts load after first paint, widths can change
    const fonts = document.fonts;
    if (fonts && fonts.ready) {
      fonts.ready.then(() => {
        scheduleMeasure();
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (vv) vv.removeEventListener("resize", onResize);
      if (ro) ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // lock body scroll when sidebar open
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", open);
    return () => document.body.classList.remove("overflow-hidden");
  }, [open]);

  // Close dropdowns/sidebar on route change
  useEffect(() => {
    setOpen(false);
    setOpenDesktopMenuId(null);
    setOpenMobileMenuId(null);
    setOpenMobileSubMenuId(null);
  }, [pathname]);

  // Also collapse mobile submenus when sidebar closes
  useEffect(() => {
    if (!open) {
      setOpenMobileMenuId(null);
      setOpenMobileSubMenuId(null);
    }
  }, [open]);

  // Close desktop dropdown when clicking outside
  useEffect(() => {
    if (!openDesktopMenuId) return;

    const onDown = (e) => {
      const root = containerRef.current;
      if (!root) return;
      if (!root.contains(e.target)) setOpenDesktopMenuId(null);
    };

    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [openDesktopMenuId]);

  // Escape closes everything
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenDesktopMenuId(null);
        setOpen(false);
        setOpenMobileMenuId(null);
        setOpenMobileSubMenuId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleNavClick = () => {
    setOpen(false);
    setOpenDesktopMenuId(null);
    setOpenMobileMenuId(null);
    setOpenMobileSubMenuId(null);
  };

  return (
    <>
      <nav
        ref={containerRef}
        className={`navbar shadow-md transition-all duration-300 ${
          scrolled ? "h-12" : "h-16"
        }`}
      >
        <div
          ref={innerRef}
          className="max-w-7xl mx-auto flex items-center justify-between h-full px-3 sm:px-4 md:px-8"

        >
          {/* Left: logo + links */}
          <div className="flex items-center flex-1 min-w-0">
            <ul className="flex flex-1 min-w-0 items-center space-x-3 sm:space-x-4 flex-nowrap overflow-visible ml-5 landscape:ml-2 sm:ml-6">
              {NAV_ITEMS.map((item, i) => {
                const hasChildren = hasKids(item);
                const isActive = isNodeActive(item, pathname);

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
                    {/* SIZER (always measurable) */}
                    <span
                      className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none"
                      aria-hidden="true"
                    >
                      <span className="inline-flex items-center space-x-1">
                       {item.id === "home" ? (
                        <span className="inline-flex items-center mr-1">
                          <img
                            src="/logo_navbar@2x-v2.png"
                            alt=""
                            loading="eager"
                            decoding="async"
                            className={`${scrolled ? "h-7 w-7" : "h-8 w-8"} object-contain nav-home-logo`}
                            style={{ display: "block" }}
                            aria-hidden="true"
                          />

                        </span>

                      ) : (
                        item.icon ? <item.icon className="w-5 h-5" /> : null
                      )}


                        <span className="whitespace-nowrap">{item.name}</span>
                        <NavPills node={item} />
                        {hasChildren && <FiChevronDown className="w-4 h-4" />}
                      </span>
                    </span>

                    {!hasChildren && (
                      <Link
                        href={item.to}
                        prefetch={false}
                        className={`flex items-center space-x-1 transition-colors duration-200 ${
                          isActive
                            ? "text-primary font-semibold"
                            : "text-fg hover:text-accent"
                        }`}
                        onClick={handleNavClick}
                      >
                        {item.id === "home" ? (
                          <span className="inline-flex items-center mr-1">
                           <img
                            src="/logo_navbar@2x-v2.png"
                            alt=""
                            loading="eager"
                            decoding="async"
                            className={`${scrolled ? "h-7 w-7" : "h-8 w-8"} object-contain nav-home-logo`}
                            style={{ display: "block" }}
                            aria-hidden="true"
                          />

                          </span>


                        ) : (
                          item.icon ? <item.icon className="w-5 h-5" /> : null
                        )}


                        <span className="whitespace-nowrap">{item.name}</span>
                        <NavPills node={item} />
                      </Link>
                    )}

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
                          aria-expanded={
                            openDesktopMenuId === item.id ? "true" : "false"
                          }
                          aria-haspopup="menu"
                        >
                            {item.id === "home" ? (
                              <span className="inline-flex items-center mr-1">
                                <img
                                src="/logo_navbar@2x-v2.png"
                                alt=""
                                loading="eager"
                                decoding="async"
                                className={`${scrolled ? "h-7 w-7" : "h-8 w-8"} object-contain nav-home-logo`}
                                style={{ display: "block" }}
                                aria-hidden="true"
                              />

                              </span>


                            ) : (
                              item.icon ? <item.icon className="w-5 h-5" /> : null
                            )}


                          <span className="whitespace-nowrap">{item.name}</span>
                          <NavPills node={item} />
                          <FiChevronDown
                            className={`w-4 h-4 transition-transform ${
                              openDesktopMenuId === item.id ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {openDesktopMenuId === item.id && (
                          <div
                            className="absolute left-0 mt-2 w-72 rounded-xl border border-subtle bg-card-surface z-50 py-2
                                       shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/5
                                       origin-top-left transition duration-150 ease-out"
                            role="menu"
                          >
                            {item.children.map((child) => {
                              const childHasKids = hasKids(child);
                              const childActive = isNodeActive(child, pathname);

                              if (!childHasKids) {
                                return (
                                  <Link
                                    key={child.to}
                                    prefetch={false}
                                    href={child.to}
                                    className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors mx-2 ${
                                      pathname === child.to
                                        ? "text-primary font-semibold bg-white/5"
                                        : "text-fg hover:text-accent hover:bg-white/5"
                                    }`}
                                    onClick={handleNavClick}
                                    role="menuitem"
                                  >
                                    <span>{child.name}</span>
                                    <NavPills node={child} />
                                  </Link>
                                );
                              }

                              return (
                                <div key={child.id || child.name} className="px-2">
                                  {/* parent row */}
                                  <Link
                                    prefetch={false}
                                    href={child.to || "#"}
                                    className={`flex items-center justify-between px-2 py-2 text-sm rounded-lg transition-colors ${
                                      childActive
                                        ? "text-primary font-semibold bg-white/5"
                                        : "text-fg hover:text-accent hover:bg-white/5"
                                    }`}
                                    onClick={
                                      child.to
                                        ? handleNavClick
                                        : (e) => e.preventDefault()
                                    }
                                    role="menuitem"
                                  >
                                    <span className="inline-flex items-center">
                                      {child.name}
                                      <NavPills node={child} />
                                    </span>
                                    <FiChevronDown className="w-4 h-4 opacity-70 -rotate-90" />
                                  </Link>

                                  {/* sub rows */}
                                  <div className="pb-2">
                                    {child.children.map((sub) => (
                                      <Link
                                        key={sub.to}
                                        prefetch={false}
                                        href={sub.to}
                                        className={`ml-3 flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                                          pathname === sub.to
                                            ? "text-primary font-semibold bg-white/5"
                                            : "text-fg hover:text-accent hover:bg-white/5"
                                        }`}
                                        onClick={handleNavClick}
                                      >
                                        <span>{sub.name}</span>
                                        <NavPills node={sub} />
                                      </Link>
                                    ))}
                                  </div>

                                  <div className="my-1 h-px bg-subtle/60" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: controls (✅ always above link area) */}
          <div
            className="relative z-20 flex items-center flex-shrink-0 space-x-2 pl-4"
            ref={rightRef}
          >
            {overflow.length > 0 && (
              <button
                className="w-10 h-10 grid place-items-center rounded-lg hover:opacity-90 transition"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                aria-controls="mobile-menu"
                aria-expanded={open ? "true" : "false"}
                type="button"
              >
                <FiMenu className="w-7 h-7 text-primary" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {open && (
        <div
          className="fixed inset-0 scrim backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="mobile-menu"
        className={`fixed top-16 left-0 h-full w-3/4 max-w-xs transform transition-transform duration-300 ease-in-out bg-card-surface border border-subtle rounded-r-2xl shadow-md ${
          open ? "translate-x-0" : "-translate-x-full"
        } flex flex-col justify-between`}
        style={{ zIndex: 975 }} // ✅ above scrim, below navbar (navbar is 1000)
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
              const hasChildren = hasKids(item);
              const isMenuOpen = openMobileMenuId === item.id;
              const isActive = isNodeActive(item, pathname);

              if (!hasChildren) {
                return (
                  <Link
                    key={item.id}
                    prefetch={false}
                    href={item.to}
                    className={`flex items-center space-x-2 text-xl font-medium transition-colors duration-200 ${
                      isActive ? "text-accent" : "text-fg hover:text-primary"
                    }`}
                    onClick={handleNavClick}
                  >
                    {item.id === "home" ? (
                      <span className="inline-flex items-center mr-1">
                        <img
                          src="/logo_navbar@2x-v2.png"
                          alt=""
                          loading="eager"
                          decoding="async"
                          className={`${scrolled ? "h-7 w-7" : "h-8 w-8"} object-contain nav-home-logo`}
                          style={{ display: "block" }}
                          aria-hidden="true"
                        />

                      </span>

                    ) : (
                      item.icon ? <item.icon className="w-5 h-5" /> : null
                    )}

                    <span>{item.name}</span>
                    <NavPills node={item} />
                  </Link>
                );
              }

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
                      {item.id === "home" ? (
                        <span className="inline-flex items-center mr-1">
                          <img
                            src="/logo_navbar@2x-v2.png"
                            alt=""
                            loading="eager"
                            decoding="async"
                            className={`${scrolled ? "h-7 w-7" : "h-8 w-8"} object-contain nav-home-logo`}
                            style={{ display: "block" }}
                            aria-hidden="true"
                          />

                        </span>

                      ) : (
                        item.icon ? <item.icon className="w-5 h-5" /> : null
                      )}


                      <span>{item.name}</span>
                      <NavPills node={item} />
                    </span>
                    <FiChevronDown
                      className={`w-5 h-5 transition-transform ${
                        isMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isMenuOpen && (
                    <div className="mt-1 pl-8 space-y-3">
                      {item.children.map((child) => {
                        const childHasKids = hasKids(child);
                        const childKey = child.id || child.name;
                        const childOpen = openMobileSubMenuId === childKey;
                        const childActive = isNodeActive(child, pathname);

                        if (!childHasKids) {
                          return (
                            <Link
                              key={child.to}
                              prefetch={false}
                              href={child.to}
                              className={`flex items-center justify-between text-base transition-colors ${
                                pathname === child.to
                                  ? "text-primary font-semibold"
                                  : "text-fg hover:text-accent"
                              }`}
                              onClick={handleNavClick}
                            >
                              <span>{child.name}</span>
                              <NavPills node={child} />
                            </Link>
                          );
                        }

                        return (
                          <div key={childKey} className="space-y-2">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMobileSubMenuId((prev) =>
                                  prev === childKey ? null : childKey
                                )
                              }
                              className={`flex w-full items-center justify-between text-base transition-colors ${
                                childActive
                                  ? "text-primary font-semibold"
                                  : "text-fg hover:text-accent"
                              }`}
                            >
                              <span className="inline-flex items-center">
                                {child.name}
                                <NavPills node={child} />
                              </span>
                              <FiChevronDown
                                className={`w-5 h-5 transition-transform ${
                                  childOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {childOpen && (
                              <div className="pl-4 space-y-2">
                                {child.children.map((sub) => (
                                  <Link
                                    key={sub.to}
                                    prefetch={false}
                                    href={sub.to}
                                    className={`flex items-center justify-between text-sm transition-colors ${
                                      pathname === sub.to
                                        ? "text-primary font-semibold"
                                        : "text-fg hover:text-accent"
                                    }`}
                                    onClick={handleNavClick}
                                  >
                                    <span>{sub.name}</span>
                                    <NavPills node={sub} />
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
