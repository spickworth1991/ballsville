// checkSleeperOpenSlots.mjs
// Run: node checkSleeperOpenSlots.mjs

const LEAGUE_IDS = [
//   paste league IDs here:
  "1322319150873313280","1313356028980527104","1319713784654200832","1322319730991693824"
];

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} for ${url}\n${text.slice(0, 200)}`);
  }
  return res.json();
}

async function checkLeague(leagueId) {
  const leagueUrl = `https://api.sleeper.app/v1/league/${leagueId}`;
  const rostersUrl = `https://api.sleeper.app/v1/league/${leagueId}/rosters`;

  const [league, rosters] = await Promise.all([
    fetchJson(leagueUrl),
    fetchJson(rostersUrl),
  ]);

  const totalTeams = Number(league?.total_rosters) || (Array.isArray(rosters) ? rosters.length : 0);

  // filled team slots = rosters that have an owner_id
  const filledTeams = Array.isArray(rosters)
    ? rosters.filter((r) => r && r.owner_id).length
    : 0;

  const openTeams = Math.max(0, totalTeams - filledTeams);

  return {
    leagueId,
    name: league?.name ?? "(no name)",
    status: league?.status ?? "(no status)",
    totalTeams,
    filledTeams,
    openTeams,
  };
}

async function main() {
  if (!LEAGUE_IDS.length) {
    console.log("Add league IDs to LEAGUE_IDS first.");
    process.exit(0);
  }

  console.log(`Checking ${LEAGUE_IDS.length} league(s)...\n`);

  for (const id of LEAGUE_IDS) {
    try {
      const out = await checkLeague(id);
      console.log(
        `${out.name} (${out.leagueId})\n` +
        `  status: ${out.status}\n` +
        `  filled: ${out.filledTeams}/${out.totalTeams}\n` +
        `  open:   ${out.openTeams}\n`
      );
    } catch (e) {
      console.log(`League ${id} FAILED: ${e?.message || e}`);
      console.log("");
    }
  }
}

main();
