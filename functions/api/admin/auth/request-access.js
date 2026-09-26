import { adminJson, adminUserKey, hashAdminPassword, hashAdminToken, normalizeAdminUsername, readAdminUser, validAdminUsername, writeAdminUser } from "../../../_lib/adminAuth.js";
import { sendAdminApprovalEmail } from "../../../_lib/adminApprovalEmail.js";

const LIFETIME_MS = 48 * 60 * 60 * 1000;

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function enforceRequestLimit(request, env) {
  const bucket = env.ADMIN_BUCKET || env.admin_bucket;
  if (!bucket?.get || !bucket?.put) throw new Error("The admin R2 binding is not configured.");
  const address = request.headers.get("cf-connecting-ip") || "local";
  const fingerprint = (await hashAdminToken(address)).slice(0, 24);
  const key = `data/admin/auth/limits/access-v1-${fingerprint}.json`;
  const now = Date.now();
  let record = null;
  try { record = await (await bucket.get(key))?.json(); } catch { record = null; }
  const current = record && Number(record.resetAt || 0) > now
    ? record
    : { count: 0, resetAt: now + 60 * 60 * 1000 };
  if (Number(current.count || 0) >= 3) return false;
  await bucket.put(key, JSON.stringify({ count: Number(current.count || 0) + 1, resetAt: current.resetAt }), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return true;
}

export async function onRequestPost({ request, env }) {
  let username = "";
  try {
    const body = await request.json();
    username = normalizeAdminUsername(body?.username);
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 254);
    const password = String(body?.password || "");
    if (body?.website) return adminJson({ ok: true, message: "Request sent for approval." }, 201);
    if (!validAdminUsername(username)) return adminJson({ error: "Use 3–32 letters, numbers, dots, dashes, or underscores." }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return adminJson({ error: "Enter a valid email address." }, 400);
    if (password.length < 12 || password.length > 128) return adminJson({ error: "Password must be between 12 and 128 characters." }, 400);
    if (password !== String(body?.confirmPassword || "")) return adminJson({ error: "Passwords do not match." }, 400);
    if (!await enforceRequestLimit(request, env)) return adminJson({ error: "Too many requests. Try again in an hour." }, 429);
    const existing = await readAdminUser(env, username);
    if (existing?.status === "approved") return adminJson({ error: "That username is already in use." }, 409);
    if (existing?.status === "pending" && Date.parse(existing.expiresAt || 0) > Date.now()) return adminJson({ error: "That request is already waiting for approval." }, 409);

    const token = randomToken();
    const now = new Date();
    const account = {
      schema: 1, username, name: username, email, status: "pending",
      ...await hashAdminPassword(password),
      approvalTokenHash: await hashAdminToken(token),
      createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + LIFETIME_MS).toISOString(),
    };
    await writeAdminUser(env, account);
    try {
      const sent = await sendAdminApprovalEmail(env, request, account, token);
      return adminJson({ ok: true, message: "Admin request sent. Access stays locked until approved.", ...(sent.reviewUrl ? { devReviewUrl: sent.reviewUrl } : {}) }, 201);
    } catch (error) {
      try { await (env.ADMIN_BUCKET || env.admin_bucket)?.delete?.(adminUserKey(username)); } catch (cleanupError) { console.error("Admin request cleanup failed", cleanupError); }
      throw error;
    }
  } catch (error) {
    console.error("Admin access request failed", error);
    return adminJson({ error: "The admin request could not be processed. Check the Pages function logs.", code: "ADMIN_ACCESS_REQUEST_FAILED" }, 500);
  }
}
