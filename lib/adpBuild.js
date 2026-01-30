// lib/adpBuild.js
// Build Draft Compare-compatible JSON from Sleeper drafts.
// Ported from the standalone ADP tool so the output shape stays identical.

import { getDraftPicks, getLeagueDraftById, getLeaguePrimaryDraft } from "@/lib/sleeperApi";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeNum(v) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function parseLeagueDraftKey(key) {
  const s = safeStr(key).trim();
  if (!s) return { leagueId: "", draftId: null };
  const parts = s.split("::");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { leagueId: parts[0].trim(), draftId: parts[1].trim() };
  }
  return { leagueId: s, draftId: null };
}

export function formatRoundPickFromOverall(overallPick, teams) {
  const t = Number.isFinite(teams) && teams > 0 ? teams : 12;
  const x = Number.isFinite(overallPick) ? overallPick : 0;
  if (x <= 0) return "—";

  const round = Math.floor((x - 1) / t) + 1;
  const pickInRound = x - (round - 1) * t;

  const isInt = Math.abs(pickInRound - Math.round(pickInRound)) < 1e-9;
  if (isInt) {
    return `${round}.${String(Math.round(pickInRound)).padStart(2, "0")}`;
  }

  const intPart = Math.floor(pickInRound);
  const frac = pickInRound - intPart;
  const frac2 = Math.round(frac * 100);
  return `${round}.${String(intPart).padStart(2, "0")}.${String(frac2).padStart(2, "0")}`;
}

export function formatRoundPickFromAvgOverall(avgOverallPick, teams) {
  const x = Number.isFinite(avgOverallPick) ? avgOverallPick : 0;
  if (x <= 0) return "—";
  return formatRoundPickFromOverall(Math.max(1, Math.round(x)), teams);
}

function playerNameFromPick(p) {
  const m = p?.metadata || {};
  const pn = safeStr(m?.player_name).trim();
  if (pn) return pn;
  const first = safeStr(m?.first_name).trim();
  const last = safeStr(m?.last_name).trim();
  const full = `${first} ${last}`.trim();
  return full || safeStr(p?.player_id || "Unknown").trim();
}

function playerPosFromPick(p) {
  const pos = safeStr(p?.metadata?.position).trim();
  return pos || "UNK";
}

function playerKey(name, pos) {
  return `${name}|||${pos}`;
}

function finalizePlayersMap(map, teams) {
  const out = {};
  for (const [k, acc] of map.entries()) {
    const avg = acc.sumPick / acc.count;

    // mode pick_no (most common). Tie-break: earlier pick wins.
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
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }
  return out;
}

