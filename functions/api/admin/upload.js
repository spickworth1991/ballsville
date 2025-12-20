// functions/api/admin/upload.js
//
// POST multipart/form-data:
// - file: <File>
// - folder: (optional) e.g. "mini-leagues"
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

// Admin bucket is required.
// Public bucket is optional, but if present we'll also write there (so /r2 can serve it).
function getBuckets(env) {
  const admin = env.admin_bucket || env.ADMIN_BUCKET;
  if (!admin) {
    return {
      ok: false,
      status: 500,
      error: "Missing R2 binding: admin_bucket",
    };
  }
  if (typeof admin.get !== "function" || typeof admin.put !== "function") {
    return {
      ok: false,
      status: 500,
      error: "admin_bucket binding is not an R2 bucket object (check Pages > Settings > Bindings: admin_bucket).",
    };
  }

  // Optional: bucket that backs /r2 on the public site
  const pub = env.public_bucket || env.PUBLIC_BUCKET || env.r2_bucket || env.R2_BUCKET || null;
  const publicBucket =
    pub && typeof pub.get === "function" && typeof pub.put === "function" ? pub : null;

  return { ok: true, adminBucket: admin, publicBucket };
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

function splitNameAndExt(filename) {
  const safe = safeName(filename || "upload");
  const lastDot = safe.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === safe.length - 1) {
    return { base: safe || "upload", ext: "" };
  }
  return {
    base: safe.slice(0, lastDot),
    ext: safe.slice(lastDot + 1),
  };
}

export async function onRequest(context) {
  try {
    const { request, env } = context;

    const buckets = getBuckets(env);
    if (!buckets.ok) return json({ ok: false, error: buckets.error }, buckets.status);

    const gate = await requireAdmin(context);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);

    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    const form = await request.formData();
    const file = form.get("file");
    const folder = safeName(form.get("folder") || "misc");

    if (!file || typeof file === "string") return json({ ok: false, error: "Missing file" }, 400);

    const { base, ext } = splitNameAndExt(file.name);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Prefer the real extension; fallback to mime-derived extension; fallback to "bin"
    const mime = file.type || "application/octet-stream";
    const mimeExt =
      mime === "image/webp"
        ? "webp"
        : mime === "image/png"
        ? "png"
        : mime === "image/jpeg"
        ? "jpg"
        : mime === "image/gif"
        ? "gif"
        : "";

    const finalExt = (ext || mimeExt || "bin").toLowerCase();

    // ✅ key is now "...-filename.webp" (NOT webp.webp)
    const key = `media/${folder}/${stamp}-${base || "image"}.${finalExt}`.replace(/\.+/g, ".");

    const buf = await file.arrayBuffer();

    // Write to admin bucket
    await buckets.adminBucket.put(key, buf, {
      httpMetadata: { contentType: mime },
    });

    // Also write to public bucket if present (so /r2 can serve it)
    if (buckets.publicBucket) {
      await buckets.publicBucket.put(key, buf, {
        httpMetadata: { contentType: mime },
      });
    }

    const url = `/r2/${key}`;
    return json({ ok: true, key, url, wrotePublic: !!buckets.publicBucket });
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
