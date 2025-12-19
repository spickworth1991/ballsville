// functions/api/admin/mini-leagues.js

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function getSkeleton() {
  return {
    version: 1,
    updatedAt: null,

    hero: {
      kicker: "Welcome to",
      title: "the Mini-Leagues game",
      subtitle:
        "Way-too-early, rookie-inclusive, budget BESTBALL redraft leagues.",
      image: {
        url: "", // set via upload
        alt: "Mini-Leagues hero image",
      },
      bullets: [
        "Season ends after Week 14",
        "Game ends after Week 15",
      ],
    },

    settings: {
      title: "BALLSVILLE SETTINGS",
      bullets: [
        "MOST POINTS WINS ⚠️",
        "12-team Superflex",
        "No TEP · 2× Flex · +6 passing TD",
        "Rookie-inclusive drafting",
        "3× shuffle or quick derby",
        "No 3rd-round reversal",
        "No trading",
        "1–2 hour timers or fast draft (pre-determined)",
        "Pure draft and go!",
      ],
    },

    howItWorks: {
      title: "How the game works",
      paragraphs: [
        "You play and win in your league. Most points after Week 14 wins $30 (🪙) in that league.",
        "After Week 14, a game manager will ask whether you want to WAGER your 🪙 or KEEP it. Wagering is optional.",
      ],
      wager: {
        withoutTitle: "Without a wager",
        withoutBullets: [
          "You’re eligible to win your DIVISION BONUS (+$30).",
          "You’re eligible to win the CHAMPIONSHIP BONUS (+$100).",
        ],
        withTitle: "With a wager",
        withBullets: [
          "You’re eligible to win ALL wagers (big upside).",
          "You’re eligible for both bonuses above.",
          "You’re eligible for the WAGER BONUS (+$60).",
        ],
        note: "BONUSES stack!",
      },
    },

    cash: {
      title: "How the cash works",
      bullets: [
        "$4 buy-in",
        "League winners take $30 to keep or wager, and a shot at the 🏆",
        "$100 🏆 BONUS (no wager needed)",
        "$60 Wager BONUS (wager needed)",
        "$30 bonus for winning your division (×4)",
        "Many opportunities for free extras",
        "LeagueSafe accounts are pinned in the Sleeper leagues",
      ],
    },

    etiquette: {
      title: "Draft etiquette",
      bullets: [
        "Please tag the next person up.",
        "Please don’t rush people.",
        "As a league, you can vote to reduce the timer after Round 10.",
        "No one auto-picks Round 1 ⚠️ If you’re absent, your spot will be substituted and you can join the next draft or be refunded.",
        "If you auto at the 1.12, your next 2.01 may be pushed through.",
        "If you make a mistake, tag your managers immediately for a chance at a reversal (does not apply to an expired clock).",
        "Manager intervention beyond that is a league vote.",
      ],
    },

    divisions: [
      {
        id: "div-100",
        title: "Division 100",
        status: "FULL", // FULL | FILLING | TBD | DRAFTING
        order: 100,
        image: { url: "", alt: "Division 100 image" },
        leagues: [
          // 10 leagues, each 12 people (you can add/edit in admin)
          // { id:"lg-100-1", name:"League 1", status:"FULL", order:1, image:{url:"",alt:""} , sleeperUrl:"" }
        ],
      },
      {
        id: "div-200",
        title: "Division 200",
        status: "FULL",
        order: 200,
        image: { url: "", alt: "Division 200 image" },
        leagues: [],
      },
      {
        id: "div-400",
        title: "Division 400",
        status: "FULL",
        order: 400,
        image: { url: "", alt: "Division 400 image" },
        leagues: [],
      },
    ],

    lastYear: {
      title: "Last year’s winners",
      image: { url: "", alt: "Last year’s Mini-Leagues winners" },
    },
  };
}

function deepMerge(base, patch) {
  if (Array.isArray(base)) {
    // arrays are replaced (admin sends full arrays)
    return Array.isArray(patch) ? patch : base;
  }
  if (base && typeof base === "object") {
    const out = { ...base };
    if (patch && typeof patch === "object") {
      for (const k of Object.keys(patch)) {
        out[k] = deepMerge(base[k], patch[k]);
      }
    }
    return out;
  }
  return patch === undefined ? base : patch;
}

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
    headers: { authorization: `Bearer ${token}`, apikey: anon },
  });

  if (!res.ok) return { ok: false, status: 401, error: "Invalid session token" };

  const user = await res.json();
  const email = String(user?.email || "").toLowerCase();

  const admins = parseAdmins(env);
  if (!admins.includes(email)) {
    return { ok: false, status: 403, error: `Not an admin: ${email}` };
  }

  return { ok: true, email };
}

export async function onRequest(context) {
  const { env, request } = context;

  try {
    if (!env.ADMIN_BUCKET) {
      return json({ error: "Missing R2 binding ADMIN_BUCKET" }, 500);
    }

    const gate = await requireAdmin({ env, request });
    if (!gate.ok) return json({ error: gate.error }, gate.status);

    const key = "admin/mini-leagues.json";
    const skeleton = getSkeleton();

    // GET: return merged (skeleton + stored)
    if (request.method === "GET") {
      const obj = await env.ADMIN_BUCKET.get(key);
      if (!obj) return json(skeleton);

      let stored = {};
      try {
        stored = JSON.parse(await obj.text());
      } catch {
        stored = {};
      }

      return json(deepMerge(skeleton, stored));
    }

    // PUT/POST: merge patch into current and save
    if (request.method === "PUT" || request.method === "POST") {
      let patch;
      try {
        patch = await request.json();
      } catch {
        return json({ error: "Body must be valid JSON" }, 400);
      }

      // load current
      const obj = await env.ADMIN_BUCKET.get(key);
      let stored = {};
      if (obj) {
        try {
          stored = JSON.parse(await obj.text());
        } catch {
          stored = {};
        }
      }

      const current = deepMerge(skeleton, stored);
      const next = deepMerge(current, patch);
      next.updatedAt = new Date().toISOString();

      await env.ADMIN_BUCKET.put(key, JSON.stringify(next, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });

      return json({ ok: true, updatedAt: next.updatedAt });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
