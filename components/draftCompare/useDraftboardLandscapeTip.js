"use client";

import { useEffect, useRef, useState } from "react";

// Phone-like = touch (coarse pointer) with no hover.
// Max-width guard avoids showing the tip on large tablets.
//
// Shows at most ONCE per component mount ("once per visit"),
// and never re-opens after dismiss or after rotating to landscape.
export function useDraftboardLandscapeTip({ enabled = true } = {}) {
  const [isPhoneLike, setIsPhoneLike] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);
  const [showTip, setShowTip] = useState(false);

  // “Seen once this visit” (per mount)
  const seenOnceRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!enabled) {
      setShowTip(false);
      return;
    }

    let mounted = true;

    const mqPhone = window.matchMedia("(hover: none) and (pointer: coarse) and (max-width: 1024px)");
    const mqPortrait = window.matchMedia("(orientation: portrait)");

    function compute() {
      if (!mounted) return;

      const phone = !!mqPhone.matches;
      const portrait = !!mqPortrait.matches;

      setIsPhoneLike(phone);
      setIsPortrait(portrait);

      // Not phone-like => never show
      if (!phone) {
        setShowTip(false);
        return;
      }

      // Rotated to landscape => close and mark seen
      if (!portrait) {
        setShowTip(false);
        seenOnceRef.current = true;
        return;
      }

      // Phone-like + portrait => show ONCE per visit
      if (!seenOnceRef.current) {
        setShowTip(true);
        seenOnceRef.current = true;
      }
    }

    compute();

    const onChange = () => compute();

    try {
      mqPhone.addEventListener?.("change", onChange);
      mqPortrait.addEventListener?.("change", onChange);
    } catch {
      mqPhone.addListener?.(onChange);
      mqPortrait.addListener?.(onChange);
    }

    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);

    return () => {
      mounted = false;
      try {
        mqPhone.removeEventListener?.("change", onChange);
        mqPortrait.removeEventListener?.("change", onChange);
      } catch {
        mqPhone.removeListener?.(onChange);
        mqPortrait.removeListener?.(onChange);
      }
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, [enabled]);

  function acknowledge() {
    // Explicit dismiss should also prevent re-open this visit
    seenOnceRef.current = true;
    setShowTip(false);
  }

  return { isPhoneLike, isPortrait, showTip, acknowledge };
}
