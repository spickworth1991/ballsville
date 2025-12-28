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
  const b = env.admin_bucket || env.ADMIN_BUCKET || env;
  if (!b?.get) throw new Error("R2 bucket binding missing (admin_bucket/ADMIN_BUCKET)");
  return b;
}

async function touchManifest(env, season) {
  const b = ensureR2(env);

  // IMPORTANT: this section is "posts" (matches SectionManifestGate in /news)
  const key = season ? `data/manifests/posts_${season}.json` : `data/manifests/posts.json`;

  const body = JSON.stringify(
    {
      section: "posts",
      season: season || null,
      updatedAt: Date.now(),
    },
    null,
    2
  );

  await b.put(key, body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, res: json({ error: "Missing auth token" }, 401) };

  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!url || !key) return { ok: false, res: json({ error: "Supabase env not configured" }, 500) };

  const me = await fetch(`${url}/auth/v1/user`, {
    headers: {
      authorization: `Bearer ${token}`,
      apikey: key,
    },
  });

  if (!me.ok) return { ok: false, res: json({ error: "Not authenticated" }, 401) };
  const user = await me.json();

  const allow = (env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const email = String(user?.email || "").toLowerCase();
  if (!email || (allow.length && !allow.includes(email))) {
    return { ok: false, res: json({ error: "Not authorized" }, 403) };
  }

  return { ok: true, token, user };
}

const KEY = "data/posts/posts.json";

// One-time seed from Supabase export (used only if R2 JSON does not exist yet)
const SEED_POSTS = [
  {
    id: "71215870-3640-4166-ab75-b243770c0348",
    created_at: "2025-11-29T02:39:58.796193Z",
    title: "Redraft Promo",
    body: "Brief Explanation",
    tags: ["Promo"],
    pin: false,
    imageKey: "",
    image_url: "https://pxwgquaviukhzhvgzvsg.supabase.co/storage/v1/object/public/news/f764b3cd-ade6-4f45-9578-7ae8b4e19285.mp4",
  },
  {
    id: "72c95cc6-18cd-48c4-9de8-6bba8273d72d",
    created_at: "2025-11-29T02:44:20.868977Z",
    title: "Guess the most receiving yards for week 13",
    body: "Submit your guess in the hub at http://sleeper.com/i/JKmljme9dDbW3 !!",
    tags: ["Mini Game"],
    pin: false,
    imageKey: "",
    image_url: "",
  },
  {
    id: "e2533afb-fe94-442b-b1e8-7287b1a0bd3b",
    created_at: "2025-11-29T02:17:31.198264Z",
    title: "test",
    body: "Guess The most rushing yards week 8! Submit your guesses in the hub at http://sleeper.com/i/JKmljme9dDbW3",
    tags: ["Mini Game"],
    pin: false,
    imageKey: "",
    image_url: "",
  },
];

function getSeasonFromRequest(request) {
  try {
    const url = new URL(request.url);
    const s = url.searchParams.get("season");
    return s && String(s).trim() ? String(s).trim() : null;
  } catch {
    return null;
  }
}


export async function onRequest(context) {
  
  const { request, env } = context;

  try {
    const auth = await requireAdmin(request, env);
    if (!auth.ok) return auth.res;

    const r2 = ensureR2(env);

    if (request.method === "GET") {
      const obj = await r2.get(KEY);
      if (!obj) return json({ updatedAt: Date.now(), posts: SEED_POSTS });

      const txt = await obj.text();
      try {
        const parsed = JSON.parse(txt);
        const posts = Array.isArray(parsed?.posts) ? parsed.posts : Array.isArray(parsed) ? parsed : [];
        const updatedAt = parsed?.updatedAt || parsed?.updated_at || Date.now();
        return json({ updatedAt, posts });
      } catch {
        return json({ updatedAt: Date.now(), posts: [] });
      }
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      const posts = Array.isArray(body?.posts) ? body.posts : [];

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

      const updatedAt = Date.now();
      await r2.put(KEY, JSON.stringify({ updatedAt, posts: cleaned }, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });

      // Touch manifests (season + global)
      const seasonParam = getSeasonFromRequest(request);
      await touchManifest(env, seasonParam);
      await touchManifest(env, null);


      return json({ ok: true, key: KEY, updatedAt, count: cleaned.length });
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}
