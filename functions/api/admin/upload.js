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

function ensureR2(env) {
  const b = env.ADMIN_BUCKET;
  // If binding is misconfigured, Cloudflare will still give you "something" but not an R2 object.
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

  if (!supabaseUrl || !supabaseAnon) return { ok: false, status: 500, error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY." };
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

    if (!file || typeof file === "string") return json({ ok: false, error: "Missing file" }, 400);

    const original = safeName(file.name);
    const ext = original.includes(".") ? original.split(".").pop() : "bin";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `media/${folder}/${stamp}-${original || "image"}.${ext}`.replace(/\.+/g, ".");

    const buf = await file.arrayBuffer();

    await r2.bucket.put(key, buf, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    // Served publicly by your /r2 proxy:
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
