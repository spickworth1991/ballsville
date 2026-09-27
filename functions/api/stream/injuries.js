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

function isSpecificInjuryDetail(value) {
  return Boolean(value) && !/^(?:undisclosed|unknown|unspecified|not disclosed|n\/?a|none|other|-)$/i.test(value);
}

function selectInjuryDetail(candidates) {
  const cleaned = candidates.map((candidate) => ({ ...candidate, value: cleanText(candidate.value) })).filter((candidate) => candidate.value);
  return cleaned.find((candidate) => isSpecificInjuryDetail(candidate.value)) || cleaned[0] || { value: "", source: "" };
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

function makePlayerValueIndex(payload) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.players) ? payload.players : Array.isArray(payload?.data) ? payload.data : [];
  const byName = new Map();
  for (const row of rows) {
    if (String(row?._position || row?.position || "").toUpperCase() === "PICK") continue;
    const name = normalizeName(row?.player_full_name || row?.player_name || row?.name);
    const value = Number(row?.sf_value ?? row?.player_value ?? row?.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (name) byName.set(name, value);
  }
  return byName;
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

  let previous = null;
  try {
    const object = bucket.get ? await bucket.get(KEY) : null;
    previous = object ? await object.json() : null;
  } catch {
    previous = null;
  }

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

  const playerValues = { dynasty: new Map(), redraft: new Map() };
  const playerValueErrors = [];
  await Promise.all(["dynasty", "redraft"].map(async (rankType) => {
    try {
      const payload = await fetchJson(`https://fantasy-navigator-latest.onrender.com/trade_calculator?platform=sf&rank_type=${rankType}`);
      playerValues[rankType] = makePlayerValueIndex(payload);
    } catch (error) {
      playerValueErrors.push(`${rankType}: ${error?.message || "value refresh failed"}`);
    }
  }));

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

  const currentPlayers = Object.entries(database || {})
    .map(([id, player]) => {
      const name = player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ") || id;
      const team = normalizeTeam(player.team || "FA") || "FA";
      const matches = fantasyProsByName.get(normalizeName(name)) || [];
      const fantasyPros = matches.find((item) => normalizeTeam(item?.team_id || item?.team) === team) || matches[0] || null;
      const fantasyProsId = String(fantasyPros?.player_id || "");
      const injuryDetail = selectInjuryDetail([
        { value: fantasyPros?.practice_report_injury_type, source: "FantasyPros practice report" },
        { value: fantasyPros?.injury_type, source: "FantasyPros" },
        { value: player.injury_body_part, source: "Sleeper" },
      ]);
      const injuryNote = selectInjuryDetail([
        { value: fantasyPros?.comment, source: "FantasyPros" },
        { value: player.injury_notes, source: "Sleeper" },
      ]);
      const directNews = newsByFantasyProsId.get(fantasyProsId) || [];
      const playerNews = directNews.length ? directNews : normalizedNews.filter((article) => articleMatchesPlayer(article, name));
      const valueKey = normalizeName(name);
      return {
        id,
        name,
        team,
        position: player.position || player.fantasy_positions?.[0] || "",
        status: normalizedStatus(fantasyPros?.status || player.injury_status || player.status),
        sleeperStatus: cleanText(player.injury_status || player.status),
        statusShort: cleanText(fantasyPros?.status_short),
        bodyPart: injuryDetail.value,
        bodyPartSource: injuryDetail.source || null,
        injuryDetailsBySource: {
          fantasyPros: cleanText(fantasyPros?.practice_report_injury_type || fantasyPros?.injury_type),
          sleeper: cleanText(player.injury_body_part),
        },
        notes: injuryNote.value,
        notesSource: injuryNote.source || null,
        practiceParticipation: cleanText(player.practice_participation),
        practiceDescription: cleanText(player.practice_description),
        practice: [fantasyPros?.practice_1, fantasyPros?.practice_2, fantasyPros?.practice_3].map(cleanText).filter(Boolean),
        probabilityOfPlaying: fantasyPros?.probability_of_playing == null || fantasyPros?.probability_of_playing === "" ? null : Number(fantasyPros.probability_of_playing),
        injuryUpdatedAt: cleanText(fantasyPros?.injury_update_date),
        injuryStartDate: cleanText(player.injury_start_date),
        dynastyValue: playerValues.dynasty.get(valueKey) ?? null,
        redraftValue: playerValues.redraft.get(valueKey) ?? null,
        fantasyProsId: fantasyProsId || null,
        news: playerNews.slice(0, 10),
        searchName: player.search_full_name || "",
      };
    })
    .filter((player) => POSITIONS.has(player.position) && (player.status || player.notes || player.bodyPart))
    .filter((player) => !["Active", "Inactive"].includes(player.status) || player.notes || player.bodyPart)
    .sort((a, b) => (SEVERITY[String(a.status).toUpperCase()] ?? 20) - (SEVERITY[String(b.status).toUpperCase()] ?? 20) || a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  const updatedAt = new Date().toISOString();
  const previousUpdatedAt = cleanText(previous?.updatedAt) || updatedAt;
  const previousPlayers = new Map((Array.isArray(previous?.players) ? previous.players : []).map((player) => [String(player.id), player]));
  const players = currentPlayers.map((player) => {
    const prior = previousPlayers.get(String(player.id));
    return {
      ...player,
      reportState: prior ? "existing" : "added",
      trackedSince: cleanText(prior?.trackedSince) || (prior ? previousUpdatedAt : updatedAt),
      lastSeenAt: updatedAt,
      trackedRefreshes: Math.max(1, Number(prior?.trackedRefreshes || 0) + 1),
    };
  });

  const currentIds = new Set(players.map((player) => String(player.id)));
  const retainedRemoved = (Array.isArray(previous?.recentlyRemoved) ? previous.recentlyRemoved : []).filter((player) => {
    if (currentIds.has(String(player.id))) return false;
    const removedAt = Date.parse(player.removedAt || "");
    return Number.isFinite(removedAt) && Date.now() - removedAt <= 45 * 86400000;
  });
  const newlyRemoved = fantasyProsError ? [] : [...previousPlayers.values()]
    .filter((player) => !currentIds.has(String(player.id)))
    .map((player) => ({ ...player, reportState: "removed", removedAt: updatedAt, lastSeenAt: cleanText(player.lastSeenAt) || previousUpdatedAt }));
  const recentlyRemovedById = new Map(retainedRemoved.map((player) => [String(player.id), player]));
  for (const player of newlyRemoved) recentlyRemovedById.set(String(player.id), player);
  const recentlyRemoved = [...recentlyRemovedById.values()].sort((a, b) => Date.parse(b.removedAt || 0) - Date.parse(a.removedAt || 0));
  const addedCount = players.filter((player) => player.reportState === "added").length;

  const payload = {
    updatedAt,
    updatedBy: user.name,
    source: fantasyProsError ? "Sleeper" : "Sleeper + FantasyPros",
    season,
    week,
    fantasyProsConfigured: Boolean(fantasyProsKey),
    fantasyProsError: fantasyProsError || null,
    fantasyProsInjuryCount: fantasyProsInjuries.length,
    fantasyProsNewsCount: fantasyProsNews.length,
    playerValueSource: "Fantasy Navigator Superflex",
    playerValueError: playerValueErrors.length ? playerValueErrors.join("; ") : null,
    dynastyValueCount: playerValues.dynasty.size,
    redraftValueCount: playerValues.redraft.size,
    activity: { added: addedCount, removed: newlyRemoved.length, removalComparisonSkipped: Boolean(fantasyProsError) },
    players,
    recentlyRemoved,
  };
  await bucket.put(KEY, JSON.stringify(payload), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
  return streamJson({ ok: true, ...payload });
}
