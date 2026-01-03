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

export function isLocalhost() {
  if (typeof window === "undefined") return false;
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

  // On the server (SSR) we always use /r2 so cookie/auth & bindings work.
  if (typeof window === "undefined") return `/r2/${cleanKey}`;

  // Local dev: hit public base directly (what you want).
  if (isLocalhost()) {
    const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE;
    if (base) return `${stripTrailingSlash(base)}/${cleanKey}`;
    // If the public base isn't set, fall back to the proxy route.
    return `/r2/${cleanKey}`;
  }

  // Production: use the proxy route.
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
