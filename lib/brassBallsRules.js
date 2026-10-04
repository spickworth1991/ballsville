const id = (value) => String(value || "").trim();

export function brassBallsWeekRules(week) {
  const number = Math.max(1, Number(week) || 1);
  const allowance = number <= 5 ? 1 : number <= 10 ? 2 : 3;
  return {
    week: number,
    attacksPerTeam: allowance,
    incomingPerTeam: allowance,
    phase: number <= 5 ? "Opening campaign" : number <= 10 ? "Expanded campaign" : "Final campaign",
  };
}

export function brassBallsMatchupContributions(pair) {
  const attacker = id(pair?.teamA?.rosterId);
  const defender = id(pair?.teamB?.rosterId);
  if (!attacker || !defender || attacker === defender) return [];
  if (String(pair?.battleType || "attack").toLowerCase() === "war") {
    return [
      { attacker, defender, battleType: "war" },
      { attacker: defender, defender: attacker, battleType: "war" },
    ];
  }
  return [{ attacker, defender, battleType: "attack" }];
}

export function brassBallsWeekUsage(matchups, rosterIds = []) {
  const empty = () => ({ attacks: 0, incoming: 0, directAttacks: 0, targetedByDirectAttacks: 0, wars: 0 });
  const usage = Object.fromEntries((rosterIds || []).map((rosterId) => [id(rosterId), empty()]));
  const ensure = (rosterId) => {
    if (!usage[rosterId]) usage[rosterId] = empty();
    return usage[rosterId];
  };
  for (const pair of matchups || []) {
    for (const contribution of brassBallsMatchupContributions(pair)) {
      ensure(contribution.attacker).attacks += 1;
      ensure(contribution.defender).incoming += 1;
      if (contribution.battleType === "war") {
        ensure(contribution.attacker).wars += 1;
      } else {
        ensure(contribution.attacker).directAttacks += 1;
        ensure(contribution.defender).targetedByDirectAttacks += 1;
      }
    }
  }
  return usage;
}

export function brassBallsAttackSlot(matchups, matchupIndex, rosterId) {
  const target = id(rosterId);
  let slot = 0;
  for (let index = 0; index <= matchupIndex; index += 1) {
    for (const contribution of brassBallsMatchupContributions(matchups?.[index])) {
      if (contribution.attacker === target) slot += 1;
    }
  }
  return slot;
}

export function validateBrassBallsWeek(week, rosterIds = []) {
  const rules = brassBallsWeekRules(week?.week);
  const usage = brassBallsWeekUsage(week?.matchups, rosterIds);
  const errors = [];
  (week?.matchups || []).forEach((pair, index) => {
    const attacker = id(pair?.teamA?.rosterId);
    const defender = id(pair?.teamB?.rosterId);
    if (attacker && defender && attacker === defender) errors.push(`Week ${rules.week}, row ${index + 1}: a team cannot attack itself.`);
    if (pair?.slotPlaceholder && attacker && !defender) errors.push(`Week ${rules.week}, row ${index + 1}: choose a defender for the generated attack slot.`);
  });
  for (const [rosterId, counts] of Object.entries(usage)) {
    if (counts.attacks > rules.attacksPerTeam) errors.push(`Week ${rules.week}: roster ${rosterId} has ${counts.attacks} attacks; the limit is ${rules.attacksPerTeam}.`);
    if (counts.incoming > rules.incomingPerTeam) errors.push(`Week ${rules.week}: roster ${rosterId} is attacked ${counts.incoming} times; the limit is ${rules.incomingPerTeam}.`);
  }
  return { rules, usage, errors, valid: errors.length === 0 };
}
