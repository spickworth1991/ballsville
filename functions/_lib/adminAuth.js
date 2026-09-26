const COOKIE_NAME = "ballsville_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function bucketFor(env) {
  return env.ADMIN_BUCKET || env.admin_bucket || null;
}

export function normalizeAdminUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function validAdminUsername(value) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeAdminUsername(value));
}

export function adminUserKey(username) {
  return `data/admin/auth/users/${normalizeAdminUsername(username)}.json`;
}

export async function hashAdminPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    material,
    256,
  ));
  return { salt: bytesToBase64Url(saltBytes), hash: bytesToBase64Url(derived), iterations: PBKDF2_ITERATIONS };
}

export async function hashAdminToken(token) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

export async function readAdminUser(env, username) {
  const bucket = bucketFor(env);
  if (!bucket?.get || !validAdminUsername(username)) return null;
  const object = await bucket.get(adminUserKey(username));
  if (!object) return null;
  try { return await object.json(); } catch { return null; }
}

export async function writeAdminUser(env, user) {
  const bucket = bucketFor(env);
  if (!bucket?.put) throw new Error("The admin R2 binding is not configured.");
  await bucket.put(adminUserKey(user.username), JSON.stringify(user), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export async function verifyAdminCredentials(env, username, password) {
  const key = normalizeAdminUsername(username);
  const user = await readAdminUser(env, key);
  if (!user || user.status !== "approved" || !user.salt || !user.hash || !password) return null;
  const iterations = Number(user.iterations || PBKDF2_ITERATIONS);
  if (iterations !== PBKDF2_ITERATIONS) return null;
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64UrlToBytes(user.salt), iterations },
    material,
    256,
  ));
  if (!equalBytes(derived, base64UrlToBytes(user.hash))) return null;
  return { username: key, name: key };
}

export async function createAdminSession(env, user) {
  if (!env.ADMIN_AUTH_SECRET) throw new Error("ADMIN_AUTH_SECRET is not configured.");
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    sub: user.username,
    name: user.username,
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })));
  return `${payload}.${bytesToBase64Url(await hmac(env.ADMIN_AUTH_SECRET, payload))}`;
}

export async function readAdminSession(request, env) {
  if (!env.ADMIN_AUTH_SECRET) return null;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    if (!equalBytes(await hmac(env.ADMIN_AUTH_SECRET, payload), base64UrlToBytes(signature))) return null;
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!data?.sub || data.role !== "admin" || Number(data.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return { username: String(data.sub), name: String(data.name || data.sub), role: "admin", exp: Number(data.exp) };
  } catch { return null; }
}

export function adminSessionCookie(token, secure = true) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearAdminSessionCookie(secure = true) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Max-Age=0`;
}

export function adminJson(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}

export async function requireAdminSession(request, env) {
  const user = await readAdminSession(request, env);
  return user ? { ok: true, user } : { ok: false, status: 401, error: "Admin sign-in required." };
}
