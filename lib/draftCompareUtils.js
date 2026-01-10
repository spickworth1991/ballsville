// lib/draftCompareUtils.js
//
// Utilities for Draft Compare pages.
// Client-safe (no node APIs).

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}
function safeObj(v) {
  return v && typeof v === "object" ? v : {};
}
function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

// Small, surgical name fixes for known draft export inconsistencies.
// Keep this list tiny to avoid unintended merges.
const NAME_OVERRIDES = {
  // Some exports record "Cameron Ward" even when Sleeper uses "Cam Ward".
  "cameron ward|||QB": "Cam Ward",
};

function canonicalizeName(nameRaw, posRaw) {
  const name = safeStr(nameRaw).trim();
  const pos = safeStr(posRaw).trim().toUpperCase();
  const key = `${name.toLowerCase()}|||${pos}`;
  return NAME_OVERRIDES[key] || name;
}

export function formatRoundPickFromAvgOverall(overallPick, teams) {
  const t = Math.max(1, Math.round(safeNum(teams) || 12));
  const p = Math.max(1, Math.round(safeNum(overallPick) || 1));
  const r = Math.floor((p - 1) / t) + 1;
  const inRound = ((p - 1) % t) + 1;
  return `${r}.${String(inRound).padStart(2, "0")}`;
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of safeArr(arr)) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/**
 * Normalize the uploaded JSON into:
 * {
 *   meta: { teams, rounds },
 *   leagues: [{ leagueId, name, meta, players, draftboard, picks }]
 * }
 *
 * Supports the ADPCompare export shape (what your tool generates):
 * {
 *   meta,
 *   leagues: [...],                // optional
 *   perLeague: { sideA: [...], sideB: [...] },
 *   aggregated: { sideA: {...}, sideB: {...} },  // optional
 * }
 */
export function normalizeDraftCompareJson(input) {
  const root = safeObj(input?.data ?? input);

  const meta = safeObj(root?.meta);
  const teams = safeNum(meta?.teams) || 12;
  const rounds = safeNum(meta?.rounds) || 18;

  // ADPCompare export: perLeague.sideA/sideB
  const perLeague = safeObj(root?.perLeague);
  const leaguesFromPer = [
    ...safeArr(perLeague?.sideA),
    ...safeArr(perLeague?.sideB),
  ];

  // Direct raw: leagues: []
  const leaguesDirect = safeArr(root?.leagues);

  const leaguesRaw = leaguesFromPer.length ? leaguesFromPer : leaguesDirect;

  const leagues = uniqBy(
    leaguesRaw.map((l) => {
      const lo = safeObj(l);
      const leagueId = safeStr(lo?.leagueId || lo?.id).trim();
      const name = safeStr(lo?.name || lo?.leagueName || leagueId).trim();
      return {
        leagueId,
        name,
        meta: safeObj(lo?.meta),
        players: safeObj(lo?.players),
        draftboard: safeObj(lo?.draftboard),
        picks: safeArr(lo?.picks), // if present
      };
    }),
    (x) => x.leagueId
  ).filter((x) => x.leagueId);

  return { meta: { teams, rounds }, leagues };
}

function incMap(map, key, add) {
  map[key] = (map[key] || 0) + add;
}

/**
 * Aggregate a selected set of leagues into the shape used by the Draft Compare UI:
 * {
 *   meta: { teams, rounds },
 *   leagueCount,
 *   players: { "<name>|||<pos>": { name, position, count, avgOverallPick, avgRoundPick, modeOverallPick, modeRoundPick } },
 *   draftboard: { cells: { "R-P": [ { name, position, count, pct, overallPick, roundPick } ... ] } }
 * }
 */
