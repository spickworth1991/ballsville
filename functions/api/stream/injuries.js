import { readStreamSession, streamJson } from "../../_lib/streamAuth.js";

const KEY = "data/stream/injuries.json";
const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);
const SEVERITY = { IR: 0, OUT: 1, PUP: 2, DOUBTFUL: 3, QUESTIONABLE: 4 };
const TEAM_ALIASES = { JAC: "JAX", WSH: "WAS", LA: "LAR" };

function bucketFor(env) {
  return env.ADMIN_BUCKET || env.admin_bucket;
}

async function authorize(request, env) {
  return await readStreamSession(request, env) || null;
}

function cleanText(value) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTeam(value) {
  const team = String(value || "").trim().toUpperCase();
  return TEAM_ALIASES[team] || team;
}

function absoluteFantasyPros(value) {
  try { return new URL(String(value || ""), "https://www.fantasypros.com").toString(); } catch { return ""; }
}

function normalizeNews(item) {
  return {
    id: String(item?.id || ""),
    fantasyProsPlayerId: String(item?.player_id || ""),
    title: cleanText(item?.title),
    summary: cleanText(item?.impact || item?.desc || item?.description),
    link: absoluteFantasyPros(item?.link),
    published: cleanText(item?.created || item?.created_formated),
    category: Array.isArray(item?.categories) ? item.categories.map(cleanText).filter(Boolean).join(" · ") : "Player news",
    source: "FantasyPros",
  };
}

function articleMatchesPlayer(article, playerName) {
  const needle = normalizeName(playerName);
  const haystack = normalizeName(`${article?.title || ""} ${article?.summary || ""}`);
  if (!needle || !haystack) return false;
  if (haystack.includes(needle)) return true;
  const parts = needle.split(" ");
  return parts.length > 1 && haystack.includes(parts[0]) && haystack.includes(parts.at(-1));
}

function normalizedStatus(value) {
  const status = cleanText(value);
  if (/^injured reserve$/i.test(status)) return "IR";
  if (/physically unable/i.test(status)) return "PUP";
  return status;
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}.`);
  return response.json();
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

  let database;
  let nflState = {};
  try {
    [database, nflState] = await Promise.all([
      fetchJson("https://api.sleeper.app/v1/players/nfl", { "user-agent": "BallsvilleStream/1.0" }),
      fetchJson("https://api.sleeper.app/v1/state/nfl", { "user-agent": "BallsvilleStream/1.0" }).catch(() => ({})),
    ]);
  } catch (error) {
    return streamJson({ error: `Sleeper player refresh failed: ${error.message}` }, 502);
  }

  const season = Number(nflState?.season) || new Date().getUTCFullYear();
  const week = Number(nflState?.week) || null;
  const fantasyProsKey = String(env.FANTASYPROS_API_KEY || "").trim();
  let fantasyProsInjuries = [];
  let fantasyProsNews = [];
  let fantasyProsError = "";

  if (fantasyProsKey) {
    const headers = { "x-api-key": fantasyProsKey, accept: "application/json" };
    const injuryParams = new URLSearchParams({ year: String(season), include_probabilities: "true" });
    if (week) injuryParams.set("week", String(week));
    try {
      const injuries = await fetchJson(`https://api.fantasypros.com/public/v2/json/nfl/injuries?${injuryParams}`, headers);
      fantasyProsInjuries = Array.isArray(injuries?.injuries) ? injuries.injuries : [];
      const news = await fetchJson("https://api.fantasypros.com/public/v2/json/nfl/news?limit=100", headers);
      fantasyProsNews = Array.isArray(news?.items) ? news.items : Array.isArray(news?.news) ? news.news : [];
    } catch (error) {
      fantasyProsError = error?.message || "FantasyPros refresh failed.";
    }
  } else {
    fantasyProsError = "FANTASYPROS_API_KEY is not configured.";
  }

  const fantasyProsByName = new Map();
  for (const injury of fantasyProsInjuries) {
    const key = normalizeName(injury?.name || injury?.player_name);
    if (!key) continue;
    const list = fantasyProsByName.get(key) || [];
    list.push(injury);
    fantasyProsByName.set(key, list);
  }

  const newsByFantasyProsId = new Map();
  const normalizedNews = [];
  for (const item of fantasyProsNews) {
    const playerId = String(item?.player_id || "");
    const article = normalizeNews(item);
    if (!article.title || !article.link) continue;
    normalizedNews.push(article);
    if (!playerId) continue;
    const list = newsByFantasyProsId.get(playerId) || [];
    list.push(article);
    newsByFantasyProsId.set(playerId, list);
  }

  const players = Object.entries(database || {})
    .map(([id, player]) => {
      const name = player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ") || id;
      const team = normalizeTeam(player.team || "FA") || "FA";
      const matches = fantasyProsByName.get(normalizeName(name)) || [];
      const fantasyPros = matches.find((item) => normalizeTeam(item?.team_id || item?.team) === team) || matches[0] || null;
      const fantasyProsId = String(fantasyPros?.player_id || "");
      const irWeeks = Array.isArray(fantasyPros?.ir_weeks)
        ? [...new Set(fantasyPros.ir_weeks.map(Number).filter(Number.isFinite))].sort((a, b) => a - b)
        : [];
      const directNews = newsByFantasyProsId.get(fantasyProsId) || [];
      const playerNews = directNews.length ? directNews : normalizedNews.filter((article) => articleMatchesPlayer(article, name));
      return {
        id,
        name,
        team,
        position: player.position || player.fantasy_positions?.[0] || "",
        status: normalizedStatus(fantasyPros?.status || player.injury_status || player.status),
        sleeperStatus: cleanText(player.injury_status || player.status),
        statusShort: cleanText(fantasyPros?.status_short),
        bodyPart: cleanText(fantasyPros?.practice_report_injury_type || fantasyPros?.injury_type || player.injury_body_part),
        notes: cleanText(fantasyPros?.comment || player.injury_notes),
        practiceParticipation: cleanText(player.practice_participation),
        practiceDescription: cleanText(player.practice_description),
        practice: [fantasyPros?.practice_1, fantasyPros?.practice_2, fantasyPros?.practice_3].map(cleanText).filter(Boolean),
        probabilityOfPlaying: fantasyPros?.probability_of_playing == null || fantasyPros?.probability_of_playing === "" ? null : Number(fantasyPros.probability_of_playing),
        injuryUpdatedAt: cleanText(fantasyPros?.injury_update_date),
        irWeeks,
        fantasyProsId: fantasyProsId || null,
        news: playerNews.slice(0, 10),
        searchName: player.search_full_name || "",
      };
    })
    .filter((player) => POSITIONS.has(player.position) && (player.status || player.notes || player.bodyPart || player.irWeeks.length))
    .filter((player) => !["Active", "Inactive"].includes(player.status) || player.notes || player.bodyPart || player.irWeeks.length)
    .sort((a, b) => (SEVERITY[String(a.status).toUpperCase()] ?? 20) - (SEVERITY[String(b.status).toUpperCase()] ?? 20) || a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  const payload = {
    updatedAt: new Date().toISOString(),
    updatedBy: user.name,
    source: fantasyProsError ? "Sleeper" : "Sleeper + FantasyPros",
    season,
    week,
    fantasyProsConfigured: Boolean(fantasyProsKey),
    fantasyProsError: fantasyProsError || null,
    fantasyProsInjuryCount: fantasyProsInjuries.length,
    fantasyProsNewsCount: fantasyProsNews.length,
    players,
  };
  await bucket.put(KEY, JSON.stringify(payload), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  return streamJson({ ok: true, ...payload });
}
