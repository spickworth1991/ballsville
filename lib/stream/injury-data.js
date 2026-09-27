const POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);
const STATUS_RANK = { IR: 0, OUT: 0, PUP: 0, NFI: 0, SUSPENDED: 0, "COV-IR": 0, DOUBTFUL: 1, QUESTIONABLE: 2 };
const TEAM_ALIASES = { JAC: "JAX", WSH: "WAS", LA: "LAR" };
const DAY = 86_400_000;

const cleanText = (value) => String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const normalizeTeam = (value) => TEAM_ALIASES[String(value || "").trim().toUpperCase()] || String(value || "").trim().toUpperCase();
const normalizeName = (value) => cleanText(value).toLowerCase().normalize("NFKD").replace(/[’']/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const specific = (value) => Boolean(value) && !/^(?:undisclosed|unknown|unspecified|not disclosed|n\/?a|none|other|-)$/i.test(value);
const normalizeStatus = (value) => /^injured reserve$/i.test(cleanText(value)) ? "IR" : /physically unable/i.test(cleanText(value)) ? "PUP" : cleanText(value);
const probability = (value) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number <= 1 ? number * 100 : number)) : null;
};

function selectDetail(candidates) {
  const rows = candidates.map((candidate) => ({ ...candidate, value: cleanText(candidate.value) })).filter((candidate) => candidate.value);
  return rows.find((candidate) => specific(candidate.value)) || rows[0] || { value: "", source: "" };
}

function absoluteFantasyPros(value) {
  try { return new URL(String(value || ""), "https://www.fantasypros.com").toString(); } catch { return ""; }
}

function normalizeNews(item) {
  return {
    id: String(item?.id || ""), fantasyProsPlayerId: String(item?.player_id || ""), title: cleanText(item?.title),
    summary: cleanText(item?.impact || item?.desc || item?.description), link: absoluteFantasyPros(item?.link),
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

function valueIndex(payload) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.players) ? payload.players : Array.isArray(payload?.data) ? payload.data : [];
  const result = new Map();
  for (const row of rows) {
    if (String(row?._position || row?.position || "").toUpperCase() === "PICK") continue;
    const name = normalizeName(row?.player_full_name || row?.player_name || row?.name);
    const value = Number(row?.sf_value ?? row?.player_value ?? row?.value);
    if (name && Number.isFinite(value) && value > 0) result.set(name, value);
  }
  return result;
}

