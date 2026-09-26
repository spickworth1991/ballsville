import { readStreamSession, streamJson } from "../../_lib/streamAuth.js";

const KEY = "data/stream/injuries.json";
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);
const SEVERITY = { IR: 0, OUT: 1, PUP: 2, DOUBTFUL: 3, QUESTIONABLE: 4 };

function bucketFor(env) {
  return env.ADMIN_BUCKET || env.admin_bucket;
}

async function authorize(request, env) {
  const user = await readStreamSession(request, env);
  return user || null;
}

export async function onRequestGet({ request, env }) {
  if (!await authorize(request, env)) return streamJson({ error: "Unauthorized" }, 401);
  const bucket = bucketFor(env);
  if (!bucket?.get) return streamJson({ error: "Existing R2 admin bucket binding is unavailable." }, 500);
  const object = await bucket.get(KEY);
  if (!object) return streamJson({ updatedAt: null, players: [] });
  return new Response(object.body, {
    headers: { "content-type": object.httpMetadata?.contentType || "application/json", "cache-control": "no-store" },
  });
}

export async function onRequestPost({ request, env }) {
  const user = await authorize(request, env);
  if (!user) return streamJson({ error: "Unauthorized" }, 401);
  const bucket = bucketFor(env);
  if (!bucket?.put) return streamJson({ error: "Existing R2 admin bucket binding is unavailable." }, 500);

  const response = await fetch("https://api.sleeper.app/v1/players/nfl", { headers: { "user-agent": "BallsvilleStream/1.0" } });
  if (!response.ok) return streamJson({ error: `Sleeper player refresh failed (${response.status}).` }, 502);
  const database = await response.json();
  const players = Object.entries(database || {})
    .map(([id, player]) => ({
      id,
      name: player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ") || id,
      team: player.team || "FA",
      position: player.position || player.fantasy_positions?.[0] || "",
      status: player.injury_status || player.status || "",
      bodyPart: player.injury_body_part || "",
      notes: player.injury_notes || "",
      practiceParticipation: player.practice_participation || "",
      practiceDescription: player.practice_description || "",
      searchName: player.search_full_name || "",
    }))
    .filter((player) => POSITIONS.has(player.position) && (player.status || player.notes || player.bodyPart))
    .filter((player) => !["Active", "Inactive"].includes(player.status) || player.notes || player.bodyPart)
    .sort((a, b) => (SEVERITY[String(a.status).toUpperCase()] ?? 20) - (SEVERITY[String(b.status).toUpperCase()] ?? 20) || a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  const payload = { updatedAt: new Date().toISOString(), updatedBy: user.name, source: "Sleeper", players };
  await bucket.put(KEY, JSON.stringify(payload), { httpMetadata: { contentType: "application/json" } });
  return streamJson({ ok: true, ...payload });
}

