// components/ErudaDebug.jsx
"use client";

import { useEffect } from "react";

export default function ErudaDebug() {
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("debug") !== "1") return;

      // Avoid double-inject
      if (window.__ERUDA_LOADED__) return;

      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/eruda";
      s.async = true;

      s.onload = () => {
        window.__ERUDA_LOADED__ = true;
        // eruda is global
        // eslint-disable-next-line no-undef
        eruda.init();

        // optional: open by default so you don't have to tap the bubble
        // eslint-disable-next-line no-undef
        eruda.show();
      };

      document.body.appendChild(s);

      return () => {
        try {
          document.body.removeChild(s);
        } catch {}
      };
    } catch {}
  }, []);

  return null;
}
