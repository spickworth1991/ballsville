import { readStreamSession } from "../_lib/streamAuth.js";

function wantsHtml(request) {
  return (request.headers.get("accept") || "").includes("text/html");
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // The Stream landing page is the login screen. Protect tool documents while
  // allowing their assets and API calls to follow their own routing/auth rules.
  const publicDocument = url.pathname === "/stream" || url.pathname === "/stream/" || url.pathname === "/stream/access-review";
  if (publicDocument || !wantsHtml(request)) {
    return context.next();
  }

  const session = await readStreamSession(request, env);
  if (session) return context.next();

  const login = new URL("/stream", url.origin);
  login.searchParams.set("next", `${url.pathname}${url.search}`);
  return Response.redirect(login, 302);
}
