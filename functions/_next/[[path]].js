// functions/_next/[[path]].js

const ARSENAL_ORIGIN = "https://thefantasyarsenal.com"; // <-- set this

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // If this request is coming from a /tools page, it's Arsenal trying to load chunks
  const referer = request.headers.get("referer") || "";
  const cameFromTools = referer.includes("/tools");

  // Only proxy Arsenal chunks when it came from Tools.
  // Otherwise, let Ballsville's own /_next assets serve normally.
  if (!cameFromTools) {
    return context.next();
  }

  // Proxy to Arsenal origin, same path (/ _next / ...)
  const target = new URL(ARSENAL_ORIGIN);
  target.pathname = url.pathname; // keep /_next/...
  target.search = url.search;

  const headers = new Headers(request.headers);
  headers.set("host", new URL(ARSENAL_ORIGIN).host);
  headers.delete("cookie"); // don't leak Ballsville cookies upstream

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

  // If we get HTML back for a JS file, it's almost always an upstream 404 page.
  // But returning it is still better than failing silently; console will show it.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}
