// app/mini-leagues/MiniLeaguesClient.jsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";

const SEASON = 2025;

// ==============================
// HARD-CODED (non-editable) copy
// ==============================
const HERO_STATIC = {
  eyebrow: "WELCOME TO",
  title: "the Mini-Leagues game",
  subtitle:
    "Way-too-early, rookie-inclusive, budget Best Ball redraft leagues. Most points wins. Optional wagering. Bonuses stack.",
};

// ==============================
// ONLY THESE ARE EDITABLE IN CMS
// ==============================
const DEFAULT_EDITABLE = {
  season: SEASON,
  hero: {
    promoImageKey: "",
    promoImageUrl: "/photos/minileagues-v2.webp",
    updatesHtml: "<p>Updates will show here.</p>",
  },
  winners: {
    title: "Last Year’s Winners",
    imageKey1: "",
    imageUrl1: "/photos/hall-of-fame/minileageus2024.png",
    caption1: "",
    imageKey2: "",
    imageUrl2: "",
    caption2: "",
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

function normLeague(l, idx) {
  return {
    name: String(l?.name || `League ${idx + 1}`),
    url: String(l?.url || ""),
    status: ["full", "filling", "drafting", "tbd"].includes(l?.status) ? l.status : "tbd",
    active: l?.active !== false,
    order: Number.isFinite(Number(l?.order)) ? Number(l.order) : idx + 1,
    imageKey: String(l?.imageKey || ""),
    imageUrl: String(l?.imageUrl || ""),
  };
}

function normDivision(d, idx) {
  const leaguesRaw = Array.isArray(d?.leagues) ? d.leagues : [];
  const leagues = leaguesRaw.map(normLeague).filter((x) => x.active !== false);
  leagues.sort((a, b) => a.order - b.order);

  return {
    divisionCode: String(d?.divisionCode || d?.code || `${(idx + 1) * 100}`),
    title: String(d?.title || `Division ${String(d?.divisionCode || (idx + 1) * 100)}`),
    status: ["full", "filling", "drafting", "tbd"].includes(d?.status) ? d.status : "tbd",
    order: Number.isFinite(Number(d?.order)) ? Number(d.order) : idx + 1,
    imageKey: String(d?.imageKey || ""),
    imageUrl: String(d?.imageUrl || ""),
    leagues,
  };
}

function PremiumFrame({ kicker, title, subtitle, children, className = "" }) {
  return (
    <section
      className={[
        "relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl",
        "p-6 md:p-8",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
        <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/16 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
      </div>

      <div className="relative space-y-4">
        {(kicker || title || subtitle) ? (
          <header className="text-center space-y-2">
            {kicker ? (
              <p className="text-xs uppercase tracking-[0.35em] text-accent">{kicker}</p>
            ) : null}
            {title ? (
              <h2 className="text-2xl sm:text-3xl font-semibold">{title}</h2>
            ) : null}
            {subtitle ? (
              <p className="text-sm text-muted max-w-3xl mx-auto">{subtitle}</p>
            ) : null}
          </header>
        ) : null}

        <div>{children}</div>
      </div>
    </section>
  );
}

function InlineNotice({ children }) {
  return (
    <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted text-center">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

export default function MiniLeaguesClient() {
  const [editable, setEditable] = useState(DEFAULT_EDITABLE);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const bust = `v=${Date.now()}`;

  const updatesSrc = editable?.hero?.promoImageKey
    ? `/r2/${editable.hero.promoImageKey}?v=${encodeURIComponent(editable.hero.promoImageKey)}`
    : editable?.hero?.promoImageUrl || DEFAULT_EDITABLE.hero.promoImageUrl;

  const winners1Src = editable?.winners?.imageKey1
    ? `/r2/${editable.winners.imageKey1}?v=${encodeURIComponent(editable.winners.imageKey1)}`
    : editable?.winners?.imageUrl1 || DEFAULT_EDITABLE.winners.imageUrl1;

  const winners2Src = editable?.winners?.imageKey2
    ? `/r2/${editable.winners.imageKey2}?v=${encodeURIComponent(editable.winners.imageKey2)}`
    : editable?.winners?.imageUrl2 || DEFAULT_EDITABLE.winners.imageUrl2;

  async function loadAll() {
    setErr("");
    setLoading(true);

    try {
      // 1) editable blocks
      const pageRes = await fetch(`/r2/content/mini-leagues/page_${SEASON}.json?${bust}`, { cache: "no-store" });
      if (pageRes.ok) {
        const pageData = await pageRes.json();

        const hero = pageData?.hero || {};
        const winners = pageData?.winners || {};

        // Back-compat with old schema: winners.imageKey/imageUrl/caption
        const imageKey1 = winners.imageKey1 ?? winners.imageKey ?? "";
        const imageUrl1 = winners.imageUrl1 ?? winners.imageUrl ?? DEFAULT_EDITABLE.winners.imageUrl1;
        const caption1 = winners.caption1 ?? winners.caption ?? "";

        setEditable({
          ...DEFAULT_EDITABLE,
          ...pageData,
          hero: {
            ...DEFAULT_EDITABLE.hero,
            promoImageKey: hero.promoImageKey ?? "",
            promoImageUrl: hero.promoImageUrl ?? DEFAULT_EDITABLE.hero.promoImageUrl,
            updatesHtml: hero.updatesHtml ?? DEFAULT_EDITABLE.hero.updatesHtml,
          },
          winners: {
            ...DEFAULT_EDITABLE.winners,
            title: winners.title ?? DEFAULT_EDITABLE.winners.title,
            imageKey1,
            imageUrl1,
            caption1,
            imageKey2: winners.imageKey2 ?? "",
            imageUrl2: winners.imageUrl2 ?? "",
            caption2: winners.caption2 ?? "",
          },
        });
      } else {
        setEditable(DEFAULT_EDITABLE);
      }

      // 2) divisions
      const divRes = await fetch(`/r2/data/mini-leagues/divisions_${SEASON}.json?${bust}`, { cache: "no-store" });
      if (divRes.ok) {
        const divData = await divRes.json();
        const list = Array.isArray(divData?.divisions) ? divData.divisions : Array.isArray(divData) ? divData : [];
        const normalized = list.map(normDivision);
        normalized.sort((a, b) => a.order - b.order);
        setDivisions(normalized);
      } else {
        setDivisions([]);
      }
    } catch (e) {
      setErr(e?.message || "Failed to load Mini-Leagues data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-10">
          {/* HERO */}
          <header className="relative py-2 overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative grid gap-8 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">{HERO_STATIC.eyebrow}</p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-primary">
                  {HERO_STATIC.title}
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">{HERO_STATIC.subtitle}</p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/dynasty" className="btn btn-outline">
                    Dynasty
                  </Link>
                  <Link href="/big-game" className="btn btn-outline">
                    Big Game
                  </Link>
                  <Link href="/hall-of-fame" className="btn btn-outline">
                    Hall of Fame
                  </Link>
                </div>
              </div>

              <aside className="w-full space-y-4">
                <div className="rounded-2xl py-2 border border-border/60 bg-card-trans backdrop-blur-sm overflow-hidden shadow-xl shadow-black/50">
                  <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Quick Facts
                    </span>
                    <span className="text-[11px] text-muted">{SEASON}</span>
                  </div>

                  <div className="p-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Buy-in</span>
                      <span className="font-semibold text-primary">$4</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">League size</span>
                      <span className="font-semibold">12 teams</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Format</span>
                      <span className="font-semibold">Bestball · SF</span>
                    </div>
                    <div className="h-px bg-border/60" />
                    <p className="text-xs text-muted">
                      Most points after Week 14 wins the league. League winners
                      can cash out or roll into Division + Championship weeks.
                    </p>
                  </div>
                </div>

                {/* OPTIONAL: Updates card (kept functional, still commented in your original)
                    If you want it back, we can re-enable and style it to match.
                */}
              </aside>
            </div>

            <OwnerHeroBlock mode="mini-leagues" season={SEASON} title="Owner Updates" />
          </header>

          {/* CONTENT (wrapped so headings never float on background) */}
          <PremiumFrame
            kicker="Rules & Format"
            title="Mini-Leagues Settings"
            subtitle="Fast, simple, and built for upside — with optional wagering that stacks bonuses."
          >
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 space-y-2">
                <h3 className="text-lg font-semibold text-primary">BALLSVILLE SETTINGS</h3>
                <ul className="text-sm text-muted space-y-1">
                  <li>Most points wins ⚠️</li>
                  <li>12 team SF (No TEP, 2x Flex, +6 passing TD)</li>
                  <li>Rookie-inclusive drafting</li>
                  <li>3x shuffle or quick Derby</li>
                  <li>No 3rd-round reversal</li>
                  <li>No trading</li>
                  <li>1–2 hr timers or fast draft (predetermined)</li>
                  <li>Pure draft &amp; go</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 space-y-2">
                <h3 className="text-lg font-semibold text-primary">How the game works</h3>
                <p className="text-sm text-muted">
                  Win your league (most points through Week 14) → earn $30 (🪙). After Week 14, a game manager will ask if
                  you’d like to <strong className="text-fg">wager</strong> your 🪙 or keep it.
                </p>
                <p className="text-sm text-muted">
                  Without a wager: eligible for Division Bonus (+$30) and Championship Bonus (+$100).
                  <br />
                  With a wager: eligible for <strong className="text-fg">all wagers</strong>, both bonuses, and Wager Bonus (+$60).
                </p>
                <p className="text-sm text-muted font-semibold">Bonuses stack.</p>
              </div>

              <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 space-y-2">
                <h3 className="text-lg font-semibold text-primary">Draft etiquette</h3>
                <ul className="text-sm text-muted space-y-1">
                  <li>Please tag the next person up.</li>
                  <li>Please don’t rush people.</li>
                  <li>League can vote to reduce timer after Round 10.</li>
                  <li>No one auto-picks Round 1 ⚠️ (spot may be substituted).</li>
                  <li>If you auto at 1.12, the 2.01 may be pushed through.</li>
                  <li>Mistakes: tag managers immediately for a chance at reversal (not for expired clocks).</li>
                </ul>
              </div>
            </div>
          </PremiumFrame>

          {/* DIVISIONS (wrapped + clearer header) */}
          <PremiumFrame
            kicker="Live Directory"
            title="Divisions"
            subtitle="Divisions contain 10 leagues each (12 teams per league)."
          >
            {err ? (
              <div className="rounded-2xl border border-subtle bg-red-950/30 p-4 text-sm text-red-200">{err}</div>
            ) : null}

            {loading ? (
              <InlineNotice>Loading…</InlineNotice>
            ) : divisions.length === 0 ? (
              <InlineNotice>No divisions loaded yet.</InlineNotice>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {divisions.map((d) => {
                  const divImage = d.imageKey ? `/r2/${d.imageKey}` : d.imageUrl || "";
                  return (
                    <div
                      key={d.divisionCode}
                      className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden"
                    >
                      <div className="p-5 border-b border-subtle flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-xl font-semibold text-primary">{d.title}</h3>
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                              STATUS_BADGE[d.status] || STATUS_BADGE.tbd
                            }`}
                          >
                            {STATUS_LABEL[d.status] || "TBD"}
                          </span>
                        </div>

                        {divImage ? (
                          <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-subtle bg-black/20">
                            <Image src={divImage} alt={`${d.title} image`} fill className="object-cover" />
                          </div>
                        ) : null}
                      </div>

                      <div className="p-5 grid gap-3 sm:grid-cols-2">
                        {d.leagues.map((l, idx) => {
                          const badge = STATUS_BADGE[l.status] || STATUS_BADGE.tbd;
                          const label = STATUS_LABEL[l.status] || "TBD";
                          const img = l.imageKey ? `/r2/${l.imageKey}` : l.imageUrl || "";
                          return (
                            <a
                              key={`${d.divisionCode}-${idx}-${l.name}`}
                              href={l.url || "#"}
                              target={l.url ? "_blank" : undefined}
                              rel={l.url ? "noreferrer" : undefined}
                              className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4 hover:bg-subtle-surface/30 transition"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <div className="font-semibold text-fg truncate">{l.name}</div>
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge}`}
                                  >
                                    {label}
                                  </span>
                                </div>

                                {img ? (
                                  <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-subtle bg-black/20 shrink-0">
                                    <Image src={img} alt={`${l.name} image`} fill className="object-cover" />
                                  </div>
                                ) : null}
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PremiumFrame>

          {/* WINNERS (wrapped so the title isn't floating) */}
          <PremiumFrame
            kicker="Hall of Fame"
            title={editable?.winners?.title || DEFAULT_EDITABLE.winners.title}
            subtitle="A snapshot of last season — updated by the admins."
          >
            <div className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden">
              <div className="p-4 bg-black/10">
                <div
                  className={`mx-auto w-full max-w-[1100px] grid gap-4 ${
                    winners2Src ? "md:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {/* Image 1 */}
                  <div className="space-y-2">
                    <div className="relative w-full h-[320px] sm:h-[420px]">
                      {winners1Src ? (
                        <Image src={winners1Src} alt="Winners (1)" fill sizes="100vw" className="object-contain" />
                      ) : null}
                    </div>
                    {(editable?.winners?.caption1 || "").trim() ? (
                      <div className="text-sm text-muted">{editable.winners.caption1}</div>
                    ) : null}
                  </div>

                  {/* Image 2 (optional) */}
                  {winners2Src ? (
                    <div className="space-y-2">
                      <div className="relative w-full h-[320px] sm:h-[420px]">
                        <Image src={winners2Src} alt="Winners (2)" fill sizes="100vw" className="object-contain" />
                      </div>
                      {(editable?.winners?.caption2 || "").trim() ? (
                        <div className="text-sm text-muted">{editable.winners.caption2}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </PremiumFrame>
        </div>
      </section>
    </main>
  );
}
