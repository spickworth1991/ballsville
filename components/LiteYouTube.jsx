"use client";
import { useEffect, useRef, useState } from "react";

export default function LiteYouTube({
  id,              // YouTube video ID (e.g. "8Bn8P3E8dHc")
  mp4Src,          // Optional MP4 source (e.g. "/ballsville.mp4")
  title = "Video",
  poster           // Optional poster image for MP4
}) {
  const [loaded, setLoaded] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const videoRef = useRef(null);

  const hasYouTube = !!id;
  const hasMp4 = !!mp4Src;

  // Only build YouTube thumbs if using YouTube
  const thumbMQ = hasYouTube ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
  const thumbHQ = hasYouTube ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  const thumbSD = hasYouTube ? `https://i.ytimg.com/vi/${id}/sddefault.jpg` : null;

  const loadYouTube = () => {
    setLoaded(true);
    setOverlayVisible(false);
  };

  // --- YOUTUBE AUTOPLAY LOGIC ---
  useEffect(() => {
    if (!hasYouTube || !loaded || !iframeRef.current) return;

    const ensureYTApi = () =>
      new Promise((resolve) => {
        if (window.YT && window.YT.Player) return resolve(window.YT);
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
        window.onYouTubeIframeAPIReady = () => resolve(window.YT);
      });

    ensureYTApi().then((YT) => {
      const player = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            playerRef.current = player;
            try {
              player.playVideo();
            } catch {}
          },
        },
      });
    });
  }, [loaded, hasYouTube]);

  // --- MP4 AUTOPLAY (no overlay) ---
  useEffect(() => {
    if (hasMp4 && videoRef.current) {
      try {
        videoRef.current.play();
      } catch {}
    }
  }, [hasMp4]);

  // If nothing provided, return nothing
  if (!hasYouTube && !hasMp4) return null;

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg aspect-video bg-fg">

      {/* --------------------------
          MP4 MODE — AUTOPLAY / LOOP
      -------------------------- */}
      {hasMp4 && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={mp4Src}
          poster={poster}
          autoPlay        // 🔥 autoplay immediately
          loop            // 🔁 repeat forever
          muted           // 🔇 required for autoplay
          playsInline     // 📱 iOS support
          controls        // 🎛 user can pause/play
        />
      )}

      {/* --------------------------
          YOUTUBE MODE — CLICK OVERLAY
      -------------------------- */}
      {hasYouTube && !hasMp4 && (
        <>
          {!loaded && (
            <button
              onClick={loadYouTube}
              className="absolute inset-0 w-full h-full"
              aria-label={`Play ${title}`}
            >
              <img
                src={thumbSD}
                srcSet={`${thumbMQ} 320w, ${thumbHQ} 480w, ${thumbSD} 640w`}
                sizes="(max-width: 640px) 320px, (max-width: 768px) 480px, 640px"
                alt={title}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  overlayVisible ? "opacity-100" : "opacity-0"
                }`}
                loading="lazy"
              />

              <span className="absolute inset-0 grid place-items-center">
                <span className="rounded-full p-4 bg-card backdrop-blur text-fg text-xl">
                  ▶
                </span>
              </span>
            </button>
          )}

          {loaded && (
            <iframe
              ref={iframeRef}
              title={title}
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
              allowFullScreen
            />
          )}
        </>
      )}
    </div>
  );
}
