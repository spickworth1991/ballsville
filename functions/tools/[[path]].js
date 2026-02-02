// functions/tools/[[path]].js

const ARSENAL_ORIGIN = "https://thefantasyarsenal.com"; // <-- set this

function isHtml(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

function rewriteHtml(html) {
  // 1) Rewrite ANY /_next/ to /tools/_next/ (unless it’s already /tools/_next/)
  // 2) Rewrite root-absolute href/src to stay under /tools (unless already /tools/ or protocol-relative)
  //
  // This handles the cases Next emits in:
  // - <script src="/_next/...">
  // - <link href="/_next/...">
  // - inline JSON strings containing "/_next/..."
  // - preload/prefetch tags

  // Rewrite raw /_next/ occurrences robustly
  html = html.replace(/(?!\/tools)\/_next\//g, "/tools/_next/");

  // Rewrite href="/something" => href="/tools/something" (but not // and not already /tools/)
  html = html.replace(/href="\/(?!\/)(?!tools\/)/g, 'href="/tools/');
  html = html.replace(/href='\/(?!\/)(?!tools\/)/g, "href='/tools/");

  // Rewrite src="/something" => src="/tools/something"
  html = html.replace(/src="\/(?!\/)(?!tools\/)/g, 'src="/tools/');
  html = html.replace(/src='\/(?!\/)(?!tools\/)/g, "src='/tools/");

  return html;
}

function rewriteLocationHeader(loc) {
  if (!loc) return loc;
  if (loc.startsWith("/tools/")) return loc;
  if (loc.startsWith("/")) return `/tools${loc}`;
  return loc;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // /tools or /tools/anything -> / or /anything on Arsenal
  const pathAfterTools = url.pathname.replace(/^\/tools/, "") || "/";
  const target = new URL(ARSENAL_ORIGIN);
  target.pathname = pathAfterTools;
  target.search = url.search;

  const headers = new Headers(request.headers);
  headers.set("host", new URL(ARSENAL_ORIGIN).host);

  // Don’t leak Ballsville cookies upstream
  headers.delete("cookie");

  const upstream = await fetch(target.toString(), {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    redirect: "manual",
  });

  const outHeaders = new Headers(upstream.headers);

  // Keep redirects inside /tools
  if (outHeaders.has("location")) {
    outHeaders.set("location", rewriteLocationHeader(outHeaders.get("location")));
  }

  // If HTML, rewrite paths so all assets stay under /tools/*
  if (isHtml(upstream)) {
    const html = await upstream.text();
    const rewritten = rewriteHtml(html);

    // Body changed => remove encoding/length
    outHeaders.delete("content-encoding");
    outHeaders.delete("content-length");

    return new Response(rewritten, {
      status: upstream.status,
      headers: outHeaders,
    });
  }

  // Non-HTML just passthrough
  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}
