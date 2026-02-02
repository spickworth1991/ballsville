// app/tools/page.jsx
"use client";

import { useEffect } from "react";

export default function ToolsSplash() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = "/tools/";
    }, 2600);

    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white relative overflow-hidden">
      <video
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-70"
      >
        <source src="space.mp4" type="video/mp4" />
      </video>
{/* /media/arsenal-partnership.mp4 */}
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
    </main>
  );
}
