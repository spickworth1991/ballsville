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

// Minimal name canonicalization to prevent duplicates caused by different sources
// (e.g. "Cam Ward" vs "Cameron Ward"). Keep this intentionally conservative.
function canonicalPlayerName(name) {
  const raw = safeStr(name).trim();
  if (!raw) return "";
  const lc = raw.toLowerCase();

  // Specific known mismatch seen in Draft Compare inputs.
  if (lc === "cameron ward") return "Cam Ward";

  return raw;
}
function safeObj(v) {
  return v && typeof v === "object" ? v : {};
}
function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

export function formatRoundPickFromAvgOverall(overallPick, teams) {
  const t = Math.max(1, Math.round(safeNum(teams) || 12));
  const p = Math.max(1, Math.round(safeNum(overallPick) || 1));
  const r = Math.floor((p - 1) / t) + 1;
  const inRound = ((p - 1) % t) + 1;
  return `${r}.${String(inRound).padStart(2, "0")}`;
}

function parseRoundPick(rp) {
  // "3.07" -> { round: 3, pick: 7 }
  const s = safeStr(rp).trim();
  const m = s.match(/^(\d+)\.(\d+)$/);
  if (!m) return { round: null, pick: null };
  const round = safeNum(m[1]);
  const pick = safeNum(m[2]);
  return {
    round: Number.isFinite(round) && round > 0 ? round : null,
    pick: Number.isFinite(pick) && pick > 0 ? pick : null,
  };
}

function overallFromRoundPick(round, pickInRound, teams) {
  return (round - 1) * teams + pickInRound;
}

/**
 * Fix the common bug: storing "snake display column" as pickInRound on even rounds.
 *
 * If storedOverall exists:
 * - if it matches direct interpretation -> keep
 * - if it matches flipped interpretation -> flip
 * Else:
 * - assume flip heuristic (even rounds) to fix "14.01 -> 14.12" style issues
 */
