// functions/api/admin/hall-of-fame.js
// Admin API for Hall of Fame content stored in R2.
//
// If the R2 JSON does not exist yet, we return a local seed (exported from
// the old Supabase table) so you can review it in the admin UI and Save
// once to migrate.

import { requireAdmin } from "../_adminAuth";
import { HALL_OF_FAME_SEED } from "../seeds/hall-of-fame";

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

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const method = request.method.toUpperCase();

    const auth = request.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";

    const admin = await requireAdmin(token, env);
    if (!admin.ok) return json({ error: admin.error }, admin.status);

    const bucket = ensureR2(env);
    const key = "data/hall-of-fame/hall_of_fame.json";

    if (method === "GET") {
      const existing = await readR2Json(bucket, key);
      if (existing) return json(existing, 200);
      // one-time migration fallback
      return json(HALL_OF_FAME_SEED, 200);
    }

    if (method === "PUT") {
      const body = await request.json().catch(() => null);
      const title = String(body?.title || "Hall of Fame");
      const entries = Array.isArray(body?.entries) ? body.entries : [];

      const normalized = {
        title,
        entries: entries
          .map((e, idx) => ({
            id: String(e?.id || idx),
            year: e?.year != null && e.year !== "" ? Number(e.year) : "",
            title: String(e?.title || ""),
            subtitle: String(e?.subtitle || ""),
            imageKey: String(e?.imageKey || ""),
            imageUrl: String(e?.imageUrl || ""),
            order: Number.isFinite(Number(e?.order)) ? Number(e.order) : idx + 1,
          }))
          .sort((a, b) => (a.order || 0) - (b.order || 0)),
      };

      await writeR2Json(bucket, key, normalized);
      return json({ ok: true }, 200);
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}
