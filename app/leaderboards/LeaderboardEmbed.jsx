"use client";

import { useEffect, useState } from "react";

const BASE_URL = "https://ballsville-leaderboard.pages.dev/";

export default function LeaderboardEmbed() {
  const [src, setSrc] = useState(BASE_URL);

  useEffect(() => {
    // New cache-busting value each time the page is loaded.
    const u = new URL(BASE_URL);
    u.searchParams.set("t", String(Date.now()));
    setSrc(u.toString());
  }, []);

  return (
    <iframe
      src={src}
      title="BALLSVILLE Leaderboards"
      loading="lazy"
      allowFullScreen
      className="w-full h-[150vh] min-h-[600px] border-0"
    />
  );
}
