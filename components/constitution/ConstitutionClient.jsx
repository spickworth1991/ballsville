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
 * - Remote-only content (no static fallback)
 */
export default function ConstitutionClient({
  version = "0",
  manifest = null,
  remoteKey = "content/constitution/main.json",
}) {
  const [remoteSections, setRemoteSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");

  const boundsRef = useRef(null);
  const tocColRef = useRef(null);
  const tocBoxRef = useRef(null);
  const [dockStyle, setDockStyle] = useState(null);

  // Prevent IntersectionObserver from fighting during click-jumps
  const scrollLockRef = useRef({ id: "", until: 0 });

  // Load remote (R2 JSON)
  useEffect(() => {
    let cancelled = false;

    const bust = `v=${encodeURIComponent(String(version || "0"))}`;
    const url = adminR2Url(`${remoteKey}?${bust}`);

    setError("");
    setLoading(true);

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const sections = normalizeRemoteSections(json?.sections || json?.items || []);
        setRemoteSections(sections);
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

  // TOC is remote-only (so it always matches what’s published)
  const toc = useMemo(() => {
    const sections = Array.isArray(remoteSections) ? remoteSections : [];
    return sections.map((s) => ({ id: s.id, label: `${s.order}. ${s.title}` }));
  }, [remoteSections]);

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

  // Active section highlight
  useEffect(() => {
    if (typeof window === "undefined") return;

    const ids = toc.map((t) => t.id);
    if (!ids.length) {
      setActiveId("");
      return;
    }

    const els = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean);

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
        if (id) setActiveId(id);
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

  function onTocClick(e, id) {
    e.preventDefault();

    scrollLockRef.current = { id, until: Date.now() + 900 };
    setActiveId(id);

    // Update URL hash without jumping (then do offset scroll)
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {}

    scrollToIdWithOffset(id);
  }

  return (
    <section ref={boundsRef} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start">
      {/* TOC */}
      <aside ref={tocColRef} className="relative space-y-3">
        <div
          ref={tocBoxRef}
          style={dockStyle || undefined}
          className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wide m-0">
            Table of Contents
          </h2>

          <div className="mt-3 space-y-1">
            {loading ? (
              <div className="text-sm text-muted">Loading…</div>
            ) : error ? (
              <div className="text-sm text-red-200">{error}</div>
            ) : toc.length === 0 ? (
              <div className="text-sm text-muted">No sections published yet.</div>
            ) : (
              toc.map((t) => {
                const isActive = t.id === activeId;
                return (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    onClick={(e) => onTocClick(e, t.id)}
                    className={[
                      "block rounded-lg px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-subtle-surface text-primary"
                        : "text-muted hover:text-primary hover:bg-subtle-surface",
                    ].join(" ")}
                  >
                    {t.label}
                  </a>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* BODY */}
      <div className="space-y-6">
        {loading ? (
          <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted text-center">
            Loading…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : remoteSections.length === 0 ? (
          <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-sm text-muted">
            No constitution sections have been published yet.
          </div>
        ) : (
          remoteSections.map((s) => (
            <RemoteSectionCard key={s.id} id={s.id} title={`${s.order}. ${s.title}`} bodyHtml={s.bodyHtml} />
          ))
        )}
      </div>
    </section>
  );
}
