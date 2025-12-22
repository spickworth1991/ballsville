// functions/api/admin/posts.js
// Admin API for Posts (News + Mini-Games) stored in R2.
//
// If the R2 JSON does not exist yet, we return a local seed (exported from
// the old Supabase table) so you can review it in the admin UI and Save
// once to migrate.

import { requireAdmin } from "../_adminAuth";
import { POSTS_SEED } from "../seeds/posts";

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
  const b = env.admin_bucket || env;
  if (!b || typeof b.get !== "function" || typeof b.put !== "function") {
    throw new Error("R2 binding missing: expected env.admin_bucket (or env) to be an R2 bucket binding.");
  }
  return b;
}

async function readR2Json(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  return await obj.json();
}

async function writeR2Json(bucket, key, data) {
  await bucket.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { updatedAt: new Date().toISOString() },
  });
}

function normalizePost(p, idx) {
  const id = String(p?.id || idx);
  const created_at = typeof p?.created_at === "string" ? p.created_at : new Date().toISOString();
  const tags = Array.isArray(p?.tags)
    ? p.tags.map(String)
    : typeof p?.tags === "string"
      ? p.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return {
    id,
    created_at,
    title: String(p?.title || "").trim(),
    body: String(p?.body || "").trim(),
    tags,
    pinned: Boolean(p?.pinned),
    imageKey: typeof p?.imageKey === "string" ? p.imageKey : "",
    imageUrl: typeof p?.imageUrl === "string" ? p.imageUrl : "",
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    await requireAdmin(request, env);

    const bucket = ensureR2(env);
    const key = `data/posts/posts.json`;

    if (request.method === "GET") {
      const existing = await readR2Json(bucket, key);
      const payload = existing || POSTS_SEED || { posts: [] };
      return json(payload, 200);
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const list = Array.isArray(body?.posts) ? body.posts : [];
      const normalized = list.map(normalizePost);

      await writeR2Json(bucket, key, { posts: normalized });
      return json({ ok: true }, 200);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}
