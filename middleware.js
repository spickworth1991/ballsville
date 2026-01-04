// middleware.js
// Hard-block indexing of admin routes, even if a crawler bypasses robots.txt.
// This sends an HTTP header that major search engines respect.

import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Guard admin UI and admin APIs.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
