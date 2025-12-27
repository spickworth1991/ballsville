function pickBucket(env) {
  // Prefer a dedicated public bucket if you have it,
  // but fall back to admin_bucket since that’s what your CMS uses.
  return env.public_bucket || env.PUBLIC_BUCKET || env.admin_bucket || env.ADMIN_BUCKET || null;
}

function getExt(key) {
  const clean = String(key || "").split("?")[0];
  const idx = clean.lastIndexOf(".");
  if (idx === -1) return "";
  return clean.slice(idx + 1).toLowerCase();
}

function cacheControlFor(key, url) {
  // If the caller explicitly busts cache (we use ?t= for polling), don't cache.
  if (url.searchParams.has("t") || url.searchParams.has("nocache")) {
    return "no-store";
  }

  const ext = getExt(key);

  // JSON data that updates frequently: allow edge caching briefly,
  // but always revalidate so admin/R2 updates show up quickly.
  if (ext === "json" || ext === "manifest") {
    return "public, max-age=0, must-revalidate, s-maxage=30, stale-while-revalidate=300";
  }

  // Images: if URL is versioned (?v=...), cache hard; otherwise revalidate but allow edge caching.
  if (["webp", "png", "jpg", "jpeg", "gif", "svg", "ico"].includes(ext)) {
    if (url.searchParams.has("v")) {
      return "public, max-age=31536000, immutable";
    }
    return "public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400";
  }

  // Other static-ish assets
  if (["css", "js", "mjs"].includes(ext)) {
    return "public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400";
  }

  // Default: short edge cache with revalidation.
  return "public, max-age=0, must-revalidate, s-maxage=60, stale-while-revalidate=300";
}

function applyHeaders(base, extra = {}) {
  const h = new Headers(base);
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) continue;
    h.set(k, v);
  }
  // Always vary on encoding
  h.set("vary", "accept-encoding");
  return h;
}

export async function onRequest({ request, env, params }) {
  const key = params?.path ? params.path.join("/") : "";
  if (!key) {
    return new Response("Missing key", {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }

  const url = new URL(request.url);
  const bucket = pickBucket(env);

  // Prefer serving from R2 directly (fast + gives us etag we can use for 304s)
  if (bucket) {
    try {
      const obj = await bucket.get(key);
      if (!obj) {
        return new Response("Not found", {
          status: 404,
          headers: { "cache-control": "no-store" },
        });
      }

      const etag = obj.etag ? `"${obj.etag}"` : null;
      const ifNoneMatch = request.headers.get("if-none-match");

      const cacheControl = cacheControlFor(key, url);
      const commonHeaders = {
        "cache-control": cacheControl,
        etag,
        ...(obj.httpMetadata?.contentType
          ? { "content-type": obj.httpMetadata.contentType }
          : null),
      };

      // Conditional GET
      if (etag && ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, {
          status: 304,
          headers: applyHeaders({}, commonHeaders),
        });
      }

      return new Response(obj.body, {
        headers: applyHeaders({}, commonHeaders),
      });
    } catch (err) {
      console.error("R2 proxy error (bucket.get):", err);
      // fall through to public R2 endpoint
    }
  }

  // Fallback: hit the public R2 subdomain if you ever need to debug without bindings
  const publicBase = env.R2_PUBLIC_BASE || env.NEXT_PUBLIC_R2_PUBLIC_BASE || "";
  if (!publicBase) {
    return new Response("R2 bucket not configured", {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }

  const upstreamUrl = `${publicBase.replace(/\/$/, "")}/${String(key).replace(/^\/+/, "")}`;
  const res = await fetch(upstreamUrl, {
    headers: {
      // Pass through conditional headers if present
      ...(request.headers.get("if-none-match")
        ? { "if-none-match": request.headers.get("if-none-match") }
        : null),
    },
    // Let Cloudflare cache upstream responses per our response headers
    cf: { cacheTtl: 0 },
  });

  const headers = applyHeaders(res.headers, {
    "cache-control": cacheControlFor(key, url),
  });

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}
