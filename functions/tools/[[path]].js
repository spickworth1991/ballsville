// functions/tools/[[path]].js

const ARSENAL_ORIGIN = "https://thefantasyarsenal.com"; // <-- change if needed

function isHtml(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function rewriteHtml(html) {
  // Rewrite root-absolute Next assets and links so they stay under /tools
  // Examples:
  //   /_next/...  -> /tools/_next/...
  //   href="/x"   -> href="/tools/x"
  //   src="/x"    -> src="/tools/x"
  //
  // Avoid rewriting protocol-relative URLs (//cdn...)
  // Avoid rewriting if already /tools/...

  return html
    // Next asset paths
    .replaceAll('"/_next/', '"/tools/_next/')
    .replaceAll("'/ _next/".replace(" ", ""), "'/tools/_next/") // harmless safety
    .replaceAll("'/_next/", "'/tools/_next/")

    // Common static asset paths
    .replaceAll('"/favicon', '"/tools/favicon')
    .replaceAll("'/favicon", "'/tools/favicon")

    // href="/something" -> href="/tools/something" (but not href="//" and not href="/tools/")
    .replace(/href="\/(?!\/)(?!tools\/)/g, 'href="/tools/')
    .replace(/href='\/(?!\/)(?!tools\/)/g, "href='/tools/")

    // src="/something" -> src="/tools/something" (but not src="//" and not src="/tools/")
    .replace(/src="\/(?!\/)(?!tools\/)/g, 'src="/tools/')
    .replace(/src='\/(?!\/)(?!tools\/)/g, "src='/tools/");
}

function rewriteLocationHeader(loc) {
  // If Arsenal responds with Location: /somewhere
  // keep it under /tools/somewhere
  if (!loc) return loc;
  if (loc.startsWith("/tools/")) return loc;
  if (loc.startsWith("/")) return `/tools${loc}`;
  return loc;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Incoming: /tools/...  -> Target: /...
  const pathAfterTools = url.pathname.replace(/^\/tools/, "") || "/";
  const targetUrl = new URL(ARSENAL_ORIGIN);
  targetUrl.pathname = pathAfterTools;
  targetUrl.search = url.search;

  // Clone headers and set Host to Arsenal origin host
  const headers = new Headers(request.headers);
  headers.set("host", new URL(ARSENAL_ORIGIN).host);

  // IMPORTANT: don’t forward Ballsville cookies to Arsenal origin
  // (they won’t be useful and can cause weirdness)
  headers.delete("cookie");

  const upstream = await fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  });

  // Copy headers
  const outHeaders = new Headers(upstream.headers);

  // Fix redirects to stay on /tools
  if (outHeaders.has("location")) {
    outHeaders.set("location", rewriteLocationHeader(outHeaders.get("location")));
  }

  // For HTML, rewrite root-absolute links/assets to keep navigation inside /tools
  if (isHtml(upstream)) {
    const html = await upstream.text();
    const rewritten = rewriteHtml(html);

    // Avoid Cloudflare content-encoding issues after modifying body
    outHeaders.delete("content-encoding");
    outHeaders.delete("content-length");

    return new Response(rewritten, {
      status: upstream.status,
      headers: outHeaders,
    });
  }

  // Non-HTML: stream through
  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}
