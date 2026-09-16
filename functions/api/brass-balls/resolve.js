import { CURRENT_SEASON } from "../../../lib/season.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const text = (value) => String(value || "").trim();
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function bestBallTotal(matchup, players) {
  const pool = Object.entries(matchup?.players_points || {})
    .map(([id, score]) => ({
      position: text(players?.[id]?.position || players?.[id]?.fantasy_positions?.[0]).toUpperCase(),
      points: num(score),
    }))
    .filter((player) => ["QB", "RB", "WR", "TE"].includes(player.position));
  const remaining = [...pool];
  let total = 0;
  const take = (count, positions) => {
    for (let index = 0; index < count; index += 1) {
      const choices = remaining
        .filter((player) => positions.includes(player.position))
        .sort((a, b) => b.points - a.points);
      if (!choices.length) break;
      total += choices[0].points;
      remaining.splice(remaining.indexOf(choices[0]), 1);
    }
  };
  take(1, ["QB"]);
  take(2, ["RB"]);
  take(3, ["WR"]);
  take(1, ["TE"]);
  take(2, ["RB", "WR", "TE"]);
  take(1, ["QB", "RB", "WR", "TE"]);
  return Number(total.toFixed(2));
}

function easternWeekday(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(date);
}

async function handle({ request, env }) {
  const url = new URL(request.url);
  const configuredSecret = text(env.BRASS_BALLS_CRON_SECRET);
  const suppliedSecret = text(
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      url.searchParams.get("secret"),
  );
  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return json({ ok: false, error: "Unauthorized cron request." }, 401);
  }

  const force = url.searchParams.get("force") === "1";
  if (!force && easternWeekday() !== "Tue") {
    return json({ ok: true, resolved: false, skipped: true, reason: "not_tuesday" });
  }

  const bucket = env.admin_bucket || env.ADMIN_BUCKET;
  if (!bucket?.get || !bucket?.put) return json({ ok: false, error: "Missing R2 admin bucket." }, 500);

  const season = Math.trunc(num(url.searchParams.get("season"), CURRENT_SEASON));
  const key = `data/brass-balls/season_${season}.json`;
  const object = await bucket.get(key);
  if (!object) return json({ ok: false, error: `No Brass Balls data found for ${season}.` }, 404);
  const doc = JSON.parse(await object.text());
  if (!doc.leagueId) return json({ ok: false, error: "The Brass Balls league ID is missing." }, 400);

  const nflState = await fetch("https://api.sleeper.app/v1/state/nfl").then((response) => {
    if (!response.ok) throw new Error(`Sleeper NFL state returned ${response.status}.`);
    return response.json();
  });
  const requestedWeek = Math.trunc(num(url.searchParams.get("week"), 0));
  const currentLeg = Math.trunc(num(nflState?.leg, doc.currentWeek));
  const unresolved = (doc.weeks || [])
    .filter((week) => !week.completed && num(week.week) <= currentLeg)
    .sort((a, b) => num(b.week) - num(a.week));
  const target = requestedWeek
    ? (doc.weeks || []).find((week) => num(week.week) === requestedWeek)
    : unresolved[0];
  if (!target) {
    return json({ ok: true, resolved: false, skipped: true, reason: "no_unresolved_week", currentLeg });
  }

  const leagueId = encodeURIComponent(doc.leagueId);
  const [matchups, players] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${target.week}`).then((response) => {
      if (!response.ok) throw new Error(`Sleeper matchups returned ${response.status}.`);
      return response.json();
    }),
    fetch("https://api.sleeper.app/v1/players/nfl").then((response) => {
      if (!response.ok) throw new Error(`Sleeper players returned ${response.status}.`);
      return response.json();
    }),
  ]);
  const byRoster = new Map(matchups.map((row) => [String(row.roster_id), row]));
  const resolvedAt = new Date().toISOString();
  target.matchups = (target.matchups || []).map((pair) => {
    const teamA = text(pair?.teamA?.rosterId);
    const teamB = text(pair?.teamB?.rosterId);
    if (!teamA || !teamB) return { ...pair, result: null };
    const teamAScore = bestBallTotal(byRoster.get(teamA), players);
    const teamBScore = bestBallTotal(byRoster.get(teamB), players);
    return {
      ...pair,
      result: {
        winnerRosterId: teamAScore === teamBScore ? "" : teamAScore > teamBScore ? teamA : teamB,
        teamAScore,
        teamBScore,
        resolvedAt,
      },
    };
  });
  target.completed = true;
  doc.updatedAt = resolvedAt;

  await bucket.put(key, JSON.stringify(doc, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
  });
  await bucket.put(
    `data/manifests/brass-balls_${season}.json`,
    JSON.stringify({ section: "brass-balls", season, updatedAt: resolvedAt, resolvedWeek: target.week }, null, 2),
    { httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" } },
  );

  return json({
    ok: true,
    resolved: true,
    season,
    week: target.week,
    matchups: target.matchups.length,
    resolvedAt,
  });
}

export async function onRequestGet(context) {
  try {
    return await handle(context);
  } catch (error) {
    return json({ ok: false, resolved: false, error: error?.message || "Resolution failed." }, 500);
  }
}

export const onRequestPost = onRequestGet;
