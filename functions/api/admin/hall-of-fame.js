// functions/api/admin/hall-of-fame.js
// Admin read/write for Hall of Fame data stored in R2.
//
// GET  -> { entries: [...] }
// PUT  -> body { entries: [...] }
//
// Storage key:
//   data/hall-of-fame/hall_of_fame.json

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function ensureR2(env) {
  const b = env.admin_bucket || env;
  if (!b || typeof b.get !== "function") throw new Error("R2 bucket binding missing (admin_bucket)");
  return b;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, res: json({ error: "Missing auth token" }, 401) };

  // Keep existing binding names (don’t rename). Support either convention.
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_KEY;
  if (!url || !key) return { ok: false, res: json({ error: "Supabase env not configured" }, 500) };

  const me = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: key },
  });
  if (!me.ok) return { ok: false, res: json({ error: "Not authenticated" }, 401) };
  const user = await me.json();

  const allow = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const email = String(user?.email || "").toLowerCase();
  if (!email || (allow.length && !allow.includes(email))) {
    return { ok: false, res: json({ error: "Not authorized" }, 403) };
  }

  return { ok: true, token, user };
}

const KEY = "data/hall-of-fame/hall_of_fame.json";

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const auth = await requireAdmin(request, env);
    if (!auth.ok) return auth.res;

    const r2 = ensureR2(env);

    if (request.method === "GET") {
      const obj = await r2.get(KEY);
      if (!obj) return json({ entries: [] });
      const txt = await obj.text();
      try {
        const parsed = JSON.parse(txt);
        const entries = Array.isArray(parsed?.entries) ? parsed.entries : Array.isArray(parsed) ? parsed : [];
        return json({ entries });
      } catch {
        return json({ entries: [] });
      }
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const entries = Array.isArray(body?.entries) ? body.entries : [];

      // Light normalization: prevent non-objects.
      const cleaned = entries
        .filter((e) => e && typeof e === "object")
        .map((e) => ({
          id: String(e.id || ""),
          game: String(e.game || ""),
          title: String(e.title || ""),
          subtitle: String(e.subtitle || ""),
          year: Number(e.year) || null,
          imageKey: typeof e.imageKey === "string" ? e.imageKey : "",
          imageUrl: typeof e.imageUrl === "string" ? e.imageUrl : "",
          order: Number.isFinite(Number(e.order)) ? Number(e.order) : null,
        }));

      await r2.put(KEY, JSON.stringify({ entries: cleaned }, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
      });

      return json({ ok: true, entries: cleaned });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}
