// lib/draftCompareUtils.js
//
// Utilities for Draft Compare pages.
// This file intentionally stays client-safe (no node APIs).

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

export function roundPickFromOverall(overallPick, teams) {
  const t = Math.max(1, safeNum(teams) || 12);
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
 *   leagues: [{ leagueId, name, meta, players, draftboard }]
 * }
 *
 * Supports the ADPCompare export shape:
 * {
 *   meta, perLeague: { sideA: [ { leagueId, name, meta, players, draftboard } ], sideB: [...] }
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
 * Build an aggregated view for a selected set of leagues.
 * Returns: { meta, leagueCount, players: Array, draftboard: { cells } }
 */
export function aggregateSelectedLeagues(norm, selectedLeagueIds) {
  const meta = safeObj(norm?.meta);
  const teams = safeNum(meta?.teams) || 12;

  const selected = new Set(safeArr(selectedLeagueIds).map((s) => safeStr(s).trim()).filter(Boolean));
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
          const name = safeStr(e?.name).trim();
          const position = safeStr(e?.position).trim() || "UNK";
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
      // fallback
      for (const key of Object.keys(players)) {
        const p = safeObj(players[key]);
        const name = safeStr(p?.name).trim();
        const position = safeStr(p?.position).trim() || "UNK";
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

  // finalize players list
  const playersList = Object.values(playersAgg).map((p) => {
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

    return {
      name: p.name,
      position: p.position,
      count,
      avgOverallPick,
      avgRoundPick: roundPickFromOverall(avgOverallPick, teams),
      modeOverallPick: modePick,
      modeRoundPick: roundPickFromOverall(modePick, teams),
    };
  });

  playersList.sort((a, b) => safeNum(a.avgOverallPick) - safeNum(b.avgOverallPick));

  // finalize draftboard
  const draftCellsOut = Object.create(null);
  for (const cellKey of Object.keys(cellAgg)) {
    const m = cellAgg[cellKey];
    const total = Object.values(m).reduce((s, v) => s + safeNum(v), 0) || 0;

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
        avgOverallPick: overallPick,
        roundPick: roundPickFromOverall(overallPick, teams),
      };
    });

    arr.sort((a, b) => (b.pct - a.pct) || (a.name || "").localeCompare(b.name || ""));
    draftCellsOut[cellKey] = arr;
  }

  return {
    meta: { teams: safeNum(meta?.teams) || 12, rounds: safeNum(meta?.rounds) || 18 },
    leagueCount,
    players: playersList,
    draftboard: { cells: draftCellsOut },
  };
}

/**
 * Compare two aggregated sets into a single table.
 * Returns array of { name, position, a, b, delta, ... }
 */
export function compareAggregates(aggA, aggB) {
  const a = safeObj(aggA);
  const b = safeObj(aggB);

  const map = new Map();

  for (const p of safeArr(a.players)) {
    const key = `${safeStr(p?.name).trim()}|||${safeStr(p?.position).trim()}`;
    map.set(key, { name: p.name, position: p.position, a: p, b: null });
  }
  for (const p of safeArr(b.players)) {
    const key = `${safeStr(p?.name).trim()}|||${safeStr(p?.position).trim()}`;
    const cur = map.get(key);
    if (cur) cur.b = p;
    else map.set(key, { name: p.name, position: p.position, a: null, b: p });
  }

  const out = [];
  for (const v of map.values()) {
    const aPick = v.a ? safeNum(v.a.avgOverallPick) : null;
    const bPick = v.b ? safeNum(v.b.avgOverallPick) : null;
    let delta = null;
    if (aPick != null && bPick != null) delta = aPick - bPick;
    out.push({
      name: v.name,
      position: v.position,
      aAvgOverallPick: aPick,
      bAvgOverallPick: bPick,
      delta,
      a: v.a,
      b: v.b,
    });
  }

  // sort by absolute delta desc, then name
  out.sort((x, y) => (Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0)) || x.name.localeCompare(y.name));
  return out;
}
