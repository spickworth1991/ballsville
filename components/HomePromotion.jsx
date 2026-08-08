"use client";

import { useEffect, useState } from "react";
import { adminR2Url } from "@/lib/r2Client";

export const DEFAULT_HOME_PROMOTION = {
  enabled: true,
  eyebrow: "Subscriber Giveaway",
  title: "Win a seat in a $1,000 fantasy football league",
  description: "We’re giving one loyal Ballsville subscriber and commenter a seat in our $1,000 league.",
  drawingDate: "Wednesday, August 19th",
  drawingTime: "5:30 PM EST — live on our podcast",
  benefits: [
    "$1,000+ total prize pool",
    "Competitive — serious players only",
    "Safe and fair — LeagueSafe majority",
    "Podcast coverage, live updates and trade talk",
    "Exclusive Ballsville perks",
  ],
  entrySteps: [
    "Subscribe to the Ballsville Game YouTube channel",
    "Leave a comment on any of our videos",
    "One random winner will be drawn live",
  ],
  imageKey: "",
  imageUrl: "/photos/homepage-promotion.png",
  actionLabel: "Visit our YouTube channel",
  actionUrl: "https://youtube.com/@theballsvillegame",
};

function cleanPromotion(value) {
  const data = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_HOME_PROMOTION,
    ...data,
    benefits: Array.isArray(data.benefits) ? data.benefits.filter(Boolean) : DEFAULT_HOME_PROMOTION.benefits,
    entrySteps: Array.isArray(data.entrySteps) ? data.entrySteps.filter(Boolean) : DEFAULT_HOME_PROMOTION.entrySteps,
  };
}

export default function HomePromotion() {
  const [promotion, setPromotion] = useState(DEFAULT_HOME_PROMOTION);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${adminR2Url("content/sitewide/home-promotion.json")}?v=${Date.now()}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (active && payload) setPromotion(cleanPromotion(payload.data || payload));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!promotion.enabled) return null;

  const imageSrc = promotion.imageKey
    ? `${adminR2Url(promotion.imageKey)}?v=${encodeURIComponent(promotion.updatedAt || "promotion")}`
    : promotion.imageUrl || DEFAULT_HOME_PROMOTION.imageUrl;

  return (
    <>
      <section className="section py-6" aria-labelledby="home-promotion-title">
        <div className="container-site">
          <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-card-surface p-6 shadow-xl md:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,1.15fr)]">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-accent">{promotion.eyebrow}</p>
                <h2 id="home-promotion-title" className="mt-2 text-3xl font-extrabold text-primary md:text-4xl">
                  {promotion.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-fg">{promotion.description}</p>

                <div className="mt-5 rounded-2xl border border-subtle bg-subtle-surface/40 p-4">
                  <p className="font-bold text-primary">Live drawing: {promotion.drawingDate}</p>
                  <p className="mt-1 text-sm text-accent">{promotion.drawingTime}</p>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-primary">Why play?</h3>
                    <ul className="mt-2 space-y-2 text-sm text-fg">
                      {promotion.benefits.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">How to enter</h3>
                    <ol className="mt-2 space-y-2 text-sm text-fg">
                      {promotion.entrySteps.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
                    </ol>
                  </div>
                </div>

                {promotion.actionUrl ? (
                  <a className="btn btn-primary mt-6 rounded-xl" href={promotion.actionUrl} target="_blank" rel="noopener noreferrer">
                    {promotion.actionLabel || "Learn more"}
                  </a>
                ) : null}
              </div>

              <button type="button" className="group cursor-zoom-in overflow-hidden rounded-2xl border border-subtle bg-black shadow-xl" onClick={() => setExpanded(true)} aria-label="Open giveaway artwork full size">
                <img src={imageSrc} alt={`${promotion.title} promotion`} className="h-auto w-full transition duration-300 group-hover:scale-[1.015]" />
                <span className="block bg-black/80 px-3 py-2 text-center text-xs text-white/80">Click artwork to enlarge</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {expanded ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 md:p-8" role="dialog" aria-modal="true" aria-label="Giveaway artwork">
          <button type="button" className="absolute inset-0 cursor-zoom-out" onClick={() => setExpanded(false)} aria-label="Close enlarged artwork" />
          <div className="relative z-10 max-h-full max-w-[96rem] overflow-auto">
            <button type="button" className="btn btn-primary sticky left-full top-0 z-20 mb-2" onClick={() => setExpanded(false)}>Close</button>
            <img src={imageSrc} alt={`${promotion.title} promotion, enlarged`} className="h-auto max-h-[88vh] w-auto max-w-full rounded-xl" />
          </div>
        </div>
      ) : null}
    </>
  );
}