export function aggregateSelectedLeagues(norm, selectedLeagueIds) {
  const meta = safeObj(norm?.meta);
  const teams = safeNum(meta?.teams) || 12;

  const selected = new Set(
    safeArr(selectedLeagueIds)
      .map((s) => safeStr(s).trim())
      .filter(Boolean)
  );

  const leagues = safeArr(norm?.leagues).filter((l) => selected.has(safeStr(l?.leagueId).trim()));
  const leagueCount = leagues.length || 0;

  // playersAgg: key -> { name, position, count, sumPick, pickHist:{} }
  const playersAgg = Object.create(null);

  // draftCellAgg: cellKey -> key -> count
  const cellAgg = Object.create(null);

  for (const lg of leagues) {
    const players = safeObj(lg?.players);
    const draftboard = safeObj(lg?.draftboard);
    const cells = safeObj(draftboard?.cells);

    // Prefer draftboard cells (gives pick position); fallback to players avgOverallPick.
    const cellKeys = Object.keys(cells);
    if (cellKeys.length) {
      for (const cellKey of cellKeys) {
        const [rStr, pStr] = safeStr(cellKey).split("-");
        const round = safeNum(rStr);
        const pickInRound = safeNum(pStr);
        const overallPick = (round - 1) * teams + pickInRound;

        const list = safeArr(cells[cellKey]);
        for (const entry of list) {
          const e = safeObj(entry);
          const position = (safeStr(e?.position).trim() || "UNK").toUpperCase();
          const name = canonicalizeName(safeStr(e?.name).trim(), position);
          const key = `${name}|||${position}`;
          const c = safeNum(e?.count) || 1;

          if (!playersAgg[key]) {
            playersAgg[key] = {
              name,
              position,
              count: 0,
              sumPick: 0,
              pickHist: Object.create(null),
            };
          }
          playersAgg[key].count += c;
          playersAgg[key].sumPick += overallPick * c;
          incMap(playersAgg[key].pickHist, String(overallPick), c);

          if (!cellAgg[cellKey]) cellAgg[cellKey] = Object.create(null);
          incMap(cellAgg[cellKey], key, c);
        }
      }
    } else {
      // fallback: players map already has avgOverallPick
      for (const key of Object.keys(players)) {
        const p = safeObj(players[key]);
        const position = (safeStr(p?.position).trim() || "UNK").toUpperCase();
        const name = canonicalizeName(safeStr(p?.name).trim(), position);
        const k = `${name}|||${position}`;
        const c = safeNum(p?.count) || 1;
        const overallPick = safeNum(p?.avgOverallPick) || 9999;

        if (!playersAgg[k]) {
          playersAgg[k] = {
            name,
            position,
            count: 0,
            sumPick: 0,
            pickHist: Object.create(null),
          };
        }
        playersAgg[k].count += c;
        playersAgg[k].sumPick += overallPick * c;
        incMap(playersAgg[k].pickHist, String(Math.round(overallPick)), c);
      }
    }
  }

  // finalize players map
  const playersOut = Object.create(null);
  for (const key of Object.keys(playersAgg)) {
    const p = playersAgg[key];
    const count = safeNum(p.count) || 0;
    const avgOverallPick = count ? p.sumPick / count : 9999;

    // mode = most frequent pick in histogram
    let modePick = Math.round(avgOverallPick);
    let best = -1;
    for (const k of Object.keys(p.pickHist || {})) {
      const v = safeNum(p.pickHist[k]);
      if (v > best) {
        best = v;
        modePick = safeNum(k);
      }
    }

    playersOut[key] = {
      name: p.name,
      position: p.position,
      count,
      avgOverallPick,
      avgRoundPick: formatRoundPickFromAvgOverall(avgOverallPick, teams),
      modeOverallPick: modePick,
      modeRoundPick: formatRoundPickFromAvgOverall(modePick, teams),
    };
  }

  // finalize draftboard cells
  const draftCellsOut = Object.create(null);
  for (const cellKey of Object.keys(cellAgg)) {
    const m = cellAgg[cellKey];

    const [rStr, pStr] = safeStr(cellKey).split("-");
    const round = safeNum(rStr);
    const pickInRound = safeNum(pStr);
    const overallPick = (round - 1) * teams + pickInRound;

    const arr = Object.keys(m).map((key) => {
      const [name, position] = key.split("|||");
      const count = safeNum(m[key]) || 0;
      const pct = leagueCount ? count / leagueCount : 0;
      return {
        name,
        position: position || "UNK",
        count,
        pct,
        overallPick,
        roundPick: formatRoundPickFromAvgOverall(overallPick, teams),
      };
    });

    arr.sort((a, b) => (b.pct - a.pct) || (a.name || "").localeCompare(b.name || ""));
    draftCellsOut[cellKey] = arr;
  }

  return {
    meta: { teams: safeNum(meta?.teams) || 12, rounds: safeNum(meta?.rounds) || 18 },
    leagueCount,
    players: playersOut,
    draftboard: { cells: draftCellsOut },
  };
}

