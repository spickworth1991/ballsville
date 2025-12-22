// functions/api/_adminAuth.js
//
// Admin auth helper that ONLY depends on the Supabase access token itself.
// We do NOT require SUPABASE_URL / anon key envs at runtime.
//
// Strategy:
// - Verify the JWT signature using the Supabase project's JWKS endpoint.
// - The JWKS URL is derived from the token's `iss` claim.
// - Optionally enforce an admin allowlist via env.ADMIN_EMAILS (comma-separated).
//
// This keeps all non-auth admin data in R2, while still using Supabase for login.

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function b64urlToBytes(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson(s) {
  const txt = new TextDecoder().decode(b64urlToBytes(s));
  return JSON.parse(txt);
}

function pickSupabaseBaseFromIss(iss) {
  // Expected: https://<project>.supabase.co/auth/v1
  if (!iss || typeof iss !== "string") return null;
  const m = iss.match(/^(https:\/\/[^\/]+)\/auth\/v1\/?$/);
  if (!m) return null;
  return m[1];
}

const JWKS_CACHE = new Map();
// { keys, fetchedAt }

async function fetchJwks(base) {
  const cached = JWKS_CACHE.get(base);
  const now = Date.now();
  // 10 minute cache
  if (cached && now - cached.fetchedAt < 10 * 60 * 1000) return cached.keys;

  const url = `${base}/auth/v1/.well-known/jwks.json`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Failed to fetch JWKS (${res.status})`);
  const jwks = await res.json();
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  JWKS_CACHE.set(base, { keys, fetchedAt: now });
  return keys;
}

async function verifySupabaseJwt(token) {
  if (!token) throw new Error("Missing Authorization token");

  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const header = b64urlToJson(parts[0]);
  const payload = b64urlToJson(parts[1]);

  const iss = payload?.iss;
  const base = pickSupabaseBaseFromIss(iss);
  if (!base) throw new Error("Unrecognized token issuer");

  const alg = header?.alg;
  const kid = header?.kid;
  if (alg !== "RS256") throw new Error("Unsupported JWT alg");
  if (!kid) throw new Error("Missing JWT kid");

  const exp = Number(payload?.exp || 0) * 1000;
  if (!exp || Date.now() >= exp) throw new Error("Token expired");

  const keys = await fetchJwks(base);
  const jwk = keys.find((k) => k?.kid === kid);
  if (!jwk) throw new Error("JWKS key not found");

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sig = b64urlToBytes(parts[2]);

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sig, data);
  if (!ok) throw new Error("Invalid token signature");

  return payload;
}

function getAllowedAdmins(env) {
  const raw =
    (env && (env.ADMIN_EMAILS || env.NEXT_PUBLIC_ADMIN_EMAILS || env.admin_emails)) ||
    "";
  const list = String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list;
}

export async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  try {
    const payload = await verifySupabaseJwt(token);
    const email = String(payload?.email || payload?.user_metadata?.email || "").toLowerCase();

    const allow = getAllowedAdmins(env);
    if (allow.length && email && !allow.includes(email)) {
      return { ok: false, response: json({ error: "Forbidden" }, 403) };
    }

    return { ok: true, payload, email };
  } catch (e) {
    return { ok: false, response: json({ error: e?.message || "Unauthorized" }, 401) };
  }
}
