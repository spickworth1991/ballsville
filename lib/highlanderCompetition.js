const ownerKey = (owner) => String(owner?.ownerId || owner?.rosterId || owner?.ownerName || "");
const ownerLabel = (owner) => String(owner?.username || owner?.ownerName || "Unknown manager");

export function highlanderWeekScore(owner, week) {
  const value = owner?.weekly?.[week] ?? owner?.weekly?.[String(week)];
  const number = Number(value);
  return value == null || !Number.isFinite(number) ? null : number;
}

export function buildHighlanderCompetition(owners, eliminationWeeks = 14) {
  const byLeague = new Map();
  for (const owner of Array.isArray(owners) ? owners : []) {
    const leagueName = String(owner?.leagueName || "Unknown league");
    if (!byLeague.has(leagueName)) byLeague.set(leagueName, []);
    byLeague.get(leagueName).push(owner);
  }

  const eliminations = [];
  const weeklyLeagueRows = new Map();

  for (const [leagueName, leagueOwners] of byLeague) {
    const alive = new Map(leagueOwners.map((owner) => [ownerKey(owner), owner]));
    for (let week = 1; week <= eliminationWeeks; week += 1) {
      const entrants = [...alive.values()];
      const ranked = entrants
        .filter((owner) => highlanderWeekScore(owner, week) !== null)
        .map((owner) => ({ ...owner, weekScore: highlanderWeekScore(owner, week) }))
        .sort((a, b) => b.weekScore - a.weekScore || ownerLabel(a).localeCompare(ownerLabel(b)));
      if (ranked.length < 2 || !ranked.some((owner) => owner.weekScore !== 0)) continue;

      // Once the following week has real scores, a single surviving entrant
      // dropping to zero is the strongest evidence that Sleeper emptied that
      // roster. This is more reliable than recomputing the league's best-ball
      // total locally, which can differ slightly from the official chop.
      const nextWeekStarted = entrants.some((owner) => Number(highlanderWeekScore(owner, week + 1) || 0) > 0);
      const nextWeekZeroes = nextWeekStarted
        ? ranked.filter((owner) => owner.weekScore > 0 && highlanderWeekScore(owner, week + 1) === 0)
        : [];
      const chopped = nextWeekZeroes.length === 1 ? nextWeekZeroes[0] : ranked[ranked.length - 1];
      const choppedKey = ownerKey(chopped);
      const confirmedByNextWeek = nextWeekZeroes.length === 1;

      weeklyLeagueRows.set(
        `${leagueName}|||${week}`,
        ranked.map((owner) => ({ ...owner, isChopped: ownerKey(owner) === choppedKey, eliminationConfirmed: confirmedByNextWeek })),
      );
      eliminations.push({ ...chopped, leagueName, week, isChopped: true, eliminationConfirmed: confirmedByNextWeek });
      alive.delete(choppedKey);
    }
  }

  return { byLeague, eliminations, weeklyLeagueRows };
}