/**
 * Build a group from the uploaded JSON + selected league IDs.
 * This is the function the DraftCompareModeClient expects.
 *
 * - If selectedLeagueIds is null/empty -> uses ALL leagues in the file.
 * - Returns the aggregated group shape used by the UI.
 */
export function buildGroupFromDraftJson(draftJson, selectedLeagueIds) {
  const norm = normalizeDraftCompareJson(draftJson);
  const allIds = safeArr(norm?.leagues).map((l) => safeStr(l?.leagueId).trim()).filter(Boolean);

  const sel = safeArr(selectedLeagueIds).map((s) => safeStr(s).trim()).filter(Boolean);
  const useIds = sel.length ? sel : allIds;

  return aggregateSelectedLeagues(norm, useIds);
}

/**
 * Build the compare table rows for two groups (Side A vs Side B).
 * Output rows match what DraftCompareModeClient renders.
 *
 * Returns: Array<{ name, position, adpA, adpB, delta, roundPickA, roundPickB }>
 * where delta = (B - A).
 */
export function buildPlayerResults(groupA, groupB) {
  const a = safeObj(groupA);
  const b = safeObj(groupB);

  const teams = safeNum(a?.meta?.teams) || safeNum(b?.meta?.teams) || 12;

  const map = new Map();

  const aPlayers = safeObj(a?.players);
  const bPlayers = safeObj(b?.players);

  for (const k of Object.keys(aPlayers)) {
    const p = safeObj(aPlayers[k]);
    const pos = safeStr(p?.position).trim().toUpperCase();
    const name = canonicalizeName(safeStr(p?.name).trim(), pos);
    const key = `${name}|||${pos}`;
    map.set(key, { name, position: pos, a: p, b: null });
  }
  for (const k of Object.keys(bPlayers)) {
    const p = safeObj(bPlayers[k]);
    const pos = safeStr(p?.position).trim().toUpperCase();
    const name = canonicalizeName(safeStr(p?.name).trim(), pos);
    const key = `${name}|||${pos}`;
    const cur = map.get(key);
    if (cur) cur.b = p;
    else map.set(key, { name, position: pos, a: null, b: p });
  }

  const out = [];
  for (const v of map.values()) {
    const adpA = v.a ? safeNum(v.a.avgOverallPick) : null;
    const adpB = v.b ? safeNum(v.b.avgOverallPick) : null;
    const delta = adpA != null && adpB != null ? (adpB - adpA) : null;

    // Used by UI for stable ordering/"adjusted" ranking when a player only appears on one side.
    // (Avoids treating missing ADP as 0, which would incorrectly push the player to 1.01.)
    const sortAdp =
      adpA != null && adpA > 0
        ? adpA
        : adpB != null && adpB > 0
        ? adpB
        : Number.POSITIVE_INFINITY;

    const roundPickA =
      v.a?.modeRoundPick || (adpA != null ? formatRoundPickFromAvgOverall(adpA, teams) : "—");
    const roundPickB =
      v.b?.modeRoundPick || (adpB != null ? formatRoundPickFromAvgOverall(adpB, teams) : "—");

    out.push({
      name: v.name,
      position: v.position,
      adpA,
      adpB,
      delta,
      sortAdp,
      roundPickA,
      roundPickB,
    });
  }

  // sort by abs(delta) desc, then name
  out.sort(
    (x, y) =>
      Math.abs(safeNum(y.delta)) - Math.abs(safeNum(x.delta)) ||
      safeStr(x.name).localeCompare(safeStr(y.name))
  );

  return out;
}
