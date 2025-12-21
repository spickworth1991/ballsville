// Cloudflare Pages Function
//
// Legacy route used in older Big Game builds:
//   /big-game/divisions/:division?year=2025
//
// Your current site uses the statically-exportable page:
//   /big-game/division?division=:division&year=2025
//
// This function keeps old links/bookmarks working by redirecting.

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // pathname like: /big-game/divisions/star-wars
  const parts = url.pathname.split("/").filter(Boolean);
  const division = parts[parts.length - 1] || "";

  // preserve year if present
  const year = url.searchParams.get("year") || "";

  const target = new URL(url.origin);
  target.pathname = "/big-game/division";
  target.searchParams.set("division", division);
  if (year) target.searchParams.set("year", year);

  return Response.redirect(target.toString(), 302);
}
