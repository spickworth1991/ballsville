// functions/[[path]].js

const ARSENAL_ORIGIN = "https://thefantasyarsenal.com";

// File extensions that should always be treated as "asset/data" requests
// when they originate from inside the embedded Arsenal context.
const ASSET_EXT_RE =
  /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|mjs|map|txt|xml|json|csv|tsv|woff|woff2|ttf|eot|mp4|mov|webm)$/i;

function isHtmlResponse(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function wantsHtml(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isArsenalContext(request) {
  const ref = request.headers.get("referer") || "";
  return ref.includes("/tools/app");
}

function rewriteArsenalHtml(html) {
  // Rewrite root /_next/ to /tools/app/_next/
  html = html.replace(/(["'(])\/_next\//g, '$1/tools/app/_next/');

  // Critical: make dynamic chunk loader use /tools/app as its assetPrefix
  html = html.replace(/"assetPrefix"\s*:\s*""/g, '"assetPrefix":"/tools/app"');

  return html;
}

async function proxyToArsenal(request, pathAndQuery) {
  const upstreamUrl = new URL(pathAndQuery, ARSENAL_ORIGIN);

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

  // 2) Next chunks often come without referer. Serve Ballsville if present, else fallback to Arsenal.
  if (url.pathname.startsWith("/_next/")) {
    const res = await context.next();
    if (res && res.status !== 404) return res;
    return proxyToArsenal(request, url.pathname + (url.search || ""));
  }

  // 3) Normal: try Ballsville first.
  const res = await context.next();
  if (res && res.status !== 404) return res;

  // 4) Ballsville returned 404.
  // If the request originates from inside the embedded Arsenal context,
  // route it to Arsenal appropriately so Arsenal assets/JSON/avatar routes load from Arsenal.
  const inArsenal = isArsenalContext(request);
  if (inArsenal) {
    const isRsc = url.searchParams.has("_rsc");
    const looksLikeAsset =
      ASSET_EXT_RE.test(url.pathname) ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/images/") ||
      url.pathname.startsWith("/img/") ||
      url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/data/") ||
      url.pathname.startsWith("/api/");

    // RSC requests must be proxied (redirect breaks streaming)
    if (isRsc) {
      return proxyToArsenal(request, url.pathname + (url.search || ""));
    }

    // Document navigation (clicking links in Arsenal) → redirect to mounted path
    if (wantsHtml(request) && !looksLikeAsset) {
      return Response.redirect(`/tools/app${url.pathname}${url.search || ""}`, 302);
    }

    // Assets/data/api/json/images → proxy
    return proxyToArsenal(request, url.pathname + (url.search || ""));
  }

  // 5) Otherwise keep Ballsville 404.
  return res;
}
