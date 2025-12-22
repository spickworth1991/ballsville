// functions/api/admin/dynasty-wagering.js
// Admin read/write for Dynasty Wager Tracker stored in R2.
//
// Query: ?season=2025
//
// GET -> { season, tracker }
// PUT -> body { season, tracker }
//
// Storage key:
//   data/dynasty/wagering_tracker_<season>.json

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
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, res: json({ error: "Missing auth token" }, 401) };

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

  return { ok: true };
}

function keyForSeason(season) {
  return `data/dynasty/wagering_tracker_${season}.json`;
}

const DEFAULT_TRACKER = {
  // Keep schema flexible; UI can render/adjust.
  updatedAt: null,
  notesHtml: "",
  rows: [],
};

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const auth = await requireAdmin(request, env);
    if (!auth.ok) return auth.res;

    const r2 = ensureR2(env);
    const url = new URL(request.url);
    const season = Number(url.searchParams.get("season") || 0) || null;
    if (!season) return json({ error: "Missing season" }, 400);

    const KEY = keyForSeason(season);

    if (request.method === "GET") {
      const obj = await r2.get(KEY);
      if (!obj) return json({ season, tracker: DEFAULT_TRACKER });
      const txt = await obj.text();
      try {
        const parsed = JSON.parse(txt);
        return json({ season, tracker: parsed?.tracker || parsed || DEFAULT_TRACKER });
      } catch {
        return json({ season, tracker: DEFAULT_TRACKER });
      }
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);
      const tracker = body.tracker ?? body.data ?? body;

      const payload = {
        season,
        tracker: {
          ...DEFAULT_TRACKER,
          ...tracker,
          updatedAt: new Date().toISOString(),
        },
      };

      await r2.put(KEY, JSON.stringify(payload, null, 2), {
        httpMetadata: { contentType: "application/json" },
      });

      return json({ ok: true, season });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}
