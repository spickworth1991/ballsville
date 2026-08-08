function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function bucketFor(env) {
  const bucket = env.admin_bucket || env.ADMIN_BUCKET;
  if (!bucket?.get || !bucket?.put) throw new Error("R2 bucket binding missing (admin_bucket/ADMIN_BUCKET)");
  return bucket;
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "Missing auth token" }, 401);
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json({ error: "Supabase env not configured" }, 500);
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: key } });
  if (!res.ok) return json({ error: "Not authenticated" }, 401);
  const user = await res.json();
  const allowed = (env.ADMIN_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!user?.email || (allowed.length && !allowed.includes(String(user.email).toLowerCase()))) return json({ error: "Not authorized" }, 403);
  return null;
}

const KEY = "content/sitewide/home-promotion.json";
const str = (value, fallback = "") => String(value ?? fallback).trim();
const list = (value) => (Array.isArray(value) ? value : []).map((item) => str(item)).filter(Boolean).slice(0, 20);

function sanitize(input) {
  const value = input && typeof input === "object" ? input : {};
  return {
    enabled: value.enabled !== false,
    eyebrow: str(value.eyebrow, "Subscriber Giveaway"),
    title: str(value.title, "Win a seat in a $1,000 fantasy football league"),
    description: str(value.description),
    drawingDate: str(value.drawingDate),
    drawingTime: str(value.drawingTime),
    benefits: list(value.benefits),
    entrySteps: list(value.entrySteps),
    imageKey: str(value.imageKey),
    imageUrl: str(value.imageUrl, "/photos/homepage-promotion.png"),
    actionLabel: str(value.actionLabel, "Visit our YouTube channel"),
    actionUrl: str(value.actionUrl),
  };
}

export async function onRequest({ request, env }) {
  try {
    const denied = await requireAdmin(request, env);
    if (denied) return denied;
    const bucket = bucketFor(env);
    if (request.method === "GET") {
      const object = await bucket.get(KEY);
      if (!object) return json({ data: null });
      const parsed = JSON.parse(await object.text());
      return json({ updatedAt: parsed.updatedAt, data: sanitize(parsed.data || parsed) });
    }
    if (request.method === "PUT" || request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const updatedAt = Date.now();
      const data = { ...sanitize(body.data || body), updatedAt };
      await bucket.put(KEY, JSON.stringify({ updatedAt, data }, null, 2), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
      return json({ ok: true, key: KEY, updatedAt, data });
    }
    return json({ error: "Method Not Allowed" }, 405);
  } catch (error) {
    return json({ error: error?.message || "Server error" }, 500);
  }
}
