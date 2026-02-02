// functions/[[path]].js
//
// Ballsville <-> The Fantasy Arsenal integration (no changes needed in Arsenal):
// - Proxy Arsenal under /tools/app/*
// - If the Arsenal app triggers a root navigation (e.g. /trade, /player-stock),
//   rewrite it into /tools/app/... so Arsenal works while embedded.
//
// NOTE: In Cloudflare Pages/Workers you must NOT set the "Host" header.

const ARSENAL_ORIGIN = "https://thefantasyarsenal.com"; // keep Arsenal standalone
const MOUNT_PREFIX = "/tools/app";

function isHtmlResponse(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function shouldTreatAsArsenalContext(request) {
  const ref = request.headers.get("referer") || "";
  return ref.includes(`${MOUNT_PREFIX}/`);
}

function isArsenalRouteRequest(request, url) {
  // Only rewrite *app route* requests coming from inside the embedded Arsenal.
  // We intentionally avoid rewriting asset requests (images, css, etc.) that
  // Ballsville might load while the iframe is visible.
  const accept = (request.headers.get("accept") || "").toLowerCase();
  const secFetchDest = (request.headers.get("sec-fetch-dest") || "").toLowerCase();

  // Next/React Server Components fetches commonly include _rsc.
  if (url.searchParams.has("_rsc")) return true;
  // Document navigations.
  if (secFetchDest === "document") return true;
  if (accept.includes("text/html")) return true;
  // RSC payloads.
  if (accept.includes("text/x-component")) return true;

  return false;
}

function rewriteHtmlToMount(html) {
  // 1) /_next assets
  html = html.replace(/"\/_next\//g, `"${MOUNT_PREFIX}/_next/`);
  html = html.replace(/'\/_next\//g, `'${MOUNT_PREFIX}/_next/`);

  // 2) Absolute URLs in common attributes
  html = html.replace(/(href|src|action)="\/(?!tools\/app)([^"]*)"/g, `$1="${MOUNT_PREFIX}/$2"`);
  html = html.replace(/(href|src|action)='\/(?!tools\/app)([^']*)'/g, `$1='${MOUNT_PREFIX}/$2'`);

  // 3) fetch("/..." ) style
  html = html.replace(/fetch\("\/(?!tools\/app)([^"]*)"/g, `fetch("${MOUNT_PREFIX}/$1"`);
  html = html.replace(/fetch\('\/(?!tools\/app)([^']*)'/g, `fetch('${MOUNT_PREFIX}/$1'`);

  return html;
}

async function proxyToArsenal(request, pathAfterMount) {
  const url = new URL(request.url);
  const upstreamUrl = new URL(pathAfterMount + url.search, ARSENAL_ORIGIN);

  // Clone headers, but DO NOT set reserved headers like Host.
  const headers = new Headers(request.headers);

  // Prevent cookie leakage between properties.
  headers.delete("cookie");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  const upstreamRes = await fetch(upstreamUrl.toString(), init);

  if (isHtmlResponse(upstreamRes)) {
    const text = await upstreamRes.text();
    const rewritten = rewriteHtmlToMount(text);

    const outHeaders = new Headers(upstreamRes.headers);
    outHeaders.delete("content-length");

    return new Response(rewritten, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: outHeaders,
    });
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: upstreamRes.headers,
  });
}

export async function onRequest(context) {
  const { request } = context;

  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1) Arsenal mounted path
    if (path === MOUNT_PREFIX || path.startsWith(MOUNT_PREFIX + "/")) {
      const after = path.slice(MOUNT_PREFIX.length) || "/";
      return await proxyToArsenal(request, after);
    }

    // 2) Root-ish requests triggered by Arsenal context
    if (
      shouldTreatAsArsenalContext(request) &&
      isArsenalRouteRequest(request, url) &&
      !path.startsWith("/_next/") &&
      !path.startsWith("/api/") &&
      !path.startsWith("/r2/") &&
      !path.startsWith("/admin") &&
      !path.startsWith("/tools")
    ) {
      const redirectTo = `${MOUNT_PREFIX}${path}${url.search}`;
      return Response.redirect(redirectTo, 302);
    }

    // 3) Everything else: normal Ballsville
    return context.next();
  } catch (err) {
    // Fail open to Ballsville if the proxy breaks.
    try {
      return context.next();
    } catch {
      return new Response("Tools proxy error", { status: 502 });
    }
  }
}
