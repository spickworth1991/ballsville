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

function cacheControlForKey(key) {
  const k = String(key || "").toLowerCase();

  // Data JSONs should propagate quickly but benefit from edge caching.
  // - Browser: always revalidate (max-age=0), usually 304 when unchanged
  // - Edge: keep hot for a short time to cut R2 reads
  if (k.endsWith(".json")) {
    return "public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=300";
  }

  // Images/fonts/etc: slightly longer edge TTL, still revalidate on navigation.
  return "public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=86400";
}

function shouldReturnNotModified(request, etag, lastModified) {
  // Weak ETag match is fine for our use-case.
  const inm = request.headers.get("if-none-match");
  if (etag && inm && inm.split(",").some((t) => t.trim() === etag || t.trim() === `W/${etag}`)) {
    return true;
  }

  const ims = request.headers.get("if-modified-since");
  if (lastModified && ims) {
    const imsTime = Date.parse(ims);
    const lmTime = Date.parse(lastModified);
    if (!Number.isNaN(imsTime) && !Number.isNaN(lmTime) && lmTime <= imsTime) {
      return true;
    }
  }

  return false;
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

      // ETag/Last-Modified allow fast 304 revalidation ("only update when new data")
      const etag = obj.httpEtag || (obj.etag ? `"${obj.etag}"` : null);
      const lm = obj.uploaded instanceof Date ? obj.uploaded.toUTCString() : null;
      if (etag) headers.set("etag", etag);
      if (lm) headers.set("last-modified", lm);

      // Allow caching (edge hot), but always revalidate in the browser.
      headers.set("cache-control", cacheControlForKey(key));

      // Conditional requests
      const inm = request.headers.get("if-none-match");
      const ims = request.headers.get("if-modified-since");
      const notModifiedByEtag = !!(etag && inm && inm === etag);
      const notModifiedByDate =
        !!(lm && ims && !Number.isNaN(Date.parse(ims)) && Date.parse(ims) >= Date.parse(lm));
      const notModified = notModifiedByEtag || notModifiedByDate;

      // HEAD should return headers only
      if (request.method === "HEAD") {
        return new Response(null, { status: notModified ? 304 : 200, headers });
      }

      if (notModified) {
        return new Response(null, { status: 304, headers });
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

  // Align caching behavior with bucket reads.
  headers.set("cache-control", cacheControlForKey(key));

  // If origin provided validators, honor conditional requests.
  const etag = headers.get("etag");
  const lm = headers.get("last-modified");
  const inm = request.headers.get("if-none-match");
  const ims = request.headers.get("if-modified-since");
  const notModifiedByEtag = !!(etag && inm && inm === etag);
  const notModifiedByDate =
    !!(lm && ims && !Number.isNaN(Date.parse(ims)) && Date.parse(ims) >= Date.parse(lm));
  const notModified = notModifiedByEtag || notModifiedByDate;

  if (notModified) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}
