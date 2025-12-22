// functions/api/admin/dynasty-wagering.js
// Admin API for Dynasty Wagering content stored in R2.
// Supabase is used ONLY for verifying the admin's access token.

import { requireAdmin } from "../_adminAuth";

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
    throw new Error("R2 binding missing: expected env.admin_bucket (or env) to be an R2 bucket");
  }
  return b;
}

async function readR2Json(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) return null;
  const txt = await obj.text();
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function writeR2Json(bucket, key, data) {
  await bucket.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

function normalizePayload(input) {
  const payload = input && typeof input === "object" ? input : {};
  return {
    title: typeof payload.title === "string" ? payload.title : "Dynasty Wagering",
    intro: typeof payload.intro === "string" ? payload.intro : "",
    tiers: Array.isArray(payload.tiers)
      ? payload.tiers.map((t) => ({
          label: typeof t?.label === "string" ? t.label : "",
          text: typeof t?.text === "string" ? t.text : "",
          amount: typeof t?.amount === "string" || typeof t?.amount === "number" ? t.amount : "",
        }))
      : [],
    notes: Array.isArray(payload.notes) ? payload.notes.map(String) : [],
  };
}

export async function onRequest({ request, env }) {
  try {
    const { ok, error } = await requireAdmin(request, env);
    if (!ok) return json({ ok: false, error }, 401);

    const url = new URL(request.url);
    const season = url.searchParams.get("season") || "";
    const year = season && /^\d{4}$/.test(season) ? season : "";
    if (!year) return json({ ok: false, error: "Missing/invalid season" }, 400);

    const bucket = ensureR2(env);
    const key = `data/dynasty/wagering_${year}.json`;

    if (request.method === "GET") {
      const payload = (await readR2Json(bucket, key)) || normalizePayload({});
      return json({ ok: true, season: year, payload });
    }

    if (request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const payload = normalizePayload(body?.payload);
      await writeR2Json(bucket, key, payload);
      return json({ ok: true, season: year });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
}
