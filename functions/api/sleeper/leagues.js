import { getLeagueDrafts, getUserLeagues } from "@/lib/sleeperApi";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const username = (url.searchParams.get("username") || "").trim();
  const seasonParam = (url.searchParams.get("season") || "").trim();

  if (!username) {
    return new Response(JSON.stringify({ error: "Missing username" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const season = seasonParam || String(new Date().getFullYear());

  try {
    const leagues = await getUserLeagues(username, season);
    const leaguesWithDrafts = await Promise.all(
      (leagues || []).map(async (l) => {
        const league_id = String(l?.league_id || "").trim();
        const drafts = league_id ? await getLeagueDrafts(league_id) : [];
        return { ...l, drafts };
      })
    );

    return new Response(JSON.stringify({ leagues: leaguesWithDrafts }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Failed to load leagues", detail: String(e?.message || e) }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
