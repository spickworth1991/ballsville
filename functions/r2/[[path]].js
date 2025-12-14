export async function onRequest(context) {
  const { request, params, env } = context;

  // Join the splat path
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const key = parts.filter(Boolean).join("/");

  // Where your public bucket is reachable
  const base =
    env.GAUNTLET_R2_PUBLIC_BASE ||
    env.R2_PUBLIC_BASE ||
    "https://pub-eec34f38e47f4ffbbc39af58bda1bcc2.r2.dev";

  const target = `${String(base).replace(/\/$/, "")}/${key}`;

  // Proxy through CF (same-origin to client), and cache at edge when possible
  const res = await fetch(target, {
    method: request.method,
    headers: {
      // Pass through accept headers; you can add more if needed
      "Accept": request.headers.get("Accept") || "*/*",
    },
    cf: {
      cacheEverything: true,
      // Keep it modest; your client already cache-busts with ?t=
      cacheTtl: 60,
    },
  });

  // Clone headers so we can safely adjust if needed
  const headers = new Headers(res.headers);

  // Optional: ensure JSON is treated correctly (R2 usually already sets this)
  if (!headers.get("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}
