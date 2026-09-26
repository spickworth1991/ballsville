import { requireAdminSession } from "../../_lib/adminAuth.js";

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
  // support both bindings used across the project
  const b = env.admin_bucket || env.ADMIN_BUCKET || env;
  if (!b?.get) throw new Error("R2 bucket binding missing (admin_bucket/ADMIN_BUCKET)");
  return b;
}

async function touchManifest(env, season) {
  const b = ensureR2(env);
  const key = season ? `data/manifests/hall-of-fame_${season}.json` : `data/manifests/hall-of-fame.json`;
  const body = JSON.stringify({ section: "hall-of-fame", season: season || null, updatedAt: Date.now() }, null, 2);
  await b.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
}


async function requireAdmin(request, env) {
  const auth = await requireAdminSession(request, env);
  return auth.ok ? auth : { ok: false, res: json({ error: auth.error }, auth.status) };
}

const KEY = "data/hall-of-fame/hall_of_fame.json";

// One-time seed from Supabase export (used only if R2 JSON does not exist yet)
const SEED_HALL_OF_FAME = [
  {
    "id": "432ab94d-deca-400d-b396-738278084bdf",
    "year": "2024",
    "title": "Dragons of Dynasty Champion",
    "subtitle": "\"The opponents tried to shoot me down as i climbed the Hill, but they could Pearsall the heart. I was thankful for Jayden reaching the Mooney and at the end of the day, he was a good Ladd.\" - Pgrote86",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/pgrote86.png",
    "order": 11
  },
  {
    "id": "48bc30c8-b3e4-403e-8257-becf308734d2",
    "year": "2024",
    "title": "2024 The BIG Game Winner",
    "subtitle": "\"If you aint first your last\" - kros24",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/biggame2024.png",
    "order": 20
  },
  {
    "id": "6925a90a-7bd5-47b3-b97d-c9b086ad90e9",
    "year": "2024",
    "title": "2024 Dragons of Dynasty Winners",
    "subtitle": "The year’s Dynasty champions — a legacy win in the toughest format we run.",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/dynasty2024.png",
    "order": 10
  },
  {
    "id": "734119f5-7330-4987-9bd1-12ae3ef2d8a3",
    "year": "2024",
    "title": "2024 The Redraft Game Winners",
    "subtitle": "Redraft champs — draft day dominance turned into a season-long run.",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/redraft2024_3.png",
    "order": 42
  },
  {
    "id": "7be8c99f-143b-4514-b3c4-c3e535060de1",
    "year": "2024",
    "title": "2024 The BIG Game Division Winners",
    "subtitle": "Your BIG game division winners!",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/biggamediv2024.png",
    "order": 21
  },
  {
    "id": "86418d95-7504-46e4-909e-04c4724392a9",
    "year": "2024",
    "title": "2024 Mini-League Champion",
    "subtitle": "\"These leagues were awesome and run very well and were a lot of fun. I will be a player in these leagues, as long as you're doing 'em\" - freemanc2447",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/minileageus2024.png",
    "order": 30
  },
  {
    "id": "99917903-da2e-4ca0-8083-fb5edbb66a16",
    "year": "2024",
    "title": "2024 The Redraft Game Winners",
    "subtitle": "Redraft champs — draft day dominance turned into a season-long run.",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/redraft2024_1.png",
    "order": 40
  },
  {
    "id": "ae50ca49-2c09-4cf4-83c6-989508b45832",
    "year": "2024",
    "title": "2024 Mini-League Wager Winner",
    "subtitle": "\"Alex and his team at BALLSVILLE are fantastic\" - Jmhubbs",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/minileagueswager2024.png",
    "order": 31
  },
  {
    "id": "c2b6c49a-26bd-426e-8b07-3900537e12a2",
    "year": "2024",
    "title": "2024 Player of the Year",
    "subtitle": "The single best season across the Ballsville universe. Crowned by performance, consistency, and clutch moments.",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/poy2024.png",
    "order": 50
  },
  {
    "id": "c894bc6a-de05-4dc9-bee0-7513027da90e",
    "year": "2024",
    "title": "Dragons of Dynasty Wager Winner",
    "subtitle": "\"It doesn't matter what cards you're dealt. Its what you do with those cards. Never complain, just keep pushing forward. Find a positive in anything and just fight for it\" - Baker Mayfield",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/jerryb83.png",
    "order": 12
  },
  {
    "id": "f11505be-54b9-42d6-aa88-a3a1a5519ab0",
    "year": "2024",
    "title": "2024 The Redraft Game Winners",
    "subtitle": "Redraft champs — draft day dominance turned into a season-long run.",
    "imageKey": "",
    "imageUrl": "/photos/hall-of-fame/redraft2024_2.png",
    "order": 41
  }
];

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const auth = await requireAdmin(request, env);
    if (!auth.ok) return auth.res;

    const r2 = ensureR2(env);
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get("season");
    const season = seasonParam ? Number(seasonParam) : new Date().getFullYear();

    if (request.method === "GET") {
      if (url.searchParams.get("source") === "supabase") {
        const supabaseUrl = String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
        const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase content storage is not configured." }, 500);
        const query = new URLSearchParams({
          select: "id,year,title,blurb,image_url,sort_order,is_active",
          is_active: "eq.true",
          order: "sort_order.asc",
        });
        const legacy = await fetch(`${supabaseUrl}/rest/v1/hall_of_fame?${query}`, {
          headers: { apikey: supabaseKey, authorization: `Bearer ${supabaseKey}` },
        });
        if (!legacy.ok) {
          const detail = await legacy.json().catch(() => ({}));
          return json({ error: detail?.message || "Could not read the legacy Hall of Fame data." }, 502);
        }
        return json({ rows: await legacy.json() });
      }
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

      // Bust manifest-first client caches on update
      await touchManifest(env, Number.isFinite(season) ? season : undefined);
      await touchManifest(env, undefined);

      return json({ ok: true, entries: cleaned });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
}
