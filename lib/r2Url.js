// lib/r2Url.js
//
// Client-side helper for building R2 URLs.
//
// Production: prefer same-origin `/r2/<key>` (Pages Functions can use bindings).
// Localhost: fetch directly from public r2.dev base URLs (matches Gauntlet Leg3 leaderboard behavior).

function isLocalhost() {
  if (typeof window === "undefined") return false;
  const h = window.location?.hostname || "";
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function stripLeadingSlashes(s) {
  return String(s || "").replace(/^\/+/, "");
}

function pickBase(kind) {
  if (kind === "leaderboards") {
    return (
      process.env.NEXT_PUBLIC_LEADERBOARDS_R2_PUBLIC_BASE ||
      "https://pub-153090242f5a4c0eb7bd0e499832a797.r2.dev"
    );
  }
  if (kind === "gauntlet_leaderboard") {
    return (
      process.env.NEXT_PUBLIC_GAUNTLET_LEADERBOARD_R2_PUBLIC_BASE ||
      "https://pub-eec34f38e47f4ffbbc39af58bda1bcc2.r2.dev"
    );
  }
  // default admin bucket
  return (
    // If you already use this name elsewhere in the project, honor it first.
    process.env.NEXT_PUBLIC_ADMIN_R2_PROXY_BASE ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE ||
    "https://pub-b20eaa361fb04ee5afea1a9cf22eeb57.r2.dev"
  );
}

export function r2Url(key, { kind = "admin" } = {}) {
  const k = stripLeadingSlashes(key);
  if (!k) return "";

  if (isLocalhost()) {
    const base = pickBase(kind);
    return `${String(base).replace(/\/$/, "")}/${k}`;
  }

  return `/r2/${k}`;
}
