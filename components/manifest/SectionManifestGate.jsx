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

async function tryFetchJson(url) {
  const res = await fetch(url);
  if (res.status === 404) return { ok: false, status: 404, data: null };
  if (!res.ok) return { ok: false, status: res.status, data: null };
  const data = await res.json();
  return { ok: true, status: res.status, data };
}

export default function SectionManifestGate({ section, season, pollMs = 0, children }) {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setError(null);
      // Let normal browser caching apply (Cloudflare sends must-revalidate + ETag).
      // We want 304s when unchanged, not forced 200s.
      let out = null;

      // Try season-scoped manifest first.
      if (season) {
        const r1 = await tryFetchJson(manifestUrl(section, season));
        if (r1.ok) out = r1.data;
        // Fall back to non-season manifest if the season-scoped one doesn't exist.
        if (!out && r1.status === 404) {
          const r2 = await tryFetchJson(manifestUrl(section));
          if (r2.ok) out = r2.data;
        }
      } else {
        const r = await tryFetchJson(manifestUrl(section));
        if (r.ok) out = r.data;
      }

      // If manifest doesn't exist yet (404), still render with a stable fallback.
      setManifest(out || { updatedAt: 0, section, season });
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
