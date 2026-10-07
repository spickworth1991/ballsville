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

export function combineReciprocalBrassBallsAttacks(matchups) {
  const rows = Array.isArray(matchups) ? matchups : [];
  const used = new Set();
  const combined = [];
  for (let index = 0; index < rows.length; index += 1) {
    if (used.has(index)) continue;
    const pair = rows[index];
    const attacker = id(pair?.teamA?.rosterId);
    const defender = id(pair?.teamB?.rosterId);
    if (!attacker || !defender || String(pair?.battleType || "attack").toLowerCase() === "war") {
      combined.push(pair);
      continue;
    }
    const reciprocalIndex = rows.findIndex((candidate, candidateIndex) => candidateIndex > index && !used.has(candidateIndex) && String(candidate?.battleType || "attack").toLowerCase() !== "war" && id(candidate?.teamA?.rosterId) === defender && id(candidate?.teamB?.rosterId) === attacker);
    if (reciprocalIndex < 0) {
      combined.push(pair);
      continue;
    }
    const reciprocal = rows[reciprocalIndex];
    used.add(reciprocalIndex);
    combined.push({ ...pair, battleType: "war", result: null, combinedAttackIds: [pair?.id, reciprocal?.id].filter(Boolean) });
  }
  return combined;
}

export function brassBallsTerritoryAward(pair) {
  const attacker = id(pair?.teamA?.rosterId);
  const defender = id(pair?.teamB?.rosterId);
  const winner = id(pair?.result?.winnerRosterId);
  if (!attacker || !defender || !winner) return null;
  if (String(pair?.battleType || "attack").toLowerCase() === "war") {
    if (winner !== attacker && winner !== defender) return null;
    return { winner, loser: winner === attacker ? defender : attacker, amount: 2 };
  }
  return winner === attacker ? { winner: attacker, loser: defender, amount: 1 } : null;
}

export function buildBrassBallsTerritoryState(doc, throughWeek = 18) {
  const teams = Array.isArray(doc?.teams) ? doc.teams : [];
  const cells = teams.flatMap((team) =>
    Array.from({ length: 7 }, (_, index) => ({
      id: `${team.rosterId}:${index}`,
      homeRosterId: id(team.rosterId),
      ownerRosterId: id(team.rosterId),
      index,
    })),
  );
  const battles = [];

  const transfer = (winner, loser, amount) => {
    const available = cells
      .filter((cell) => cell.ownerRosterId === loser)
      .sort((a, b) => {
        const priority = (cell) => {
          // Strip the outside of the defender's home cluster first. If that
          // ring is gone, territory the defender captured from other colors
          // remains attackable. Their center stronghold is the final tile.
          if (cell.homeRosterId === loser && cell.index !== 6) return 0;
          if (cell.homeRosterId !== loser) return 1;
          return 2;
        };
        return priority(a) - priority(b) || a.index - b.index || a.id.localeCompare(b.id);
      });
    const selected = available.slice(0, Math.max(0, Number(amount) || 0));
    selected.forEach((cell) => { cell.ownerRosterId = winner; });
    return selected;
  };

  [...(doc?.weeks || [])]
    .sort((a, b) => Number(a?.week || 0) - Number(b?.week || 0))
    .filter((week) => week?.completed && Number(week?.week || 0) <= Number(throughWeek || 0))
    .forEach((week) => (week.matchups || []).forEach((pair) => {
      const award = brassBallsTerritoryAward(pair);
      const movedCells = award ? transfer(award.winner, award.loser, award.amount) : [];
      battles.push({ week: week.week, pair, moved: movedCells.length, movedCellIds: movedCells.map((cell) => cell.id) });
    }));

  const counts = new Map(teams.map((team) => [id(team.rosterId), 0]));
  cells.forEach((cell) => counts.set(cell.ownerRosterId, (counts.get(cell.ownerRosterId) || 0) + 1));
  return { counts, cells, battles };
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
