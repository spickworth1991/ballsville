import { CURRENT_SEASON } from "@/lib/season";
import { requireAdminSession } from "../../_lib/adminAuth.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
const text = (value) => String(value || "").trim();
const number = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const bucketFor = (env) => env.admin_bucket || env.ADMIN_BUCKET;

async function requireAdmin(context) {
  return requireAdminSession(context.request, context.env);
}

function clean(data, season) {
  const teams = (Array.isArray(data?.teams) ? data.teams : [])
    .map((team, index) => ({
      rosterId: text(team?.rosterId),
      username: text(team?.username),
      teamName: text(team?.teamName),
      avatar: text(team?.avatar),
      side: text(team?.side).toLowerCase() === "south" ? "south" : "north",
      color: Math.max(0, Math.min(5, number(team?.color, index % 6))),
    }))
    .filter((team) => team.rosterId);
  const weeks = (Array.isArray(data?.weeks) ? data.weeks : [])
    .map((week) => ({
      week: Math.max(1, Math.min(18, number(week?.week, 1))),
      label: text(week?.label),
      completed: Boolean(week?.completed),
      matchups: (Array.isArray(week?.matchups) ? week.matchups : [])
        .map((pair, index) => ({
          id: text(pair?.id) || `w${number(week?.week, 1)}-${index + 1}`,
          teamA: { rosterId: text(pair?.teamA?.rosterId) },
          teamB: text(pair?.teamB?.rosterId)
            ? { rosterId: text(pair.teamB.rosterId) }
            : null,
          battleType: text(pair?.battleType).toLowerCase() === "war" ? "war" : "attack",
          result: pair?.result
            ? {
                winnerRosterId: text(pair.result.winnerRosterId),
                teamAScore: number(pair.result.teamAScore),
                teamBScore: number(pair.result.teamBScore),
                resolvedAt: text(pair.result.resolvedAt),
              }
            : null,
        }))
        .filter((pair) => pair.teamA.rosterId),
    }))
    .sort((a, b) => a.week - b.week);
  return {
    season: number(season, CURRENT_SEASON),
    title: text(data?.title) || "The Brass Balls",
    intro: text(data?.intro),
    leagueId: text(data?.leagueId),
    currentWeek: Math.max(1, Math.min(18, number(data?.currentWeek, 1))),
    heroImageUrl: text(data?.heroImageUrl),
    secondaryImageUrl: text(data?.secondaryImageUrl),
    actualBoardImageUrl: text(data?.actualBoardImageUrl),
    youtubeId: text(data?.youtubeId),
    teams,
    updatedAt: new Date().toISOString(),
    weeks,
  };
}

export async function onRequest(context) {
  const gate = await requireAdmin(context);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  const bucket = bucketFor(context.env);
  if (!bucket?.get || !bucket?.put)
    return json({ error: "Missing R2 admin bucket binding." }, 500);
  const url = new URL(context.request.url),
    season = number(url.searchParams.get("season"), CURRENT_SEASON),
    key = `data/brass-balls/season_${season}.json`;
  if (context.request.method === "GET") {
    const object = await bucket.get(key);
    if (!object) return json({ error: "Brass Balls season not found." }, 404);
    return json({ ok: true, key, data: JSON.parse(await object.text()) });
  }
  if (context.request.method === "PUT") {
    const data = clean(await context.request.json(), season);
    await bucket.put(key, JSON.stringify(data, null, 2), {
      httpMetadata: {
        contentType: "application/json; charset=utf-8",
        cacheControl: "no-store",
      },
    });
    await bucket.put(
      `data/manifests/brass-balls_${season}.json`,
      JSON.stringify(
        { section: "brass-balls", season, updatedAt: data.updatedAt },
        null,
        2,
      ),
      { httpMetadata: { contentType: "application/json; charset=utf-8" } },
    );
    return json({ ok: true, key, data });
  }
  return json({ error: "Method not allowed." }, 405);
}
