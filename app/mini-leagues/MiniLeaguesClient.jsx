"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabase } from "@/src/lib/supabaseClient";

const SEASON = 2025;

// swap these to your real assets in /public/photos/
const HERO_IMAGE = "/photos/minileagues-hero.webp";
const WINNERS_IMAGE = "/photos/minileagues-winners.webp";

const STATUS_LABEL = {
  full: "FULL",
  filling: "FILLING",
  drafting: "DRAFTING",
  tbd: "TBD",
};

function StatusBadge({ status }) {
  const label = STATUS_LABEL[status] || "TBD";
  return (
    <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-sm">
      {label}
    </span>
  );
}

function DivisionTitle({ row }) {
  const code = row.division_code ?? "";
  const name = (row.division_name || "").trim();
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold">
        Division {code}
        {name ? <span className="text-muted font-normal"> — {name}</span> : null}
      </div>
      <div className="text-xs text-muted">Season {row.season}</div>
    </div>
  );
}

function leaguesFromRow(row) {
  const leagues = [];
  for (let i = 1; i <= 10; i++) {
    const name = row[`league${i}_name`] || "";
    const url = row[`league${i}_url`] || "";
    const status = row[`league${i}_status`] || "tbd";
    const active = row[`league${i}_active`];
    const orderRaw = row[`league${i}_order`];
    const image = row[`league${i}_image_path`] || "";

    // default: show unless explicitly false
    if (active === false) continue;

    // Skip fully empty rows (keeps page clean)
    if (!name.trim() && !url.trim() && !image.trim()) continue;

    const order = Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : i;

    leagues.push({
      slot: i,
      name: name.trim() || `League ${i}`,
      url: url.trim(),
      status: STATUS_LABEL[status] ? status : "tbd",
      image: image.trim(),
      order,
    });
  }

  leagues.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.slot - b.slot);
  return leagues;
}

