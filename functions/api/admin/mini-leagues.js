// functions/api/admin/mini-leagues.js

function parseAdmins(env) {
  return String(env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin({ env, request }) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  if (!token) return { ok: false, status: 401, error: "Missing Bearer token" };

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return { ok: false, status: 500, error: "Missing Supabase env vars" };
  }

  const res = await fetch(`${String(url).replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      authorization: `Bearer ${token}`,
      apikey: anon,
    },
  });

  if (!res.ok) {
    return { ok: false, status: 401, error: "Invalid session token" };
  }

  const user = await res.json();
  const email = String(user?.email || "").toLowerCase();

  const admins = parseAdmins(env);
  if (!admins.includes(email)) {
    return { ok: false, status: 403, error: "Not an admin" };
  }

  return { ok: true, email };
}

export async function onRequest(context) {
  const { env, request } = context;

  const gate = await requireAdmin({ env, request });
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const key = "admin/mini-leagues.json";

  if (request.method === "GET") {
    const obj = await env.ADMIN_BUCKET.get(key);
    const payload = obj ? await obj.text() : null;

    return new Response(payload || "null", {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  if (request.method === "PUT" || request.method === "POST") {
    const body = await request.text();

    // Validate JSON to prevent saving broken content
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Body must be valid JSON" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    // Stamp updated time (keep it simple + consistent)
    parsed.updatedAt = new Date().toISOString();

    const finalJson = JSON.stringify(parsed, null, 2);

    await env.ADMIN_BUCKET.put(key, finalJson, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
