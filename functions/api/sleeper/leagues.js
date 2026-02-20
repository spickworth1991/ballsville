import { getLeagueDrafts, getUserLeagues } from "@/lib/sleeperApi";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const username = (url.searchParams.get("username") || "").trim();
  const seasonParam = (url.searchParams.get("season") || "").trim();
  const includeDrafts = (url.searchParams.get("includeDrafts") || "").trim() === "1";

  if (!username) {
    return new Response(JSON.stringify({ error: "Missing username" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const season = seasonParam || String(new Date().getFullYear());

  try {
    const leagues = await getUserLeagues(username, season);

    // IMPORTANT:
    // Do NOT fan out to N draft subrequests by default.
    // Cloudflare Functions/Workers have a hard subrequest cap per request.
    // Users with many leagues can cause this endpoint to fail, which looks like
    // "some leagues don't load" in admin UIs.
    // Drafts should be fetched lazily per-league.
    if (!includeDrafts) {
      return new Response(JSON.stringify({ leagues }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // Back-compat: include drafts, but do it sequentially and cap requests.
    const leaguesWithDrafts = [];
    const list = Array.isArray(leagues) ? leagues : [];
    const CAP = 40; // stay well under CF subrequest limits
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      const league_id = String(l?.league_id || "").trim();
      const drafts = league_id && i < CAP ? await getLeagueDrafts(league_id) : [];
      leaguesWithDrafts.push({ ...l, drafts });
    }

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