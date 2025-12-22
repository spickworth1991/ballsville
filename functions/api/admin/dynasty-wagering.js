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

  return { ok: true };
}

function keyForSeason(season) {
  return `data/dynasty/wagering_tracker_${season}.json`;
}

const DEFAULT_TRACKER = {
  updated: "", // freeform display string
  pot: 0, // computed
  entries: [], // [{id, username, amount}]
};

function computePot(entries) {
  return (Array.isArray(entries) ? entries : []).reduce((acc, e) => {
    const n = Number(e?.amount);
    if (!Number.isFinite(n)) return acc;
    return acc + n;
  }, 0);
}

function normalizeEntry(e, idx) {
  const id = String(e?.id || idx || `e_${Math.random().toString(16).slice(2)}_${Date.now()}`);
  const username = String(e?.username || "").trim();
  const amountNum = Number(e?.amount);
  const amount = Number.isFinite(amountNum) ? amountNum : 0;
  return { id, username, amount };
}

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
        const raw = parsed?.tracker || parsed || DEFAULT_TRACKER;
        const entries = Array.isArray(raw?.entries) ? raw.entries : [];
        const tracker = {
          ...DEFAULT_TRACKER,
          ...raw,
          entries,
          pot: computePot(entries),
        };
        return json({ season, tracker });
      } catch {
        return json({ season, tracker: DEFAULT_TRACKER });
      }
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "Invalid JSON" }, 400);
      const tracker = body.tracker ?? body.data ?? body;
      const entriesRaw = Array.isArray(tracker?.entries) ? tracker.entries : [];
      const entries = entriesRaw
        .map((e, idx) => {
          const id = String(e?.id || idx || crypto?.randomUUID?.() || `id_${Date.now()}_${idx}`);
          const username = String(e?.username || "").trim();
          const amountNum = Number(e?.amount);
          const amount = Number.isFinite(amountNum) ? amountNum : 0;
          return { id, username, amount };
        })
        .filter((e) => e.username);

      const payload = {
        season,
        tracker: {
          ...DEFAULT_TRACKER,
          updated: String(tracker?.updated || "").trim(),
          entries,
          pot: computePot(entries),
          serverUpdatedAt: new Date().toISOString(),
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
