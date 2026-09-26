import { adminJson, readAdminSession } from "../../../_lib/adminAuth.js";

export async function onRequestGet({ request, env }) {
  const user = await readAdminSession(request, env);
  return user ? adminJson({ authenticated: true, user }) : adminJson({ authenticated: false }, 401);
}
