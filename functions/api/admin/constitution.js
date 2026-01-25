// /api/admin/constitution
// Read/Write the MAIN constitution content stored in R2.

const SECTION = "constitution";
const CONTENT_KEY = "content/constitution/main.json";

function json(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

async function readJsonFromR2(env, key) {
  const obj = await env.R2.get(key);
  if (!obj) return null;
  const text = await obj.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function writeJsonToR2(env, key, data) {
  const body = JSON.stringify(data, null, 2);
  await env.R2.put(key, body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function touchManifest(env) {
  const key = `data/manifests/${SECTION}.json`;
  const data = {
    section: SECTION,
    version: Date.now(),
    updatedAt: nowIso(),
  };
  await writeJsonToR2(env, key, data);
  return data;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env?.R2) {
    return json({ ok: false, error: "Missing R2 binding" }, { status: 500 });
  }

  if (request.method === "GET") {
    const data = await readJsonFromR2(env, CONTENT_KEY);
    return json({ ok: true, data });
  }

  if (request.method === "PUT") {
    let payload;
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }

    const sections = Array.isArray(payload?.sections) ? payload.sections : [];

    const cleaned = sections
      .map((s, i) => {
        const id = String(s?.id || "").trim();
        const title = String(s?.title || "").trim();
        const order = Number.isFinite(Number(s?.order)) ? Number(s.order) : i + 1;
        const bodyHtml = String(s?.bodyHtml || "").trim();
        return { id, title, order, bodyHtml };
      })
      .filter((s) => s.id && s.title);

    cleaned.sort((a, b) => a.order - b.order);

    const out = {
      updatedAt: nowIso(),
      sections: cleaned.map((s, idx) => ({ ...s, order: idx + 1 })),
    };

    await writeJsonToR2(env, CONTENT_KEY, out);
    const manifest = await touchManifest(env);

    return json({ ok: true, manifest, data: out });
  }

  return json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}
