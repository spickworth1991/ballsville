import { hashStreamToken, normalizeStreamUsername, readStreamUser, streamJson, writeStreamUser } from "../../../_lib/streamAuth.js";

async function requestedAccount(request, env) {
  const url = new URL(request.url);
  const username = normalizeStreamUsername(url.searchParams.get("username"));
  const token = String(url.searchParams.get("token") || "");
  const account = await readStreamUser(env, username);
  if (!account || account.status !== "pending" || !token) return null;
  if (Date.parse(account.expiresAt || 0) <= Date.now()) return null;
  if (await hashStreamToken(token) !== account.approvalTokenHash) return null;
  return account;
}

export async function onRequestGet({ request, env }) {
  const account = await requestedAccount(request, env);
  if (!account) return streamJson({ error: "This review link is invalid or has expired." }, 404);
  return streamJson({ request: { username: account.username, name: account.name, email: account.email, createdAt: account.createdAt, expiresAt: account.expiresAt } });
}

export async function onRequestPost({ request, env }) {
  const account = await requestedAccount(request, env);
  if (!account) return streamJson({ error: "This review link is invalid or has expired." }, 404);
  let body;
  try { body = await request.json(); } catch { return streamJson({ error: "Invalid request." }, 400); }
  if (!['approve', 'reject'].includes(body?.action)) return streamJson({ error: "Choose approve or reject." }, 400);

  if (body.action === "approve") {
    await writeStreamUser(env, { ...account, status: "approved", approvalTokenHash: null, approvedAt: new Date().toISOString() });
    return streamJson({ ok: true, status: "approved", message: `${account.name} can now sign in.` });
  }

  await writeStreamUser(env, {
    schema: account.schema,
    username: account.username,
    name: account.name,
    email: account.email,
    status: "rejected",
    rejectedAt: new Date().toISOString(),
  });
  return streamJson({ ok: true, status: "rejected", message: "The request was rejected and its password hash was removed." });
}
