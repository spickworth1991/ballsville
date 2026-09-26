import { adminJson, clearAdminSessionCookie } from "../../../_lib/adminAuth.js";

export async function onRequestPost({ request }) {
  return adminJson({ ok: true }, 200, { "set-cookie": clearAdminSessionCookie(new URL(request.url).protocol === "https:") });
}
