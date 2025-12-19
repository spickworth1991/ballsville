// functions/api/admin/upload.js
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
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function onRequest(context) {
  const { env, request } = context;

  try {
    if (!env.ADMIN_BUCKET) return json({ error: "Missing R2 binding ADMIN_BUCKET" }, 500);

    // Expect JSON: { filename, contentType, dataBase64 }
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "Body must be JSON" }, 400);

    const { filename, contentType, dataBase64 } = body;
    if (!dataBase64) return json({ error: "Missing dataBase64" }, 400);

    const bin = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `admin/uploads/${ts}_${safeName(filename)}`;

    await env.ADMIN_BUCKET.put(key, bin, {
      httpMetadata: { contentType: contentType || "application/octet-stream" },
    });

    // If you have a public base for this bucket, set it in wrangler.toml / Pages env as:
    // ADMIN_ASSETS_BASE_URL="https://<your-public-bucket-domain>"
    const base = env.ADMIN_ASSETS_BASE_URL || "";
    const url = base ? `${base.replace(/\/$/, "")}/${key}` : "";

    return json({ ok: true, key, url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
