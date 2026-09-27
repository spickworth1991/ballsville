export function transactionWeeks(throughWeek, { fullRebuild = false, hasPrevious = false } = {}) {
  const through = Math.min(18, Math.max(1, Number(throughWeek) || 1));
  const from = fullRebuild || !hasPrevious ? 1 : Math.max(1, through - 2);
  return Array.from({ length: through - from + 1 }, (_, index) => from + index);
}

export function mergeTradeSnapshots(previousTrades, fetchedTrades, { fullRebuild = false, preserveExisting = false, season } = {}) {
  const merged = new Map((!fullRebuild && Array.isArray(previousTrades) ? previousTrades : []).map((trade) => [String(trade.id), trade]));
  for (const trade of fetchedTrades || []) {
    const key = String(trade.id);
    if (preserveExisting && merged.has(key)) continue;
    merged.set(key, trade);
  }
  return [...merged.values()].filter((trade) => season == null || String(trade.season) === String(season)).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}
