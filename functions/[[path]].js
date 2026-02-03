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
  // Prefer referer when available (most subresource loads inside the iframe)
  const ref = request.headers.get("referer") || "";
  if (ref.includes("/tools/app")) return true;

  // Next.js App Router often fetches server components/RSC with very little context.
  // In practice, these calls include an _rsc query param and/or special headers.
  // Treat those as Arsenal-context so in-app navigation doesn't fall through to Ballsville 404.
  const rscHeader = request.headers.get("rsc");
  const nextRouterState = request.headers.get("next-router-state-tree");
  const nextUrl = request.headers.get("next-url");
  if (rscHeader === "1" || !!nextRouterState || !!nextUrl) return true;

  return false;
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

  // 3) Determine whether this request is *likely* for the embedded Arsenal app.
  // We must do this BEFORE checking the Ballsville response status because Cloudflare
  // static exports are commonly configured with an SPA fallback that returns **200 HTML**
  // for missing files (which would otherwise be 404). When Arsenal asks for JSON/assets
  // and Ballsville serves an HTML shell, the client sees "Unexpected token '<'".
  //
  // NOTE: RSC / router fetches sometimes omit the Referer header (depending on the app's
  // referrer policy), so we also treat certain known tool routes as "Arsenal".
  const ARSENAL_TOOL_ROUTES = [
    "/trade",
    "/player-stock",
    "/player-availability",
    "/power-rankings",
    "/sos",
    "/lineup",
    "/adp",
    "/draft-compare",
  ];

  const inArsenalCandidate =
    isArsenalContext(request) ||
    url.searchParams.has("_rsc") ||
    ARSENAL_TOOL_ROUTES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));

  // These paths are known to be Arsenal-only in your integration and are safe to proxy
  // even when referer is missing.
  const ARSENAL_ONLY_PREFIXES = [
    "/icons/",
    "/images/",
    "/img/",
    "/assets/",
    "/data/",
    "/api/",
  ];
  const ARSENAL_ONLY_FILES = new Set([
    "/fantasycalc_cache.json",
    "/projections.json",
    "/values.json",
  ]);

  const looksLikeAsset =
    ASSET_EXT_RE.test(url.pathname) ||
    ARSENAL_ONLY_PREFIXES.some((p) => url.pathname.startsWith(p)) ||
    ARSENAL_ONLY_FILES.has(url.pathname);

  // 4) Normal: try Ballsville first.
  const res = await context.next();

  // If Ballsville served something real (non-404), we can usually return it.
  // BUT if this request looks like an Arsenal JSON/asset navigation and Ballsville
  // responded with HTML (common with SPA fallbacks), treat it as missing and proxy.
  const ct = (res?.headers?.get("content-type") || "").toLowerCase();
  const servedHtmlShell = res && res.status === 200 && ct.includes("text/html");
  const shouldTreatAsMissing = servedHtmlShell && (looksLikeAsset || url.searchParams.has("_rsc"));

  if (res && res.status !== 404 && !shouldTreatAsMissing) return res;

  // 5) Ballsville missing (404) or returned an HTML shell for an Arsenal JSON/asset.
  const inArsenal = inArsenalCandidate;

  if (inArsenal || looksLikeAsset) {
    const isRsc = url.searchParams.has("_rsc") || request.headers.get("rsc") === "1";

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
