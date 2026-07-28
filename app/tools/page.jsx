// app/tools/page.jsx
"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_SPLASH_START = 25; // default start time (seconds)
const SPLASH_DURATION_MS = 3600;

export default function ToolsPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [startTime, setStartTime] = useState(DEFAULT_SPLASH_START);
  const videoRef = useRef(null);

  // Read ?t= from the URL on the client (no useSearchParams -> no Suspense build error)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("t");
      const n = t == null ? NaN : Number(t);
      if (Number.isFinite(n) && n >= 0) setStartTime(n);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("ballsville:arsenal-welcome") === "seen") {
        setShowSplash(false);
        return;
      }
      sessionStorage.setItem("ballsville:arsenal-welcome", "seen");
    } catch {
      // Session storage is optional; retain the timed welcome if unavailable.
    }
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="relative min-h-[calc(100dvh-64px)] bg-[#020617]">
      {/* Arsenal mounted under /tools/app */}
      <div className="relative h-[calc(100dvh-64px)] w-full overflow-hidden">
        {!appReady && !showSplash ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#020617] text-white">
            <div className="text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-cyan-300" />
              <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-white/55">
                OPENING THE ARSENAL
              </p>
            </div>
          </div>
        ) : null}
        <iframe
          title="The Fantasy Arsenal"
          src="/tools/app/"
          onLoad={() => setAppReady(true)}
          className="absolute inset-0 h-full w-full border-0 bg-[#020617]"
          allow="clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <a
          href="/tools/app/"
          className="absolute bottom-[max(.75rem,env(safe-area-inset-bottom))] right-3 z-20 rounded-full border border-white/15 bg-slate-950/90 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-100 shadow-xl backdrop-blur md:bottom-4 md:right-4"
          title="Open The Fantasy Arsenal without the Ballsville navigation"
        >
          Focus mode ↗
        </a>
      </div>

      {/* Splash overlay */}
      {showSplash && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-white overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={() => {
              const v = videoRef.current;
              if (!v) return;

              // clamp start time to duration if known
              const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
              const t = Math.min(startTime, Math.max(0, dur - 0.25));

              // Some browsers are picky—set then play
              try {
                v.currentTime = t;
              } catch {
                // ignore
              }
            }}
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          >
            <source src="space.mp4" type="video/mp4" />
          </video>
{/* src="/media/arsenal-partnership.mp4"  */}
          <div className="relative z-10 text-center px-6">
            <div className="text-sm tracking-widest opacity-80 mb-3">
              IN PARTNERSHIP WITH
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold mb-4">
              THE FANTASY ARSENAL
            </h1>

            <div className="text-lg opacity-90">
              powered by <span className="font-semibold">BALLSVILLE</span>
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/80" />
        </div>
      )}
    </main>
  );
}
