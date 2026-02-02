// app/tools/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_SPLASH_START = 25; // <-- set your preferred default start time here (seconds)
const SPLASH_DURATION_MS = 3600;

export default function ToolsPage() {
  const [showSplash, setShowSplash] = useState(true);
  const videoRef = useRef(null);
  const searchParams = useSearchParams();

  const startTime = useMemo(() => {
    const t = searchParams?.get("t");
    const n = t == null ? NaN : Number(t);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SPLASH_START;
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-[calc(100vh-64px)] relative">
      {/* Arsenal mounted under /tools/app */}
      <div className="relative w-full h-[calc(100vh-64px)]">
        <iframe
          title="The Fantasy Arsenal"
          src="/tools/app/"
          className="absolute inset-0 w-full h-full border-0"
        />
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
              // Clamp start time to video duration if known
              const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
              v.currentTime = Math.min(startTime, Math.max(0, dur - 0.25));
            }}
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          >
            <source src="/media/arsenal-partnership.mp4" type="video/mp4" />
          </video>

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
