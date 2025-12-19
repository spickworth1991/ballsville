// app/mini-leagues/content.js
// Default (fallback) content + structure for the Mini-Leagues page.
// If R2 has no saved JSON yet, the site will render using this.

export const MINI_LEAGUES_SEASON = 2025;

export const miniLeaguesDefault = {
  season: MINI_LEAGUES_SEASON,

  hero: {
    kicker: "Welcome to",
    title: "the Mini-Leagues game",
    subhead: "Way-too-early, rookie-inclusive, budget Best Ball redraft leagues.",
    heroImagePath: "/photos/minileagues-hero.webp", // can be replaced via admin upload
    chips: ["Season ends after Week 14", "Game ends after Week 15", "12-team SF"],
  },

  settings: {
    title: "BALLSVILLE Settings",
    bullets: [
      "Most points wins ⚠️",
      "12-team Superflex",
      "No TEP · 2× Flex · +6 passing TD",
      "Rookie-inclusive drafting",
      "3× shuffle or quick derby",
      "No 3rd-round reversal",
      "No trading",
      "1–2 hour timers or fast draft (predetermined)",
      "Pure draft and go!",
    ],
  },

  howItWorks: {
    title: "How the Game Works",
    paragraphs: [
      "You play and win inside your league. The league winner is the team with the most points after Week 14 and earns $30 (🪙).",
      "After Week 14, a game manager will ask whether you want to wager your 🪙 or keep it. Wagering is optional.",
    ],
    withoutWager: {
      title: "Without a wager",
      bullets: ["Eligible for the Division Bonus (+$30)", "Eligible for the Championship Bonus (+$100)"],
    },
    withWager: {
      title: "With a wager",
      bullets: [
        "Eligible to win all wagers (big upside)",
        "Eligible for both bonuses above",
        "Eligible for the Wager Bonus (+$60)",
      ],
    },
    footerNote: "Bonuses stack!",
  },

  cash: {
    title: "How the Cash Works",
    bullets: [
      "$4 buy-in",
      "League winners take $30 (🪙) to keep or wager — and a shot at the 🏆",
      "🏆 $100 Championship Bonus (no wager needed)",
      "💰 $60 Wager Bonus (wager needed)",
      "$30 bonus for winning your division (×4)",
      "Many opportunities for free extras",
    ],
    paymentsTitle: "Payments",
    paymentsText: "LeagueSafe accounts are pinned inside the Sleeper leagues.",
  },

  etiquette: {
    title: "Draft Etiquette",
    bullets: [
      "Please tag the next person up.",
      "Please don’t rush people.",
      "You as a league can vote to reduce the timer after Round 10.",
      "No one auto-picks Round 1 ⚠️ If you’re absent, your spot will be substituted, and you’ll have the option to join the next draft or be refunded.",
      "If you auto at the 1.12, your next 2.01 may be pushed through.",
      "If you make a mistake, tag your managers immediately for a chance at a reversal. This does not apply to an expired clock.",
      "Manager intervention beyond that is a league vote.",
    ],
  },

  divisions: {
    title: "Divisions",
    blurb: "Each division contains 10 leagues. Click a league to open it in Sleeper.",
    items: [],
  },

  winners: {
    title: "Last Year’s Winners",
    subtitle: "Updated as results are finalized.",
    winnersImagePath: "/photos/minileagues-winners.webp",
  },
};

export function normalizeMiniLeaguesPayload(payload) {
  // Merge missing keys onto the saved payload, so future schema changes
  // don’t nuke old data.
  const d = miniLeaguesDefault;
  const p = payload && typeof payload === "object" ? payload : {};

  const out = {
    ...d,
    ...p,
    hero: { ...d.hero, ...(p.hero || {}) },
    settings: { ...d.settings, ...(p.settings || {}) },
    howItWorks: {
      ...d.howItWorks,
      ...(p.howItWorks || {}),
      withoutWager: { ...d.howItWorks.withoutWager, ...((p.howItWorks || {}).withoutWager || {}) },
      withWager: { ...d.howItWorks.withWager, ...((p.howItWorks || {}).withWager || {}) },
    },
    cash: { ...d.cash, ...(p.cash || {}) },
    etiquette: { ...d.etiquette, ...(p.etiquette || {}) },
    divisions: {
      ...d.divisions,
      ...(p.divisions || {}),
      items: Array.isArray((p.divisions || {}).items) ? (p.divisions || {}).items : d.divisions.items,
    },
    winners: { ...d.winners, ...(p.winners || {}) },
  };

  return out;
}

// Transform the raw CMS payload into a view model used by the public page.
export function buildMiniLeaguesPublicModel(payload) {
  const p = normalizeMiniLeaguesPayload(payload);

  const divisions = (p.divisions?.items || []).map(ensureDivisionShape);

  // sort: division.order, then numeric code if possible
  divisions.sort((a, b) => {
    const ao = Number.isFinite(a.order) ? a.order : 0;
    const bo = Number.isFinite(b.order) ? b.order : 0;
    if (ao !== bo) return ao - bo;
    const an = parseInt(String(a.code || ""), 10);
    const bn = parseInt(String(b.code || ""), 10);
    if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
    return String(a.code || "").localeCompare(String(b.code || ""));
  });

  // within each division, sort leagues by order
  divisions.forEach((d) => {
    d.leagues.sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : 0;
      const bo = Number.isFinite(b.order) ? b.order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  });

  return { ...p, divisions: { ...p.divisions, items: divisions } };
}

function ensureDivisionShape(div) {
  const leaguesIn = Array.isArray(div?.leagues) ? div.leagues : [];
  const leagues = leaguesIn.map((l, idx) => ensureLeagueShape(l, idx)).slice(0, 10);
  while (leagues.length < 10) leagues.push(ensureLeagueShape({}, leagues.length));

  return {
    code: div?.code ?? "",
    name: div?.name ?? "",
    status: (div?.status || "tbd").toLowerCase(),
    imagePath: div?.imagePath ?? "",
    active: div?.active !== false,
    order: Number.isFinite(div?.order) ? div.order : 0,
    leagues,
  };
}

function ensureLeagueShape(l, idx) {
  return {
    name: l?.name ?? "",
    url: l?.url ?? "",
    status: (l?.status || "tbd").toLowerCase(),
    imagePath: l?.imagePath ?? "",
    active: l?.active !== false,
    order: Number.isFinite(l?.order) ? l.order : idx + 1,
  };
}
