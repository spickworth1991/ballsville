"use client";

import React, { useEffect, useMemo, useState } from "react";

// In-memory cache so multiple SectionManifestGate instances on the same client session
// don't refetch the same manifest repeatedly.
const __MANIFEST_CACHE = new Map();

function isLocalhost() {
  if (typeof window === "undefined") return false;
  const h = String(window.location?.hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1";
}

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/$/, "");
  const p = String(path || "").replace(/^\//, "");
  return `${b}/${p}`;
}


/**
 * Fetches a small per-section manifest from R2 once, then lets children build
 * versioned URLs for data/images. When admin updates content, the manifest's
 * updatedAt changes and URLs change (cache-bust) automatically.
 *
 * Manifest key: /r2/data/manifests/{section}_{season}.json
 * If season is omitted, key: /r2/data/manifests/{section}.json
 */
function manifestUrl(section, season) {
  // In production we fetch through /r2 (Pages Functions) so bucket bindings + caching work.
  // In localhost dev, /r2 may not exist, so we fetch directly from the public r2.dev base.
  const localBase = process.env.NEXT_PUBLIC_ADMIN_R2_PROXY_BASE || "https://pub-b20eaa361fb04ee5afea1a9cf22eeb57.r2.dev";
  const base = isLocalhost() ? localBase : "/r2";
  const key = season
    ? `data/manifests/${section}_${season}.json`
    : `data/manifests/${section}.json`;
  return joinUrl(base, key);
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

    const cacheKey = `${section}:${season || ""}`;

    // Dedupe concurrent loads by caching the in-flight promise immediately.
    const existing = __MANIFEST_CACHE.get(cacheKey);
    if (existing?.manifest) {
      setManifest(existing.manifest);
      return;
    }
    if (existing?.promise) {
      const man = await existing.promise;
      setManifest(man);
      return;
    }

    const fetchPromise = (async () => {
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
      return out || { updatedAt: 0, section, season };
    })();

    __MANIFEST_CACHE.set(cacheKey, { promise: fetchPromise });

    const man = await fetchPromise;
    __MANIFEST_CACHE.set(cacheKey, { manifest: man });

    setManifest(man);
  } catch (e) {
    setError(e);
    // still render children with a stable fallback version so the page works
    const fallback = { updatedAt: 0, section, season };
    setManifest((m) => m || fallback);
    __MANIFEST_CACHE.set(`${section}:${season || ""}`, { manifest: fallback });
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

  // Support render-prop usage (client components can pass a function)
  if (typeof children === "function") {
    return children({ manifest, version, error });
  }

  // Support passing a React element from a Server Component without a function prop.
  // We inject `version` (and `manifest`/`error`) as props so downstream client fetches
  // can re-run only when the manifest changes.
  if (React.isValidElement(children)) {
    return React.cloneElement(children, { version, manifest, error });
  }

  return children || null;
}
