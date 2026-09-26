import {
  hashStreamPassword,
  hashStreamToken,
  hasConfiguredStreamUser,
  normalizeStreamUsername,
  readStreamUser,
  streamJson,
  streamUserKey,
  validStreamUsername,
  writeStreamUser,
} from "../../../_lib/streamAuth.js";
import { sendStreamApprovalEmail } from "../../../_lib/streamApprovalEmail.js";

const REQUEST_LIFETIME_MS = 48 * 60 * 60 * 1000;

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function enforceRequestLimit(request, env) {
  const bucket = env.ADMIN_BUCKET || env.admin_bucket;
  if (!bucket?.get || !bucket?.put) throw new Error("The Stream Room R2 binding is not configured.");
  const address = request.headers.get("cf-connecting-ip") || "local";
  const fingerprint = (await hashStreamToken(address)).slice(0, 24);
  const key = `data/stream/auth/limits/access-${fingerprint}.json`;
  const now = Date.now();
  let record = null;
  try { record = await (await bucket.get(key))?.json(); } catch { record = null; }
  const current = record && Number(record.resetAt || 0) > now ? record : { count: 0, resetAt: now + 60 * 60 * 1000 };
  if (Number(current.count || 0) >= 3) return false;
  await bucket.put(key, JSON.stringify({ count: Number(current.count || 0) + 1, resetAt: current.resetAt }), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
  return true;
}

async function handleAccessRequest({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return streamJson({ error: "Invalid request." }, 400); }

  const username = normalizeStreamUsername(body?.username);
  const name = String(body?.name || "").trim().slice(0, 60);
  const email = String(body?.email || "").trim().toLowerCase().slice(0, 254);
  const password = String(body?.password || "");
  if (body?.website) return streamJson({ ok: true, message: "Request sent for approval." }, 201);
  if (!validStreamUsername(username)) return streamJson({ error: "Use 3–32 letters, numbers, dots, dashes, or underscores." }, 400);
  if (name.length < 2) return streamJson({ error: "Enter your name." }, 400);
  if (!validEmail(email)) return streamJson({ error: "Enter a valid email address." }, 400);
  if (password.length < 12 || password.length > 128) return streamJson({ error: "Password must be between 12 and 128 characters." }, 400);
  if (!await enforceRequestLimit(request, env)) return streamJson({ error: "Too many requests. Try again in an hour." }, 429);

  const existing = await readStreamUser(env, username);
  if (hasConfiguredStreamUser(env, username)) return streamJson({ error: "That username is already in use." }, 409);
  if (existing?.status === "approved") return streamJson({ error: "That username is already in use." }, 409);
  if (existing?.status === "pending" && Date.parse(existing.expiresAt || 0) > Date.now()) {
    return streamJson({ error: "That request is already waiting for approval." }, 409);
  }

  const token = randomToken();
  const passwordRecord = await hashStreamPassword(password);
  const now = new Date();
  const account = {
    schema: 1,
    username,
    name,
    email,
    status: "pending",
    ...passwordRecord,
    approvalTokenHash: await hashStreamToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REQUEST_LIFETIME_MS).toISOString(),
  };

  await writeStreamUser(env, account);
  try {
    const result = await sendStreamApprovalEmail(env, request, account, token);
    return streamJson({ ok: true, message: "Request sent. Access will stay locked until it is approved.", ...(result.reviewUrl ? { devReviewUrl: result.reviewUrl } : {}) }, 201);
  } catch (error) {
    const bucket = env.ADMIN_BUCKET || env.admin_bucket;
    try { await bucket?.delete?.(streamUserKey(username)); } catch (cleanupError) {
      console.error("Stream pending-account cleanup failed", cleanupError);
    }
    console.error("Stream approval email failed", error);
    return streamJson({ error: "Your request could not be emailed. Please try again later." }, 503);
  }
}

export async function onRequestPost(context) {
  try {
    return await handleAccessRequest(context);
  } catch (error) {
    console.error("Stream access request failed", error);
    const message = String(error?.message || "");
    if (message.includes("R2 binding")) {
      return streamJson({ error: "Stream account storage is unavailable. Verify the ADMIN_BUCKET binding and redeploy.", code: "STREAM_R2_UNAVAILABLE" }, 503);
    }
    return streamJson({ error: "The access request could not be processed. Check the Ballsville Pages function logs.", code: "STREAM_ACCESS_REQUEST_FAILED" }, 500);
  }
}
