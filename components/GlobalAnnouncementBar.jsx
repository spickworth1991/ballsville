"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { globalAnnouncementBar } from "@/app/config/globalAnnouncementBar";

function isExternalHref(href) {
  return /^https?:\/\//i.test(String(href || "").trim());
}

function AnnouncementItem({ item }) {
  const href = String(item?.href || "").trim();
  const label = String(item?.text || "").trim();
  if (!label) return null;

  const content = (
    <>
      <span className="announcement-chip-dot" aria-hidden="true" />
      <span>{label}</span>
    </>
  );

  if (!href) {
    return <span className="announcement-chip">{content}</span>;
  }

  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="announcement-chip">
        {content}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={false} className="announcement-chip">
      {content}
    </Link>
  );
}

function AnnouncementGroup({ items, ariaHidden = false }) {
  return (
    <div className="announcement-group" aria-hidden={ariaHidden ? "true" : undefined}>
      {items.map((item, index) => (
        <AnnouncementItem key={`${item.text}-${index}`} item={item} />
      ))}
    </div>
  );
}

export default function GlobalAnnouncementBar() {
  const items = Array.isArray(globalAnnouncementBar?.items)
    ? globalAnnouncementBar.items.filter((item) => String(item?.text || "").trim())
    : [];

  const trackRef = useRef(null);
  const groupRef = useRef(null);

  useEffect(() => {
    const trackEl = trackRef.current;
    const groupEl = groupRef.current;
    if (!trackEl || !groupEl) return undefined;

    let rafId = 0;
    let resizeObserver = null;
    let previousTs = 0;
    let offset = 0;
    let groupWidth = 0;
    const loopSeconds = Math.max(8, Number(globalAnnouncementBar?.speedSeconds) || 34);

    const measure = () => {
      groupWidth = groupEl.scrollWidth || 0;
      offset = offset % (groupWidth || 1);
    };

    const tick = (ts) => {
      if (!trackRef.current || !groupWidth) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      if (!previousTs) previousTs = ts;
      const deltaSec = (ts - previousTs) / 1000;
      previousTs = ts;
      const pixelsPerSecond = groupWidth / loopSeconds;
      offset = (offset + pixelsPerSecond * deltaSec) % groupWidth;
      trackRef.current.style.transform = `translate3d(${-offset}px, 0, 0)`;
      rafId = window.requestAnimationFrame(tick);
    };

    measure();
    rafId = window.requestAnimationFrame(tick);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        previousTs = 0;
        measure();
      });
      resizeObserver.observe(groupEl);
    }

    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measure);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [items]);

  if (!globalAnnouncementBar?.enabled || items.length === 0) return null;

  return (
    <section className="announcement-shell" aria-label="Site announcements">
      <div className="mx-auto max-w-7xl px-2 sm:px-4 md:px-6">
        <div className="announcement-bar">
          <div className="announcement-badge">
            <span className="announcement-badge-pulse" aria-hidden="true" />
            <span>{globalAnnouncementBar.eyebrow || "Updates"}</span>
          </div>

          <div className="announcement-marquee">
            <div ref={trackRef} className="announcement-track">
              <div ref={groupRef}>
                <AnnouncementGroup items={items} />
              </div>
              <AnnouncementGroup items={items} ariaHidden />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
