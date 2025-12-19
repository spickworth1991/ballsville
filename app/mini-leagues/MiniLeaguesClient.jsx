"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MINI_LEAGUES_SEASON, miniLeaguesDefault, normalizeMiniLeaguesPayload, buildMiniLeaguesPublicModel } from "./content";

function Badge({ children }) {
  return (
    <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 text-xs sm:text-sm backdrop-blur-sm">
      {children}
    </span>
  );
}

function StatusPill({ status }) {
  const s = String(status || "tbd").toLowerCase();
  const label = s === "full" ? "FULL" : s === "filling" ? "FILLING" : s === "drafting" ? "DRAFTING" : "TBD";
  const cls =
    s === "full"
      ? "bg-emerald-500/10 text-emerald-200 border-emerald-400/20"
      : s === "filling"
      ? "bg-amber-500/10 text-amber-200 border-amber-400/20"
      : s === "drafting"
      ? "bg-sky-500/10 text-sky-200 border-sky-400/20"
      : "bg-zinc-500/10 text-zinc-200 border-zinc-400/20";

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${cls}`}>{label}</span>;
}

function LeagueCard({ league }) {
  const disabled = !league?.active || !league?.url;
  const img = league?.imagePath;

  const body = (
    <div className="group relative overflow-hidden rounded-2xl border border-subtle bg-card-surface shadow-sm hover:shadow-md transition">
      {img ? (
        <div className="relative h-32 w-full">
          <Image src={img} alt={league?.name || "League"} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        </div>
      ) : (
        <div className="h-12 bg-subtle-surface" />
      )}

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-fg">{league?.name || "League"}</p>
            <p className="text-xs text-muted">{league?.url ? "Open in Sleeper" : "Link not set yet"}</p>
          </div>
          <StatusPill status={league?.status} />
        </div>
      </div>
    </div>
  );

  if (disabled) return <div className="opacity-60">{body}</div>;
  return (
    <a href={league.url} target="_blank" rel="noreferrer" className="block">
      {body}
    </a>
  );
}

function DivisionCard({ div }) {
  return (
    <section className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden">
      <div className="relative">
        {div?.imagePath ? (
          <div className="relative h-40 w-full">
            <Image src={div.imagePath} alt={div?.name || `Division ${div?.code || ""}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
          </div>
        ) : (
          <div className="h-10 bg-subtle-surface" />
        )}

        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Division</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-fg">
              {div?.code ? <span className="text-primary">{div.code}</span> : null}{" "}
              {div?.name ? <span className="text-fg">{div.name}</span> : null}
            </h2>
          </div>
          <StatusPill status={div?.status} />
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(div?.leagues || []).slice(0, 10).map((league, idx) => (
            <LeagueCard key={`${div.code || "div"}-${idx}`} league={league} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function MiniLeaguesClient() {
  const [payload, setPayload] = useState(miniLeaguesDefault);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      setLoading(true);
      try {
        const res = await fetch(`/api/public/mini-leagues?season=${MINI_LEAGUES_SEASON}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const merged = normalizeMiniLeaguesPayload(json?.data || json || {});
        if (!cancelled) setPayload(merged);
      } catch (e) {
        if (!cancelled) {
          setError("Could not load Mini-Leagues content. Showing defaults.");
          setPayload(miniLeaguesDefault);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => buildMiniLeaguesPublicModel(payload), [payload]);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">{model.hero?.kicker || "Welcome to"}</p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                  <span className="text-fg">{model.hero?.title || "the Mini-Leagues game"}</span>
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">{model.hero?.subhead}</p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <a href="#divisions" className="btn btn-primary">
                    View Divisions →
                  </a>
                  <Link href="/biggame" className="btn btn-outline">
                    BIG Game
                  </Link>
                  <Link href="/dynasty" className="btn btn-outline">
                    Dynasty
                  </Link>
                </div>

                <div className="mt-4 inline-flex flex-wrap gap-2">
                  {(model.hero?.chips || []).map((c, idx) => (
                    <Badge key={idx}>{c}</Badge>
                  ))}
                </div>

                {error ? <p className="text-xs text-amber-200/80">{error}</p> : null}
                {!loading ? null : <p className="text-xs text-muted">Loading…</p>}
              </div>

              <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden shadow-lg">
                <div className="relative h-48 w-full">
                  <Image
                    src={model.hero?.heroImagePath || "/photos/minileagues-hero.webp"}
                    alt="Mini-Leagues promo"
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted leading-snug">Most points wins. Optional wagering. Bonuses stack.</p>
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">{model.settings?.title}</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
                {(model.settings?.bullets || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-3 lg:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">{model.howItWorks?.title}</h2>

              <div className="space-y-2 text-sm text-muted">
                {(model.howItWorks?.paragraphs || []).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">{model.howItWorks?.withoutWager?.title}</p>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-muted">
                    {(model.howItWorks?.withoutWager?.bullets || []).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">{model.howItWorks?.withWager?.title}</p>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-muted">
                    {(model.howItWorks?.withWager?.bullets || []).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {model.howItWorks?.footerNote ? <p className="pt-2 text-sm font-semibold text-primary">{model.howItWorks.footerNote}</p> : null}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">{model.cash?.title}</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
                {(model.cash?.bullets || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <div className="pt-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">{model.cash?.paymentsTitle}</p>
                <p className="mt-1 text-sm text-muted">{model.cash?.paymentsText}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">{model.etiquette?.title}</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
                {(model.etiquette?.bullets || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          </section>

          <section id="divisions" className="space-y-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold">{model.divisions?.title || "Divisions"}</h2>
              <p className="mt-1 text-sm text-muted">{model.divisions?.blurb}</p>
            </div>

            <div className="space-y-6">
              {(model.divisions?.items || []).length ? (
                model.divisions.items.map((d, idx) => <DivisionCard key={`${d.code || idx}`} div={d} />)
              ) : (
                <div className="rounded-2xl border border-subtle bg-card-surface p-5 text-sm text-muted">
                  No divisions added yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-subtle bg-card-surface shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold">{model.winners?.title}</h2>
                <p className="mt-1 text-sm text-muted">{model.winners?.subtitle}</p>
              </div>
            </div>

            <div className="relative h-[260px] sm:h-[340px] w-full">
              <Image
                src={model.winners?.winnersImagePath || "/photos/minileagues-winners.webp"}
                alt="Last year’s winners"
                fill
                className="object-cover"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
