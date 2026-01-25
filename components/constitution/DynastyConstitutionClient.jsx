"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { adminR2Url } from "@/lib/r2Client";
import { CURRENT_SEASON } from "@/lib/season";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function slugify(s) {
  return safeStr(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function formatUpdatedAt(iso) {
  const d = new Date(String(iso || ""));
  if (!Number.isFinite(d.getTime())) return "";
  try {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function normalizeRemoteSections(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const cleaned = rows
    .map((s, i) => {
      const title = safeStr(s?.title || "").trim();
      const id = slugify(s?.id || s?.anchor || title || `section-${i + 1}`);
      const order = Number.isFinite(Number(s?.order)) ? Number(s.order) : i + 1;
      const bodyHtml = safeStr(s?.bodyHtml || s?.html || "").trim();
      return { id, title, order, bodyHtml };
    })
    .filter((s) => s.id && s.title);

  cleaned.sort((a, b) => a.order - b.order);
  cleaned.forEach((s, i) => (s.order = i + 1));
  return cleaned;
}

function SectionCard({ id, order, title, bodyHtml }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full border border-subtle bg-card-trans px-2 text-xs font-semibold text-muted">
          {order}
        </span>
        <h2 className="text-xl md:text-2xl font-semibold text-primary">{title}</h2>
      </div>
      <div
        className="prose prose-invert mt-4 max-w-none text-sm md:text-base"
        dangerouslySetInnerHTML={{ __html: bodyHtml || "" }}
      />
    </section>
  );
}

function InlineNotice({ children }) {
  return (
    <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted text-center">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

function getNavHeightPx() {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--nav-height").trim();
    const n = parseInt(raw || "0", 10);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {}
  return 100;
}

function getScrollOffsetPx() {
  const nav = getNavHeightPx();
  return nav + 20;
}

function onTocClick(e, id) {
  e.preventDefault();

  scrollLockRef.current = { id, until: Date.now() + 900 };
  setActiveId(id);

  try {
    history.replaceState(null, "", `#${id}`);
  } catch {}

  scrollToIdWithOffset(id);
}



function scrollToIdWithOffset(id) {
  const el = document.getElementById(id);
  if (!el) return false;

  const offset = getScrollOffsetPx();

  const top = Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset);
  window.scrollTo({ top, behavior: "smooth" });
  return true;
}

export default function DynastyConstitutionClient({ season = CURRENT_SEASON, version = "0", manifest = null }) {
  const [remote, setRemote] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [activeId, setActiveId] = useState("");

  const boundsRef = useRef(null);
  const tocColRef = useRef(null);
  const tocBoxRef = useRef(null);


  const [dockStyle, setDockStyle] = useState(null);

  // Prevent observer from fighting click jumps
  const scrollLockRef = useRef({ id: "", until: 0 });

  const toc = useMemo(() => {
    const sections = Array.isArray(remote?.sections) ? remote.sections : [];
    return sections.map((s) => ({ id: s.id, label: `${s.order}. ${s.title}` }));
  }, [remote]);

    useLayoutEffect(() => {
      let raf = 0;

      function measure() {
        if (typeof window === "undefined") return;

        const isLg = window.matchMedia("(min-width: 1024px)").matches;
        if (!isLg) {
          setDockStyle(null);
          return;
        }

        const bounds = boundsRef.current;
        const col = tocColRef.current;
        const box = tocBoxRef.current;
        if (!bounds || !col || !box) {
          setDockStyle(null);
          return;
        }

        const nav = getNavHeightPx();
        const fixedTop = nav + 16;

        const colRect = col.getBoundingClientRect();
        const boundsRect = bounds.getBoundingClientRect();

        const boundsTop = window.scrollY + boundsRect.top;
        const boundsBottom = boundsTop + boundsRect.height;

        const tocHeight = box.getBoundingClientRect().height;
        const fixedTopDoc = window.scrollY + fixedTop;

        // Above bounds → normal flow
        if (fixedTopDoc < boundsTop) {
          setDockStyle(null);
          return;
        }

        // Past bottom bounds → pin inside bounds
        const maxTopWithinBounds = Math.max(0, boundsRect.height - tocHeight);
        const pinnedTopWithinBounds = Math.min(maxTopWithinBounds, boundsRect.height - tocHeight);

        if (fixedTopDoc + tocHeight > boundsBottom) {
          setDockStyle({
            position: "absolute",
            left: "0px",
            right: "0px",
            top: `${Math.max(0, pinnedTopWithinBounds)}px`,
            width: "100%",
          });
          return;
        }

        // Normal dock
        setDockStyle({
          position: "fixed",
          left: `${Math.round(colRect.left)}px`,
          top: `${fixedTop}px`,
          width: `${Math.round(colRect.width)}px`,
          maxHeight: `calc(100vh - ${nav + 32}px)`,
          overflowY: "auto",
        });
      }

      function onScrollOrResize() {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(measure);
      }

      onScrollOrResize();
      window.addEventListener("resize", onScrollOrResize);
      window.addEventListener("scroll", onScrollOrResize, { passive: true });

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onScrollOrResize);
        window.removeEventListener("scroll", onScrollOrResize);
      };
    }, [toc.length]);


  // Data load
  useEffect(() => {
    let cancelled = false;

    if (!manifest && String(version || "0") === "0") {
      return () => {
        cancelled = true;
      };
    }

    const bust = `v=${encodeURIComponent(String(version || "0"))}`;
    const url = adminR2Url(`content/constitution/dynasty.json?${bust}`);

    setError("");
    setLoading(true);

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const sections = normalizeRemoteSections(json?.sections || json?.items || []);
        setRemote({ sections });
        setUpdatedAt(safeStr(json?.updatedAt || ""));
        setActiveId(sections?.[0]?.id || "");
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load constitution.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [version, manifest]);

  

  // Active section highlighting
  useEffect(() => {
    if (typeof window === "undefined") return;

    const ids = toc.map((t) => t.id);
    if (!ids.length) {
      setActiveId("");
      return;
    }

    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;

    const navOffset = getScrollOffsetPx();

    const io = new IntersectionObserver(
      (entries) => {
        const lock = scrollLockRef.current;
        if (lock?.until && Date.now() < lock.until) return;

        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top || 0) - (b.boundingClientRect.top || 0));

        if (!visible.length) return;

        const id = visible[0]?.target?.id || "";
        if (id) {
          setActiveId(id);
          try {
            window.history.replaceState(null, "", `#${id}`);
          } catch {}
        }
      },
      {
        root: null,
        rootMargin: `-${navOffset}px 0px -60% 0px`,
        threshold: [0.01, 0.1, 0.25],
      }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [toc]);


  // Initial hash handling
  useEffect(() => {
    const sections = Array.isArray(remote?.sections) ? remote.sections : [];
    if (!sections.length) return;

    let hash = "";
    try {
      hash = (window.location.hash || "").replace(/^#/, "");
    } catch {}

    if (!hash) return;

    scrollLockRef.current = { id: hash, until: Date.now() + 900 };
    setActiveId(hash);

    const t = window.setTimeout(() => {
      scrollToIdWithOffset(hash);
    }, 50);

    return () => window.clearTimeout(t);
  }, [remote?.sections]);

  const updatedLabel = formatUpdatedAt(updatedAt);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          {/* HERO */}
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
              <div className="absolute top-10 right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">DYNASTY GOVERNANCE</p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-primary">
                  Dynasty Bye-Laws <span className="text-accent">&amp; Code of Conduct</span>
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">
                  Official rules and expectations for all BALLSVILLE dynasty leagues.
                </p>

                <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    LIVE{updatedLabel ? ` · Last updated ${updatedLabel}` : ""}
                  </span>
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    Use TOC for quick jumps
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {toc.length ? (
                    <a
                      href={`#${toc[0].id}`}
                      className="btn btn-primary"
                      onClick={(e) => {
                       onTocClick(e, s.id);
                      }}
                    >
                      Start Reading →
                    </a>
                  ) : null}

                  <Link prefetch={false} href="/constitution" className="btn btn-outline">
                    League Constitution
                  </Link>
                  <Link prefetch={false} href="/leaderboards" className="btn btn-outline">
                    Leaderboards
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden shadow-lg">
                <div className="px-4 py-3 border-b border-subtle">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">NOTES</p>
                </div>
                <div className="p-4 space-y-2 text-sm text-muted">
                  <p>This page is fully editable by admins.</p>
                  <p>Order numbers are the Table of Contents numbers.</p>
                </div>
              </div>
            </div>
          </header>

          {/* TOC + CONTENT */}
          <section
            ref={boundsRef}
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start"
          >
            {/* TOC */}
            <aside ref={tocColRef} className="space-y-4">
              <div
                ref={tocBoxRef}
                className="bg-card-surface border border-subtle rounded-2xl p-5 shadow-sm"
                style={dockStyle || undefined}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-primary uppercase tracking-wide m-0">
                    Table of Contents
                  </h2>
                  <span className="rounded-full border border-subtle bg-card-trans px-2 py-1 text-[11px] font-semibold text-muted">
                    LIVE
                  </span>
                </div>

                {loading ? (
                  <div className="text-sm text-muted">Loading…</div>
                ) : error ? (
                  <div className="text-sm text-red-200">{error}</div>
                ) : toc.length === 0 ? (
                  <div className="text-sm text-muted">No sections yet.</div>
                ) : (
                  <nav className="space-y-1">
                    {toc.map((s) => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className={[
                          "block rounded-lg px-3 py-2 text-sm transition",
                          activeId === s.id
                            ? "text-primary bg-subtle-surface border border-subtle"
                            : "text-muted hover:text-primary hover:bg-subtle-surface",
                        ].join(" ")}
                        onClick={(e) => {
                          onTocClick(e, s.id);
                        }}
                      >
                        {s.label}
                      </a>
                    ))}
                  </nav>
                )}
              </div>
            </aside>

            {/* CONTENT */}
            <div className="space-y-6">
              {/* Start clamp boundary: first section begins here */}

              {loading ? (
                <InlineNotice>Loading…</InlineNotice>
              ) : error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">
                  {error}
                </div>
              ) : !remote?.sections?.length ? (
                <InlineNotice>No Dynasty Constitution content has been published yet.</InlineNotice>
              ) : (
                remote.sections.map((s) => (
                  <SectionCard key={s.id} id={s.id} order={s.order} title={s.title} bodyHtml={s.bodyHtml} />
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
