import { getLeagueDrafts } from "@/lib/sleeperApi";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const leagueId = (url.searchParams.get("leagueId") || "").trim();

  if (!leagueId) {
    return new Response(JSON.stringify({ error: "Missing leagueId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const drafts = await getLeagueDrafts(leagueId);
    return new Response(JSON.stringify({ drafts }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Failed to load drafts", detail: String(e?.message || e) }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}