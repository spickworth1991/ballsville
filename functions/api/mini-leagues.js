// functions/api/mini-leagues.js
export async function onRequest({ env, request }) {
  try {
    const key = "admin/mini-leagues.json";

    const obj = await env.ADMIN_BUCKET.get(key);
    if (!obj) {
      // Default skeleton so the page never breaks
      const fallback = {
        hero: {
          title: "Welcome to the Mini-Leagues Game",
          subtitle:
            "Way-too-early, rookie-inclusive, budget best ball redraft leagues. Season ends after Week 14. Game ends after Week 15.",
          image: "/photos/minileagues-v2.webp",
        },
        settings: [
          "Most points wins ⚠️",
          "12 team Superflex",
          "No TEP • 2x Flex • +6 passing TD",
          "Rookie-inclusive drafting",
          "3x shuffle or quick derby",
          "No 3rd-round reversal",
          "No trading",
          "1–2hr timers or fast draft (predetermined)",
          "Pure draft-and-go",
        ],
        howItWorks: [
          "You play and win in your league. Most points after Week 14 wins $30 (🪙) in that league.",
          "After Week 14, a game manager will ask if you want to Wager your 🪙 or Keep it. Wagering is optional.",
        ],
        wagering: {
          withoutWager: [
            "Eligible to win your Division Bonus (+$30)",
            "Eligible to win the Championship Bonus (+$100)",
          ],
          withWager: [
            "Eligible to win all wagers (big upside)",
            "Eligible for both bonuses above",
            "Eligible for the Wager Bonus (+$60)",
            "Bonuses stack",
          ],
        },
        cash: [
          "$4 buy-in",
          "League Winners take $30 to keep or wager, and a shot at the 🏆",
          "$100 🏆 Bonus (no wager needed)",
          "$60 Wager Bonus (wager needed)",
          "$30 Division Bonus for winning your division (x4)",
          "Many opportunities for free extras",
          "LeagueSafe accounts are pinned in the Sleeper leagues",
        ],
        etiquette: [
          "Please tag the next person up",
          "Please don’t rush people",
          "As a league, you can vote to reduce the timer after Round 10",
          "No one auto-picks the 1st round ⚠️ If you’re absent, your spot will be substituted and you’ll have the option to join the next draft or be refunded.",
          "If you auto at 1.12, your next 2.01 is pushed through",
          "If you make a mistake, tag your managers immediately for a chance at a reversal. This does not apply to an expired clock.",
          "Manager intervention beyond that is a league vote",
        ],
        divisions: [
          { id: "100", order: 100, status: "FULL", image: "", leagues: [] },
          { id: "200", order: 200, status: "FULL", image: "", leagues: [] },
          { id: "400", order: 400, status: "FULL", image: "", leagues: [] },
        ],
        lastYear: {
          title: "Last Year’s Winners",
          // No year-specific default. Admins can upload winners when ready.
          image: "",
        },
      };

      return new Response(JSON.stringify(fallback, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    const json = await obj.text();
    return new Response(json, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
