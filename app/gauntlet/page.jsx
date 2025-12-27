// src/app/gauntlet/page.jsx
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import GauntletLegionsClient from "@/components/gauntlet/GauntletLegionsClient";
import OwnerHeroBlock from "@/components/blocks/OwnerHeroBlock";
import { CURRENT_SEASON } from "@/lib/season";

const DOC_EMBED_SRC =
  "https://docs.google.com/document/d/e/2PACX-1vT1-uDhonEEjWlgg4nT1Ix5HHcgwIKCWRuVTUCK9P2HH19bp_MwER8R_BCxM2EQ4mNMe6nSyJaxpfpC/pub?embedded=true";

function Card({ children }) {
  return (
    <section className="bg-card-surface border border-subtle shadow-md rounded-2xl p-6 md:p-8">
      {children}
    </section>
  );
}

function SubCard({ children }) {
  return (
    <div className="bg-subtle-surface border border-subtle rounded-2xl p-5 md:p-6">
      {children}
    </div>
  );
}

export default function GauntletPage() {
  return (
    <main className="relative min-h-screen text-fg">
      {/* cosmic glow overlay (match Big Game layout) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
       {/* HERO */}
      <header className="relative overflow-hidden rounded-3xl border border-border/70 bg-card-surface shadow-2xl shadow-black/40 p-6 md:p-10">
        {/* premium glow */}
        <div className="pointer-events-none absolute inset-0 mix-blend-screen">
            <div className="opacity-50 absolute -top-24 -left-5 h-56 w-56 rounded-full bg-green-500/50 blur-3xl" />
            <div className="opacity-50 absolute -top-24 -right-5 h-56 w-56 rounded-full bg-purple-500/50 blur-3xl" />
            <div className="opacity-65 absolute -bottom-24 -right-5 h-56 w-64 rounded-full bg-orange-400/40 blur-3xl" />
            <div className="opacity-55 absolute -bottom-24 -left-7 h-56 w-56 rounded-full bg-red-500/50 blur-3xl" />
            <div className="opacity-30 absolute left-1/2 top-1/2 h-56 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/50 blur-3xl" />
          </div>

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:items-start">
          {/* left */}
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-accent">
              BALLSVILLE GAUNTLET
            </p>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
              3 Legions. 12 Gods.{" "}
              <span className="text-primary">1 Grand Champion</span>.
            </h1>

            <p className="text-sm sm:text-base text-muted max-w-prose">
              24 teams per <span className="text-fg font-semibold">God</span>, four
              Gods per <span className="text-fg font-semibold">Legion</span>: Egyptians,
              Greeks, and Romans. 12 God Champions collide in Week 17 for the Grand
              Championship.
            </p>

            <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
              <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                Redraft → Guillotine → Bracket
              </span>
              <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                288 total entries
              </span>
              <span className="rounded-full border border-subtle bg-card-surface px-3 py-1">
                Week 17 Grand Championship
              </span>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/gauntlet/intro" className="btn btn-primary">
                ⚔️ Gauntlet Game Intro
              </Link>
              <Link href="/gauntlet/cash-doc" className="btn btn-outline">
                💸 View Cash Doc
              </Link>
            </div>

            {/* quick stats (kept) */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  Entries
                </div>
                <div className="mt-1 font-semibold text-fg">288</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  God Champs
                </div>
                <div className="mt-1 font-semibold text-fg">12</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  Payouts
                </div>
                <div className="mt-1 font-semibold text-fg">133+</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted">
                  Max Winnings
                </div>
                <div className="mt-1 font-semibold text-fg">$2,342</div>
              </div>
              
            </div>
            <OwnerHeroBlock mode="gauntlet" season={CURRENT_SEASON} title="Owner Updates" />
          </div>

          {/* right: owner block + rules doc */}
          <div className="space-y-4">
            

            {/* framed doc embed like a “panel” */}
            <div className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm overflow-hidden shadow-xl shadow-black/40">
              <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    GAME RULES (LIVE DOC)
                  </span>
                  <span className="block text-[11px] text-muted truncate">
                    Google Docs Embed
                  </span>
                </div>

                {/* Full screen button */}
                <a
                  href={DOC_EMBED_SRC.replace("?embedded=true", "")}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full border border-subtle bg-card-surface px-3 py-1 text-[11px] font-semibold text-fg hover:border-accent hover:text-accent transition"
                  aria-label="Open Gauntlet Rules Doc in a new tab"
                >
                  ⤢ Full Screen
                </a>
              </div>

              {/* shorter embed */}
              <div className="h-[360px] sm:h-[420px] lg:h-[460px]">
                <iframe
                  src={DOC_EMBED_SRC}
                  title="Gauntlet Rules Doc"
                  className="h-full w-full border-0"
                />
              </div>

              {/* footer tip */}
              <div className="px-4 py-3 border-t border-border/60 text-[11px] text-muted flex items-center justify-between gap-3">
                <span className="truncate">Tip: On mobile, use “Full Screen” for easier reading.</span>
                <span className="hidden sm:inline text-[11px] text-muted">(opens new tab)</span>
              </div>
            </div>
          </div>

        </div>
      </header>


        {/* PAYOUTS + BONUSES MINI CHART */}
        <Card>
          <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="h2">Payouts & Bonuses Everywhere</h2>
              <p className="text-sm text-muted mt-2 max-w-2xl">
                Redraft Weeks 1–8, Guillotine Weeks 9–12, Bracket Weeks 13–17.
                Payouts and BONUSES are stackable across all three legs.
              </p>
            </div>

            <Link href="/gauntlet/cash-doc" className="btn btn-outline">
              CASH DOC →
            </Link>
          </header>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[520px] text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.2em] text-muted border-b border-subtle">
                  <th className="py-2 pr-4 text-left font-semibold">Leg</th>
                  <th className="py-2 px-4 text-left font-semibold">Weeks</th>
                  <th className="py-2 px-4 text-left font-semibold">Payouts</th>
                  <th className="py-2 pl-4 text-left font-semibold">Bonuses</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-subtle">
                  <td className="py-2 pr-4 font-medium">Redraft</td>
                  <td className="py-2 px-4 text-muted">Weeks 1–8</td>
                  <td className="py-2 px-4">24 Payouts</td>
                  <td className="py-2 pl-4">12 BONUSES</td>
                </tr>
                <tr className="border-b border-subtle">
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
            For the full breakdown of every payout, BONUS, and conditional upside, read the{" "}
            <Link href="/gauntlet/cash-doc" className="text-accent hover:underline underline-offset-2">
              Gauntlet Cash Doc
            </Link>
            .
          </p>
        </Card>

        {/* BRACKET EXPLAINER */}
       <Card>
        <header className="space-y-2">
          <h2 className="h2">The Bracket</h2>
          <p className="text-sm text-muted max-w-2xl">
            Weeks 1–12 run inside your Leagues. Weeks 9–12 you enter Guillotine.
            Weeks 13–17 all that work turns into a God Bracket you can follow here.
          </p>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* CLICKABLE LIVE BRACKET CARD */}
          <Link
            href="/gauntlet/leaderboard"
            className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <SubCard>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
                BRACKET PROTOTYPE
              </p>
              <p className="mt-2 text-sm text-muted">
                This is where your God Bracket will live — seeded #1–#16 based on points,
                with Light and Dark leagues colliding. Follow matchups, see who advances,
                track which Gods remain.
              </p>

              <div className="mt-3 text-xs font-semibold text-accent">
                View Live Bracket →
              </div>
            </SubCard>
          </Link>

          {/* STATIC INFO CARD */}
          <SubCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
              LIGHT & DARK LEAGUES
            </p>
            <p className="mt-2 text-sm text-muted">
              Each God has a <span className="text-fg font-semibold">Light</span> and{" "}
              <span className="text-fg font-semibold">Dark</span> league. They run as
              12-team leagues Weeks 1–12, then merge into a single God Bracket in Week 13.
            </p>
            <ul className="mt-3 text-xs text-muted space-y-1.5">
              <li>• Light League vs Dark League collide in Week 13.</li>
              <li>• Seeded by points, then locked into a head-to-head bracket.</li>
              <li>• Win and advance; every win adds more cash.</li>
            </ul>
          </SubCard>
        </div>
      </Card>


        {/* LEGIONS */}
        <section className="space-y-4 relative overflow-hidden rounded-3xl border border-border/70 bg-card-surface shadow-2xl shadow-black/40 p-6 md:p-10">
          <header>
            <h2 className="h2">The Legions</h2>
            <p className="text-sm text-muted mt-2 max-w-2xl">
              Three Legions — Egyptians, Greeks, and Romans — each with four Gods and 24 teams per God.
              Join a God, fill your league, and fight your way toward the Gauntlet.
            </p>
          </header>

          <GauntletLegionsClient embedded season={CURRENT_SEASON} />
        </section>
      </div>
    </main>
  );
}
