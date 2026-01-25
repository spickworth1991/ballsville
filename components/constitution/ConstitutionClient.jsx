"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { adminR2Url } from "@/lib/r2Client";

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
  return cleaned.map((s, idx) => ({ ...s, order: idx + 1 }));
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
  // Keep anchor scroll below fixed navbar
  const nav = getNavHeightPx();
  return nav + 20;
}

function scrollToIdWithOffset(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  const offset = getScrollOffsetPx();
  const top = Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset);
  window.scrollTo({ top, behavior: "smooth" });
  return true;
}

function RemoteSectionCard({ id, title, bodyHtml }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
      <h2 className="text-xl md:text-2xl font-bold text-primary">{title}</h2>
      <div
        className="mt-3 prose prose-invert max-w-none prose-p:my-2 prose-li:my-1 text-sm md:text-base"
        dangerouslySetInnerHTML={{ __html: bodyHtml || "" }}
      />
    </section>
  );
}

/**
 * ConstitutionClient
 * - Fixed-position TOC on lg+ (sticky can break when ancestors use overflow-x clip)
 * - Clamped so TOC never overlays the HERO and never runs past the last section
 * - Active section highlighting + hash sync
 * - Remote override (R2 JSON) with static fallback children
 */
export default function ConstitutionClient({
  version = "0",
  manifest = null,
  remoteKey = "content/constitution/main.json",
  fallbackToc = [],
  children,
}) {
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");

  const boundsRef = useRef(null);
  const tocColRef = useRef(null);
  const tocBoxRef = useRef(null);
  const [dockStyle, setDockStyle] = useState(null);

  // Prevent IntersectionObserver from fighting during click-jumps
  const scrollLockRef = useRef({ id: "", until: 0 });

  // Load remote (if published) — fallback to children otherwise
  useEffect(() => {
    let cancelled = false;

    // If you haven't published yet, keep fallback content without flashing errors.
    if (!manifest && String(version || "0") === "0") {
      setRemote(null);
      setError("");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const bust = `v=${encodeURIComponent(String(version || "0"))}`;
    const url = adminR2Url(`${remoteKey}?${bust}`);

    setError("");
    setLoading(true);

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const sections = normalizeRemoteSections(json?.sections || json?.items || []);
        setRemote(sections.length ? { sections } : null);
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
  }, [version, manifest, remoteKey]);

  const toc = useMemo(() => {
    const sections = Array.isArray(remote?.sections) ? remote.sections : null;
    if (sections) return sections.map((s) => ({ id: s.id, label: `${s.order}. ${s.title}` }));
    return (Array.isArray(fallbackToc) ? fallbackToc : []).map((s) => ({ id: s.id, label: s.label }));
  }, [remote, fallbackToc]);

  // Clamp / dock TOC (lg+)
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

      // TOC height should be measured with its current styles
      const tocHeight = box.getBoundingClientRect().height;

      // Where the top of the fixed TOC would land in document space
      const fixedTopDoc = window.scrollY + fixedTop;

      // 1) Above bounds → behave like normal flow (no fixed overlay on hero)
      if (fixedTopDoc < boundsTop) {
        setDockStyle(null);
        return;
      }

      // 2) Past bottom bounds → pin to bottom of bounds (prevents running past last section)
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

      // 3) Normal dock
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

  // IntersectionObserver: update active section while scrolling (unless locked)
  useEffect(() => {
    if (!toc?.length) return;

    const ids = toc.map((s) => s.id).filter(Boolean);

    const obs = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        if (now < (scrollLockRef.current?.until || 0)) return;

        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];

        if (!visible?.target?.id) return;

        const id = visible.target.id;
        setActiveId((prev) => (prev === id ? prev : id));

        try {
          window.history.replaceState(null, "", `#${id}`);
        } catch {}
      },
      {
        root: null,
        threshold: [0.15, 0.25, 0.35, 0.5],
        // makes "active" switch when section header enters upper area
        rootMargin: "-20% 0px -70% 0px",
      }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });

    return () => obs.disconnect();
  }, [toc]);

  // Initial hash handling (jump once, correctly, with offset)
  useEffect(() => {
    if (!toc?.length) return;

    let hash = "";
    try {
      hash = (window.location.hash || "").replace(/^#/, "");
    } catch {}

    const defaultId = toc[0]?.id || "";

    if (!hash) {
      setActiveId(defaultId);
      return;
    }

    scrollLockRef.current = { id: hash, until: Date.now() + 900 };
    setActiveId(hash);

    const t = setTimeout(() => {
      scrollToIdWithOffset(hash);
    }, 50);

    return () => clearTimeout(t);
  }, [toc]);

  const hasRemote = !!remote?.sections?.length;

  return (
    <section ref={boundsRef} className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] items-start">
      {/* TOC */}
      <aside ref={tocColRef} className="space-y-4 relative">
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
                    e.preventDefault();
                    const id = s.id;
                    scrollLockRef.current = { id, until: Date.now() + 900 };
                    setActiveId(id);
                    scrollToIdWithOffset(id);
                    try {
                      window.history.replaceState(null, "", `#${id}`);
                    } catch {}
                  }}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          )}

          {/* Keep legacy helper text from the old page (always visible) */}
          <p className="mt-4 text-[11px] text-muted leading-snug">
            Use this Constitution as the baseline. Each league’s <span className="font-semibold">League Info</span>{" "}
            page and any posted bylaws clarify which options are enabled (trades, FAAB, best ball rules, etc.).
          </p>
        </div>
      </aside>

      {/* CONTENT */}
      <div className="space-y-6 leading-relaxed text-sm md:text-base">
        {loading && !children ? (
          <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted text-center">
            Loading…
          </div>
        ) : hasRemote ? (
          remote.sections.map((s) => (
            <RemoteSectionCard key={s.id} id={s.id} title={`${s.order}. ${s.title}`} bodyHtml={s.bodyHtml} />
          ))
        ) : (
          children
        )}
      </div>
    </section>
  );
}
