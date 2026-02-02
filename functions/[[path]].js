// functions/[[path]].js

// Ballsville runs as a static export on Cloudflare Pages.
// We "mount" The Fantasy Arsenal under /tools/app by proxying requests to its standalone origin.
// Key rules:
// - NEVER break Ballsville's own assets/routes.
// - Only proxy what Ballsville doesn't have (404), plus the explicit /tools/app mount.

const ARSENAL_ORIGIN = "https://thefantasyarsenal.com";

function isHtmlResponse(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function wantsHtml(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isArsenalReferrer(request) {
  const ref = request.headers.get("referer") || "";
  return ref.includes("/tools") || ref.includes("/tools/app");
}

function rewriteArsenalHtml(html) {
  // 1) Rewrite hardcoded Next script/link paths ONLY when they start at root "/_next/".
  // Avoid double-rewriting anything already under "/tools/app/_next/".
  html = html.replace(/(["'(])\/_next\//g, '$1/tools/app/_next/');

  // 2) Critical: fix Next's runtime publicPath for dynamic chunks.
  // If assetPrefix is empty, Next will request chunks from /_next/... (Ballsville root) and 404.
  // Setting assetPrefix to /tools/app makes chunk loading request /tools/app/_next/... instead.
  html = html.replace(/"assetPrefix"\s*:\s*""/g, '"assetPrefix":"/tools/app"');

  return html;
}

async function proxyToArsenal(request, pathAndQuery) {
  const upstreamUrl = new URL(pathAndQuery, ARSENAL_ORIGIN);

  // Clone headers but DO NOT set restricted headers like Host.
  const headers = new Headers(request.headers);
  headers.delete("cookie"); // don't leak Ballsville cookies

  const upstream = await fetch(upstreamUrl.toString(), {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    redirect: "manual",
  });

  const outHeaders = new Headers(upstream.headers);

  if (isHtmlResponse(upstream)) {
    const html = await upstream.text();
    const rewritten = rewriteArsenalHtml(html);
    outHeaders.delete("content-encoding");
    outHeaders.delete("content-length");
    return new Response(rewritten, { status: upstream.status, headers: outHeaders });
  }

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 1) Hard mount: EVERYTHING under /tools/app/* is Arsenal.
  if (url.pathname === "/tools/app" || url.pathname.startsWith("/tools/app/")) {
    const pathAfter = url.pathname.replace(/^\/tools\/app/, "") || "/";
    return proxyToArsenal(request, pathAfter + (url.search || ""));
  }

  // 2) Special case: Next chunk requests often do NOT include Referer.
  // Serve Ballsville's own /_next assets if present, otherwise fall back to Arsenal.
  if (url.pathname.startsWith("/_next/")) {
    const res = await context.next();
    if (res && res.status !== 404) return res;
    return proxyToArsenal(request, url.pathname + (url.search || ""));
  }

  // 3) Normal: try Ballsville first.
  const res = await context.next();
  if (res && res.status !== 404) return res;

  // 4) Ballsville returned 404. Decide if this should be handled by Arsenal.
  // - RSC requests (?_rsc=...) must be proxied (redirect would break streaming).
  // - Document navigations from the embedded Arsenal context should redirect into /tools/app/...
  // - Static assets/data requested from the embedded Arsenal context should be proxied.

  const isRsc = url.searchParams.has("_rsc");
  if (isRsc) {
    return proxyToArsenal(request, url.pathname + (url.search || ""));
  }

  if (isArsenalReferrer(request)) {
    if (wantsHtml(request)) {
      return Response.redirect(`/tools/app${url.pathname}${url.search || ""}`, 302);
    }
    return proxyToArsenal(request, url.pathname + (url.search || ""));
  }

  // 5) Otherwise, keep the 404 from Ballsville.
  return res;
}
