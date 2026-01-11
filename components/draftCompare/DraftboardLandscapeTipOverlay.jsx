"use client";

import React from "react";

function cls(...a) {
  return a.filter(Boolean).join(" ");
}

// Controlled overlay UI (reusable).
// Use the hook to decide when to show it.
export default function DraftboardLandscapeTipOverlay({ open, isPortrait = true, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={cls(
          "w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-card-surface shadow-2xl",
          isPortrait ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]",
          "transition-all duration-300"
        )}
      >
        <div className="relative p-6">
          <div className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-white/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-white/70">Draftboard</div>
                <div className="mt-1 text-lg font-semibold text-white">Landscape recommended</div>
                <div className="mt-2 text-sm text-white/70">
                  For the clearest view, rotate your phone sideways. (This closes automatically when you do.)
                </div>
              </div>

              <button
                type="button"
                onClick={() => onClose?.()}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
              >
                Got it
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 rounded-[36px] bg-white/10 blur-2xl" />

                <div className="relative h-[132px] w-[78px] rounded-[22px] border border-white/15 bg-white/10 shadow-xl backdrop-blur">
                  <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25" />
                  <div className="absolute inset-2 rounded-[16px] border border-white/10 bg-black/10" />
                </div>

                <div
                  className={cls(
                    "pointer-events-none absolute inset-0 flex items-center justify-center",
                    isPortrait ? "opacity-100" : "opacity-0",
                    "transition-opacity duration-150",
                    "animate-[draftPhoneFlip_1.6s_ease-in-out_infinite]"
                  )}
                >
                  <div className="h-[132px] w-[78px] rounded-[22px] border border-white/15 bg-white/5 shadow-lg backdrop-blur">
                    <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20" />
                    <div className="absolute inset-2 rounded-[16px] border border-white/10 bg-black/10" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center text-[11px] text-white/60">Tip: landscape + swipe = fastest scanning.</div>
          </div>
        </div>

        <style jsx>{`
          @keyframes draftPhoneFlip {
            0% {
              transform: rotate(0deg) scale(1);
              opacity: 0.35;
            }
            35% {
              transform: rotate(0deg) scale(1);
              opacity: 0.35;
            }
            70% {
              transform: rotate(90deg) scale(1.02);
              opacity: 0.9;
            }
            100% {
              transform: rotate(90deg) scale(1.02);
              opacity: 0.9;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
