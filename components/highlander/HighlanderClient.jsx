"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { adminR2Url as r2Url } from "@/lib/r2Client";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

const HERO_STATIC = {
  eyebrow: "WELCOME TO",
  title: "Highlander",
  subtitle:
    "10x Guillotine leagues. Survive Weeks 1–14, then wager in Weeks 15–17 for the $500 Highlander crown. There can only be one.",
};

const DEFAULT_EDITABLE = {
  hero: {
    promoImageKey: "",
    promoImageUrl: "/photos/highlandermain.png",
    updatesHtml: "<p>Highlander updates will show here.</p>",
  },
};

const STATUS_LABEL = {
  full: "FULL",
  filling: "FILLING",
  drafting: "DRAFTING",
  tbd: "TBD",
};

const STATUS_BADGE = {
  full: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  filling: "bg-amber-500/15 text-amber-200 border-amber-400/20",
  drafting: "bg-sky-500/15 text-sky-200 border-sky-400/20",
  tbd: "bg-zinc-500/15 text-zinc-200 border-zinc-400/20",
};

function statusBadge(raw) {
  const s = safeStr(raw).trim().toLowerCase();
  if (s === "full") return STATUS_LABEL.full;
  if (s === "filling") return STATUS_LABEL.filling;
  if (s === "drafting") return STATUS_LABEL.drafting;
  return STATUS_LABEL.tbd;
}

function normLeague(l, idx) {
  const active = l?.active !== false;
  const order = Number(l?.order);
  return {
    id: safeStr(l?.id || l?.slug || `lg_${idx + 1}`),
    name: safeStr(l?.name || `League ${idx + 1}`),
    url: safeStr(l?.url || ""),
    status: safeStr(l?.status || "tbd").toLowerCase(),
    active,
    order: Number.isFinite(order) ? order : idx + 1,

    imageKey: safeStr(l?.imageKey || l?.image_key || "").trim(),
    imageUrl: safeStr(l?.imageUrl || l?.image_url || "").trim(),
  };
}

const RULES_DOC =
  "https://docs.google.com/document/d/1Rsyn7ZP_O7JjTloDrPcLqVwC8YpUh4QWvtqAUGjimfc/edit?usp=sharing";

// per your message: template is the spreadsheet
const TEMPLATE_SHEET =
  "https://docs.google.com/spreadsheets/d/1rKt9VKAnV45iDvLpPG7KMo9Og6AU4AQk35YlisDXRkQ/edit?gid=0#gid=0";

