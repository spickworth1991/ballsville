"use client";

import { createContext, useContext, useMemo } from "react";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeName(value) {
  return String(value || "").trim();
}

function buildTopOwners(rows, limit = 5) {
  const map = new Map();

  for (const row of safeArray(rows)) {
    const ownerName = safeName(row?.ownerName);
    if (!ownerName) continue;

    const current = map.get(ownerName) || {
      ownerName,
      teamCount: 0,
      combinedTotal: 0,
      bestTeamTotal: 0,
      leagues: new Set(),
    };

    const total = Number(row?.total || 0);
    current.teamCount += 1;
    current.combinedTotal += total;
    current.bestTeamTotal = Math.max(current.bestTeamTotal, total);

    const leagueName = safeName(row?.leagueName);
    if (leagueName) current.leagues.add(leagueName);

    map.set(ownerName, current);
  }

  return Array.from(map.values())
    .map((entry) => ({
      ownerName: entry.ownerName,
      teamCount: entry.teamCount,
      leagueCount: entry.leagues.size,
      hasPointData: entry.teamCount > 0,
      combinedTotal: Number(entry.combinedTotal.toFixed(2)),
      averageTotal: Number((entry.combinedTotal / Math.max(1, entry.teamCount)).toFixed(2)),
      bestTeamTotal: Number(entry.bestTeamTotal.toFixed(2)),
    }))
    .sort(
      (a, b) =>
        Number(b.averageTotal || 0) - Number(a.averageTotal || 0) ||
        Number(b.teamCount || 0) - Number(a.teamCount || 0) ||
        Number(b.combinedTotal || 0) - Number(a.combinedTotal || 0) ||
        a.ownerName.localeCompare(b.ownerName)
    )
    .slice(0, limit);
}

function computeFallbackYearSummary(yearBlock, perModeMinSizes) {
  let draftedTeams = 0;
  let totalLeagues = 0;
  const ownerNames = new Set();
  const modeCards = [];
  const topOwnersByMode = {};

  for (const [mode, block] of Object.entries(yearBlock || {})) {
    if (String(mode).startsWith("__")) continue;

    const min = perModeMinSizes?.[mode];
    const owners = safeArray(block?.owners);
    if (min && owners.length < min) continue;

    const draftedUniqueOwnersSet = new Set();
    owners.forEach((owner) => {
      const ownerName = safeName(owner?.ownerName);
      if (!ownerName) return;
      ownerNames.add(ownerName);
      draftedUniqueOwnersSet.add(ownerName);
    });

    draftedTeams += owners.length;
    totalLeagues += Object.values(block?.leaguesByDivision || {}).reduce(
      (sum, leagues) => sum + safeArray(leagues).length,
      0
    );

    const summary = block?.summary || {
      key: mode,
      name: block?.name || mode,
      draftedTeams: owners.length,
      draftedUniqueOwners: draftedUniqueOwnersSet.size,
      filledTeams: owners.length,
      uniqueOwnersOnceDrafted: draftedUniqueOwnersSet.size,
      preDraftTeams: null,
      draftingTeams: null,
      openDraftSlots: null,
      totalRosterSlots: null,
      totalLeagues: Object.values(block?.leaguesByDivision || {}).reduce(
        (sum, leagues) => sum + safeArray(leagues).length,
        0
      ),
      draftedLeagues: null,
      preDraftLeagues: null,
      draftingLeagues: null,
      activeDraftLeagues: null,
      topOwners: buildTopOwners(owners, 5),
    };

    modeCards.push({
      key: mode,
      name: summary.name,
      draftedTeams: summary.draftedTeams,
      draftedUniqueOwners: summary.draftedUniqueOwners,
      uniqueOwnersOnceDrafted: summary.uniqueOwnersOnceDrafted,
      preDraftTeams: summary.preDraftTeams,
      draftingTeams: summary.draftingTeams,
      totalLeagues: summary.totalLeagues,
      draftedLeagues: summary.draftedLeagues,
      draftingLeagues: summary.draftingLeagues,
      activeDraftLeagues: summary.activeDraftLeagues,
      totalRosterSlots: summary.totalRosterSlots,
      draftTypeBreakdown: summary.draftTypeBreakdown || null,
    });

    topOwnersByMode[mode] = {
      key: mode,
      name: summary.name,
      rows: safeArray(summary.topOwners).length ? summary.topOwners : buildTopOwners(owners, 5),
    };
  }

  return {
    draftedTeams,
    draftedUniqueOwners: ownerNames.size,
    filledTeams: draftedTeams,
    uniqueOwnersOnceDrafted: ownerNames.size,
    preDraftTeams: null,
    draftingTeams: null,
    openDraftSlots: null,
    totalRosterSlots: null,
    totalLeagues,
    draftedLeagues: null,
    preDraftLeagues: null,
    draftingLeagues: null,
    activeDraftLeagues: null,
    activeModes: Object.keys(topOwnersByMode),
    topOwnersByMode,
    modeCards,
  };
}

