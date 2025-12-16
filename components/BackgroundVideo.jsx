"use client";

import { useEffect, useRef } from "react";

export default function BackgroundVideo({
  src = "/space.mp4",
  start = 0,     // seconds
  end = 12,      // seconds (segment end)
}) {
  const ref = useRef(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const onLoaded = () => {
      // start at the desired point
      try {
        v.currentTime = start;
      } catch {}
      v.play?.().catch(() => {});
    };

    const onTimeUpdate = () => {
      if (end > start && v.currentTime >= end) {
        v.currentTime = start;
        v.play?.().catch(() => {});
      }
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [start, end]);

  return (
    <video
      ref={ref}
      className="site-bg-video"
      autoPlay
      loop={false}     // we handle looping
      muted
      playsInline
      preload="metadata"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
