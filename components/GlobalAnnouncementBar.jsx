"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { globalAnnouncementBar as fallbackAnnouncementBar } from "@/app/config/globalAnnouncementBar";
import { r2Url } from "@/lib/r2Url";

const ANNOUNCEMENT_BAR_KEY = "content/sitewide/announcement-bar.json";

function isExternalHref(href) {
  return /^https?:\/\//i.test(String(href || "").trim());
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v, fallback = 0) {
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function sanitizeAnnouncementBar(input) {
  const value = input && typeof input === "object" ? input : {};
  return {
    enabled: value?.enabled !== false,
    eyebrow: safeStr(value?.eyebrow || fallbackAnnouncementBar?.eyebrow || "Ballsville Bulletin").trim() || "Ballsville Bulletin",
    speedSeconds: Math.max(8, safeNum(value?.speedSeconds, fallbackAnnouncementBar?.speedSeconds || 34)),
    items: safeArray(value?.items)
      .map((item, index) => ({
        id: safeStr(item?.id).trim() || `announcement_${index + 1}`,
        text: safeStr(item?.text).trim(),
        href: safeStr(item?.href).trim(),
      }))
      .filter((item) => item.text),
  };
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
        <AnnouncementItem key={`${item.id || item.text}-${index}`} item={item} />
      ))}
    </div>
  );
}

export default function GlobalAnnouncementBar({ version = "0" }) {
  const [config, setConfig] = useState(() => sanitizeAnnouncementBar(fallbackAnnouncementBar));
  const trackRef = useRef(null);
  const groupRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const v = String(version || "0");
      const cacheVersionKey = "announcement-bar:version";
      const cacheDataKey = "announcement-bar:data";

      try {
        const cachedVersion = sessionStorage.getItem(cacheVersionKey);
        const cachedData = sessionStorage.getItem(cacheDataKey);
        if (cachedVersion && cachedVersion === v && cachedData) {
          const parsed = JSON.parse(cachedData);
          if (!cancelled) setConfig(sanitizeAnnouncementBar(parsed));
          return;
        }
      } catch {
        // ignore cache issues
      }

      try {
        const res = await fetch(`${r2Url(ANNOUNCEMENT_BAR_KEY)}?v=${encodeURIComponent(v)}`);
        if (!res.ok) return;
        const parsed = await res.json();
        const next = sanitizeAnnouncementBar(parsed?.data || parsed);
        if (cancelled) return;
        setConfig(next);

        try {
          sessionStorage.setItem(cacheVersionKey, v);
          sessionStorage.setItem(cacheDataKey, JSON.stringify(next));
        } catch {
          // ignore cache issues
        }
      } catch {
        // keep fallback config
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const items = useMemo(() => safeArray(config?.items).filter((item) => safeStr(item?.text).trim()), [config]);

  useEffect(() => {
    const trackEl = trackRef.current;
    const groupEl = groupRef.current;
    if (!trackEl || !groupEl || items.length === 0 || config?.enabled === false) return undefined;

    let rafId = 0;
    let resizeObserver = null;
    let previousTs = 0;
    let offset = 0;
    let groupWidth = 0;
    const loopSeconds = Math.max(8, Number(config?.speedSeconds) || 34);

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
    trackEl.style.transform = "translate3d(0, 0, 0)";
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
  }, [config, items]);

  if (!config?.enabled || items.length === 0) return null;

  return (
    <section className="announcement-shell" aria-label="Site announcements">
      <div className="mx-auto max-w-7xl px-2 sm:px-4 md:px-6">
        <div className="announcement-bar">
          <div className="announcement-badge">
            <span className="announcement-badge-pulse" aria-hidden="true" />
            <span>{config.eyebrow || "Updates"}</span>
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
