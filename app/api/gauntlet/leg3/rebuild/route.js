// app/api/gauntlet/leg3/rebuild/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Simple GET – proves the route is wired
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/gauntlet/leg3/rebuild",
    method: "GET",
  });
}

// Simple POST – proves POST is allowed + wired
export async function POST() {
  return NextResponse.json({
    ok: true,
    route: "/api/gauntlet/leg3/rebuild",
    method: "POST",
  });
}
