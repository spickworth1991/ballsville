// functions/r2/[[path]].js
export async function onRequest(context) {
  const { request, params, env } = context;

  // params.path can be undefined, a string, or an array depending on route depth
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const key = parts.filter(Boolean).join("/");

  if (!key) {
    return new Response("Missing R2 key", { status: 400 });
  }

  // Use your existing public base envs (no renames)
  const base =
    env.GAUNTLET_R2_PUBLIC_BASE ||
    env.R2_PUBLIC_BASE ||
    "https://pub-eec34f38e47f4ffbbc39af58bda1bcc2.r2.dev";

  const target = `${String(base).replace(/\/$/, "")}/${key}`;

  // Proxy it through same-origin
  const res = await fetch(target, {
    method: request.method,
    headers: {
      Accept: request.headers.get("Accept") || "*/*",
      // Optional: pass through range for big images/video if ever needed
      Range: request.headers.get("Range") || "",
    },
    cf: {
      cacheEverything: true,
      cacheTtl: 60,
    },
  });

  // Return as-is (including content-type set by R2 dev)
  const headers = new Headers(res.headers);
  headers.set("cache-control", "public, max-age=60");

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}
