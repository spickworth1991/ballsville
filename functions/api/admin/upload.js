// functions/api/admin/mini-leagues/upload.js
// Upload an image to R2 and return a same-origin URL you can store in CMS JSON.
//
// POST multipart/form-data with field name "file".
// Response: { ok: true, url: "/r2/<key>", key }
//
// Uses the same admin auth as the Mini-Leagues admin JSON endpoint.

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const PREFIX = "cms/mini-leagues/images/";

export async function onRequestPost({ env, request }) {
  try {
    await requireAdmin(env, request);

    const bucket = env.R2_BUCKET;
    if (!bucket) return json({ ok: false, error: "Missing R2_BUCKET binding" }, 500);

    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return json({ ok: false, error: "Expected multipart/form-data" }, 400);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ ok: false, error: "Missing file field" }, 400);
    }

    if (file.size > MAX_BYTES) {
      return json({ ok: false, error: "File too large (max 15MB)" }, 413);
    }

    const safeName = sanitizeFilename(file.name || "upload");
    const ext = safeName.includes(".") ? safeName.split(".").pop().toLowerCase() : "bin";
    const key = `${PREFIX}${Date.now()}-${rand(6)}.${ext}`;

    const buf = await file.arrayBuffer();
    await bucket.put(key, buf, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    // Same-origin URL via your existing /r2 proxy function:
    return json({ ok: true, key, url: `/r2/${key}` }, 200);
  } catch (e) {
    return json({ ok: false, error: e?.message || "Upload failed" }, e?.statusCode || 400);
  }
}

async function requireAdmin(env, request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw err("Missing Authorization Bearer token", 401);

  const url = env.SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw err("Missing SUPABASE_URL or SUPABASE_ANON_KEY", 500);

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
    },
  });

  if (!res.ok) throw err("Invalid session", 401);
  const user = await res.json();
  const email = (user?.email || "").toLowerCase();

  const allowList = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowList.length && !allowList.includes(email)) {
    throw err("Not an admin", 403);
  }

  return { email };
}

function sanitizeFilename(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function rand(n) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function err(message, statusCode) {
  const e = new Error(message);
  e.statusCode = statusCode;
  return e;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
