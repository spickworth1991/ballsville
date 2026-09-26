import { adminJson, hashAdminToken, normalizeAdminUsername, readAdminUser, writeAdminUser } from "../../../_lib/adminAuth.js";

async function requestedAccount(request, env) {
  const url = new URL(request.url);
  const username = normalizeAdminUsername(url.searchParams.get("username"));
  const token = String(url.searchParams.get("token") || "");
  const account = await readAdminUser(env, username);
  if (!account || account.status !== "pending" || !token || Date.parse(account.expiresAt || 0) <= Date.now()) return null;
  return await hashAdminToken(token) === account.approvalTokenHash ? account : null;
}

export async function onRequestGet({ request, env }) {
  const account = await requestedAccount(request, env);
  if (!account) return adminJson({ error: "This review link is invalid or has expired." }, 404);
  return adminJson({ request: { username: account.username, email: account.email, createdAt: account.createdAt, expiresAt: account.expiresAt } });
}

export async function onRequestPost({ request, env }) {
  const account = await requestedAccount(request, env);
  if (!account) return adminJson({ error: "This review link is invalid or has expired." }, 404);
  let body;
  try { body = await request.json(); } catch { return adminJson({ error: "Invalid request." }, 400); }
  if (!['approve', 'reject'].includes(body?.action)) return adminJson({ error: "Choose approve or reject." }, 400);
  if (body.action === "approve") {
    await writeAdminUser(env, { ...account, status: "approved", approvalTokenHash: null, approvedAt: new Date().toISOString() });
    return adminJson({ ok: true, status: "approved", message: `${account.username} can now sign in as an administrator.` });
  }
  await writeAdminUser(env, { schema: 1, username: account.username, name: account.username, email: account.email, status: "rejected", rejectedAt: new Date().toISOString() });
  return adminJson({ ok: true, status: "rejected", message: "The request was rejected and its password hash was removed." });
}
