// functions/[[path]].js

const ARSENAL_ORIGIN = "https://thefantasyarsenal.com"; // <-- set this EXACTLY

function isHtml(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function rewriteHtml(html) {
  // Make sure Next assets load through /tools/app/_next/...
  html = html.replace(/(?!\/tools\/app)\/_next\//g, "/tools/app/_next/");
  return html;
}

function shouldTreatAsArsenalContext(request) {
  const ref = request.headers.get("referer") || "";
  return ref.includes("/tools/app");
}

async function proxyToArsenal(request, pathAndQuery) {
  const full = new URL(pathAndQuery, ARSENAL_ORIGIN);

  const headers = new Headers(request.headers);
  headers.set("host", new URL(ARSENAL_ORIGIN).host);
  headers.delete("cookie"); // don’t leak Ballsville cookies

  const upstream = await fetch(full.toString(), {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    redirect: "manual",
  });

  const outHeaders = new Headers(upstream.headers);

  // Rewrite HTML to force assets through /tools/app/_next
  if (isHtml(upstream)) {
    const html = await upstream.text();
    const rewritten = rewriteHtml(html);
    outHeaders.delete("content-encoding");
    outHeaders.delete("content-length");
    return new Response(rewritten, { status: upstream.status, headers: outHeaders });
  }

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 1) Arsenal proxy lives ONLY under /tools/app/*
  if (url.pathname === "/tools/app" || url.pathname.startsWith("/tools/app/")) {
    const pathAfter = url.pathname.replace(/^\/tools\/app/, "") || "/";
    return proxyToArsenal(request, pathAfter + (url.search || ""));
  }

  // 2) If Arsenal iframe triggers a root navigation (e.g. /trade, /runner.webp),
  // redirect it into /tools/app/... so Arsenal stays working without changing Arsenal.
  if (shouldTreatAsArsenalContext(request)) {
    // Avoid redirect loops
    if (!url.pathname.startsWith("/tools/app")) {
      const dest = `/tools/app${url.pathname}${url.search || ""}`;
      return Response.redirect(dest, 302);
    }
  }

  // 3) Otherwise, let Ballsville serve normally
  return context.next();
}
