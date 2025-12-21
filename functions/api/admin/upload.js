// functions/api/admin/upload.js
//
// POST multipart/form-data:
// - file: <File> (required)
// - section:
//    "mini-leagues-updates"
//    "mini-leagues-winners"      (legacy single winner image)
//    "mini-leagues-winners-1"    (winner slot 1)
//    "mini-leagues-winners-2"    (winner slot 2)
//    "mini-leagues-division"
//    "mini-leagues-league"
//    "redraft-updates"
//    "redraft-league"
//    "dynasty-league"
// - season: "2025" (required for all sections in this endpoint)
// - divisionCode: "100" (required for mini-leagues-division and mini-leagues-league)
// - leagueOrder: "1" (required for mini-leagues-league and redraft-league)
// - leagueId: "<string>" (required for dynasty-league)
//
// Behavior:
// - Always writes to a deterministic R2 key for that section.
// - Re-upload replaces the existing image.
// - ALSO deletes other extensions at the same deterministic base key,
//   so there is only ever ONE image per section even if you upload a different file type later.

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

  if (!b) return { ok: false, status: 500, error: "Missing R2 binding: admin_bucket" };
  if (typeof b.get !== "function" || typeof b.put !== "function") {
    return {
      ok: false,
      status: 500,
      error: "admin_bucket binding is not an R2 bucket object (check Pages > Settings > Bindings: admin_bucket).",
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

function cleanNum(x) {
  const n = Number(String(x || "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function cleanId(x) {
  const s = String(x || "").trim();
  return /^[0-9]+$/.test(s) ? s : "";
}

function cleanLooseId(x) {
  // for dynasty league IDs (uuid-ish or any stable string)
  return String(x || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function extFromFile(file) {
  const t = String(file?.type || "").toLowerCase();
  if (t === "image/webp") return "webp";
  if (t === "image/png") return "png";
  if (t === "image/jpeg") return "jpg";
  if (t === "image/gif") return "gif";
  if (t === "image/avif") return "avif";

  const name = String(file?.name || "");
  const m = name.match(/\.([a-z0-9]+)$/i);
  const ext = (m?.[1] || "bin").toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "bin";
}

/**
 * Deterministic base key (NO extension) for each section.
 * We’ll delete all known image extensions for that base before putting the new one.
 */
function baseKeyForUpload({ section, season, divisionCode, leagueOrder, leagueId }) {
  // ============
  // MINI-LEAGUES
  // ============
  if (section === "mini-leagues-updates") return `media/mini-leagues/updates_${season}`;

  // legacy single slot (kept supported)
  if (section === "mini-leagues-winners") return `media/mini-leagues/winners_${season}`;
  if (section === "mini-leagues-winners-1") return `media/mini-leagues/winners_1_${season}`;
  if (section === "mini-leagues-winners-2") return `media/mini-leagues/winners_2_${season}`;

  if (section === "mini-leagues-division") return `media/mini-leagues/divisions/${season}/${divisionCode}`;
  if (section === "mini-leagues-league") return `media/mini-leagues/leagues/${season}/${divisionCode}/${leagueOrder}`;

  // =======
  // REDRAFT
  // =======
  if (section === "redraft-updates") return `media/redraft/updates_${season}`;
  if (section === "redraft-league") return `media/redraft/leagues/${season}/${leagueOrder}`;

  // =======
  // DYNASTY
  // =======
  if (section === "dynasty-league") return `media/dynasty/leagues/${season}/${leagueId}`;

  return "";
}

const IMAGE_EXTS_TO_CLEAN = ["webp", "png", "jpg", "gif", "avif"];

/**
 * Enforce: "only ever one photo for each section"
 * If the admin uploads a different file type later, we remove previous extensions first.
 */
async function deleteOtherExtVariants(bucket, baseKey) {
  const deletions = IMAGE_EXTS_TO_CLEAN.map((ext) => bucket.delete(`${baseKey}.${ext}`).catch(() => null));
  await Promise.all(deletions);
}

export async function onRequest(context) {
  try {
    const { request } = context;

    const r2 = ensureR2(context.env);
    if (!r2.ok) return json({ ok: false, error: r2.error }, r2.status);

    const gate = await requireAdmin(context);
    if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);

    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return json({ ok: false, error: "Missing file" }, 400);

    const section = String(form.get("section") || "").trim();
    const seasonNum = cleanNum(form.get("season"));
    const season = Number.isFinite(seasonNum) ? String(seasonNum) : "";

    const divisionCode = cleanId(form.get("divisionCode"));
    const leagueOrderNum = cleanNum(form.get("leagueOrder"));
    const leagueOrder = Number.isFinite(leagueOrderNum) ? String(leagueOrderNum) : "";

    const leagueId = cleanLooseId(form.get("leagueId"));

    if (!section) return json({ ok: false, error: "Missing section" }, 400);
    if (!season) return json({ ok: false, error: "Missing season" }, 400);

    // Validate required identifiers for section type
    if (section === "mini-leagues-division" && !divisionCode) {
      return json({ ok: false, error: "Missing divisionCode" }, 400);
    }
    if (section === "mini-leagues-league" && (!divisionCode || !leagueOrder)) {
      return json({ ok: false, error: "Missing divisionCode or leagueOrder" }, 400);
    }
    if (section === "redraft-league" && !leagueOrder) {
      return json({ ok: false, error: "Missing leagueOrder" }, 400);
    }
    if (section === "dynasty-league" && !leagueId) {
      return json({ ok: false, error: "Missing leagueId" }, 400);
    }

    const baseKey = baseKeyForUpload({ section, season, divisionCode, leagueOrder, leagueId });
    if (!baseKey) return json({ ok: false, error: "Invalid section" }, 400);

    const ext = extFromFile(file);
    const key = `${baseKey}.${ext}`;

    // ✅ enforce “only one image per section”
    await deleteOtherExtVariants(r2.bucket, baseKey);

    const buf = await file.arrayBuffer();

    await r2.bucket.put(key, buf, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    // cache-bust for immediate preview
    const url = `/r2/${key}?v=${Date.now()}`;

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