export async function getADPGroupData(leagueDraftKeys) {
  const ids = (leagueDraftKeys || []).map((s) => safeStr(s).trim()).filter(Boolean);
  if (!ids.length) {
    return { meta: { teams: 12, rounds: 15 }, leagues: [], players: {}, draftboard: { cells: {} } };
  }

  // Resolve (league,draft) -> draft meta
  const choices = ids.map(parseLeagueDraftKey).filter((x) => !!x.leagueId);
  const resolved = await Promise.all(
    choices.map(async ({ leagueId, draftId }) => {
      const draft = draftId ? await getLeagueDraftById(leagueId, draftId) : await getLeaguePrimaryDraft(leagueId);
      if (!draft) return null;
      return { leagueId, draft };
    })
  );

  const valid = resolved
    .filter((x) => !!x)
    .map((x) => ({ ...(x.draft || {}), _leagueId: x.leagueId }));

  if (!valid.length) throw new Error("No drafts found for provided league IDs.");

  const firstTeams = safeNum(valid[0]?.settings?.teams) ?? 12;
  const firstRounds = safeNum(valid[0]?.settings?.rounds) ?? 15;

  // Guard against mismatched settings
  const mismatches = valid.filter((d) => {
    const t = safeNum(d?.settings?.teams) ?? 12;
    const r = safeNum(d?.settings?.rounds) ?? 15;
    return t !== firstTeams || r !== firstRounds;
  });

  if (mismatches.length) {
    const bad = mismatches
      .slice(0, 5)
      .map((d) => {
        const lid = safeStr(d?._leagueId);
        const t = safeNum(d?.settings?.teams) ?? 12;
        const r = safeNum(d?.settings?.rounds) ?? 15;
        const n = safeStr(d?.metadata?.name);
        return `${lid} (${n || "Draft"}) [teams=${t}, rounds=${r}]`;
      })
      .join(", ");

    throw new Error(
      `League draft settings mismatch. All leagues must share the same teams/rounds as the first one (teams=${firstTeams}, rounds=${firstRounds}). Mismatch: ${bad}`
    );
  }

  const meta = { teams: firstTeams, rounds: firstRounds };

  const draftIds = valid.map((d) => safeStr(d?.draft_id)).filter(Boolean);
  const pickLists = await Promise.all(draftIds.map((draftId) => getDraftPicks(draftId)));

  const byPlayer = new Map();
  const cellToPlayers = new Map();
  const leagues = [];

  for (let i = 0; i < pickLists.length; i++) {
    const picks = pickLists[i] || [];
    const draftMeta = valid[i] || {};
    const leagueId = safeStr(draftMeta?._leagueId);
    const draftId = safeStr(draftMeta?.draft_id);
    const draftName = safeStr(draftMeta?.metadata?.name).trim();

    const byPlayerOne = new Map();
    const cellToPlayersOne = new Map();

    for (const p of picks) {
      const pickNo = safeNum(p?.pick_no);
      const round = safeNum(p?.round);
      const slot = safeNum(p?.draft_slot ?? p?.draft_slot);
      if (!pickNo || !round || !slot) continue;

      const name = playerNameFromPick(p);
      const pos = playerPosFromPick(p);
      const key = playerKey(name, pos);

      // Global player acc
      let acc = byPlayer.get(key);
      if (!acc) {
        acc = { name, pos, sumPick: 0, count: 0, pickCounts: new Map() };
        byPlayer.set(key, acc);
      }
      acc.sumPick += pickNo;
      acc.count += 1;
      acc.pickCounts.set(pickNo, (acc.pickCounts.get(pickNo) || 0) + 1);

      // Per-league player acc
      let acc1 = byPlayerOne.get(key);
      if (!acc1) {
        acc1 = { name, pos, sumPick: 0, count: 0, pickCounts: new Map() };
        byPlayerOne.set(key, acc1);
      }
      acc1.sumPick += pickNo;
      acc1.count += 1;
      acc1.pickCounts.set(pickNo, (acc1.pickCounts.get(pickNo) || 0) + 1);

      // Board cell
      const cellKey = `${round}-${slot}`;

      let cellMap = cellToPlayers.get(cellKey);
      if (!cellMap) {
        cellMap = new Map();
        cellToPlayers.set(cellKey, cellMap);
      }
      let cc = cellMap.get(key);
      if (!cc) {
        cc = { name, pos, sumPick: 0, count: 0 };
        cellMap.set(key, cc);
      }
      cc.sumPick += pickNo;
      cc.count += 1;

      let cellMap1 = cellToPlayersOne.get(cellKey);
      if (!cellMap1) {
        cellMap1 = new Map();
        cellToPlayersOne.set(cellKey, cellMap1);
      }
      let cc1 = cellMap1.get(key);
      if (!cc1) {
        cc1 = { name, pos, sumPick: 0, count: 0 };
        cellMap1.set(key, cc1);
      }
      cc1.sumPick += pickNo;
      cc1.count += 1;
    }

    leagues.push({
      leagueId,
      draftId,
      name: draftName || leagueId || draftId,
      meta,
      players: finalizePlayersMap(byPlayerOne, meta.teams),
      draftboard: { cells: finalizeCellsMap(cellToPlayersOne, meta.teams) },
    });
  }

  const players = finalizePlayersMap(byPlayer, meta.teams);
  const cells = finalizeCellsMap(cellToPlayers, meta.teams);

  return { meta, leagues, players, draftboard: { cells } };
}
