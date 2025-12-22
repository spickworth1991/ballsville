// functions/api/admin/posts.js
// Admin read/write for News + Mini-Games posts stored in R2.
//
// GET  -> returns { posts: [...] }
// PUT  -> body { posts: [...] }
//
// Storage key is deterministic so re-save replaces data:
//   data/posts/posts.json

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function ensureR2(env) {
  const b = env.admin_bucket || env;
  if (!b || typeof b.get !== "function") throw new Error("R2 bucket binding missing (admin_bucket)");
  return b;
}

async function requireAdmin(request, env) {
  // Reuse the site's Supabase admin auth model.
  // Frontend sends: Authorization: Bearer <access_token>
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, res: json({ error: "Missing auth token" }, 401) };

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, res: json({ error: "Supabase env not configured" }, 500) };

  const me = await fetch(`${url}/auth/v1/user`, {
    headers: {
      authorization: `Bearer ${token}`,
      apikey: key,
    },
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

const KEY = "data/posts/posts.json";

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const auth = await requireAdmin(request, env);
    if (!auth.ok) return auth.res;

    const r2 = ensureR2(env);

    if (request.method === "GET") {
      const obj = await r2.get(KEY);
      if (!obj) return json({ posts: [] });
      const txt = await obj.text();
      try {
        const parsed = JSON.parse(txt);
        const posts = Array.isArray(parsed?.posts) ? parsed.posts : Array.isArray(parsed) ? parsed : [];
        return json({ posts });
      } catch {
        return json({ posts: [] });
      }
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const posts = Array.isArray(body?.posts) ? body.posts : [];

      // Light validation/sanitization
      const cleaned = posts.map((p, idx) => {
        const id = String(p?.id || "").trim() || String(idx + 1);
        const title = String(p?.title || "").trim();
        const bodyText = String(p?.body || "");
        const tags = Array.isArray(p?.tags) ? p.tags.map((t) => String(t).trim()).filter(Boolean) : [];

        return {
          id,
          title,
          body: bodyText,
          tags,
          pin: !!p?.pin,
          is_coupon: !!p?.is_coupon,
          expires_at: p?.expires_at ? String(p.expires_at) : null,
          created_at: p?.created_at ? String(p.created_at) : new Date().toISOString(),
          imageKey: typeof p?.imageKey === "string" ? p.imageKey : "",
          image_url: typeof p?.image_url === "string" ? p.image_url : "",
        };
      });

      await r2.put(KEY, JSON.stringify({ posts: cleaned }, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });

      return json({ ok: true, key: KEY, count: cleaned.length });
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}
