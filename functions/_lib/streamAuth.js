const COOKIE_NAME = "ballsville_stream_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
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

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function configuredUsers(env) {
  try {
    const parsed = JSON.parse(env.STREAM_USERS_JSON || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function hasConfiguredStreamUser(env, username) {
  return Boolean(configuredUsers(env)[normalizeStreamUsername(username)]);
}

function streamBucket(env) {
  return env.ADMIN_BUCKET || env.admin_bucket || null;
}

export function normalizeStreamUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function validStreamUsername(value) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeStreamUsername(value));
}

export function streamUserKey(username) {
  return `data/stream/auth/users/${normalizeStreamUsername(username)}.json`;
}

export async function hashStreamPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const iterations = PBKDF2_ITERATIONS;
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    material,
    256,
  ));
  return { salt: bytesToBase64Url(saltBytes), hash: bytesToBase64Url(derived), iterations };
}

export async function hashStreamToken(token) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

export async function readStreamUser(env, username) {
  const bucket = streamBucket(env);
  if (!bucket?.get || !validStreamUsername(username)) return null;
  const object = await bucket.get(streamUserKey(username));
  if (!object) return null;
  try { return await object.json(); } catch { return null; }
}

export async function writeStreamUser(env, user) {
  const bucket = streamBucket(env);
  if (!bucket?.put) throw new Error("The Stream Room R2 binding is not configured.");
  await bucket.put(streamUserKey(user.username), JSON.stringify(user), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function verifyPasswordRecord(password, user) {
  if (!user?.salt || !user?.hash || !password) return false;
  const iterations = Number(user.iterations || PBKDF2_ITERATIONS);
  // Cloudflare's production Web Crypto runtime rejects PBKDF2 counts above
  // 100,000. Reject incompatible records without throwing a Worker exception.
  if (!Number.isInteger(iterations) || iterations !== PBKDF2_ITERATIONS) return false;
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64UrlToBytes(user.salt), iterations },
    material,
    256,
  ));
  return timingSafeEqual(derived, base64UrlToBytes(user.hash));
}

export async function verifyStreamCredentials(env, username, password) {
  const key = normalizeStreamUsername(username);
  const stored = await readStreamUser(env, key);
  const user = stored?.status === "approved" ? stored : configuredUsers(env)[key];
  if (!await verifyPasswordRecord(password, user)) return null;
  return { username: key, name: String(user.name || key) };
}

export async function createStreamSession(env, user, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!env.STREAM_AUTH_SECRET) throw new Error("STREAM_AUTH_SECRET is not configured.");
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    sub: user.username,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  })));
  const signature = bytesToBase64Url(await hmac(env.STREAM_AUTH_SECRET, payload));
  return `${payload}.${signature}`;
}

export async function readStreamSession(request, env) {
  if (!env.STREAM_AUTH_SECRET) return null;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const expected = await hmac(env.STREAM_AUTH_SECRET, payload);
    if (!timingSafeEqual(expected, base64UrlToBytes(signature))) return null;
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (!data?.sub || Number(data.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return { username: String(data.sub), name: String(data.name || data.sub), exp: Number(data.exp) };
  } catch {
    return null;
  }
}

export function streamSessionCookie(token, maxAge = DEFAULT_TTL_SECONDS, secure = true) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearStreamSessionCookie(secure = true) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Max-Age=0`;
}

export function streamJson(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
