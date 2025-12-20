// functions/api/public/mini-leagues.js
// Public read-only endpoint for Mini-Leagues page content.
//
// Expects an R2 bucket binding named ADMIN_BUCKET (Cloudflare Pages > Settings > Functions > R2 bindings).
// Stores JSON at: cms/mini-leagues.json

import { miniLeaguesDefault, normalizeMiniLeaguesPayload } from "../../../app/mini-leagues/content";

const KEY = "cms/mini-leagues.json";

export async function onRequestGet({ env }) {
  try {
    const bucket = env.ADMIN_BUCKET;
    if (!bucket) {
      return json({ ok: false, error: "Missing ADMIN_BUCKET binding" }, 500);
    }

    const obj = await bucket.get(KEY);
    if (!obj) {
      return json({ ok: true, data: normalizeMiniLeaguesPayload(miniLeaguesDefault) }, 200);
    }

    const text = await obj.text();
    const parsed = JSON.parse(text);
    const merged = normalizeMiniLeaguesPayload(parsed);

    return json({ ok: true, data: merged }, 200);
  } catch (e) {
    return json({ ok: true, data: normalizeMiniLeaguesPayload(miniLeaguesDefault), warning: "fallback" }, 200);
  }
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
