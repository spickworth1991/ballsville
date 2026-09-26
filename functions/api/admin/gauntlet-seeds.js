const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

function config(env) {
  const url = String(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("Gauntlet seed storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return { url, key };
}

function tableFor(year) {
  const value = Number(year);
  if (!Number.isInteger(value) || value < 2020 || value > 2100) throw new Error("Invalid season.");
  return `gauntlet_seeds_${value}`;
}

async function supabase(env, path, init = {}) {
  const { url, key } = config(env);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || error?.hint || `Supabase returned ${response.status}.`);
  }
  return response;
}

function seedValue(value) {
  if (value == null || value === "") return null;
  const seed = Number(value);
  return Number.isFinite(seed) ? Math.max(1, Math.trunc(seed)) : null;
}

function cleanRow(row, year) {
  const text = (value, max = 180) => String(value ?? "").trim().slice(0, max);
  return {
    year,
    division: text(row?.division, 80),
    god: text(row?.god, 120),
    god_name: text(row?.god_name, 120),
    side: text(row?.side, 40),
    league_id: text(row?.league_id, 80),
    league_name: text(row?.league_name, 180) || null,
    owner_id: text(row?.owner_id, 100) || null,
    owner_name: text(row?.owner_name, 180) || "TBD",
    seed: seedValue(row?.seed),
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const year = Number(new URL(request.url).searchParams.get("year"));
    const table = tableFor(year);
    const query = new URLSearchParams({
      select: "id,year,division,god_name,god,side,league_id,league_name,owner_id,owner_name,seed",
      year: `eq.${year}`,
      order: "division.asc,god_name.asc,side.asc,seed.asc",
    });
    const response = await supabase(env, `${table}?${query}`);
    return json({ rows: await response.json() });
  } catch (error) {
    return json({ error: error?.message || "Failed to load seeds." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const year = Number(body?.year);
    const table = tableFor(year);
    if (body?.action === "save") {
      const updates = Array.isArray(body.updates) ? body.updates.slice(0, 24) : [];
      const inserts = Array.isArray(body.inserts) ? body.inserts.slice(0, 24).map((row) => cleanRow(row, year)) : [];
      for (const update of updates) {
        const id = String(update?.id || "").trim();
        if (!id || id.length > 128) throw new Error("Invalid seed row ID.");
        const values = { seed: seedValue(update.seed) };
        if (update.owner_name != null) values.owner_name = String(update.owner_name).trim().slice(0, 180) || "TBD";
        await supabase(env, `${table}?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(values),
        });
      }
      if (inserts.length) {
        await supabase(env, table, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(inserts) });
      }
      return json({ ok: true });
    }
    if (body?.action === "upsert") {
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 24).map((row) => cleanRow(row, year)) : [];
      if (!rows.length) return json({ error: "No seed rows were supplied." }, 400);
      await supabase(env, `${table}?on_conflict=year%2Cleague_id%2Cowner_id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
      return json({ ok: true });
    }
    return json({ error: "Unsupported seed operation." }, 400);
  } catch (error) {
    return json({ error: error?.message || "Failed to save seeds." }, 500);
  }
}
