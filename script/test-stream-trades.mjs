import { mergeTradeSnapshots, summarizeTradeAssets, tradeValueFormatForRosterPositions, tradeValueModelForMode, transactionWeeks } from "../lib/stream/trade-data.js";

if (transactionWeeks(10, { hasPrevious: true }).join(",") !== "8,9,10") throw new Error("Incremental trade range should contain only the latest three weeks.");
if (transactionWeeks(4, { fullRebuild: true, hasPrevious: true }).join(",") !== "1,2,3,4") throw new Error("Full rebuild should include every week.");
const previous = [{ id: "old", season: "2026", timestamp: 1 }, { id: "same", season: "2026", timestamp: 2, value: 900 }];
const incoming = [{ id: "same", season: "2026", timestamp: 3, value: 950 }, { id: "new", season: "2026", timestamp: 4 }];
const incremental = mergeTradeSnapshots(previous, incoming, { season: "2026" });
if (incremental.length !== 3 || incremental.find((trade) => trade.id === "same")?.value !== 950) throw new Error("Incremental trade merge did not retain old trades and replace fetched IDs.");
const staleValues = mergeTradeSnapshots(previous, incoming, { season: "2026", preserveExisting: true });
if (staleValues.find((trade) => trade.id === "same")?.value !== 900) throw new Error("Optional value failure did not preserve the last saved trade enrichment.");
const rebuilt = mergeTradeSnapshots(previous, incoming, { season: "2026", fullRebuild: true });
if (rebuilt.length !== 2 || rebuilt.some((trade) => trade.id === "old")) throw new Error("Full trade rebuild unexpectedly retained an old snapshot-only trade.");
const partial = summarizeTradeAssets([{ type: "player", value: 4200, projection: 14.2 }, { type: "faab", value: null, projection: null }, { type: "player", value: 1800, projection: 7.1 }]);
if (partial.totalValue !== 6000 || partial.valuedAssetCount !== 2 || partial.unvaluedAssetCount !== 1 || partial.totalValueComplete || partial.totalProjection !== 21.3 || partial.projectableAssetCount !== 2 || !partial.totalProjectionComplete) throw new Error(`Partial asset totals are wrong: ${JSON.stringify(partial)}`);
if (tradeValueModelForMode("dynasty") !== "dynasty" || tradeValueModelForMode("dynasty_superflex") !== "dynasty" || tradeValueModelForMode("redraft") !== "redraft" || tradeValueModelForMode("gauntlet") !== "redraft") throw new Error("Trade value model selection is wrong.");
if (tradeValueFormatForRosterPositions(["QB", "RB", "WR", "FLEX"]) !== "1qb" || tradeValueFormatForRosterPositions(["QB", "RB", "SUPER_FLEX"]) !== "superflex" || tradeValueFormatForRosterPositions(["QB", "QB", "RB"]) !== "superflex") throw new Error("1QB/Superflex league detection is wrong.");
console.log("Incremental ranges, merge replacement, partial totals, mode-aware values, stale-value preservation, and full Trade rebuild passed.");
