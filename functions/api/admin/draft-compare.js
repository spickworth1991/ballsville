// functions/api/admin/draft-compare.js
//
// R2-backed JSON storage for Draft Compare.
//
// Endpoints:
// - GET  /api/admin/draft-compare?season=2025&type=modes|page|drafts&modeSlug=<slug>
// - POST /api/admin/draft-compare
//     - { season, type:"modes", rows:[...] }
//     - { season, type:"page",  data:{ hero:{...} } }
//     - { season, type:"drafts", modeSlug:"...", data:<any json> }
//
// Stored keys (deterministic):
// - data/draft-compare/modes_<season>.json
// - content/draft-compare/page_<season>.json
// - data/draft-compare/drafts_<season>_<modeSlug>.json

import { CURRENT_SEASON } from "@/lib/season";

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
  const b = env.admin_bucket || env.ADMIN_BUCKET;
  if (!b) throw new Error("Missing R2 binding: env.admin_bucket (or ADMIN_BUCKET)");
  return b;
}

async function touchManifest(env, section, season) {
  try {
    const r2 = ensureR2(env);
    const key = season ? `data/manifests/${section}_${season}.json` : `data/manifests/${section}.json`;
    const body = JSON.stringify(
      {
        section,
        season: season || null,
        updatedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
      },
      null,
      2
    );
    await r2.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  } catch {
    // non-fatal
  }
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function cleanSlug(v) {
  return safeStr(v)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function seasonOrDefault(season) {
  const s = safeStr(season).trim();
  const n = Number(s || CURRENT_SEASON);
  return Number.isFinite(n) ? n : CURRENT_SEASON;
}

function modesKey(season) {
  const y = seasonOrDefault(season);
  return `data/draft-compare/modes_${y}.json`;
}

function pageKey(season) {
  const y = seasonOrDefault(season);
  return `content/draft-compare/page_${y}.json`;
}

function draftsKey(season, modeSlug) {
  const y = seasonOrDefault(season);
  const slug = cleanSlug(modeSlug);
  return slug ? `data/draft-compare/drafts_${y}_${slug}.json` : "";
}

function sanitizePageInput(data, season) {
  const hero = data?.hero || {};
  return {
    season: seasonOrDefault(season),
    hero: {
      title: safeStr(hero.title || "Draft Compare"),
      subtitle: safeStr(hero.subtitle || "Pick leagues to compare and view ADP + a draftboard."),
      promoImageKey: safeStr(hero.promoImageKey || ""),
      promoImageUrl: safeStr(hero.promoImageUrl || ""),
    },
  };
}

async function readJSON(env, key) {
  if (!key) return null;
  const r2 = ensureR2(env);
  const obj = await r2.get(key);
  if (!obj) return null;
  const text = await obj.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeJSON(env, key, payload) {
  if (!key) throw new Error("Missing key");
  const r2 = ensureR2(env);
  const body = JSON.stringify(payload, null, 2);
  await r2.put(key, body, { httpMetadata: { contentType: "application/json; charset=utf-8" } });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const season = seasonOrDefault(url.searchParams.get("season"));
  const type = safeStr(url.searchParams.get("type") || "modes").toLowerCase();
  const modeSlug = cleanSlug(url.searchParams.get("modeSlug"));

  try {
    if (request.method === "GET") {
      if (type === "page") {
        const existing = await readJSON(env, pageKey(season));
        return json(sanitizePageInput(existing || {}, season));
      }

      if (type === "drafts") {
        if (!modeSlug) return json({ error: "Missing modeSlug" }, 400);
        const existing = await readJSON(env, draftsKey(season, modeSlug));
        if (!existing) return json({ season, modeSlug, data: null });
        return json({ season, modeSlug, data: existing });
      }

      // modes
      const existing = await readJSON(env, modesKey(season));
      const rows = Array.isArray(existing?.rows) ? existing.rows : Array.isArray(existing) ? existing : [];
      return json({ season, rows });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const s = seasonOrDefault(body?.season ?? season);
      const bodyType = safeStr(body?.type || type || "modes").toLowerCase();
      const now = new Date().toISOString();

      if (bodyType === "page") {
        const payload = sanitizePageInput(body?.data || body, s);
        await writeJSON(env, pageKey(s), payload);
        await touchManifest(env, "draft-compare", s);
        await touchManifest(env, "draft-compare", null);
        return json({ ok: true, season: s, key: pageKey(s), type: "page", updated_at: now });
      }

      if (bodyType === "drafts") {
        const slug = cleanSlug(body?.modeSlug || modeSlug);
        if (!slug) return json({ error: "Missing modeSlug" }, 400);
        const payload = body?.data ?? body?.payload ?? body?.json ?? null;
        if (!payload) return json({ error: "Missing data" }, 400);
        await writeJSON(env, draftsKey(s, slug), payload);
        await touchManifest(env, "draft-compare", s);
        await touchManifest(env, "draft-compare", null);
        return json({ ok: true, season: s, key: draftsKey(s, slug), type: "drafts", modeSlug: slug, updated_at: now });
      }

      // modes
      const rows = Array.isArray(body?.rows)
        ? body.rows
        : Array.isArray(body?.data?.rows)
          ? body.data.rows
          : Array.isArray(body?.data)
            ? body.data
            : [];

      const payload = { season: s, updated_at: now, rows };
      await writeJSON(env, modesKey(s), payload);
      await touchManifest(env, "draft-compare", s);
      await touchManifest(env, "draft-compare", null);
      return json({ ok: true, season: s, key: modesKey(s), type: "modes", updated_at: now });
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (e) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}
