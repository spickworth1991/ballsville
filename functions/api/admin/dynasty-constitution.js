import { requireAdminSession } from "../../_lib/adminAuth.js";

const SECTION = "dynasty-constitution";

function jsonResponse(obj, init = {}) {
  const headers = { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) };
  return new Response(JSON.stringify(obj), { ...init, headers });
}

function ensureR2(env) {
  const b = env.admin_bucket || env.ADMIN_BUCKET;
  if (!b) return { ok: false, status: 500, error: "Missing R2 binding: admin_bucket" };
  if (typeof b.get !== "function" || typeof b.put !== "function") {
    return {
      ok: false,
      status: 500,
      error:
        "admin_bucket binding is not an R2 bucket object (check Pages > Settings > Bindings: admin_bucket).",
    };
  }
  return { ok: true, bucket: b };
}

async function requireAdmin(ctx) {
  return requireAdminSession(ctx.request, ctx.env);
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
  const bucket = r2.bucket;

  const key = `content/constitution/dynasty.json`;

  const data = await readJsonFromR2(bucket, key);
  return jsonResponse(
    {
      ok: true,
      key,
      data: data || {
        updatedAt: "",
        sections: [],
      },
    },
    { status: 200 }
  );
}

export async function onRequestPut(ctx) {
  const auth = await requireAdmin(ctx);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, { status: auth.status });

  const r2 = ensureR2(ctx.env);
  if (!r2.ok) return jsonResponse({ ok: false, error: r2.error }, { status: r2.status });
  const bucket = r2.bucket;

  const key = `content/constitution/dynasty.json`;

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
  await putJsonToR2(bucket, key, out);
  await touchManifest(bucket, version);

  return jsonResponse(
    { ok: true, key, version, updatedAt, count: sections.length },
    { status: 200 }
  );
}
