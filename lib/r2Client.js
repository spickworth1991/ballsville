// lib/r2Client.js
//
// Client-side helper for building URLs to content stored in the ADMIN bucket.
//
// Goal: match the Gauntlet leaderboard behavior.
// - Production (or any non-localhost): fetch through the proxy route: /r2/<key>
// - Localhost: fetch directly from the public R2 base URL so local dev works
//   even if bindings/env are not wired in Wrangler.

export function isLocalhostHost(hostname) {
  const h = String(hostname || "").trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function isDevRuntime() {
  // Next replaces process.env.NODE_ENV at build time.
  // This catches local dev even if you're testing over a LAN URL.
  try {
    return process?.env?.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

export function isLocalhost() {
  if (typeof window === "undefined") return false;
  if (isDevRuntime()) return true;
  return isLocalhostHost(window.location?.hostname);
}

function stripLeadingSlashes(s) {
  return String(s || "").replace(/^\/+/, "");
}

function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}

/**
 * Build a URL for an ADMIN-bucket key.
 *
 * @param {string} key - e.g. "data/redraft/leagues_2025.json" or "content/.../hero.webp"
 */
export function adminR2UrlForKey(key) {
  const cleanKey = stripLeadingSlashes(key);

  // Prefer direct public R2 reads during local dev so Next "npm run dev" works
  // without Wrangler bindings (and even when testing via a LAN hostname).
  if (isDevRuntime()) {
    const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE;
    if (base) return `${stripTrailingSlash(base)}/${cleanKey}`;
  }

  // Default: use the proxy route (/r2/<key>) which is correct in production.
  return `/r2/${cleanKey}`;
}

/**
 * Same as adminR2UrlForKey, but preserves a querystring.
 *
 * @param {string} keyWithQuery - e.g. "data/redraft/leagues_2025.json?v=123"
 */
export function adminR2Url(keyWithQuery) {
  const s = String(keyWithQuery || "");
  const [key, query] = s.split("?");
  const base = adminR2UrlForKey(key);
  return query ? `${base}?${query}` : base;
}
