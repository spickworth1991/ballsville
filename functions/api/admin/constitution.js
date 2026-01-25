// functions/api/admin/constitution.js
// Admin Read/Write for the MAIN constitution content stored in R2 (auth-protected),
// matching the dynasty-constitution API conventions.

const SECTION = "constitution";
const CONTENT_KEY = "content/constitution/main.json";

function jsonResponse(obj, init = {}) {
  const headers = { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) };
  return new Response(JSON.stringify(obj), { ...init, headers });
}

function ensureR2(env) {
  // Prefer the binding name used by /functions/r2/[[path]].js
  const b = env.ADMIN_BUCKET || env.admin_bucket || env.ADMIN || env.admin;
  if (!b) return { ok: false, status: 500, error: "Missing R2 binding: ADMIN_BUCKET" };
  if (typeof b.get !== "function" || typeof b.put !== "function") {
    return {
      ok: false,
      status: 500,
      error:
        "ADMIN_BUCKET binding is not an R2 bucket object (check Pages > Settings > Bindings: ADMIN_BUCKET).",
    };
  }
  return { ok: true, bucket: b };
}

async function requireAdmin(ctx) {
  const { request, env } = ctx;

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Missing Authorization Bearer token." };

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const adminsRaw = (env.ADMIN_EMAILS || env.NEXT_PUBLIC_ADMIN_EMAILS || "").trim();
  const admins = adminsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!supabaseUrl || !supabaseAnon) {
    return { ok: false, status: 500, error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY." };
  }
  if (!admins.length) return { ok: false, status: 500, error: "ADMIN_EMAILS is not set." };

  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: supabaseAnon, authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { ok: false, status: 401, error: "Invalid session token." };

  const user = await res.json();
  const email = String(user?.email || "").toLowerCase();
  if (!admins.includes(email)) return { ok: false, status: 403, error: "Not an admin." };

  return { ok: true };
}

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function slugify(s) {
  return safeStr(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function normalizeSections(input) {
  const raw = Array.isArray(input) ? input : [];
  const cleaned = raw
    .map((s, idx) => {
      const title = safeStr(s?.title).trim();
      const id = slugify(s?.id || title || `section-${idx + 1}`);
      const order = toInt(s?.order, idx + 1);
      const bodyHtml = safeStr(s?.bodyHtml || "");
      return { id, title, order, bodyHtml };
    })
    .filter((s) => s.title && s.id);

  // Sort by order, then renumber sequentially so TOC numbers == order.
  cleaned.sort((a, b) => a.order - b.order);
  cleaned.forEach((s, i) => {
    s.order = i + 1;
  });

  return cleaned;
}

async function readJsonFromR2(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const txt = await obj.text();
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function putJsonToR2(bucket, key, data) {
  const body = JSON.stringify(data, null, 2);
  await bucket.put(key, body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function touchManifest(bucket, version) {
  const key = `data/manifests/${SECTION}.json`;
  await putJsonToR2(bucket, key, {
    section: SECTION,
    version: String(version),
    updatedAt: new Date().toISOString(),
  });
}

export async function onRequestGet(ctx) {
  const auth = await requireAdmin(ctx);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, { status: auth.status });

  const r2 = ensureR2(ctx.env);
  if (!r2.ok) return jsonResponse({ ok: false, error: r2.error }, { status: r2.status });

  const data = await readJsonFromR2(r2.bucket, CONTENT_KEY);

  return jsonResponse(
    {
      ok: true,
      key: CONTENT_KEY,
      data: data || { updatedAt: "", sections: [] },
    },
    { status: 200 }
  );
}

export async function onRequestPut(ctx) {
  const auth = await requireAdmin(ctx);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, { status: auth.status });

  const r2 = ensureR2(ctx.env);
  if (!r2.ok) return jsonResponse({ ok: false, error: r2.error }, { status: r2.status });

  let payload;
  try {
    payload = await ctx.request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const sections = normalizeSections(payload?.sections);
  const updatedAt = new Date().toISOString();
  const version = Date.now();

  const out = { updatedAt, sections };
  await putJsonToR2(r2.bucket, CONTENT_KEY, out);
  await touchManifest(r2.bucket, version);

  return jsonResponse(
    { ok: true, key: CONTENT_KEY, version, updatedAt, count: sections.length },
    { status: 200 }
  );
}

export async function onRequest(ctx) {
  const m = ctx.request.method.toUpperCase();
  if (m === "GET") return onRequestGet(ctx);
  if (m === "PUT") return onRequestPut(ctx);
  return jsonResponse({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}
