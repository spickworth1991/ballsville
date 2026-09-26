import { requireAdminSession } from "../../_lib/adminAuth.js";

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
  const bucket = env.admin_bucket || env.ADMIN_BUCKET || env;
  if (!bucket?.get) throw new Error("R2 bucket binding missing (admin_bucket/ADMIN_BUCKET)");
  return bucket;
}

async function touchManifest(env) {
  const bucket = ensureR2(env);
  const key = "data/manifests/announcement-bar.json";
  const body = JSON.stringify(
    {
      section: "announcement-bar",
      updatedAt: Date.now(),
    },
    null,
    2
  );
  await bucket.put(key, body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function requireAdmin(request, env) {
  const auth = await requireAdminSession(request, env);
  return auth.ok ? auth : { ok: false, res: json({ error: auth.error }, auth.status) };
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v, fallback = 0) {
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function sanitizeItem(item, index) {
  const text = safeStr(item?.text).trim();
  const href = safeStr(item?.href).trim();
  return {
    id: safeStr(item?.id).trim() || `announcement_${index + 1}`,
    text,
    href,
  };
}

function sanitizeAnnouncementBar(input) {
  const value = input && typeof input === "object" ? input : {};
  return {
    enabled: value?.enabled !== false,
    eyebrow: safeStr(value?.eyebrow || "Ballsville Bulletin").trim() || "Ballsville Bulletin",
    speedSeconds: Math.max(8, safeNum(value?.speedSeconds, 34)),
    items: safeArray(value?.items)
      .map(sanitizeItem)
      .filter((item) => item.text),
  };
}

const KEY = "content/sitewide/announcement-bar.json";

const DEFAULT_ANNOUNCEMENT_BAR = sanitizeAnnouncementBar({
  enabled: true,
  eyebrow: "Ballsville Bulletin",
  speedSeconds: 34,
  items: [
    {
      id: "announcement_1",
      text: "Highlander is live with a fresh format and a new path to win big!",
      href: "/highlander",
    },
    {
      id: "announcement_2",
      text: "Catch mini-games, promos, and the latest announcements in the News hub.",
      href: "/news",
    },
    {
      id: "announcement_3",
      text: "Use Draft Compare to stack ADP and draftboard trends across multiple leagues.",
      href: "/draft-compare",
    },
  ],
});

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const auth = await requireAdmin(request, env);
    if (!auth.ok) return auth.res;

    const bucket = ensureR2(env);

    if (request.method === "GET") {
      const obj = await bucket.get(KEY);
      if (!obj) return json({ updatedAt: Date.now(), data: DEFAULT_ANNOUNCEMENT_BAR });

      const text = await obj.text();
      try {
        const parsed = JSON.parse(text);
        return json({
          updatedAt: parsed?.updatedAt || parsed?.updated_at || Date.now(),
          data: sanitizeAnnouncementBar(parsed?.data || parsed),
        });
      } catch {
        return json({ updatedAt: Date.now(), data: DEFAULT_ANNOUNCEMENT_BAR });
      }
    }

    if (request.method === "PUT" || request.method === "POST") {
      const body = await request.json().catch(() => null);
      const data = sanitizeAnnouncementBar(body?.data || body);
      const updatedAt = Date.now();

      await bucket.put(KEY, JSON.stringify({ updatedAt, data }, null, 2), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });

      await touchManifest(env);
      return json({ ok: true, key: KEY, updatedAt, data });
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}
