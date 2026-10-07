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

export function summarizeTradeAssets(assets) {
  const rows = Array.isArray(assets) ? assets : [];
  const valued = rows.filter((asset) => asset?.value != null && Number.isFinite(Number(asset.value)));
  const projectable = rows.filter((asset) => asset?.type === "player");
  const projected = rows.filter((asset) => asset?.projection != null && Number.isFinite(Number(asset.projection)));
  return {
    totalValue: valued.length ? valued.reduce((sum, asset) => sum + Number(asset.value), 0) : null,
    valuedAssetCount: valued.length,
    unvaluedAssetCount: rows.length - valued.length,
    totalValueComplete: rows.length > 0 && valued.length === rows.length,
    totalProjection: projected.length ? Number(projected.reduce((sum, asset) => sum + Number(asset.projection), 0).toFixed(2)) : null,
    projectedAssetCount: projected.length,
    projectableAssetCount: projectable.length,
    totalProjectionComplete: projectable.length > 0 && projected.length === projectable.length,
  };
}

export function tradeValueModelForMode(mode) {
  return String(mode || "").toLowerCase().includes("dynasty") ? "dynasty" : "redraft";
}

export function tradeValueFormatForRosterPositions(rosterPositions) {
  const slots = (Array.isArray(rosterPositions) ? rosterPositions : []).map((slot) => String(slot || "").toUpperCase());
  return slots.includes("SUPER_FLEX") || slots.filter((slot) => slot === "QB").length > 1 ? "superflex" : "1qb";
}