async function getJson(fetchImpl, url, headers = {}) {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}.`);
  return response.json();
}

function practiceText(player) {
  return [...(Array.isArray(player?.practice) ? player.practice : []), player?.practiceParticipation, player?.practiceDescription].filter(Boolean).join(" / ");
}

function practiceRank(value) {
  if (/DNP|DID NOT PARTICIPATE/i.test(value)) return 0;
  if (/LIMIT/i.test(value)) return 1;
  if (/FULL/i.test(value)) return 2;
  return null;
}

function playerChanges(previous, current) {
  if (!previous) return [];
  const changes = [];
  const add = (field, label, before, after, direction = "changed") => {
    if (cleanText(before) !== cleanText(after)) changes.push({ field, label, from: before ?? null, to: after ?? null, direction });
  };
  const beforeStatus = normalizeStatus(previous.status);
  const afterStatus = normalizeStatus(current.status);
  const beforeStatusRank = STATUS_RANK[beforeStatus.toUpperCase()] ?? 3;
  const afterStatusRank = STATUS_RANK[afterStatus.toUpperCase()] ?? 3;
  add("status", "Status", beforeStatus, afterStatus, afterStatusRank < beforeStatusRank ? "worsening" : afterStatusRank > beforeStatusRank ? "improving" : "changed");
  const beforePractice = practiceText(previous);
  const afterPractice = practiceText(current);
  const beforePracticeRank = practiceRank(beforePractice);
  const afterPracticeRank = practiceRank(afterPractice);
  add("practice", "Practice", beforePractice, afterPractice, beforePracticeRank != null && afterPracticeRank != null ? (afterPracticeRank < beforePracticeRank ? "worsening" : afterPracticeRank > beforePracticeRank ? "improving" : "changed") : "changed");
  add("injury", "Injury", previous.bodyPart, current.bodyPart);
  const beforeProbability = probability(previous.probabilityOfPlaying);
  const afterProbability = probability(current.probabilityOfPlaying);
  if (beforeProbability !== afterProbability) changes.push({ field: "probability", label: "Chance to play", from: beforeProbability, to: afterProbability, direction: beforeProbability != null && afterProbability != null ? (afterProbability < beforeProbability ? "worsening" : "improving") : "changed" });
  return changes;
}

function stats(rows) {
  const values = rows.map((row) => Number(row.observedDays)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return { sampleSize: 0, averageObservedDays: null, medianObservedDays: null, earlySample: true };
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return { sampleSize: values.length, averageObservedDays: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10, medianObservedDays: Math.round(median * 10) / 10, earlySample: values.length < 10 };
}

function groupedStats(episodes, field) {
  const groups = new Map();
  for (const episode of episodes) {
    const key = cleanText(episode[field]) || "Unknown";
    const rows = groups.get(key) || [];
    rows.push(episode); groups.set(key, rows);
  }
  return Object.fromEntries([...groups].map(([key, rows]) => [key, stats(rows)]));
}

function eventId(event) {
  return [event.season, event.playerId, event.episodeId, event.type, event.field || "", event.from ?? "", event.to ?? "", String(event.at || "").slice(0, 10)].map((value) => encodeURIComponent(String(value || ""))).join(":");
}

function calibrationSummary(events) {
  const settled = events.filter((event) => event.type === "probability_observed" && typeof event.played === "boolean" && Number.isFinite(Number(event.to)));
  const definitions = [[0, 25, "0–24%"], [25, 50, "25–49%"], [50, 75, "50–74%"], [75, 100, "75–99%"], [100, 101, "100%"]];
  const bands = definitions.map(([minimum, maximum, label]) => {
    const rows = settled.filter((event) => Number(event.to) >= minimum && Number(event.to) < maximum);
    return { label, sampleSize: rows.length, predictedAverage: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.to), 0) / rows.length * 10) / 10 : null, actualPlayedRate: rows.length ? Math.round(rows.filter((row) => row.played).length / rows.length * 1000) / 10 : null };
  });
  const brierScore = settled.length ? Math.round(settled.reduce((sum, row) => sum + ((Number(row.to) / 100) - (row.played ? 1 : 0)) ** 2, 0) / settled.length * 1000) / 1000 : null;
  return { settledPredictions: settled.length, available: settled.length >= 30, minimumRequired: 30, brierScore, bands };
}

export async function buildInjuryData({ previous = null, historyDocument = null, fantasyProsKey = "", updatedBy = "scheduled", now = new Date(), fetchImpl = fetch } = {}) {
  const updatedAt = now.toISOString();
  let database;
  let nflState = {};
  [database, nflState] = await Promise.all([
    getJson(fetchImpl, "https://api.sleeper.app/v1/players/nfl", { "user-agent": "BallsvilleStreamBuilder/2.0" }),
    getJson(fetchImpl, "https://api.sleeper.app/v1/state/nfl", { "user-agent": "BallsvilleStreamBuilder/2.0" }).catch(() => ({})),
  ]);
  const season = Number(nflState?.season) || now.getUTCFullYear();
  const week = Number(nflState?.week) || null;
  let fantasyProsInjuries = [];
  let fantasyProsNews = [];
  let fantasyProsError = "";
  if (fantasyProsKey) {
    try {
      const headers = { "x-api-key": fantasyProsKey, accept: "application/json" };
      const params = new URLSearchParams({ year: String(season), include_probabilities: "true" });
      if (week) params.set("week", String(week));
      const [injuries, news] = await Promise.all([
        getJson(fetchImpl, `https://api.fantasypros.com/public/v2/json/nfl/injuries?${params}`, headers),
        getJson(fetchImpl, "https://api.fantasypros.com/public/v2/json/nfl/news?limit=100", headers),
      ]);
      fantasyProsInjuries = Array.isArray(injuries?.injuries) ? injuries.injuries : [];
      fantasyProsNews = Array.isArray(news?.items) ? news.items : Array.isArray(news?.news) ? news.news : [];
    } catch (error) { fantasyProsError = error?.message || "FantasyPros refresh failed."; }
  } else fantasyProsError = "FANTASYPROS_API_KEY is not configured.";

  const values = { dynasty: new Map(), redraft: new Map() };
  const valueErrors = [];
  await Promise.all(["dynasty", "redraft"].map(async (rankType) => {
    try { values[rankType] = valueIndex(await getJson(fetchImpl, `https://fantasy-navigator-latest.onrender.com/trade_calculator?platform=sf&rank_type=${rankType}`)); }
    catch (error) { valueErrors.push(`${rankType}: ${error?.message || "value refresh failed"}`); }
  }));

  const previousPlayers = new Map((Array.isArray(previous?.players) ? previous.players : []).map((player) => [String(player.id), player]));
  const previousRemoved = new Map((Array.isArray(previous?.recentlyRemoved) ? previous.recentlyRemoved : []).map((player) => [String(player.id), player]));
  const fpByName = new Map();
  for (const injury of fantasyProsInjuries) {
    const key = normalizeName(injury?.name || injury?.player_name);
    if (!key) continue;
    const rows = fpByName.get(key) || []; rows.push(injury); fpByName.set(key, rows);
  }
  const newsById = new Map();
  const normalizedNews = [];
  for (const item of fantasyProsNews) {
    const article = normalizeNews(item);
    if (!article.title || !article.link) continue;
    normalizedNews.push(article);
    const id = String(item?.player_id || "");
    if (id) { const rows = newsById.get(id) || []; rows.push(article); newsById.set(id, rows); }
  }

  const currentPlayers = Object.entries(database || {}).map(([id, sleeper]) => {
    const prior = previousPlayers.get(String(id));
    const name = sleeper.full_name || [sleeper.first_name, sleeper.last_name].filter(Boolean).join(" ") || id;
    const team = normalizeTeam(sleeper.team || "FA") || "FA";
    const matches = fpByName.get(normalizeName(name)) || [];
    const fp = matches.find((item) => normalizeTeam(item?.team_id || item?.team) === team) || matches[0] || null;
    const fpId = String(fp?.player_id || prior?.fantasyProsId || "");
    const injuryDetail = selectDetail([
      { value: fp?.practice_report_injury_type, source: "FantasyPros practice report" },
      { value: fp?.injury_type, source: "FantasyPros" },
      { value: sleeper.injury_body_part, source: "Sleeper" },
      ...(fantasyProsError ? [{ value: prior?.bodyPart, source: prior?.bodyPartSource || "Previous snapshot" }] : []),
    ]);
    const injuryNote = selectDetail([{ value: fp?.comment, source: "FantasyPros" }, { value: sleeper.injury_notes, source: "Sleeper" }, ...(fantasyProsError ? [{ value: prior?.notes, source: prior?.notesSource || "Previous snapshot" }] : [])]);
    const fpNews = newsById.get(fpId) || normalizedNews.filter((article) => articleMatchesPlayer(article, name));
    const fpDetail = cleanText(fp?.practice_report_injury_type || fp?.injury_type);
    const sleeperDetail = cleanText(sleeper.injury_body_part);
    const valueKey = normalizeName(name);
    const current = {
      id: String(id), name, team, position: sleeper.position || sleeper.fantasy_positions?.[0] || "",
      status: normalizeStatus(fp?.status || sleeper.injury_status || sleeper.status), sleeperStatus: cleanText(sleeper.injury_status || sleeper.status), statusShort: cleanText(fp?.status_short),
      bodyPart: injuryDetail.value, bodyPartSource: injuryDetail.source || null,
      injuryDetailsBySource: { fantasyPros: fpDetail || (fantasyProsError ? prior?.injuryDetailsBySource?.fantasyPros || "" : ""), sleeper: sleeperDetail },
      sourceConflict: Boolean(specific(fpDetail) && specific(sleeperDetail) && normalizeName(fpDetail) !== normalizeName(sleeperDetail)),
      notes: injuryNote.value, notesSource: injuryNote.source || null,
      practiceParticipation: cleanText(sleeper.practice_participation), practiceDescription: cleanText(sleeper.practice_description),
      practice: fp ? [fp.practice_1, fp.practice_2, fp.practice_3].map(cleanText).filter(Boolean) : fantasyProsError ? prior?.practice || [] : [],
      probabilityOfPlaying: fp ? probability(fp.probability_of_playing) : fantasyProsError ? prior?.probabilityOfPlaying ?? null : null,
      injuryUpdatedAt: cleanText(fp?.injury_update_date) || (fantasyProsError ? prior?.injuryUpdatedAt || "" : ""), injuryStartDate: cleanText(sleeper.injury_start_date),
      dynastyValue: values.dynasty.get(valueKey) ?? (valueErrors.some((error) => error.startsWith("dynasty:")) ? prior?.dynastyValue ?? null : null),
      redraftValue: values.redraft.get(valueKey) ?? (valueErrors.some((error) => error.startsWith("redraft:")) ? prior?.redraftValue ?? null : null),
      fantasyProsId: fpId || null, news: fpNews.length ? fpNews.slice(0, 10) : fantasyProsError ? prior?.news || [] : [], searchName: sleeper.search_full_name || "",
    };
    const removed = previousRemoved.get(String(id));
    const reappeared = removed && now.getTime() - Date.parse(removed.removedAt || 0) <= 2 * DAY;
    const continuity = prior || (reappeared ? removed : null);
    const changes = playerChanges(continuity, current);
    const trend = changes.some((change) => change.direction === "worsening") ? "worsening" : changes.some((change) => change.direction === "improving") ? "improving" : changes.length ? "changed" : "steady";
    return { ...current, initialStatus: cleanText(continuity?.initialStatus) || current.status, reportState: reappeared ? "reappeared" : prior ? "existing" : "added", trackedSince: cleanText(continuity?.trackedSince) || updatedAt, lastSeenAt: updatedAt, trackedRefreshes: Math.max(1, Number(continuity?.trackedRefreshes || 0) + 1), changes, trend };
  }).filter((player) => POSITIONS.has(player.position) && (player.status || player.notes || player.bodyPart))
    .filter((player) => !["Active", "Inactive"].includes(player.status) || player.notes || player.bodyPart)
    .sort((a, b) => (STATUS_RANK[String(a.status).toUpperCase()] ?? 20) - (STATUS_RANK[String(b.status).toUpperCase()] ?? 20) || a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  const currentIds = new Set(currentPlayers.map((player) => player.id));
  const retainedRemoved = [...previousRemoved.values()].filter((player) => !currentIds.has(String(player.id)) && now.getTime() - Date.parse(player.removedAt || 0) <= 45 * DAY);
  const newlyRemoved = fantasyProsError ? [] : [...previousPlayers.values()].filter((player) => !currentIds.has(String(player.id))).map((player) => ({ ...player, reportState: "removed", removedAt: updatedAt, lastSeenAt: player.lastSeenAt || previous?.updatedAt || updatedAt }));
  const removedById = new Map(retainedRemoved.map((player) => [String(player.id), player]));
  for (const player of newlyRemoved) removedById.set(String(player.id), player);
  for (const player of currentPlayers) if (player.reportState === "reappeared") removedById.delete(player.id);
  const recentlyRemoved = [...removedById.values()].sort((a, b) => Date.parse(b.removedAt || 0) - Date.parse(a.removedAt || 0));

  const journal = historyDocument && Number(historyDocument.season) === season ? structuredClone(historyDocument) : { schemaVersion: 1, season, events: [], episodes: [] };
  journal.events ||= []; journal.episodes ||= [];
  const episodes = new Map(journal.episodes.map((episode) => [episode.episodeId, episode]));
  for (const legacy of Array.isArray(previous?.injuryHistory) ? previous.injuryHistory : []) episodes.set(legacy.episodeId, legacy);
  const events = [];
  for (const player of currentPlayers) {
    const episodeId = `${player.id}:${player.trackedSince}`;
    if (player.reportState === "added" || player.reportState === "reappeared") events.push({ season, playerId: player.id, episodeId, type: player.reportState, at: updatedAt });
    for (const change of player.changes) events.push({ season, playerId: player.id, episodeId, type: "changed", field: change.field, from: change.from, to: change.to, direction: change.direction, at: updatedAt });
    if (player.reportState === "reappeared") episodes.delete(episodeId);
    if (player.probabilityOfPlaying != null) events.push({ season, playerId: player.id, episodeId, type: "probability_observed", to: player.probabilityOfPlaying, week, at: updatedAt });
  }
  for (const player of newlyRemoved) {
    const episodeId = `${player.id}:${player.trackedSince}`;
    const observedDays = Math.max(0, Math.floor((Date.parse(updatedAt) - Date.parse(player.trackedSince || updatedAt)) / DAY));
    episodes.set(episodeId, { episodeId, playerId: player.id, name: player.name, team: player.team, position: player.position, bodyPart: player.bodyPart, initialStatus: player.initialStatus || player.status, finalStatus: player.status, probabilityAtRemoval: player.probabilityOfPlaying, trackedSince: player.trackedSince, endedAt: updatedAt, observedDays, trackedRefreshes: player.trackedRefreshes, season });
    events.push({ season, playerId: player.id, episodeId, type: "removed", at: updatedAt });
  }
  const knownEvents = new Set(journal.events.map((event) => event.id));
  for (const event of events) { const id = eventId(event); if (!knownEvents.has(id)) { journal.events.push({ ...event, id }); knownEvents.add(id); } }
  const unsettledWeeks = [...new Set(journal.events.filter((event) => event.type === "probability_observed" && typeof event.played !== "boolean" && Number(event.week) > 0 && Number(event.week) < Number(week)).map((event) => Number(event.week)))];
  const settlementWarnings = [];
  for (const observedWeek of unsettledWeeks) {
    try {
      const weeklyStats = await getJson(fetchImpl, `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${observedWeek}`, { "user-agent": "BallsvilleStreamBuilder/2.0" });
      for (const event of journal.events) {
        if (event.type !== "probability_observed" || Number(event.week) !== observedWeek || typeof event.played === "boolean") continue;
        const row = weeklyStats?.[event.playerId];
        event.played = Boolean(row && (Number(row.gp || 0) > 0 || Number(row.off_snp || row.tm_off_snp || 0) > 0));
        event.settledAt = updatedAt;
      }
    } catch (error) { settlementWarnings.push(`Week ${observedWeek} outcomes: ${error?.message || "unavailable"}`); }
  }
  journal.episodes = [...episodes.values()].sort((a, b) => Date.parse(b.endedAt || 0) - Date.parse(a.endedAt || 0));
  journal.updatedAt = updatedAt;

  const historySummary = { ...stats(journal.episodes), completedEpisodes: journal.episodes.length, byBodyPart: groupedStats(journal.episodes, "bodyPart"), byPosition: groupedStats(journal.episodes, "position"), byInitialStatus: groupedStats(journal.episodes, "initialStatus"), calibration: calibrationSummary(journal.events) };
  const valueSort = (a, b) => Number(b.redraftValue || 0) - Number(a.redraftValue || 0);
  const riskSort = (a, b) => (STATUS_RANK[String(a.status).toUpperCase()] ?? 20) - (STATUS_RANK[String(b.status).toUpperCase()] ?? 20) || valueSort(a, b);
  const briefing = {
    newOrChanged: currentPlayers.filter((player) => ["added", "reappeared"].includes(player.reportState) || player.changes.length).sort(valueSort).slice(0, 8).map((player) => player.id),
    biggestRisk: [...currentPlayers].sort(riskSort).slice(0, 8).map((player) => player.id),
    worsening: currentPlayers.filter((player) => player.trend === "worsening").sort(valueSort).slice(0, 8).map((player) => player.id),
    improving: currentPlayers.filter((player) => player.trend === "improving").sort(valueSort).slice(0, 8).map((player) => player.id),
    removed: recentlyRemoved.slice(0, 8).map((player) => player.id),
    longest: [...currentPlayers].sort((a, b) => Date.parse(a.trackedSince || 0) - Date.parse(b.trackedSince || 0)).slice(0, 8).map((player) => player.id),
    conflicts: currentPlayers.filter((player) => player.sourceConflict).sort(valueSort).slice(0, 8).map((player) => player.id),
  };
  const warnings = [fantasyProsError ? `FantasyPros: ${fantasyProsError}` : "", valueErrors.length ? `Player values: ${valueErrors.join("; ")}` : "", ...settlementWarnings].filter(Boolean);
  const payload = {
    schemaVersion: 2, updatedAt, updatedBy, source: fantasyProsError ? "Sleeper + saved FantasyPros data" : "Sleeper + FantasyPros", season, week,
    sourceStatus: { sleeper: { fresh: true, updatedAt }, fantasyPros: { fresh: !fantasyProsError, updatedAt: fantasyProsError ? previous?.sourceStatus?.fantasyPros?.updatedAt || null : updatedAt, error: fantasyProsError || null }, playerValues: { fresh: !valueErrors.length, updatedAt: valueErrors.length ? previous?.sourceStatus?.playerValues?.updatedAt || null : updatedAt, error: valueErrors.join("; ") || null } },
    fantasyProsConfigured: Boolean(fantasyProsKey), fantasyProsError: fantasyProsError || null, fantasyProsInjuryCount: fantasyProsInjuries.length, fantasyProsNewsCount: fantasyProsNews.length,
    playerValueSource: "Fantasy Navigator Superflex", playerValueError: valueErrors.join("; ") || null, dynastyValueCount: values.dynasty.size, redraftValueCount: values.redraft.size,
    activity: { added: currentPlayers.filter((player) => player.reportState === "added").length, reappeared: currentPlayers.filter((player) => player.reportState === "reappeared").length, changed: currentPlayers.filter((player) => player.changes.length).length, removed: newlyRemoved.length, removalComparisonSkipped: Boolean(fantasyProsError) },
    warnings, players: currentPlayers, recentlyRemoved, briefing, injuryHistorySummary: historySummary,
  };
  return { payload, journal, summary: { players: currentPlayers.length, added: payload.activity.added, changed: payload.activity.changed, removed: payload.activity.removed, eventsAdded: events.length, warnings } };
}
