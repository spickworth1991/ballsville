// functions/r2/[[path]].js
//
// Universal /r2/* handler:
// 1) Try the appropriate bound R2 bucket first
//    - ADMIN_BUCKET (admin + all public pages)
//    - LEADERBOARDS (global leaderboards)
//    - GAUNTLET_LEADERBOARD (Gauntlet Leg3 leaderboard)
// 2) Fallback to proxying a public r2.dev base per section
//
// This keeps Gauntlet working AND makes Mini-Leagues CMS content load.

function pickBucket(env, key) {
  const k = String(key || "");

  // Bucket wiring rules (your current setup):
  // - Admin + all admin-managed public pages => ADMIN_BUCKET
  // - Global leaderboards => LEADERBOARDS
  // - Gauntlet Leg3 leaderboard => GAUNTLET_LEADERBOARD
  //
  // IMPORTANT: we do *not* try to auto-fallback between buckets based on "public vs admin".
  // In your setup there is no separate public bucket; attempting to read from one causes
  // confusing stale/empty reads.

  // Helper: accept multiple possible binding names without needing extra .env vars.
  // In Cloudflare Pages, bindings appear as env.<BINDING_NAME>.
  const pick = (...names) => {
    for (const n of names) {
      const b = env?.[n];
      if (b && typeof b.get === "function") return b;
    }
    return null;
  };

  // 1) Leaderboards bucket
  if (k.startsWith("data/leaderboards/")) {
    return (
      pick("LEADERBOARDS") ||
      pick("LEADERBOARDS_BUCKET", "LEADERBOARD_BUCKET") ||
      pick("leaderboards_bucket", "leaderboard_bucket", "leaderboard_data_bucket", "LEADERBOARD_DATA_BUCKET")
    );
  }

  // 2) Gauntlet Leg3 leaderboard bucket (these keys are *not* under data/)
  if (k.startsWith("gauntlet/leg3/")) {
    return (
      pick("GAUNTLET_LEADERBOARD") ||
      pick("GAUNTLET_LEADERBOARD_BUCKET", "gauntlet_leaderboard_bucket")
    );
  }

  // 3) Everything else (including gauntlet pages + admin CMS content)
  return pick("ADMIN_BUCKET") || pick("admin_bucket", "ADMIN") || pick("ADMIN_BUCKET_BINDING");
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

  // ✅ 1) Try the correct bound bucket first.
  const bucket = pickBucket(env, key);
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

  
  // If a section manifest is missing, synthesize it from the underlying data file.
  // This prevents "manifest 404" from breaking the manifest-first caching strategy
  // for legacy sections that don't have a manifest written yet.
  if (bucket && key.startsWith("data/manifests/") && key.endsWith(".json")) {
    try {
      const file = key.split("/").pop() || "";
      const m = file.match(/^([a-z0-9-]+?)(?:_(\d{4}))?\.json$/i);
      if (m) {
        const section = (m[1] || "").toLowerCase();
        const season = m[2] ? String(m[2]) : "";

        // Map manifest section => a deterministic data JSON that always exists for that section.
        const candidates = [];
        if (section === "gauntlet") {
          // Gauntlet directory data
          candidates.push(season ? `data/gauntlet/leagues_${season}.json` : `data/gauntlet/leagues_${new Date().getFullYear()}.json`);
        } else if (section === "posts" || section === "news") {
          // News/Posts feed
          candidates.push("data/posts/posts.json");
        } else if (section === "hall-of-fame" || section === "hall_of_fame") {
          candidates.push("data/hall-of-fame/hall_of_fame.json");}
        } else if (section === "redraft") {
          candidates.push(season ? `data/redraft/leagues_${season}.json` : `data/redraft/leagues_${new Date().getFullYear()}.json`);

        

        for (const sourceKey of candidates) {
          const src = await bucket.get(sourceKey);
          if (!src) continue;

          let updatedAt = "";
          try {
            const raw = await src.text();
            const parsed = JSON.parse(raw);
            updatedAt = String(parsed?.updatedAt || parsed?.updated_at || parsed?.lastUpdated || "");
          } catch {
            // ignore parse errors
          }

          // Fallback to last modified time if no timestamp inside JSON
          if (!updatedAt) {
            updatedAt = src.httpMetadata?.lastModified
              ? new Date(src.httpMetadata.lastModified).toISOString()
              : "";
          }

          const body = JSON.stringify(
            {
              section,
              season: season ? Number(season) : undefined,
              updatedAt: updatedAt || null,
              sourceKey,
            },
            null,
            2
          );

          const headers = new Headers();
          headers.set("content-type", "application/json; charset=utf-8");
          headers.set("cache-control", cacheControlForKey(key));

          // Reuse the source ETag/Last-Modified so the manifest 304s alongside the source.
          const et = src.etag ? `"${String(src.etag).replace(/"/g, "")}"` : "";
          if (et) headers.set("etag", et);
          const lm = src.httpMetadata?.lastModified ? new Date(src.httpMetadata.lastModified).toUTCString() : "";
          if (lm) headers.set("last-modified", lm);

          const inm = request.headers.get("if-none-match");
          const ims = request.headers.get("if-modified-since");
          const notModifiedByEtag = !!(et && inm && inm.split(",").some((t) => t.trim() === et));
          const notModifiedByDate =
            !!(lm && ims && !Number.isNaN(Date.parse(ims)) && Date.parse(ims) >= Date.parse(lm));
          const notModified = notModifiedByEtag || notModifiedByDate;

          if (request.method === "HEAD") {
            return new Response(null, { status: notModified ? 304 : 200, headers });
          }
          if (notModified) return new Response(null, { status: 304, headers });
          return new Response(body, { status: 200, headers });
        }
      }
    } catch {
      // ignore synth errors and fall through
    }
  }

    // ✅ 2) Fallback to public r2.dev proxy (for localhost / when a key isn't in the bound bucket)
    // IMPORTANT: These must be URL strings, not R2 bucket bindings.
    let base;
    if (key.startsWith("data/leaderboards/")) {
      base =
        env.NEXT_PUBLIC_LEADERBOARDS_R2_PUBLIC_BASE ||
        "https://pub-153090242f5a4c0eb7bd0e499832a797.r2.dev";
    } else if (key.startsWith("gauntlet/leg3/")) {
      base =
        env.NEXT_PUBLIC_GAUNTLET_LEADERBOARD_R2_PUBLIC_BASE ||
        "https://pub-eec34f38e47f4ffbbc39af58bda1bcc2.r2.dev";
    } else {
      base =
        env.NEXT_PUBLIC_ADMIN_R2_PUBLIC_BASE ||
        env.NEXT_PUBLIC_R2_PUBLIC_BASE ||
        "https://pub-b20eaa361fb04ee5afea1a9cf22eeb57.r2.dev";
    }


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
