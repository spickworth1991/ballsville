// lib/draftCompareUtils.js
//
// Client-side ADP + draftboard aggregation using pre-generated JSON.
// Supports two input styles:
// 1) RAW: { meta:{teams,rounds}, leagues:[{leagueId,name,draftId,picks:[{pick_no,metadata:{player_name,position,...}}]}] }
// 2) AGG: { meta:{teams,rounds}, leagues:[{leagueId,name,players:{},draftboard:{cells:{}}}] }
//
// We prefer RAW when available (gives accurate mode pick). If only AGG is present,
// we use a weighted fallback for mode.

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

export function formatRoundPickFromOverall(overallPick, teams) {
  const t = Number.isFinite(teams) && teams > 0 ? teams : 12;
  const x = Number.isFinite(overallPick) ? overallPick : 0;
  if (x <= 0) return "—";
  const round = Math.floor((x - 1) / t) + 1;
  const pickInRound = x - (round - 1) * t;
  return `${round}.${String(Math.round(pickInRound)).padStart(2, "0")}`;
}

export function formatRoundPickFromAvgOverall(avgOverallPick, teams) {
  const x = Number.isFinite(avgOverallPick) ? avgOverallPick : 0;
  if (x <= 0) return "—";
  return formatRoundPickFromOverall(Math.max(1, Math.round(x)), teams);
}

function playerKey(name, pos) {
  return `${name}|||${pos}`;
}

function pickPlayerName(p) {
  const m = p?.metadata || {};
  const pn = safeStr(m.player_name).trim();
  if (pn) return pn;
  const first = safeStr(m.first_name).trim();
  const last = safeStr(m.last_name).trim();
  const full = `${first} ${last}`.trim();
  return full || safeStr(p?.player_id || "Unknown").trim();
}

function pickPlayerPos(p) {
  const m = p?.metadata || {};
  return safeStr(m.position).trim() || "UNK";
}

function normalizeDraftJson(input) {
  const data = input && typeof input === "object" ? input : {};

  // If someone uploads the compare-page export, it may be wrapped.
  // We accept:
  // - { meta, leagues }
  // - { perLeague: { sideA: [...], sideB: [...] }, meta }
  // - { data: { ... } }
  const root = data?.data && typeof data.data === "object" ? data.data : data;

  const leagues =
    Array.isArray(root?.leagues)
      ? root.leagues
      : root?.perLeague
        ? [...(root?.perLeague?.sideA || []), ...(root?.perLeague?.sideB || [])]
        : [];

  const meta = root?.meta || {};
  const teams = safeNum(meta.teams) ?? 12;
  const rounds = safeNum(meta.rounds) ?? 15;

  // De-dupe by leagueId when we stitched from sideA/sideB.
  const byId = new Map();
  for (const l of leagues) {
    const leagueId = safeStr(l?.leagueId || l?.league_id).trim();
    if (!leagueId) continue;
    if (!byId.has(leagueId)) byId.set(leagueId, l);
  }

  return {
    meta: { teams, rounds },
    leagues: Array.from(byId.values()).map((l) => {
      const leagueId = safeStr(l?.leagueId || l?.league_id).trim();
      const name = safeStr(l?.name || l?.leagueName || l?.league_name || "").trim() || leagueId;
      const draftId = safeStr(l?.draftId || l?.draft_id || "").trim();
      const picks = Array.isArray(l?.picks) ? l.picks : Array.isArray(l?.draftPicks) ? l.draftPicks : null;
      const players = l?.players && typeof l.players === "object" ? l.players : null;
      const draftboard = l?.draftboard && typeof l.draftboard === "object" ? l.draftboard : null;

      return { leagueId, name, draftId, picks, players, draftboard };
    }),
  };
}

export function buildGroupFromDraftJson(input, selectedLeagueIds = null) {
  const parsed = normalizeDraftJson(input);
  const { teams, rounds } = parsed.meta;

  const selectedSet =
    selectedLeagueIds && Array.isArray(selectedLeagueIds)
      ? new Set(selectedLeagueIds.map((x) => safeStr(x).trim()).filter(Boolean))
      : null;

  const leagues = parsed.leagues.filter((l) => !selectedSet || selectedSet.has(l.leagueId));

  const hasRaw = leagues.some((l) => Array.isArray(l.picks) && l.picks.length);

  if (hasRaw) {
    return buildFromRaw(leagues, { teams, rounds });
  }
  return buildFromAgg(leagues, { teams, rounds });
}

