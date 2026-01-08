// lib/r2Url.js
//
// Client-side helper for building URLs to content stored in R2.
//
// - Production / Preview: prefer same-origin `/r2/<key>` so Pages Functions can attach auth/bindings.
// - Localhost: fetch directly from the PUBLIC R2 base URL so dev works even if Wrangler bindings
//   (or the /r2 proxy) aren't wired for your local environment.

function isLocalhost() {
  if (typeof window === "undefined") return false;
  const h = (window.location?.hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function stripLeadingSlashes(s) {
  return String(s || "").replace(/^\/+/, "");
}

function env(name, fallback = "") {
  // Next injects NEXT_PUBLIC_* at build time; fallback keeps localhost usable even without .env.
  return (typeof process !== "undefined" && process?.env?.[name]) || fallback;
}

function pickBase(kind) {
  const k = String(kind || "").trim().toUpperCase();

  // Allow per-kind override, e.g. NEXT_PUBLIC_R2_PUBLIC_BASE_BIGGAME
  const perKind = env(`NEXT_PUBLIC_R2_PUBLIC_BASE_${k}`, "");
  if (perKind) return perKind;

  // Default public base for localhost direct reads
  const base = env(
    "NEXT_PUBLIC_R2_PUBLIC_BASE",
    // Fallback to your existing public bucket (matches your HAR captures)
    "https://pub-b20eaa361fb04ee5afea1a9cf22eeb57.r2.dev"
  );
  return base;
}

export function r2Url(key, { kind = "admin" } = {}) {
  const k = stripLeadingSlashes(key);
  if (!k) return "";

  // Local dev: direct public R2 read
  if (isLocalhost()) {
    const base = pickBase(kind);
    return `${String(base).replace(/\/$/, "")}/${k}`;
  }

  // Preview/Prod: use proxy route handled by Functions
  return `/r2/${k}`;
}
