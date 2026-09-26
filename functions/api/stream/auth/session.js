import { readStreamSession, streamJson } from "../../../_lib/streamAuth.js";

export async function onRequestGet({ request, env }) {
  const user = await readStreamSession(request, env);
  return user ? streamJson({ authenticated: true, user }) : streamJson({ authenticated: false }, 401);
}

