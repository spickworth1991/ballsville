"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Fetches a small per-section manifest from R2 once, then lets children build
 * versioned URLs for data/images. When admin updates content, the manifest's
 * updatedAt changes and URLs change (cache-bust) automatically.
 *
 * Manifest key: /r2/data/manifests/{section}_{season}.json
 * If season is omitted, key: /r2/data/manifests/{section}.json
 */
function manifestUrl(section, season) {
  const base = season ? `/r2/data/manifests/${section}_${season}.json` : `/r2/data/manifests/${section}.json`;
  return base;
}

export default function SectionManifestGate({ section, season, pollMs = 0, children }) {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setError(null);
      const res = await fetch(manifestUrl(section, season), { cache: "no-store" });
      if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
      const data = await res.json();
      setManifest(data);
    } catch (e) {
      setError(e);
      // still render children with a stable fallback version so the page works
      setManifest((m) => m || { updatedAt: 0, section, season });
    }
  }

  useEffect(() => {
    load();
    if (!pollMs) return;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, season, pollMs]);

  const version = useMemo(() => {
    const v = manifest?.updatedAt ? String(manifest.updatedAt) : "0";
    return encodeURIComponent(v);
  }, [manifest]);

  if (typeof children === "function") {
    return children({ manifest, version, error });
  }

  return children || null;
}
