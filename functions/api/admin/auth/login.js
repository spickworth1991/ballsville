import { adminJson, adminSessionCookie, createAdminSession, verifyAdminCredentials } from "../../../_lib/adminAuth.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const user = await verifyAdminCredentials(env, body?.username, body?.password);
    if (!user) return adminJson({ error: "Incorrect username or password." }, 401);
    const token = await createAdminSession(env, user);
    return adminJson({ ok: true, user }, 200, { "set-cookie": adminSessionCookie(token, new URL(request.url).protocol === "https:") });
  } catch (error) {
    console.error("Admin login failed", error);
    return adminJson({ error: "Admin login is unavailable." }, 500);
  }
}
