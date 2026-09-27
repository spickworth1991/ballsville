import { mergeTradeSnapshots, transactionWeeks } from "../lib/stream/trade-data.js";

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
console.log("Incremental ranges, merge replacement, stale-value preservation, and full Trade rebuild passed.");
