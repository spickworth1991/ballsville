import { buildHighlanderCompetition } from "../lib/highlanderCompetition.js";

const owners = [
  { ownerId: "A", ownerName: "A", leagueName: "Test", weekly: { 1: 10, 2: 12, 3: 14 } },
  { ownerId: "B", ownerName: "B", leagueName: "Test", weekly: { 1: 9, 2: 11, 3: 0 } },
  { ownerId: "C", ownerName: "C", leagueName: "Test", weekly: { 1: 9.1, 2: 0, 3: 0 } },
];
const result = buildHighlanderCompetition(owners, 2);
const weekOne = result.eliminations.find((row) => row.week === 1);
const weekTwo = result.eliminations.find((row) => row.week === 2);
if (weekOne?.ownerId !== "C" || !weekOne.eliminationConfirmed) throw new Error(`Week 1 did not honor the confirmed next-week disappearance: ${JSON.stringify(weekOne)}`);
if (weekTwo?.ownerId !== "B" || !weekTwo.eliminationConfirmed) throw new Error(`Week 2 did not remove only the remaining confirmed entrant: ${JSON.stringify(weekTwo)}`);
const weekTwoRows = result.weeklyLeagueRows.get("Test|||2") || [];
if (weekTwoRows.some((row) => row.ownerId === "C") || weekTwoRows.filter((row) => row.isChopped).map((row) => row.ownerId).join() !== "B") throw new Error(`Previously chopped teams leaked into the next scoreboard: ${JSON.stringify(weekTwoRows)}`);
console.log("Highlander confirmed eliminations and alive-only weekly scoreboards passed.");