function buildFromRaw(leagues, meta) {
  const { teams, rounds } = meta;

  // player key -> { name,pos, sumPick, count, pickCounts: Map<pick_no,count> }
  const byPlayer = new Map();
  // cell key -> Map<playerKey, { name,pos, sumPick, count }>
  const cellToPlayers = new Map();

  for (const league of leagues) {
    const picks = Array.isArray(league.picks) ? league.picks : [];

    for (const p of picks) {
      const pickNo = safeNum(p?.pick_no ?? p?.pickNo ?? p?.pick) ?? null;
      if (!pickNo || pickNo <= 0) continue;

      const name = pickPlayerName(p);
      const pos = pickPlayerPos(p);
      const k = playerKey(name, pos);

      // player
      if (!byPlayer.has(k)) byPlayer.set(k, { name, pos, sumPick: 0, count: 0, pickCounts: new Map() });
      const acc = byPlayer.get(k);
      acc.sumPick += pickNo;
      acc.count += 1;
      acc.pickCounts.set(pickNo, (acc.pickCounts.get(pickNo) || 0) + 1);

      // draftboard cell
      const round = Math.floor((pickNo - 1) / teams) + 1;
      const slot = pickNo - (round - 1) * teams;
      if (round < 1 || round > rounds) continue;
      if (slot < 1 || slot > teams) continue;
      const cellKey = `${round}-${slot}`;

      if (!cellToPlayers.has(cellKey)) cellToPlayers.set(cellKey, new Map());
      const pmap = cellToPlayers.get(cellKey);
      if (!pmap.has(k)) pmap.set(k, { name, pos, sumPick: 0, count: 0 });
      const c = pmap.get(k);
      c.sumPick += pickNo;
      c.count += 1;
    }
  }

  const players = finalizePlayersMap(byPlayer, teams);
  const draftboard = { cells: finalizeCellsMap(cellToPlayers, teams) };

  return { meta: { teams, rounds }, leagues, players, draftboard };
}

function buildFromAgg(leagues, meta) {
  const { teams, rounds } = meta;

  // We reconstruct enough information to aggregate averages + counts.
  // Mode is approximated as the most common per-league modeOverallPick weighted by count.
  const byPlayer = new Map();
  const byPlayerModeCounts = new Map(); // key -> Map<modePick,count>
  const cellToPlayers = new Map();

  for (const league of leagues) {
    const players = league.players && typeof league.players === "object" ? league.players : {};
    for (const k of Object.keys(players)) {
      const p = players[k] || {};
      const name = safeStr(p.name).trim() || safeStr(k.split("|||")[0]).trim();
      const pos = safeStr(p.position).trim() || safeStr(k.split("|||")[1]).trim() || "UNK";
      const count = safeNum(p.count) ?? 0;
      const avg = safeNum(p.avgOverallPick) ?? 0;
      const mode = safeNum(p.modeOverallPick) ?? null;
      if (!count || !avg) continue;

      const kk = playerKey(name, pos);
      if (!byPlayer.has(kk)) byPlayer.set(kk, { name, pos, sumPick: 0, count: 0 });
      const acc = byPlayer.get(kk);
      acc.sumPick += avg * count;
      acc.count += count;

      if (mode) {
        if (!byPlayerModeCounts.has(kk)) byPlayerModeCounts.set(kk, new Map());
        const m = byPlayerModeCounts.get(kk);
        m.set(mode, (m.get(mode) || 0) + count);
      }
    }

    const cells = league?.draftboard?.cells && typeof league.draftboard.cells === "object" ? league.draftboard.cells : {};
    for (const cellKey of Object.keys(cells)) {
      const list = Array.isArray(cells[cellKey]) ? cells[cellKey] : [];
      if (!cellToPlayers.has(cellKey)) cellToPlayers.set(cellKey, new Map());
      const pmap = cellToPlayers.get(cellKey);
      for (const e of list) {
        const name = safeStr(e?.name).trim();
        const pos = safeStr(e?.position).trim() || "UNK";
        const count = safeNum(e?.count) ?? 0;
        const avg = safeNum(e?.avgOverallPick) ?? 0;
        if (!name || !count || !avg) continue;
        const kk = playerKey(name, pos);
        if (!pmap.has(kk)) pmap.set(kk, { name, pos, sumPick: 0, count: 0 });
        const c = pmap.get(kk);
        c.sumPick += avg * count;
        c.count += count;
      }
    }
  }

  const playersOut = {};
  for (const [k, acc] of byPlayer.entries()) {
    const avg = acc.sumPick / (acc.count || 1);
    let modePick = Math.max(1, Math.round(avg));
    const mm = byPlayerModeCounts.get(k);
    if (mm) {
      let bestPick = modePick;
      let bestCount = -1;
      for (const [pickNo, c] of mm.entries()) {
        if (c > bestCount || (c === bestCount && pickNo < bestPick)) {
          bestPick = pickNo;
          bestCount = c;
        }
      }
      modePick = bestPick;
    }

    playersOut[k] = {
      name: acc.name,
      position: acc.pos,
      count: acc.count,
      avgOverallPick: avg,
      avgRoundPick: formatRoundPickFromAvgOverall(avg, teams),
      modeOverallPick: modePick,
      modeRoundPick: formatRoundPickFromOverall(modePick, teams),
    };
  }

  return {
    meta: { teams, rounds },
    leagues,
    players: playersOut,
    draftboard: { cells: finalizeCellsMap(cellToPlayers, teams) },
  };
}

