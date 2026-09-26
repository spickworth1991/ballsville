import { adminJson, readAdminSession } from "../../_lib/adminAuth.js";

export async function onRequest({ request, env, next }) {
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/api/admin/auth/")) return next();
  if (!await readAdminSession(request, env)) return adminJson({ error: "Admin sign-in required." }, 401);
  return next();
}
