import { clearStreamSessionCookie, streamJson } from "../../../_lib/streamAuth.js";

export async function onRequestPost({ request }) {
  return streamJson({ ok: true }, 200, { "set-cookie": clearStreamSessionCookie(new URL(request.url).protocol === "https:") });
}
