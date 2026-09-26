import { readAdminSession } from "../_lib/adminAuth.js";

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  const publicPage = url.pathname === "/admin/login" || url.pathname === "/admin/access-review";
  if (!acceptsHtml || publicPage || await readAdminSession(request, env)) return next();
  const login = new URL("/admin/login", url.origin);
  login.searchParams.set("next", `${url.pathname}${url.search}`);
  return Response.redirect(login, 302);
}
