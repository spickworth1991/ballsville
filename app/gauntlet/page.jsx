// src/app/gauntlet/page.jsx
import Link from "next/link";
import GauntletLegionsClient from "@/lib/GauntletLegionsClient";

const DOC_EMBED_SRC =
  "https://docs.google.com/document/d/e/2PACX-1vT1-uDhonEEjWlgg4nT1Ix5HHcgwIKCWRuVTUCK9P2HH19bp_MwER8R_BCxM2EQ4mNMe6nSyJaxpfpC/pub?embedded=true";

export default function GauntletPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl shadow-black/40 px-6 py-8 sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen">
          <div className="absolute -top-24 -left-10 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">
              BALLSVILLE GAUNTLET
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
              3 Legions. 12 Gods.{" "}
              <span className="text-accent">1 Grand Champion</span>.
            </h1>
            <p className="text-sm sm:text-base text-muted max-w-prose">
              24 teams per <span className="font-semibold">God</span>, four
              Gods per <span className="font-semibold">Legion</span>:{" "}
              <span className="font-semibold">Egyptians</span>,{" "}
              <span className="font-semibold">Greeks</span>, and{" "}
              <span className="font-semibold">Romans</span>. 12 God Champions
              will collide in Week 17 for the Grand Championship.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              {/* Clickable image-style button for Intro */}
              <Link
                href="/gauntlet/intro"
                className="group inline-flex items-center gap-3 rounded-2xl border border-purple-500/50 bg-gradient-to-r from-purple-600/80 via-indigo-600/80 to-sky-500/80 px-4 py-2.5 text-sm font-semibold tracking-wide text-white shadow-lg shadow-purple-900/40 hover:shadow-xl hover:shadow-purple-900/60 transition-transform hover:-translate-y-0.5"
              >
                <div className="h-7 w-7 rounded-xl bg-black/20 backdrop-blur-sm flex items-center justify-center text-lg">
                  ⚔️
                </div>
                <div className="text-left">
                  <div className="leading-tight">Gauntlet Game Intro</div>
                  <div className="text-[11px] opacity-80">
                    How the draft, legs, and bracket all work.
                  </div>
                </div>
              </Link>

              <Link
                href="/gauntlet/cash-doc"
                className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-muted hover:border-accent/80 hover:text-accent transition-colors"
              >
                💸 View Cash Doc
              </Link>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs sm:text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  Entries
                </dt>
                <dd className="mt-1 font-semibold text-white">288</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  God Champs
                </dt>
                <dd className="mt-1 font-semibold text-white">12</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  Payouts
                </dt>
                <dd className="mt-1 font-semibold text-white">133+</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  Max Winnings
                </dt>
                <dd className="mt-1 font-semibold text-white">$2,342</dd>
              </div>
            </dl>
          </div>

          {/* Google Doc embed */}
          <div className="mt-4 lg:mt-0 lg:w-[360px] xl:w-[400px]">
            <div className="rounded-2xl border border-border/60 bg-black/40 backdrop-blur-sm overflow-hidden shadow-xl shadow-black/50">
              <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  GAME RULES (LIVE DOC)
                </span>
                <span className="text-[11px] text-muted">Google Docs</span>
              </div>
              <div className="aspect-[4/5]">
                <iframe
                  src={DOC_EMBED_SRC}
                  title="Gauntlet Rules Doc"
                  className="h-full w-full border-0"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payouts + Bonuses mini chart */}
      <section className="rounded-3xl border border-border/70 bg-surface/70 px-5 py-6 sm:px-8 sm:py-7 shadow-lg shadow-black/30">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Payouts & Bonuses Everywhere</h2>
            <p className="mt-1 text-sm text-muted max-w-2xl">
              Redraft from Weeks 1–8, Guillotine from Weeks 9–12, and a Bracket
              from Weeks 13–17. Payouts and BONUSES are stackable across all
              three legs.
            </p>
          </div>
          <Link
            href="/gauntlet/cash-doc"
            className="self-start rounded-full border border-accent/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent hover:bg-accent/10 transition-colors"
          >
            CASH DOC →
          </Link>
        </header>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[480px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.2em] text-muted border-b border-border/60">
                <th className="py-2 pr-4 text-left font-semibold">Leg</th>
                <th className="py-2 px-4 text-left font-semibold">Weeks</th>
                <th className="py-2 px-4 text-left font-semibold">Payouts</th>
                <th className="py-2 pl-4 text-left font-semibold">Bonuses</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40">
                <td className="py-2 pr-4 font-medium">Redraft</td>
                <td className="py-2 px-4 text-muted">Weeks 1–8</td>
                <td className="py-2 px-4">24 Payouts</td>
                <td className="py-2 pl-4">12 BONUSES</td>
              </tr>
              <tr className="border-b border-border/40">
                <td className="py-2 pr-4 font-medium">Guillotine</td>
                <td className="py-2 px-4 text-muted">Weeks 9–12</td>
                <td className="py-2 px-4">24 Payouts</td>
                <td className="py-2 pl-4">4 BONUSES</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">Bracket</td>
                <td className="py-2 px-4 text-muted">Weeks 13–17</td>
                <td className="py-2 px-4">85 Payouts</td>
                <td className="py-2 pl-4">Up to 24 BONUSES</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted">
          For the full breakdown of every payout, BONUS, and conditional
          upside, read the{" "}
          <Link href="/gauntlet/cash-doc" className="text-accent underline-offset-2 hover:underline">
            Gauntlet Cash Doc
          </Link>
          .
        </p>
      </section>

      {/* Bracket explainer & future bracket section */}
      <section className="rounded-3xl border border-border/70 bg-surface/70 px-5 py-6 sm:px-8 sm:py-7 shadow-lg shadow-black/30 space-y-5">
        <header>
          <h2 className="text-xl font-semibold">The Bracket</h2>
          <p className="mt-1 text-sm text-muted max-w-2xl">
            For Weeks 1–12, the game runs inside your Leagues. In Weeks 9–12,
            you enter the Guillotine format. From Weeks 13–17, all the work
            you&apos;ve done turns into a God Bracket you can follow here.
          </p>
          <p className="mt-2 text-xs text-muted">
            The bracket shown here will be a live prototype during the season
            and will be refined and locked in by Week 13.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="rounded-2xl border border-dashed border-border/60 bg-black/40 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
              BRACKET PROTOTYPE
            </p>
            <p className="mt-2 text-sm text-muted">
              This is where your **God Bracket** will live — seeded #1–#16
              based on points, with Light and Dark leagues colliding. You&apos;ll
              be able to follow matchups, see who advances, and track which
              Gods remain.
            </p>
            <p className="mt-2 text-xs text-muted">
              Note: this section will eventually pull live seeding and matchup
              information once we hit Week 13.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-slate-950/60 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
              LIGHT & DARK LEAGUES
            </p>
            <p className="mt-2 text-sm text-muted">
              Each <span className="font-semibold">God</span> has a{" "}
              <span className="font-semibold">Light</span> and{" "}
              <span className="font-semibold">Dark</span> league. They run as
              12-team leagues in Weeks 1–12, then merge into a single God
              Bracket in Week 13.
            </p>
            <ul className="mt-3 text-xs text-muted space-y-1.5">
              <li>• Light League vs Dark League collide in Week 13.</li>
              <li>• Seeded by points, then locked into a head-to-head bracket.</li>
              <li>• Win and advance; every win adds more cash.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Legions */}
      <section className="pb-4">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">The Legions</h2>
            <p className="mt-1 text-sm text-muted max-w-2xl">
              Three Legions — Egyptians, Greeks, and Romans — each with four
              Gods and 24 teams per God. Join a God, fill your league, and
              fight your way toward the Gauntlet.
            </p>
          </div>
        </header>

        <GauntletLegionsClient />
      </section>
    </main>
  );
}