export default function HighlanderClient({ season }) {
  const [editable, setEditable] = useState(DEFAULT_EDITABLE);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rosterTab, setRosterTab] = useState("w1");

  const list = useMemo(() => {
    const arr = safeArray(leagues).map(normLeague);
    arr.sort((a, b) => (a.order || 0) - (b.order || 0));
    return arr.filter((l) => l.active);
  }, [leagues]);

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      setErr("");
      setLoading(true);
      const bust = Date.now();

      try {
        const pageRes = await fetch(
          r2Url(`content/highlander/page_${season}.json?v=${bust}`)
        );
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          const hero = pageData?.hero || {};
          const promoKey = safeStr(hero?.promoImageKey || "").trim();
          const promoUrl = safeStr(hero?.promoImageUrl || "").trim();
          const updatesHtml = safeStr(hero?.updatesHtml || "").trim();
          if (alive) {
            setEditable({
              hero: {
                promoImageKey: promoKey,
                promoImageUrl: promoUrl || DEFAULT_EDITABLE.hero.promoImageUrl,
                updatesHtml: updatesHtml || DEFAULT_EDITABLE.hero.updatesHtml,
              },
            });
          }
        } else if (alive) {
          setEditable(DEFAULT_EDITABLE);
        }

        const lRes = await fetch(
          r2Url(`data/highlander/leagues_${season}.json?v=${bust}`)
        );
        if (lRes.ok) {
          const lData = await lRes.json();
          const raw = safeArray(lData?.leagues);
          if (alive) setLeagues(raw);
        } else if (alive) {
          setLeagues([]);
        }
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load Highlander content.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, [season]);

  const promoSrc = useMemo(() => {
    const key = safeStr(editable?.hero?.promoImageKey || "").trim();
    const fallback =
      safeStr(editable?.hero?.promoImageUrl || "").trim() ||
      DEFAULT_EDITABLE.hero.promoImageUrl;
    return key ? r2Url(`${key}?v=${Date.now()}`) : fallback;
  }, [editable]);

  const LeaguesGrid = () => {
  if (err) {
    return (
      <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
        {err}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-2xl border border-subtle bg-card-surface p-6 text-muted">
        Loading…
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-subtle bg-card-surface p-6 text-muted">
        Leagues will appear here when they’re posted.
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-4">
      {list.map((l) => {
        const label = statusBadge(l.status);
        const badgeClass =
          STATUS_BADGE[safeStr(l.status).toLowerCase()] || STATUS_BADGE.tbd;
        const joinable =
          !!l.url && (l.status === "filling" || l.status === "drafting" || l.status === "tbd");

        const cardImgSrc = l.imageKey ? r2Url(`${l.imageKey}?v=${Date.now()}`) : l.imageUrl || "";

        return (
          <div
            key={l.id}
            className="rounded-2xl border border-subtle bg-card-surface shadow-sm overflow-hidden"
          >
            {cardImgSrc ? (
              <div className="relative aspect-[99/100] w-full">
                <Image
                  src={cardImgSrc}
                  alt={safeStr(l.name)}
                  fill
                  className="object-contain object-top"
                  sizes="(max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            ) : null}

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-primary">{l.name}</div>
                  <div className="mt-1 text-xs text-muted">
                    18 teams • Guillotine • Best Ball
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${badgeClass}`}>
                  {label}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                {joinable ? (
                  <a className="btn btn-primary" href={l.url} target="_blank" rel="noreferrer">
                    Join
                  </a>
                ) : (
                  <button className="btn btn-subtle" disabled>
                    Join
                  </button>
                )}
                <div className="text-[11px] text-muted">
                  {l.url ? "Link available" : "Link soon"}
                </div>
              </div>
            </div>

            <div className="h-1 bg-gradient-to-r from-[rgba(59,130,246,0.25)] via-[rgba(236,72,153,0.25)] to-[rgba(245,158,11,0.25)]" />
          </div>
        );
      })}
    </div>
  );
};

  return (
    <div className="space-y-1 sm:space-y-1">
      {/* HERO */}
      <section className="section pt-0">
        <div className="container-site">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card-trans backdrop-blur-sm shadow-xl shadow-black/40">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/25" />
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-9">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <p className="text-xs tracking-widest text-muted uppercase">
                  {HERO_STATIC.eyebrow}
                </p>
                <h1 className="mt-2 text-4xl sm:text-5xl font-semibold text-primary">
                  {HERO_STATIC.title}
                </h1>
                <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
                  {HERO_STATIC.subtitle}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-subtle px-3 py-1 bg-card-surface">
                    <span className="text-xs text-muted">18 Teams</span>
                    <span className="text-xs text-muted">•</span>
                    <span className="text-xs text-muted">Guillotine</span>
                    <span className="text-xs text-muted">•</span>
                    <span className="text-xs text-muted">Best Ball</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-subtle px-3 py-1 bg-card-surface">
                    <span className="text-xs text-muted">12 Round Draft</span>
                    <span className="text-xs text-muted">•</span>
                    <span className="text-xs text-muted">$200 FAAB</span>
                  </span>
                </div>
              </div>

              <div className="lg:col-span-6">
                {promoSrc ? (
                  <div className="relative w-full overflow-hidden rounded-2xl border border-subtle bg-black/20">
                    <div
                      className="relative mx-auto flex items-center justify-center w-full"
                      style={{ height: "clamp(220px, 26vw, 340px)" }}
                    >
                      <Image
                        src={promoSrc}
                        alt="Highlander"
                        width={1600}
                        height={900}
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-contain p-20"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MANAGER UPDATES (TOP, UNDER HERO) */}
      <section className="section pt-0">
        <div className="container-site">
          <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-widest text-muted uppercase">
                  Manager Updates
                </p>
                <p className="mt-2 text-sm text-muted">
                  Updates below are maintained by the game managers.
                </p>
              </div>
            </div>

            <div
              className="prose prose-invert max-w-none mt-4 text-sm"
              dangerouslySetInnerHTML={{
                __html: safeStr(editable?.hero?.updatesHtml || ""),
              }}
            />
          </div>
        </div>
      </section>


      {/* TEMPLATE CTA */}
        <section className="section pt-0">
          <div className="container-site">
            <div className="rounded-2xl border border-subtle bg-card-surface p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs tracking-widest text-muted uppercase">League Tracking</p>
                  <div className="mt-1 text-lg font-semibold text-primary">
                    Official Highlander League Template
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    This is the spreadsheet used to track every Highlander league (coins, eliminations, wagers).
                  </p>
                </div>

                <a
                  href={TEMPLATE_SHEET}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary whitespace-nowrap"
                >
                  Open Template
                </a>
              </div>
            </div>
          </div>
        </section>

      {/* RULES + PAYOUTS */}
      <section className="section pt-0">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT */}
            <div className="lg:col-span-8 rounded-2xl border border-subtle bg-card-surface shadow-sm p-5 sm:p-7">
              <p className="text-xs tracking-widest text-muted uppercase">
                How to Play
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-primary">
                Survive. Stack coins. Wager for the crown.
              </h2>
              <p className="mt-2 text-sm sm:text-base text-muted leading-relaxed">
                You play and win in your league, with the option to play the game. 

Each week here,  you fight to avoid the chopping block.
The lowest-scoring team is eliminated.

                Weeks 1–14 are elimination. Weeks 15–17 are the BALLSVILLE wager phase.
              </p>

              {/* Timeline (less boxy, more premium) */}
              <div className="mt-6 rounded-2xl border border-subtle bg-subtle-surface p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex gap-4 rounded-xl border border-subtle bg-card-surface p-4">
                    <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-subtle bg-card-trans text-sm">
                      🔪
                    </div>
                    <div>
                      <div className="text-text font-semibold">
                        Weeks 1–14 • Survival Phase
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        Lowest weekly scorer is eliminated. No mercy, no ties to fate. Eliminated rosters hit waivers.
                       Includes <a href="#roster-expansion" className="underline font-bold">
                                  roster expansion
                                </a> after Weeks 3, 6, 9, and 12.
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 rounded-xl border border-subtle bg-card-surface p-4">
                    <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-subtle bg-card-trans text-sm">
                      🪙
                    </div>
                    <div>
                      <div className="text-text font-semibold">
                        End of Week 14 • Coins
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        Four players remain. Each surviving player receives{" "}
                        <span className="text-text font-semibold">one coin ($25)</span>.
                      </div>
                    </div>
                  </div>

                  {/* WEEK 15 */}
                    <div className="flex gap-4 rounded-xl border border-subtle bg-card-surface p-4">
                      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-subtle bg-card-trans text-sm">
                        🎲
                      </div>
                      <div className="w-full">
                        <div className="text-text font-semibold">
                          Week 15 • “The BALLSVILLE game begins. Time to wager.”
                        </div>

                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl border border-subtle bg-subtle-surface p-3">
                            <div className="text-text font-semibold">Be Safe</div>
                            <div className="mt-1 text-muted">
                              Keep your 🪙 coin. Guaranteed <span className="text-text font-semibold">$25</span> payout.
                            </div>
                          </div>

                          <div className="rounded-xl border border-subtle bg-subtle-surface p-3">
                            <div className="text-text font-semibold">Play the game</div>
                            <div className="mt-1 text-muted">
                              Throw your 🪙 coin into the pot to compete against the other wagering players in your league.
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-subtle bg-subtle-surface p-3 text-sm">
                          <div className="text-text font-semibold">After Week 15</div>
                          <ul className="mt-2 list-disc pl-5 text-muted space-y-1">
                            <li>
                              Highest scorer among the <span className="text-text font-semibold">wagering players</span> wins the league pot
                              and all 🪙’s wagered.
                            </li>
                            <li>Two players are eliminated. Two players survive.</li>
                            <li className="text-text">
                              You can lose the wagers and still advance — <span className="font-semibold">two players move on</span>.
                            </li>
                          </ul>
                        </div>

                        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm">
                          <div className="text-amber-200 font-semibold">⚠️ Roster Lock</div>
                          <div className="mt-1 text-muted">
                            Thursday following Week 15 (~7pm EST), all remaining rosters are locked moving forward
                            to prevent all champions from having the same rosters.
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-muted">
                          Both surviving players receive <span className="text-text font-semibold">(🪙🪙🪙) three additional coins ($75)</span>.
                          They now face another decision.
                        </div>
                      </div>
                    </div>

                    {/* WEEK 16 */}
                    <div className="flex gap-4 rounded-xl border border-subtle bg-card-surface p-4">
                      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-subtle bg-card-trans text-sm">
                        ⚖️
                      </div>
                      <div className="w-full">
                        <div className="text-text font-semibold">Week 16 • League Finals</div>

                        <div className="mt-2 rounded-xl border border-subtle bg-subtle-surface p-3 text-sm">
                          <div className="text-text font-semibold">As Week 16 begins, each finalist may:</div>
                          <ul className="mt-2 list-disc pl-5 text-muted space-y-1">
                            <li>Keep coins (guaranteed payouts)</li>
                            <li>Wager coins</li>
                            <li>Negotiate a split</li>
                          </ul>
                          <div className="mt-2 text-muted">
                            (Week 15 has many variables — max upside is shown below.)
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-subtle bg-subtle-surface p-3 text-sm">
                          <div className="text-text font-semibold">But ultimately…</div>
                          <div className="mt-1 text-muted">
                            🔥 They go head-to-head in Week 16.
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-muted">
                          After Week 16, the winner receives all major coins in play plus{" "}
                          <span className="text-text font-semibold">(🪙🪙🪙🪙) four bonus coins ($100)</span>.
                        </div>
                      </div>
                    </div>

                    {/* WEEK 17 */}
                    <div className="flex gap-4 rounded-xl border border-subtle bg-card-surface p-4">
                      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-subtle bg-card-trans text-sm">
                        🌌
                      </div>
                      <div className="w-full">
                        <div className="text-text font-semibold">Week 17 • The Highlander Game</div>

                        <div className="mt-2 rounded-xl border border-subtle bg-subtle-surface p-3 text-sm">
                          <div className="text-muted">
                            Ten leagues. Each league produces <span className="text-text font-semibold">one League Winner</span>.
                            These ten winners advance to the <span className="text-text font-semibold">Game Championship</span> in Week 17.
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-subtle bg-subtle-surface p-3 text-sm">
                          <div className="text-text font-semibold">League Winners (Week 17 rules)</div>
                          <ul className="mt-2 list-disc pl-5 text-muted space-y-1">
                            <li>Each winner enters with their accumulated bankroll (coins & wagers).</li>
                            <li>Wagers can be placed in <span className="text-text font-semibold">$50 increments</span>.</li>
                            <li>Any amount may be wagered.</li>
                            <li className="text-text font-semibold">No wager = no entry. You MUST wager to compete.</li>
                          </ul>
                          <div className="mt-2 text-muted">
                            🏆 Grand Prize: <span className="text-text font-semibold">$500</span>
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-muted">
                          Only one survives. Only one claims the throne. Only one Highlander.
                        </div>
                      </div>
                    </div>
                </div>
              </div>

              {/* Roster Expansion (visual chart like the sheet, NO horizontal scroll) */}
                <div
                  id="roster-expansion"
                  className="mt-6 rounded-2xl border border-subtle bg-card-trans p-4 sm:p-6 scroll-mt-24"
                >
                 <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-primary">Roster Expansion</h3>
                      <p className="mt-1 text-sm text-muted">
                        After Weeks 3, 6, 9, and 12, roster slots expand.
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const COLS = [
                      {
                        key: "w1",
                        title: "w1 - w3",
                        slots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH"],
                      },
                      {
                        key: "w4",
                        title: "w4 - w6",
                        slots: ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH"],
                      },
                      {
                        key: "w7",
                        title: "w7 - w9",
                        slots: ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH"],
                      },
                      {
                        key: "w10",
                        title: "w10 - w12",
                        slots: ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX", "SUPERFLEX", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH"],
                      },
                      {
                        key: "w13",
                        title: "w13 - END",
                        // ✅ add the missing 5 bench spots (13 BENCH total for this phase)
                        slots: [
                          "QB",
                          "RB",
                          "RB",
                          "RB",
                          "WR",
                          "WR",
                          "WR",
                          "TE",
                          "TE",
                          "FLEX",
                          "FLEX",
                          "SUPERFLEX",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                          "BENCH",
                        ],
                      },
                    ];

                    const slotClass = (s) => {
                      switch (s) {
                        case "QB":
                          return "bg-rose-900/70 border-rose-200/10 text-rose-50";
                        case "RB":
                          return "bg-emerald-900/70 border-emerald-200/10 text-emerald-50";
                        case "WR":
                          return "bg-sky-900/70 border-sky-200/10 text-sky-50";
                        case "TE":
                          return "bg-amber-900/70 border-amber-200/10 text-amber-50";
                        case "FLEX":
                          return "bg-cyan-900/60 border-cyan-200/10 text-cyan-50";
                        case "SUPERFLEX":
                          return "bg-fuchsia-900/60 border-fuchsia-200/10 text-fuchsia-50";
                        case "BENCH":
                        default:
                          return "bg-zinc-900/70 border-white/10 text-zinc-100";
                      }
                    };

                    const maxRows = Math.max(...COLS.map((c) => c.slots.length));

                    return (
                      <div className="mt-4">
                        {/* Tabs ONLY on the smallest screens */}
                        <div className="sm:hidden mb-3">
                          <div className="grid grid-cols-5 gap-1 rounded-xl border border-subtle bg-black/20 p-1">
                            {COLS.map((c) => {
                              const active = rosterTab === c.key;
                              return (
                                <button
                                  key={c.key}
                                  onClick={() => setRosterTab(c.key)}
                                  className={[
                                    "rounded-lg px-2 py-2 text-[10px] font-semibold uppercase tracking-widest",
                                    active
                                      ? "bg-card-surface text-text border border-subtle"
                                      : "text-muted",
                                  ].join(" ")}
                                  type="button"
                                >
                                  {c.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* FULL 5-col grid ONLY when aside is actually beside (lg+) */}
                        <div className="hidden lg:grid grid-cols-5 gap-2 sm:gap-3">
                          {COLS.map((c) => (
                            <div key={c.key} className="rounded-2xl border border-subtle bg-black/20 p-2 sm:p-3">
                              <div className="rounded-xl border border-subtle bg-black/40 px-2 py-2 text-center text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-muted">
                                {c.title}
                              </div>

                              <div className="mt-2 space-y-1.5">
                                {Array.from({ length: maxRows }).map((_, i) => {
                                  const s = c.slots[i];
                                  return s ? (
                                    <div
                                      key={`${c.key}_${i}`}
                                      className={[
                                        "h-8 rounded-lg border px-2 flex items-center justify-center text-xs font-semibold",
                                        slotClass(s),
                                      ].join(" ")}
                                    >
                                      {s}
                                    </div>
                                  ) : (
                                    <div key={`${c.key}_${i}`} className="h-8 rounded-lg border border-transparent" />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* MID layout (sm -> md): show 3 columns, no tabs, no single-column */}
                        <div className="hidden sm:grid lg:hidden grid-cols-5 gap-2">
                          {COLS.map((c) => (
                            <div key={c.key} className="rounded-2xl border border-subtle bg-black/20 p-2">
                              <div className="rounded-xl border border-subtle bg-black/40 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-muted">
                                {c.title}
                              </div>

                              <div className="mt-2 space-y-1.5">
                                {c.slots.map((s, i) => (
                                  <div
                                    key={`${c.key}_${i}`}
                                    className={[
                                      "h-8 rounded-lg border px-2 flex items-center justify-center text-xs font-semibold",
                                      slotClass(s),
                                    ].join(" ")}
                                  >
                                    {s}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* TRUE mobile (xs): single column, sizes to selected week */}
                        <div className="sm:hidden">
                          {COLS.filter((c) => c.key === rosterTab).map((c) => (
                            <div key={c.key} className="rounded-2xl border border-subtle bg-black/20 p-2">
                              <div className="rounded-xl border border-subtle bg-black/40 px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted">
                                {c.title}
                              </div>

                              <div className="mt-2 space-y-1.5">
                                {c.slots.map((s, i) => (
                                  <div
                                    key={`${c.key}_${i}`}
                                    className={[
                                      "h-9 rounded-lg border px-2 flex items-center justify-center text-sm font-semibold",
                                      slotClass(s),
                                    ].join(" ")}
                                  >
                                    {s}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

            {/* RIGHT */}
            <aside className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm p-5">
              <p className="text-xs tracking-widest text-muted uppercase">Payouts & Wagers</p>
              <h3 className="mt-2 text-xl font-semibold text-primary">$25 Buy-In</h3>

              <p className="mt-2 text-sm text-muted leading-relaxed">
                Each league has <span className="text-text font-semibold">18 teams</span>{" "}
                (<span className="text-text font-semibold">$450</span> total).{" "}
                <span className="text-text font-semibold">$50</span> funds the Game Championship pool, and{" "}
                <span className="text-text font-semibold">$50</span> goes to BALLSVILLE for giveaways/freebies/expenses.
              </p>

              {/* Quick clarity strip */}
              <div className="mt-4 rounded-2xl border border-subtle bg-card-trans p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted">Who gets paid?</div>
                  <div className="text-text font-semibold">Only teams still alive.</div>
                </div>
                <div className="mt-2 text-muted">
                  “Coins” are <span className="text-text font-semibold">$25</span> units earned by survivors and used for
                  guaranteed payouts or wagering.
                </div>
              </div>

              {/* Milestones */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-subtle bg-subtle-surface">
                <div className="grid grid-cols-12 gap-0 border-b border-subtle bg-card-surface/60 px-3 py-2 text-[11px] uppercase tracking-widest text-muted">
                  <div className="col-span-4">Milestone</div>
                  <div className="col-span-4 text-right">Teams</div>
                  <div className="col-span-4 text-right">What happens</div>
                </div>

                {[
                  {
                    label: "End of Week 14",
                    teams: "4 remain",
                    happens: "Each survivor earns 🪙 1 coin ($25)",
                  },
                  {
                    label: "After Week 15",
                    teams: "2 finalists",
                    happens: "Each finalist earns 🪙🪙🪙 (+$75 in coins)",
                  },
                  {
                    label: "After Week 16",
                    teams: "1 league winner",
                    happens: "Winner earns 🪙🪙🪙🪙 (+$100 in coins)",
                  },
                ].map((r) => (
                  <div
                    key={r.label}
                    className="grid grid-cols-12 gap-0 px-3 py-3 border-b border-subtle last:border-b-0 text-sm"
                  >
                    <div className="col-span-4 text-text font-semibold">{r.label}</div>
                    <div className="col-span-4 text-right text-muted">{r.teams}</div>
                    <div className="col-span-4 text-right text-text font-semibold">{r.happens}</div>
                  </div>
                ))}
              </div>

              {/* Wager phase explanation */}
              <div className="mt-4 rounded-2xl border border-subtle bg-card-trans p-4 text-sm">
                <div className="text-text font-semibold">Weeks 15–17: Wager Phase</div>
                <div className="mt-1 text-muted leading-relaxed">
                  Coins can be kept for guaranteed payouts or wagered to compete for bigger pots.
                  Wagers are placed in <span className="text-text font-semibold">$50 increments</span>.
                </div>

                <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm">
                  <div className="text-amber-200 font-semibold">Week 17 entry rule</div>
                  <div className="mt-1 text-muted">
                    <span className="text-text font-semibold">No wager = no entry.</span>{" "}
                    To play for the $500 crown, you must wager.
                  </div>
                </div>
              </div>

              {/* Max upside table (keep yours, but clarify columns) */}
              <div className="mt-4 rounded-2xl border border-subtle bg-card-trans p-4">
                <div className="text-sm text-muted">Max Upside (if everyone wagers)</div>

                <div className="mt-3 overflow-hidden rounded-xl border border-subtle bg-subtle-surface">
                  <div className="grid grid-cols-12 gap-0 border-b border-subtle bg-card-surface/60 px-3 py-2 text-[11px] uppercase tracking-widest text-muted">
                    <div className="col-span-4">Week</div>
                    <div className="col-span-4 text-right">Pot you can win</div>
                    <div className="col-span-2 text-right">Bonus</div>
                    <div className="col-span-2 text-right">Odds</div>
                  </div>

                  {[
                    { week: "Week 15", pot: "$100", bonus: "$75", odds: "1/4" },
                    { week: "Week 16", pot: "$250", bonus: "$100", odds: "1/2" },
                    { week: "Week 17", pot: "$3,500", bonus: "$500", odds: "1/10" },
                  ].map((r) => (
                    <div
                      key={r.week}
                      className="grid grid-cols-12 gap-0 px-3 py-3 border-b border-subtle last:border-b-0 text-sm"
                    >
                      <div className="col-span-4 text-text font-semibold">{r.week}</div>
                      <div className="col-span-4 text-right text-text font-semibold">{r.pot}</div>
                      <div className="col-span-2 text-right text-text font-semibold">{r.bonus}</div>
                      <div className="col-span-2 text-right">
                        <span className="inline-flex items-center rounded-full border border-subtle bg-card-surface px-2 py-0.5 text-xs text-text font-semibold">
                          {r.odds}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 text-xs text-muted leading-relaxed">
                  “Bonus” = extra coins earned for surviving (not separate money). “Pot” assumes all remaining players wager.
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-subtle bg-card-trans p-4">
                <div className="text-sm text-muted">Highlander Champion</div>
                <div className="text-2xl font-semibold text-primary">$500</div>
                <div className="mt-1 text-xs text-muted">
                  Week 17 gamewide championship (10 league winners enter).
                </div>
              </div>

              <div className="mt-4 text-xs text-muted">
                Managed by:{" "}
                <span className="text-text font-semibold">SORRY4CUSSIN, DegenEthan, WestLEX</span>
              </div>
            </div>
              {/* JOIN LEAGUES (right panel, desktop flow) */}
              <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm p-5">
                <p className="text-xs tracking-widest text-muted uppercase">Join</p>
                <h3 className="mt-2 text-xl font-semibold text-primary">Highlander Leagues</h3>
                <p className="mt-2 text-sm text-muted">Pick a league, draft, and survive.</p>

                <LeaguesGrid />
              </div>
            </aside>
          </div>
        </div>
      </section>

      
    </div>
  );
}