const SECTION = "joe-street-journal";
const CONTENT_KEY = "content/joe-street-journal/main.json";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function bucket(env) {
  const value = env.ADMIN_BUCKET || env.admin_bucket;
  if (!value?.get || !value?.put) throw new Error("Missing R2 binding: ADMIN_BUCKET");
  return value;
}

async function requireAdmin({ request, env }) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Missing admin session." };
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admins = String(env.ADMIN_EMAILS || env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!url || !anon || !admins.length) return { ok: false, status: 500, error: "Admin authentication is not configured." };
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anon, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false, status: 401, error: "Invalid admin session." };
  const user = await res.json();
  if (!admins.includes(String(user?.email || "").toLowerCase())) {
    return { ok: false, status: 403, error: "Not an admin." };
  }
  return { ok: true };
}

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const cleanId = (v, fallback) =>
  str(v || fallback).toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

function objectText(value, fields) {
  const out = {};
  for (const field of fields) out[field] = str(value?.[field]).trim();
  return out;
}

function sanitize(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    schemaVersion: 1,
    branding: objectText(raw.branding, ["eyebrow", "title", "accent", "description"]),
    links: (Array.isArray(raw.links) ? raw.links : []).map((item, index) => ({
      id: cleanId(item?.id, `link-${index + 1}`),
      label: str(item?.label).trim(),
      url: str(item?.url).trim(),
    })).filter((item) => item.id && item.label),
    stats: (Array.isArray(raw.stats) ? raw.stats : []).map((item) => objectText(item, ["value", "label"])),
    journey: (Array.isArray(raw.journey) ? raw.journey : []).map((item) => objectText(item, ["title", "text"])),
    sections: (Array.isArray(raw.sections) ? raw.sections : []).map((item, index) => ({
      id: cleanId(item?.id, `section-${index + 1}`),
      title: str(item?.title).trim(),
      body: str(item?.body).trim(),
      items: (Array.isArray(item?.items) ? item.items : []).map(str).map((v) => v.trim()).filter(Boolean),
      calloutTitle: str(item?.calloutTitle).trim(),
      calloutText: str(item?.calloutText).trim(),
      linkId: cleanId(item?.linkId, ""),
    })).filter((item) => item.id && item.title),
    draftKings: {
      ...objectText(raw.draftKings, ["title", "description"]),
      steps: (Array.isArray(raw.draftKings?.steps) ? raw.draftKings.steps : []).map(str).map((v) => v.trim()).filter(Boolean),
    },
    signup: objectText(raw.signup, ["eyebrow", "title", "description", "paymentNote"]),
    weekly: objectText(raw.weekly, ["eyebrow", "title", "description"]),
    disclaimer: str(raw.disclaimer).trim(),
  };
}

async function read(r2) {
  const obj = await r2.get(CONTENT_KEY);
  if (!obj) return null;
  return JSON.parse(await obj.text());
}

async function write(r2, data) {
  await r2.put(CONTENT_KEY, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function manifest(r2, updatedAt) {
  await r2.put(`data/manifests/${SECTION}.json`, JSON.stringify({ section: SECTION, updatedAt }), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export async function onRequest(context) {
  try {
    const auth = await requireAdmin(context);
    if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
    const r2 = bucket(context.env);

    if (context.request.method === "GET") {
      const data = await read(r2);
      if (!data) {
        return response(
          { ok: false, error: `Journal content is missing from R2 at ${CONTENT_KEY}. Restore the R2 object before editing.` },
          404
        );
      }
      return response({ ok: true, data, key: CONTENT_KEY });
    }

    if (context.request.method === "PUT" || context.request.method === "POST") {
      const body = await context.request.json().catch(() => null);
      if (!body) return response({ ok: false, error: "Invalid JSON body." }, 400);
      const updatedAt = new Date().toISOString();
      const data = { ...sanitize(body), updatedAt };
      await write(r2, data);
      await manifest(r2, updatedAt);
      return response({ ok: true, data, key: CONTENT_KEY, updatedAt });
    }

    return response({ ok: false, error: "Method Not Allowed" }, 405);
  } catch (error) {
    return response({ ok: false, error: error?.message || "Server error" }, 500);
  }
}
