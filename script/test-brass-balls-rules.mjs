import { brassBallsAttackSlot, brassBallsTerritoryAward, brassBallsWeekRules, brassBallsWeekUsage, buildBrassBallsTerritoryState, combineReciprocalBrassBallsAttacks, validateBrassBallsWeek } from "../lib/brassBallsRules.js";

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
const combinedWar = combineReciprocalBrassBallsAttacks([{ id: "ab", teamA: { rosterId: "A" }, teamB: { rosterId: "B" }, battleType: "attack" }, { id: "ba", teamA: { rosterId: "B" }, teamB: { rosterId: "A" }, battleType: "attack" }]);
if (combinedWar.length !== 1 || combinedWar[0].battleType !== "war" || combinedWar[0].combinedAttackIds?.length !== 2) throw new Error(`Reciprocal attacks were not combined into one War: ${JSON.stringify(combinedWar)}`);
const uneven = combineReciprocalBrassBallsAttacks([{ id: "ab1", teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }, { id: "ab2", teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }, { id: "ba1", teamA: { rosterId: "B" }, teamB: { rosterId: "A" } }]);
if (uneven.length !== 2 || uneven.filter((pair) => pair.battleType === "war").length !== 1 || brassBallsWeekUsage(uneven).A.attacks !== 2 || brassBallsWeekUsage(uneven).B.incoming !== 2) throw new Error(`Uneven Week 6 reciprocal attacks combined incorrectly: ${JSON.stringify(uneven)}`);
const doubleWar = combineReciprocalBrassBallsAttacks([{ id: "ab1", teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }, { id: "ba1", teamA: { rosterId: "B" }, teamB: { rosterId: "A" } }, { id: "ab2", teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }, { id: "ba2", teamA: { rosterId: "B" }, teamB: { rosterId: "A" } }]);
if (doubleWar.length !== 2 || doubleWar.some((pair) => pair.battleType !== "war") || !validateBrassBallsWeek({ week: 6, matchups: doubleWar }, ["A", "B"]).valid) throw new Error(`Two legal Week 6 Wars failed: ${JSON.stringify(doubleWar)}`);
if (validateBrassBallsWeek({ week: 5, matchups: doubleWar }, ["A", "B"]).valid) throw new Error("Two Wars were incorrectly allowed during the one-attack phase.");
const tripleVsDouble = combineReciprocalBrassBallsAttacks([{ teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }, { teamA: { rosterId: "B" }, teamB: { rosterId: "A" } }, { teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }, { teamA: { rosterId: "B" }, teamB: { rosterId: "A" } }, { teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }]);
const finalUsage = brassBallsWeekUsage(tripleVsDouble, ["A", "B"]);
if (tripleVsDouble.length !== 3 || finalUsage.A.attacks !== 3 || finalUsage.B.attacks !== 2 || finalUsage.B.incoming !== 3 || !validateBrassBallsWeek({ week: 11, matchups: tripleVsDouble }, ["A", "B"]).valid) throw new Error(`Week 11 reciprocal pairing failed: ${JSON.stringify({ tripleVsDouble, finalUsage })}`);
const explicitWarPlusAttack = combineReciprocalBrassBallsAttacks([{ id: "war", battleType: "war", teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }, { id: "attack", battleType: "attack", teamA: { rosterId: "A" }, teamB: { rosterId: "B" } }]);
if (explicitWarPlusAttack.length !== 2 || explicitWarPlusAttack[0].battleType !== "war" || explicitWarPlusAttack[1].battleType !== "attack") throw new Error("An explicit War incorrectly consumed another direct attack.");
const warAward = brassBallsTerritoryAward({ battleType: "war", teamA: { rosterId: "A" }, teamB: { rosterId: "B" }, result: { winnerRosterId: "B" } });
const attackWin = brassBallsTerritoryAward({ battleType: "attack", teamA: { rosterId: "A" }, teamB: { rosterId: "B" }, result: { winnerRosterId: "A" } });
const defended = brassBallsTerritoryAward({ battleType: "attack", teamA: { rosterId: "A" }, teamB: { rosterId: "B" }, result: { winnerRosterId: "B" } });
if (warAward?.winner !== "B" || warAward?.loser !== "A" || warAward?.amount !== 2 || attackWin?.amount !== 1 || defended !== null) throw new Error("War/direct territory awards are incorrect.");
if (!validateBrassBallsWeek({ week: 6, matchups }, ["A", "B", "C"]).valid) throw new Error("A legal Week 6 schedule was rejected.");
if (validateBrassBallsWeek({ week: 6, matchups: [{ teamA: { rosterId: "A" }, teamB: null, slotPlaceholder: true }] }, ["A"]).valid) throw new Error("An unfinished generated attack slot was accepted.");
const invalid = validateBrassBallsWeek({ week: 6, matchups: [...matchups, { teamA: { rosterId: "A" }, teamB: { rosterId: "B" }, battleType: "attack" }] }, ["A", "B", "C"]);
if (invalid.valid || !invalid.errors.some((error) => error.includes("3 attacks")) || !invalid.errors.some((error) => error.includes("attacked 3 times"))) throw new Error(`Week 6 limits were not enforced: ${JSON.stringify(invalid.errors)}`);

const win = (attacker, defender) => ({ teamA: { rosterId: attacker }, teamB: { rosterId: defender }, battleType: "attack", result: { winnerRosterId: attacker } });
const territoryDoc = {
  teams: ["A", "B", "C", "D"].map((rosterId) => ({ rosterId })),
  weeks: [
    { week: 1, completed: true, matchups: [win("B", "C"), win("A", "B")] },
    { week: 2, completed: true, matchups: [win("B", "D"), win("A", "B")] },
    ...[3, 4, 5, 6].map((week) => ({ week, completed: true, matchups: [win("A", "B")] })),
    { week: 7, completed: true, matchups: [win("A", "B"), win("A", "B")] },
    { week: 8, completed: true, matchups: [win("A", "B"), win("C", "B")] },
  ],
};
const throughSix = buildBrassBallsTerritoryState(territoryDoc, 6);
const bAfterHomeRing = throughSix.cells.filter((cell) => cell.ownerRosterId === "B");
if (bAfterHomeRing.some((cell) => cell.homeRosterId === "B" && cell.index !== 6) || !bAfterHomeRing.some((cell) => cell.homeRosterId === "C") || !bAfterHomeRing.some((cell) => cell.homeRosterId === "D")) throw new Error(`Captured-color setup is wrong: ${JSON.stringify(bAfterHomeRing)}`);
const throughSeven = buildBrassBallsTerritoryState(territoryDoc, 7);
const weekSevenMoves = throughSeven.battles.filter((battle) => Number(battle.week) === 7);
if (weekSevenMoves.length !== 2 || weekSevenMoves.some((battle) => battle.moved !== 1) || weekSevenMoves[0].movedCellIds.join() !== "C:0" || weekSevenMoves[1].movedCellIds.join() !== "D:0") throw new Error(`Multiple attacks did not capture the defender's stolen colors in order: ${JSON.stringify(weekSevenMoves)}`);
const throughEight = buildBrassBallsTerritoryState(territoryDoc, 8);
const weekEightMoves = throughEight.battles.filter((battle) => Number(battle.week) === 8).map((battle) => battle.moved);
if (throughEight.counts.get("B") !== 0 || weekEightMoves.join() !== "1,0") throw new Error(`Multiple attacks against an exhausted defender moved invalid territory: ${JSON.stringify({ count: throughEight.counts.get("B"), weekEightMoves })}`);

console.log("Brass Balls limits, wars, usage, slot numbering, and captured-territory transfers passed.");