function finalizePlayersMap(map, teams) {
  const out = {};
  for (const [k, acc] of map.entries()) {
    const avg = acc.sumPick / (acc.count || 1);
    // mode
    let modePick = 0;
    let modeCount = -1;
    for (const [pickNo, c] of acc.pickCounts.entries()) {
      if (c > modeCount || (c === modeCount && pickNo < modePick)) {
        modePick = pickNo;
        modeCount = c;
      }
    }
    if (!modePick) modePick = Math.max(1, Math.round(avg));

    out[k] = {
      name: acc.name,
      position: acc.pos,
      count: acc.count,
      avgOverallPick: avg,
      avgRoundPick: formatRoundPickFromAvgOverall(avg, teams),
      modeOverallPick: modePick,
      modeRoundPick: formatRoundPickFromOverall(modePick, teams),
    };
  }
  return out;
}

function finalizeCellsMap(map, teams) {
  const out = {};
  for (const [cellKey, pmap] of map.entries()) {
    const total = Array.from(pmap.values()).reduce((s, v) => s + v.count, 0) || 1;
    out[cellKey] = Array.from(pmap.values())
      .map((v) => {
        const avgPick = v.sumPick / (v.count || 1);
        return {
          name: v.name,
          position: v.pos,
          count: v.count,
          pct: v.count / total,
          avgOverallPick: avgPick,
          roundPick: formatRoundPickFromAvgOverall(avgPick, teams),
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (a.avgOverallPick !== b.avgOverallPick) return a.avgOverallPick - b.avgOverallPick;
        return a.name.localeCompare(b.name);
      });
  }
  return out;
}

export function buildPlayerResults(groupA, groupB) {
  const mapA = groupA?.players || {};
  const mapB = groupB?.players || {};
  const keys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
  const out = [];
  for (const k of keys) {
    const a = mapA[k];
    const b = mapB[k];
    const name = safeStr(a?.name || b?.name);
    const pos = safeStr(a?.position || b?.position);
    const adpA = a?.avgOverallPick ?? null;
    const adpB = b?.avgOverallPick ?? null;
    const delta = adpA != null && adpB != null ? adpB - adpA : null;
    out.push({
      name,
      position: pos,
      adpA,
      adpB,
      delta,
      roundPickA: safeStr(a?.modeRoundPick || "—"),
      roundPickB: safeStr(b?.modeRoundPick || "—"),
    });
  }
  return out;
}