function collectDraftedOwnerNames(yearBlock, perModeMinSizes) {
  const ownerNames = new Set();

  for (const [mode, block] of Object.entries(yearBlock || {})) {
    if (String(mode).startsWith("__")) continue;

    const min = perModeMinSizes?.[mode];
    const owners = safeArray(block?.owners);
    if (min && owners.length < min) continue;

    owners.forEach((owner) => {
      const ownerName = safeName(owner?.ownerName);
      if (ownerName) ownerNames.add(ownerName);
    });
  }

  return ownerNames;
}

function countSharedOwners(sourceSet, targetSet) {
  let count = 0;
  sourceSet.forEach((ownerName) => {
    if (targetSet.has(ownerName)) count += 1;
  });
  return count;
}

function countUniqueOwners(sourceSet, targetSet) {
  let count = 0;
  sourceSet.forEach((ownerName) => {
    if (!targetSet.has(ownerName)) count += 1;
  });
  return count;
}

function buildOwnerYearComparisons(draftedOwnerNamesByYear, orderedYears) {
  return orderedYears.map((year, index) => {
    const currentOwners = draftedOwnerNamesByYear[year] || new Set();
    const previousYears = orderedYears.slice(0, index).reverse();
    const comparisons = previousYears.map((compareYear) => {
      const compareOwners = draftedOwnerNamesByYear[compareYear] || new Set();
      return {
        compareYear,
        returned: countSharedOwners(currentOwners, compareOwners),
        newOwners: countUniqueOwners(currentOwners, compareOwners),
      };
    });

    return {
      year,
      comparisons,
    };
  });
}

function computeYearStats(leaderboards, perModeMinSizes) {
  const out = {};
  const draftedOwnerNamesByYear = {};

  for (const [year, yearBlock] of Object.entries(leaderboards || {})) {
    const summary =
      yearBlock?.__summary && typeof yearBlock.__summary === "object"
        ? yearBlock.__summary
        : computeFallbackYearSummary(yearBlock, perModeMinSizes);

    out[year] = { ...summary };
    draftedOwnerNamesByYear[year] = collectDraftedOwnerNames(yearBlock, perModeMinSizes);
  }

  const orderedYears = Object.keys(out).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const ownerYearComparisons = buildOwnerYearComparisons(draftedOwnerNamesByYear, orderedYears);
  for (const year of orderedYears) {
    out[year] = {
      ...out[year],
      ownerYearComparisons,
    };
  }

  return out;
}

export const LeaderboardContext = createContext({ statsByYear: {} });

export const LeaderboardProvider = ({ children, leaderboards, perModeMinSizes }) => {
  const statsByYear = useMemo(() => {
    if (!leaderboards || typeof leaderboards !== "object") return {};
    return computeYearStats(leaderboards, perModeMinSizes);
  }, [leaderboards, perModeMinSizes]);

  const value = useMemo(() => ({ statsByYear }), [statsByYear]);

  return (
    <LeaderboardContext.Provider value={value}>
      {children}
    </LeaderboardContext.Provider>
  );
};

export const useLeaderboard = () => useContext(LeaderboardContext);
