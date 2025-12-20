// functions/api/admin/upload.js
//
// POST multipart/form-data:
// - file: <File>
// - folder: (optional) e.g. "mini-leagues"
// - key: (optional) exact R2 object key to overwrite, e.g. "media/mini-leagues/hero_2025.webp"
//
// Returns: { ok, key, url }

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function safeName(name) {
  return String(name || "upload")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeKey(key) {
  // allow only safe key characters and folders
  const k = String(key || "").trim();
  if (!k) return "";
  if (k.includes("..")) return "";
  if (!/^[a-z0-9/_\-.]+$/i.test(k)) return "";
  return k.replace(/^\/+/, "");
}

function ensureR2(env) {
  const b = env.admin_bucket || env.ADMIN_BUCKET;

  if (!b) {
    return { ok: false, status: 500, error: "Missing R2 binding: admin_bucket" };
  }

  if (typeof b.get !== "function" || typeof b.put !== "function") {
    return {
      ok: false,
      status: 500,
      error: "admin_bucket binding is not an R2 bucket object (check Pages > Settings > Bindings: admin_bucket).",
    };
  }

  return { ok: true, bucket: b };
}

async function requireAdmin(context) {
  const { request, env } = context;

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

function getExtFromName(filename) {
  const n = String(filename || "");
  const last = n.lastIndexOf(".");
  if (last === -1) return "";
  return n.slice(last + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function onRequest(context) {
  try {
    const { request, env } = context;

    const r2 = ensureR2(env);
    if (!r2.ok) return json({ ok: false, error: r2.error }, r2.status);

    const gate = await requireAdmin(context);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);

    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    const form = await request.formData();
    const file = form.get("file");
    const folder = safeName(form.get("folder") || "misc");
    const desiredKeyRaw = form.get("key");

    if (!file || typeof file === "string") return json({ ok: false, error: "Missing file" }, 400);

    const originalName = safeName(file.name || "upload");
    const ext = getExtFromName(originalName) || "bin";

    // Optional fixed overwrite key
    const desiredKey = typeof desiredKeyRaw === "string" ? safeKey(desiredKeyRaw) : "";

    let key;
    if (desiredKey) {
      key = desiredKey;
    } else {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      // IMPORTANT: do NOT append ext twice
      key = `media/${folder}/${stamp}-${originalName}`;
      if (!key.toLowerCase().endsWith(`.${ext}`)) key = `${key}.${ext}`;
      key = key.replace(/\.+/g, ".");
    }

    const buf = await file.arrayBuffer();

    await r2.bucket.put(key, buf, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    const url = `/r2/${key}`;

    return json({ ok: true, key, url });
  } catch (e) {
    return json(
      {
        ok: false,
        error: "upload.js crashed",
        detail: String(e?.message || e),
      },
      500
    );
  }
}
