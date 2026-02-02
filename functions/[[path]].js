// functions/[[path]].js

const ARSENAL_ORIGIN = "https://thefantasyarsenal.com"; // <-- set this

function isHtml(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function rewriteHtml(html) {
  // Force any /_next/ refs to load through /tools/_next/ so they hit our /tools proxy.
  // This covers script/link/preload + inline JSON strings.
  html = html.replace(/(?!\/tools)\/_next\//g, "/tools/_next/");

  // Keep root-absolute links under /tools (but not protocol-relative // and not already /tools/)
  html = html.replace(/href="\/(?!\/)(?!tools\/)/g, 'href="/tools/');
  html = html.replace(/href='\/(?!\/)(?!tools\/)/g, "href='/tools/");
  html = html.replace(/src="\/(?!\/)(?!tools\/)/g, 'src="/tools/');
  html = html.replace(/src='\/(?!\/)(?!tools\/)/g, "src='/tools/");

  return html;
}

function rewriteLocationHeader(loc) {
  if (!loc) return loc;
  // Keep Arsenal redirects inside /tools
  if (loc.startsWith("/tools/")) return loc;
  if (loc.startsWith("/")) return `/tools${loc}`;
  return loc;
}

async function proxyToArsenal(request, targetPathAndQuery) {
  const target = new URL(ARSENAL_ORIGIN);
  // targetPathAndQuery already includes leading "/" and maybe "?.."
  const full = new URL(targetPathAndQuery, ARSENAL_ORIGIN);

  const headers = new Headers(request.headers);
  headers.set("host", new URL(ARSENAL_ORIGIN).host);
  headers.delete("cookie"); // don't leak Ballsville cookies upstream

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

  // keep redirects inside /tools (only matters on HTML nav)
  if (outHeaders.has("location")) {
    outHeaders.set("location", rewriteLocationHeader(outHeaders.get("location")));
  }

  // Rewrite HTML so Next assets + links stay under /tools
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

  // 1) Handle /tools and /tools/*
  if (url.pathname === "/tools" || url.pathname.startsWith("/tools/")) {
    // Map /tools/... -> /... on Arsenal
    const pathAfterTools = url.pathname.replace(/^\/tools/, "") || "/";
    const targetPathAndQuery = pathAfterTools + (url.search || "");
    return proxyToArsenal(request, targetPathAndQuery);
  }

  // 2) Handle root /_next/* ONLY when it came from a /tools page
  // This catches the remaining chunk loads that still try to hit /_next/ at root.
  if (url.pathname.startsWith("/_next/")) {
    const referer = request.headers.get("referer") || "";
    const cameFromTools = referer.includes("/tools");
    if (cameFromTools) {
      const targetPathAndQuery = url.pathname + (url.search || "");
      return proxyToArsenal(request, targetPathAndQuery);
    }
    // Otherwise, let Ballsville serve its own /_next assets normally
    return context.next();
  }

  // 3) Everything else is Ballsville
  return context.next();
}
