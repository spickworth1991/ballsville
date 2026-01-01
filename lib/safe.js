// /lib/safe.js
// Tiny, dependency-free helpers used across client + server.

export function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