function LeagueCard({ league }) {
  const inner = (
    <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden hover:bg-subtle-surface/40 transition">
      {league.image ? (
        <div className="relative h-28 w-full">
          <Image
            src={league.image}
            alt={`${league.name} league graphic`}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 50vw, 25vw"
          />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute top-2 right-2">
            <StatusBadge status={league.status} />
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4 flex items-start justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">League</div>
          <StatusBadge status={league.status} />
        </div>
      )}

      <div className="p-4 space-y-1">
        <div className="text-sm font-semibold">{league.name}</div>
        {league.url ? (
          <div className="text-xs text-muted">Open in Sleeper →</div>
        ) : (
          <div className="text-xs text-muted">Link not added yet</div>
        )}
      </div>
    </div>
  );

  if (league.url) {
    return (
      <a href={league.url} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return inner;
}

export default function MiniLeaguesClient() {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function loadDivisions() {
    setErr("");
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("minileagues_divisions")
        .select("*")
        .eq("season", SEASON)
        .eq("active", true)
        .order("division_order", { ascending: true })
        .order("division_code", { ascending: true });

      if (error) throw error;
      setDivisions(data || []);
    } catch (e) {
      setErr(e?.message || "Failed to load divisions.");
      setDivisions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDivisions();
  }, []);

  const hasDivisions = useMemo(() => (divisions?.length || 0) > 0, [divisions]);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          {/* HERO */}
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
              <div className="absolute top-12 right-24 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">Welcome to</p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                  The <span className="text-primary">Mini-Leagues</span> Game
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">
                  Way-too-early, rookie-inclusive, budget Best Ball redraft leagues.
                  Draft and go — no trading, no lineup setting, just points.
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <a href="#divisions" className="btn btn-primary">
                    View Divisions →
                  </a>
                  <Link href="/constitution" className="btn btn-outline">
                    Constitution
                  </Link>
                  <Link href="/about" className="btn btn-outline">
                    About
                  </Link>
                </div>

                <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    Season ends after Week 14
                  </span>
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    Game ends after Week 15
                  </span>
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    12-team SF
                  </span>
                </div>
              </div>

              {/* image bubble */}
              <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden shadow-lg">
                <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    MINI-LEAGUES
                  </span>
                </div>
                <div className="p-4">
                  <Image
                    src={HERO_IMAGE}
                    alt="BALLSVILLE Mini-Leagues promo graphic"
                    width={1200}
                    height={800}
                    className="rounded-xl"
                    priority
                  />
                </div>
              </div>
            </div>
          </header>

          {/* SETTINGS + HOW IT WORKS */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm space-y-3">
              <h2 className="text-2xl font-semibold">BALLSVILLE Settings</h2>
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
                <li>
                  <span className="font-semibold text-fg">Most points wins</span> ⚠️
                </li>
                <li>12-team Superflex</li>
                <li>No TEP · 2× Flex · +6 passing TD</li>
                <li>Rookie-inclusive drafting</li>
                <li>3× shuffle or quick derby</li>
                <li>No 3rd-round reversal</li>
                <li>No trading</li>
                <li>1–2 hour timers or fast draft (predetermined)</li>
              </ul>
              <p className="text-sm text-muted">
                <span className="font-semibold text-fg">Pure draft and go.</span>
              </p>
            </div>

            <div className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm space-y-3">
              <h2 className="text-2xl font-semibold">How the Game Works</h2>

              <p className="text-sm text-muted">
                You play and win inside your league. The league winner is the team with the most points
                after Week 14 and earns <span className="font-semibold text-fg">$30 (🪙)</span>.
              </p>

              <p className="text-sm text-muted">
                After Week 14, a game manager will ask whether you want to{" "}
                <span className="font-semibold text-fg">wager</span> your 🪙 or{" "}
                <span className="font-semibold text-fg">keep</span> it. Wagering is optional.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <p className="text-sm font-semibold">Without a wager</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted space-y-1">
                    <li>Eligible for the Division Bonus (+$30)</li>
                    <li>Eligible for the Championship Bonus (+$100)</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <p className="text-sm font-semibold">With a wager</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted space-y-1">
                    <li>Eligible to win all wagers (big upside)</li>
                    <li>Eligible for both bonuses above</li>
                    <li>Eligible for the Wager Bonus (+$60)</li>
                  </ul>
                </div>
              </div>

              <p className="text-sm text-muted">Bonuses stack.</p>
            </div>
          </section>

          {/* CASH */}
          <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold">How the Cash Works</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
                <li>$4 buy-in</li>
                <li>League winners take $30 (🪙) to keep or wager</li>
                <li>🏆 $100 Championship Bonus (no wager needed)</li>
                <li>💰 $60 Wager Bonus (wager required)</li>
                <li>$30 Division Bonus for winning your division (×4)</li>
                <li>Many opportunities for free extras</li>
              </ul>

              <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted space-y-2">
                <p className="font-semibold text-fg">Payments</p>
                <p>LeagueSafe accounts are pinned inside each Sleeper league.</p>
              </div>
            </div>
          </section>

          {/* DRAFT ETIQUETTE */}
          <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm space-y-3">
            <h2 className="text-2xl font-semibold">Draft Etiquette</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
              <li>Please tag the next person up.</li>
              <li>Please don’t rush people.</li>
              <li>The league can vote to reduce the timer after Round 10.</li>
              <li>
                No one auto-picks Round 1 ⚠️ If you’re absent, your spot will be substituted.
                You can join the next draft or be refunded.
              </li>
              <li>If you auto at the 1.12, your next 2.01 may be pushed through.</li>
              <li>
                If you make a mistake, tag your managers immediately for a chance at a reversal.
                This does not apply to an expired clock.
              </li>
              <li>Manager intervention beyond that is a league vote.</li>
            </ul>
          </section>

          {/* DIVISIONS */}
          <section id="divisions" className="space-y-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold">Divisions</h2>
              <p className="mt-1 text-sm text-muted max-w-prose">
                Each division contains 10 leagues. Click a league to open it in Sleeper.
              </p>
            </div>

            {err ? (
              <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-red-300">
                {err}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-subtle bg-card-surface p-4 text-sm text-muted">
                Loading divisions…
              </div>
            ) : !hasDivisions ? (
              <div className="rounded-2xl border border-subtle bg-card-surface p-6 text-sm text-muted">
                No divisions posted yet.
              </div>
            ) : (
              <div className="grid gap-6">
                {divisions.map((d) => {
                  const leagues = leaguesFromRow(d);
                  return (
                    <div
                      key={`${d.season}-${d.division_code}`}
                      className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden"
                    >
                      {/* division header */}
                      <div className="px-5 py-4 border-b border-subtle flex flex-wrap items-center justify-between gap-3">
                        <DivisionTitle row={d} />
                        <StatusBadge status={d.status} />
                      </div>

                      {/* division image (optional) */}
                      {d.division_image_path ? (
                        <div className="relative h-40 w-full">
                          <Image
                            src={d.division_image_path}
                            alt={`Division ${d.division_code} graphic`}
                            fill
                            className="object-cover"
                            sizes="100vw"
                          />
                          <div className="absolute inset-0 bg-black/20" />
                        </div>
                      ) : null}

                      <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {leagues.length ? (
                          leagues.map((lg) => <LeagueCard key={`${d.division_code}-${lg.slot}`} league={lg} />)
                        ) : (
                          <div className="sm:col-span-2 lg:col-span-5 rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-5 text-sm text-muted">
                            No leagues added for this division yet.
                          </div>
                        )}
                      </div>

                      {d.notes ? (
                        <div className="px-5 pb-5 text-sm text-muted">{d.notes}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* WINNERS */}
          <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8 shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold">Last Year’s Winners</h2>
            <p className="text-sm text-muted">Updated as results are finalized.</p>
            <Image
              src={WINNERS_IMAGE}
              alt="Last year's Mini-Leagues winners"
              width={1400}
              height={900}
              className="rounded-2xl"
              loading="lazy"
            />
          </section>
        </div>
      </section>
    </main>
  );
}
