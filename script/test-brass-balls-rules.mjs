import { brassBallsAttackSlot, brassBallsWeekRules, brassBallsWeekUsage, validateBrassBallsWeek } from "../lib/brassBallsRules.js";

for (const [week, expected] of [[1, 1], [5, 1], [6, 2], [10, 2], [11, 3], [17, 3]]) {
  if (brassBallsWeekRules(week).attacksPerTeam !== expected) throw new Error(`Week ${week} should allow ${expected} attacks.`);
}
const matchups = [
  { teamA: { rosterId: "A" }, teamB: { rosterId: "B" }, battleType: "attack" },
  { teamA: { rosterId: "A" }, teamB: { rosterId: "C" }, battleType: "attack" },
  { teamA: { rosterId: "B" }, teamB: { rosterId: "C" }, battleType: "war" },
];
const usage = brassBallsWeekUsage(matchups, ["A", "B", "C"]);
if (usage.A.attacks !== 2 || usage.A.directAttacks !== 2 || usage.B.incoming !== 2 || usage.B.wars !== 1 || usage.C.attacks !== 1 || usage.C.wars !== 1 || usage.C.incoming !== 2) throw new Error(`Multi-attack or war usage is wrong: ${JSON.stringify(usage)}`);
if (brassBallsAttackSlot(matchups, 1, "A") !== 2 || brassBallsAttackSlot(matchups, 2, "B") !== 1 || brassBallsAttackSlot(matchups, 2, "C") !== 1) throw new Error("Attack slot numbering is wrong.");
if (!validateBrassBallsWeek({ week: 6, matchups }, ["A", "B", "C"]).valid) throw new Error("A legal Week 6 schedule was rejected.");
if (validateBrassBallsWeek({ week: 6, matchups: [{ teamA: { rosterId: "A" }, teamB: null, slotPlaceholder: true }] }, ["A"]).valid) throw new Error("An unfinished generated attack slot was accepted.");
const invalid = validateBrassBallsWeek({ week: 6, matchups: [...matchups, { teamA: { rosterId: "A" }, teamB: { rosterId: "B" }, battleType: "attack" }] }, ["A", "B", "C"]);
if (invalid.valid || !invalid.errors.some((error) => error.includes("3 attacks")) || !invalid.errors.some((error) => error.includes("attacked 3 times"))) throw new Error(`Week 6 limits were not enforced: ${JSON.stringify(invalid.errors)}`);
console.log("Brass Balls Week 5/6/10/11 limits, wars, usage, and slot numbering passed.");
