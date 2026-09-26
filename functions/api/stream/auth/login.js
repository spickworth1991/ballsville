import { createStreamSession, streamJson, streamSessionCookie, verifyStreamCredentials } from "../../../_lib/streamAuth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return streamJson({ error: "Invalid request." }, 400); }
  const user = await verifyStreamCredentials(env, body?.username, body?.password);
  if (!user) return streamJson({ error: "Incorrect username or password." }, 401);
  const token = await createStreamSession(env, user);
  return streamJson({ ok: true, user }, 200, { "set-cookie": streamSessionCookie(token, undefined, new URL(request.url).protocol === "https:") });
}