function normalizePick({ round, pickInRound, teams, storedOverall }) {
  const directOverall = overallFromRoundPick(round, pickInRound, teams);

  const flippedPick = round % 2 === 0 ? teams - pickInRound + 1 : pickInRound;
  const flippedOverall = overallFromRoundPick(round, flippedPick, teams);

  const so = safeNum(storedOverall);
  if (Number.isFinite(so) && so > 0) {
    if (Math.abs(so - directOverall) < 0.0001) {
      return { pickInRound, overallPick: directOverall };
    }
    if (Math.abs(so - flippedOverall) < 0.0001) {
      return { pickInRound: flippedPick, overallPick: flippedOverall };
    }
    // If it doesn't match either, fall back to direct.
    return { pickInRound, overallPick: directOverall };
  }

  // No stored overall: apply heuristic flip on even rounds.
  return { pickInRound: flippedPick, overallPick: flippedOverall };
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
 */
export function normalizeDraftCompareJson(input) {
  const root = safeObj(input?.data ?? input);

  const meta = safeObj(root?.meta);
  const teams = safeNum(meta?.teams) || 12;
  const rounds = safeNum(meta?.rounds) || 18;

  // ADPCompare export: perLeague.sideA/sideB
  const perLeague = safeObj(root?.perLeague);
  const leaguesFromPer = [...safeArr(perLeague?.sideA), ...safeArr(perLeague?.sideB)];

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

  // draftCellAgg: cellKey -> key -> count (count = number of leagues that had this player in this slot)
  const cellAgg = Object.create(null);

  // helper: add ONE league contribution (avoid multiplicative counts)
  function addLeaguePick({ name, position, round, pickInRound, overallPick }) {
    const nm = canonicalPlayerName(name);
    const pos = safeStr(position).trim() || "UNK";
    if (!nm) return;

    const key = `${nm}|||${pos}`;

    const r = safeNum(round);
    const p = safeNum(pickInRound);
    const o = safeNum(overallPick);

    if (!(r > 0 && p > 0 && o > 0)) return;

    if (!playersAgg[key]) {
      playersAgg[key] = {
        name: nm,
        position: pos,
        count: 0,
        sumPick: 0,
        pickHist: Object.create(null),
      };
    }
    playersAgg[key].count += 1;
    playersAgg[key].sumPick += o;
    incMap(playersAgg[key].pickHist, String(Math.round(o)), 1);

    const cellKey = `${r}-${p}`;
    if (!cellAgg[cellKey]) cellAgg[cellKey] = Object.create(null);
    incMap(cellAgg[cellKey], key, 1);
  }

  for (const lg of leagues) {
    // Per-league "dedupe": only one pick per player per league
    const seenThisLeague = new Set();

    // 1) BEST: use explicit picks if present
    const picks = safeArr(lg?.picks);
    if (picks.length) {
      for (const pk of picks) {
        const po = safeObj(pk);

        const name = canonicalPlayerName(po?.name || po?.player_name || po?.playerName);
        const position = safeStr(po?.position || po?.pos).trim() || "UNK";

        // Try common schemas for overall + round/pick
        const overallRaw =
          po?.overallPick ?? po?.overall ?? po?.pick_number ?? po?.pickNumber ?? po?.pick ?? null;
        const roundRaw = po?.round ?? po?.roundNumber ?? null;
        const pickRaw = po?.pickInRound ?? po?.slot ?? po?.round_pick ?? po?.roundPick ?? null;

        let overallPick = safeNum(overallRaw);
        let round = safeNum(roundRaw);
        let pickInRound = safeNum(pickRaw);

        // If only overall is present, derive round/pickInRound
        if (overallPick > 0 && !(round > 0 && pickInRound > 0)) {
          const rp = formatRoundPickFromAvgOverall(overallPick, teams);
          const parsed = parseRoundPick(rp);
          round = parsed.round || 0;
          pickInRound = parsed.pick || 0;
        }

        // If round/pickInRound are present but overall isn't, compute it
        if (!(overallPick > 0) && round > 0 && pickInRound > 0) {
          overallPick = overallFromRoundPick(round, pickInRound, teams);
        }

        const k = `${name}|||${position}`;
        if (!name || seenThisLeague.has(k)) continue;
        seenThisLeague.add(k);

        addLeaguePick({ name, position, round, pickInRound, overallPick });
      }

      // done with this league
      continue;
    }

    // 2) Next best: use players map (modeOverallPick/modeRoundPick) if present
    const players = safeObj(lg?.players);
    const playerKeys = Object.keys(players);
    if (playerKeys.length) {
      for (const k0 of playerKeys) {
        const p = safeObj(players[k0]);

        const name = canonicalPlayerName(p?.name || k0.split("|||")[0]);
        const position = safeStr(p?.position || k0.split("|||")[1]).trim() || "UNK";
        const k = `${name}|||${position}`;
        if (!name || seenThisLeague.has(k)) continue;
        seenThisLeague.add(k);

        const storedOverall =
          p?.modeOverallPick ?? p?.overallPick ?? p?.avgOverallPick ?? p?.avgPick ?? null;

        // Prefer modeRoundPick (single-league most common slot)
        const rp =
          p?.modeRoundPick ?? p?.roundPick ?? p?.avgRoundPick ?? (storedOverall ? formatRoundPickFromAvgOverall(storedOverall, teams) : "");

        const parsed = parseRoundPick(rp);
        if (parsed.round && parsed.pick) {
          const normPick = normalizePick({
            round: parsed.round,
            pickInRound: parsed.pick,
            teams,
            storedOverall,
          });

          addLeaguePick({
            name,
            position,
            round: parsed.round,
            pickInRound: normPick.pickInRound,
            overallPick: normPick.overallPick,
          });
          continue;
        }

        // fallback: if we only have stored overall
        const o = safeNum(storedOverall);
        if (o > 0) {
          const rp2 = formatRoundPickFromAvgOverall(o, teams);
          const p2 = parseRoundPick(rp2);
          if (p2.round && p2.pick) {
            addLeaguePick({ name, position, round: p2.round, pickInRound: p2.pick, overallPick: o });
          }
        }
      }

      // done with this league
      continue;
    }

    // 3) LAST resort: use draftboard.cells (can be snake-flipped; no stored overall to validate)
    const draftboard = safeObj(lg?.draftboard);
    const cells = safeObj(draftboard?.cells);
    const cellKeys = Object.keys(cells);
    if (cellKeys.length) {
      for (const cellKey of cellKeys) {
        const [rStr, pStr] = safeStr(cellKey).split("-");
        const round = safeNum(rStr);
        const pickInRoundRaw = safeNum(pStr);
        if (!(round > 0 && pickInRoundRaw > 0)) continue;

        // heuristic normalize (no stored overall)
        const normPick = normalizePick({
          round,
          pickInRound: pickInRoundRaw,
          teams,
          storedOverall: null,
        });

        const overallPick = normPick.overallPick;

        const list = safeArr(cells[cellKey]);
        for (const entry of list) {
          const e = safeObj(entry);
          const name = canonicalPlayerName(e?.name);
          const position = safeStr(e?.position).trim() || "UNK";
          const k = `${name}|||${position}`;
          if (!name || seenThisLeague.has(k)) continue;
          seenThisLeague.add(k);

          addLeaguePick({
            name,
            position,
            round,
            pickInRound: normPick.pickInRound,
            overallPick,
          });
        }
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
  // pct must be WITHIN-CELL share, not count/leagueCount
  const draftCellsOut = Object.create(null);
  for (const cellKey of Object.keys(cellAgg)) {
    const m = cellAgg[cellKey];

    const [rStr, pStr] = safeStr(cellKey).split("-");
    const round = safeNum(rStr);
    const pickInRound = safeNum(pStr);
    const overallPick = (round - 1) * teams + pickInRound;

    const totalInCell = Object.keys(m).reduce((acc, k) => acc + (safeNum(m[k]) || 0), 0) || 1;

    const arr = Object.keys(m).map((key) => {
      const [name, position] = key.split("|||");
      const count = safeNum(m[key]) || 0;
      const pct = count / totalInCell;
      return {
        name,
        position: position || "UNK",
        count,
        pct,
        overallPick,
        roundPick: formatRoundPickFromAvgOverall(overallPick, teams),
      };
    });

    arr.sort((a, b) => b.pct - a.pct || (a.name || "").localeCompare(b.name || ""));
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
  const allIds = safeArr(norm?.leagues)
    .map((l) => safeStr(l?.leagueId).trim())
    .filter(Boolean);

  const sel = safeArr(selectedLeagueIds)
    .map((s) => safeStr(s).trim())
    .filter(Boolean);
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
    const name = canonicalPlayerName(p?.name);
    const pos = safeStr(p?.position).trim() || "UNK";
    const key = `${name}|||${pos}`;
    map.set(key, { name, position: pos, a: p, b: null });
  }
  for (const k of Object.keys(bPlayers)) {
    const p = safeObj(bPlayers[k]);
    const name = canonicalPlayerName(p?.name);
    const pos = safeStr(p?.position).trim() || "UNK";
    const key = `${name}|||${pos}`;
    const cur = map.get(key);
    if (cur) cur.b = p;
    else map.set(key, { name, position: pos, a: null, b: p });
  }

  const out = [];
  for (const v of map.values()) {
    const adpA = v.a ? safeNum(v.a.avgOverallPick) : null;
    const adpB = v.b ? safeNum(v.b.avgOverallPick) : null;
    const delta = adpA != null && adpB != null ? adpB - adpA : null;

    const roundPickA = v.a?.modeRoundPick || (adpA != null ? formatRoundPickFromAvgOverall(adpA, teams) : "—");
    const roundPickB = v.b?.modeRoundPick || (adpB != null ? formatRoundPickFromAvgOverall(adpB, teams) : "—");

    out.push({
      name: v.name,
      position: v.position,
      adpA,
      adpB,
      delta,
      roundPickA,
      roundPickB,
    });
  }

  // sort by abs(delta) desc, then name
  out.sort(
    (x, y) => Math.abs(safeNum(y.delta)) - Math.abs(safeNum(x.delta)) || safeStr(x.name).localeCompare(safeStr(y.name))
  );

  return out;
}
