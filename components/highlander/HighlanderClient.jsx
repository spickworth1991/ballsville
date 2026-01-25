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
    "18-team survival Best Ball. Each week, the lowest score is eliminated — their roster hits waivers. Survive the blade. There can only be one.",
};

const DEFAULT_EDITABLE = {
  hero: {
    promoImageKey: "",
    promoImageUrl: "/photos/biggame-v2.webp",
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

    // images (admin saves may use either casing)
    imageKey: safeStr(l?.imageKey || l?.image_key || "").trim(),
    imageUrl: safeStr(l?.imageUrl || l?.image_url || "").trim(),
  };
}

export default function HighlanderClient({ season }) {
  const [editable, setEditable] = useState(DEFAULT_EDITABLE);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
        // page content
        const pageRes = await fetch(r2Url(`content/highlander/page_${season}.json?v=${bust}`));
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

        // leagues list
        const lRes = await fetch(r2Url(`data/highlander/leagues_${season}.json?v=${bust}`));
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
    const fallback = safeStr(editable?.hero?.promoImageUrl || "").trim() || DEFAULT_EDITABLE.hero.promoImageUrl;
    // promoImageKey is an R2 key like "media/highlander/updates_2026.png"
    return key ? r2Url(`${key}?v=${Date.now()}`) : fallback;
  }, [editable]);

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
                <p className="text-xs tracking-widest text-muted uppercase">{HERO_STATIC.eyebrow}</p>
                <h1 className="mt-2 text-4xl sm:text-5xl font-semibold text-primary">{HERO_STATIC.title}</h1>
                <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">{HERO_STATIC.subtitle}</p>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-subtle px-3 py-1 bg-card-surface">
                    <span className="text-xs text-muted">18 Teams</span>
                    <span className="text-xs text-muted">•</span>
                    <span className="text-xs text-muted">Best Ball</span>
                    <span className="text-xs text-muted">•</span>
                    <span className="text-xs text-muted">No Trades</span>
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
                        className="object-contain p-3"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 rounded-2xl border border-subtle bg-card-surface shadow-sm p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs tracking-widest text-muted uppercase">The Rules</p>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-primary">Survive the blade.</h2>
                  <p className="mt-2 text-sm sm:text-base text-muted leading-relaxed">
                    Each week, the <span className="text-text font-semibold">lowest scoring team is eliminated</span>.
                    Their season ends, and their roster is released to waivers/free agency. This repeats all season —
                    <span className="text-text font-semibold"> there can only be one</span>.
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  <div className="inline-flex items-center gap-2 rounded-full border border-subtle px-3 py-1 bg-card-trans">
                    <span className="text-xs text-muted">12 Round Draft</span>
                    <span className="text-xs text-muted">•</span>
                    <span className="text-xs text-muted">$200 FAAB</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <h3 className="font-semibold text-primary">Draft</h3>
                  <p className="mt-1 text-sm text-muted">
                    Slow snake draft • <span className="text-text font-semibold">12 rounds</span> • no trading.
                  </p>
                </div>
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <h3 className="font-semibold text-primary">Waivers & FAAB</h3>
                  <p className="mt-1 text-sm text-muted">
                    Weekly waivers all season. Sundays are open FA. Each team gets{" "}
                    <span className="text-text font-semibold">$200 FAAB</span> after the draft (no reset).
                  </p>
                </div>
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <h3 className="font-semibold text-primary">Scoring</h3>
                  <p className="mt-1 text-sm text-muted">Ballsville scoring for all leagues.</p>
                </div>
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <h3 className="font-semibold text-primary">Elimination</h3>
                  <p className="mt-1 text-sm text-muted">Lowest weekly score is eliminated. Their entire roster hits waivers.</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-subtle bg-card-trans p-4 sm:p-5">
                <h3 className="font-semibold text-primary">Roster Growth (Manager adds slots)</h3>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-3 rounded-xl border border-subtle bg-subtle-surface p-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-card-surface border border-subtle text-xs font-semibold">
                      W1
                    </span>
                    <div>
                      <div className="text-text font-semibold">Start</div>
                      <div className="text-muted">1QB, 2RB, 2WR, 1TE, 1FLEX, 5 Bench</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-subtle bg-subtle-surface p-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-card-surface border border-subtle text-xs font-semibold">
                      W4
                    </span>
                    <div>
                      <div className="text-text font-semibold">After Week 3</div>
                      <div className="text-muted">+1 WR, +2 Bench</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-subtle bg-subtle-surface p-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-card-surface border border-subtle text-xs font-semibold">
                      W7
                    </span>
                    <div>
                      <div className="text-text font-semibold">After Week 6</div>
                      <div className="text-muted">+1 FLEX, +2 Bench</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-subtle bg-subtle-surface p-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-card-surface border border-subtle text-xs font-semibold">
                      W10
                    </span>
                    <div>
                      <div className="text-text font-semibold">After Week 9</div>
                      <div className="text-muted">+1 SF, +2 Bench</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-subtle bg-subtle-surface p-3 md:col-span-2">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-card-surface border border-subtle text-xs font-semibold">
                      W13
                    </span>
                    <div>
                      <div className="text-text font-semibold">After Week 12</div>
                      <div className="text-muted">+1 RB, +1 TE, +2 Bench</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm p-5">
                <p className="text-xs tracking-widest text-muted uppercase">Payouts</p>
                <h3 className="mt-2 text-xl font-semibold text-primary">$25 Buy-In</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  Each league is 18 teams ($450). $50 goes to the gamewide championship and $50 goes to Ballsville for
                  giveaways/freebies/expenses.
                </p>

                <div className="mt-4 rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Week 15</span>
                    <span className="text-text font-semibold">3 remaining → $50 each</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted">Week 16</span>
                    <span className="text-text font-semibold">2 remaining → +$50 each</span>
                  </div>
                  <div className="mt-2 text-muted">
                    Bank or wager:
                    <ul className="list-disc pl-5 mt-1">
                      <li>Week 16: wager vs your league’s other 2 players</li>
                      <li>Week 17: wager gamewide vs all remaining players</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-subtle bg-card-trans p-4">
                  <div className="text-sm text-muted">Highlander Champion</div>
                  <div className="text-2xl font-semibold text-primary">$500</div>
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm p-5">
                <p className="text-xs tracking-widest text-muted uppercase">Updates</p>
                <div
                  className="prose prose-invert max-w-none mt-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: safeStr(editable?.hero?.updatesHtml || "") }}
                />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="section pt-0">
        <div className="container-site">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-widest text-muted uppercase">Join</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-primary">Highlander Leagues</h2>
              <p className="mt-2 text-sm text-muted">Pick a league, draft, and survive.</p>
            </div>
          </div>

          {err ? (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">{err}</div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-2xl border border-subtle bg-card-surface p-6 text-muted">Loading…</div>
          ) : list.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-subtle bg-card-surface p-6 text-muted">
              Leagues will appear here when they’re posted.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {list.map((l) => {
                const label = statusBadge(l.status);
                const badgeClass = STATUS_BADGE[safeStr(l.status).toLowerCase()] || STATUS_BADGE.tbd;
                const joinable = !!l.url && (l.status === "filling" || l.status === "drafting" || l.status === "tbd");

                const cardImgSrc = l.imageKey ? r2Url(`${l.imageKey}?v=${Date.now()}`) : l.imageUrl || "";

                return (
                  <div key={l.id} className="rounded-2xl border border-subtle bg-card-surface shadow-sm overflow-hidden">
                    {cardImgSrc ? (
                      <div className="relative aspect-[99/100] w-full">
                    <Image
                      src={cardImgSrc}
                      alt={safeStr(l.name)}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  </div>

                    ) : null}

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-primary">{l.name}</div>
                          <div className="mt-1 text-sm text-muted">18 teams • Best Ball • Elimination</div>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${badgeClass}`}>
                          {label}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        {joinable ? (
                          <a className="btn btn-primary" href={l.url} target="_blank" rel="noreferrer">
                            Join League
                          </a>
                        ) : (
                          <button className="btn btn-subtle" disabled>
                            Join League
                          </button>
                        )}
                        <div className="text-xs text-muted">{l.url ? "Sleeper link available" : "Link coming soon"}</div>
                      </div>
                    </div>

                    <div className="h-1 bg-gradient-to-r from-[rgba(59,130,246,0.25)] via-[rgba(236,72,153,0.25)] to-[rgba(245,158,11,0.25)]" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      
    </div>
  );
}
