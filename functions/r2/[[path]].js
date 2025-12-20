// functions/r2/[[path]].js
//
// Universal /r2/* handler:
// 1) Try bound R2 bucket first (admin_bucket / ADMIN_BUCKET / public_bucket / PUBLIC_BUCKET)
// 2) Fallback to proxying a public r2.dev base (GAUNTLET_R2_PUBLIC_BASE / R2_PUBLIC_BASE)
//
// This keeps Gauntlet working AND makes Mini-Leagues CMS content load.

function pickBucket(env) {
  // Prefer a dedicated public bucket if you have it,
  // but fall back to admin_bucket since that’s what your CMS uses.
  return env.public_bucket || env.PUBLIC_BUCKET || env.admin_bucket || env.ADMIN_BUCKET || null;
}

export async function onRequest({ request, params, env }) {
  // params.path is an array like ["content","mini-leagues","page_2025.json"]
  const parts = Array.isArray(params?.path) ? params.path : [params?.path].filter(Boolean);
  const key = parts.join("/").replace(/^\/+/, "");

  if (!key) {
    return new Response("Missing R2 key", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // ✅ 1) Try bucket binding first (this is what fixes Mini-Leagues 404s)
  const bucket = pickBucket(env);
  if (bucket && typeof bucket.get === "function") {
    const obj = await bucket.get(key);

    if (obj) {
      const headers = new Headers();

      // Preserve stored content-type when present (important for webp + json)
      const ct = obj.httpMetadata?.contentType;
      if (ct) headers.set("content-type", ct);

      // For fast CMS iteration, don't cache aggressively.
      headers.set("cache-control", "no-store");

      // HEAD should return headers only
      if (request.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }

      return new Response(obj.body, { status: 200, headers });
    }
  }

  // ✅ 2) Fallback to public r2.dev proxy (keeps Gauntlet working)
  const base =
    env.GAUNTLET_R2_PUBLIC_BASE ||
    env.R2_PUBLIC_BASE ||
    "https://pub-eec34f38e47f4ffbbc39af58bda1bcc2.r2.dev";

  const target = `${String(base).replace(/\/$/, "")}/${key}`;

  const res = await fetch(target, {
    method: request.method,
    headers: {
      Accept: request.headers.get("Accept") || "*/*",
    },
    cf: {
      cacheEverything: true,
      cacheTtl: 60,
    },
  });

  // Clone headers and ensure a content-type exists (helps previews)
  const headers = new Headers(res.headers);
  if (!headers.get("content-type")) headers.set("content-type", "application/octet-stream");

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}
