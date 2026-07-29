import Link from "next/link";
import { siteConfig } from "@/app/config/siteConfig";

const SIGNUP_URL = "https://forms.gle/613k73dmU6iSgyKD8";
const PAYMENT_URL = "https://www.leaguesafe.com/join/4444507";
const DRAFTKINGS_REFERRAL_URL = "https://www.draftkings.com/r/JWillMayne/US-DK/US-CA";
const DRAFTKINGS_LEAGUE_URL = "https://dkn.gs/r/nd9EVtj8P0CTbd5lyateaw";
const DRAFTKINGS_RULES_URL = "https://www.draftkings.com/help/rules/1";
const SOURCE_DOC_URL =
  "https://docs.google.com/document/d/19I0M17HoNYu_zi2dcLTdrbr7lzSRzLqxQb6OAnzNRQk/edit?tab=t.0";

const pageTitle = `The Joe Street Journal | ${siteConfig.shortName}`;

export const metadata = {
  title: pageTitle,
  description:
    "Join the Ballsville DFS League, review the format and payouts, and read The Joe Street Journal's weekly update.",
  alternates: { canonical: "/joe-street-journal" },
  openGraph: {
    url: "/joe-street-journal",
    title: pageTitle,
    description: "A season-long DraftKings DFS league with weekly prizes, cumulative standings, and fresh weekly coverage.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

function Eyebrow({ children }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">{children}</p>;
}

function Stat({ value, label }) {
  return (
    <div className="border-l border-white/15 pl-4">
      <div className="text-2xl font-black tracking-tight text-primary">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{label}</div>
    </div>
  );
}

function SectionCard({ number, title, children }) {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface p-6 shadow-lg md:p-8">
      <div className="pointer-events-none absolute right-5 top-1 text-7xl font-black text-white/[0.035]">{number}</div>
      <div className="relative">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Section {number}</div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-primary">{title}</h2>
        <div className="mt-5 text-sm leading-7 text-muted">{children}</div>
      </div>
    </article>
  );
}

export default function JoeStreetJournalPage() {
  return (
    <main className="section">
      <div className="container-site space-y-8">
        <header className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#07152b]/95 px-6 py-10 shadow-2xl md:px-10 md:py-14 lg:px-14">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_15%,rgba(122,212,242,.18),transparent_30%),radial-gradient(circle_at_10%_100%,rgba(229,159,60,.16),transparent_34%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div>
              <Eyebrow>Ballsville presents</Eyebrow>
              <h1 className="mt-4 max-w-4xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
                The Joe Street <span className="text-[color:var(--color-primary)]">Journal</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Your front door to the Ballsville DFS League: a new lineup every week, season-long stakes,
                weekly cash, and Joe&apos;s running account of the action.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a className="btn btn-primary" href={SIGNUP_URL} target="_blank" rel="noreferrer">
                  Apply to join
                </a>
                <Link className="btn btn-outline" href="/joe-street-journal/weekly">
                  Read the weekly update →
                </Link>
              </div>
            </div>

            <aside className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 backdrop-blur">
              <Eyebrow>2026 season</Eyebrow>
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6">
                <Stat value="$200" label="Entry" />
                <Stat value="100%" label="Paid out" />
                <Stat value="17" label="Scoring weeks" />
                <Stat value="Weekly" label="Fresh lineups" />
              </div>
              <a className="btn btn-outline mt-6 w-full" href={PAYMENT_URL} target="_blank" rel="noreferrer">
                Pay dues on LeagueSafe
              </a>
              <p className="mt-3 text-center text-[11px] leading-5 text-muted">
                Funds are held securely through LeagueSafe. Payment is for confirmed entrants committing to the full season.
              </p>
            </aside>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["01", "Join", "Submit the short interest form so Ballsville knows you’re in."],
            ["02", "Fund", "Confirmed entrants pay the $200 fee securely through LeagueSafe."],
            ["03", "Compete", "Build a new Sunday Main Slate lineup every week on DraftKings."],
          ].map(([number, title, copy]) => (
            <div key={number} className="rounded-2xl border border-subtle bg-card-trans p-5 backdrop-blur">
              <div className="text-xs font-bold tracking-[0.2em] text-accent">{number}</div>
              <h2 className="mt-3 text-lg font-bold text-primary">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <SectionCard number="01" title="The format">
            <p>
              This league is played on DraftKings. Each week you&apos;ll build a brand-new lineup using
              DraftKings&apos; Salary Cap format. Every player has a salary, and your job is to build the best
              lineup possible while staying under the cap. You&apos;re never stuck with the same team—every week
              is a fresh start.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              {["1 QB", "2 RB", "3 WR", "1 TE", "1 FLEX", "1 D/ST"].map((slot) => (
                <div key={slot} className="rounded-xl border border-white/10 bg-black/10 px-2 py-3 font-bold text-primary">
                  {slot}
                </div>
              ))}
            </div>
            <p className="mt-5">
              Standard DraftKings PPR scoring applies.{" "}
              <a className="text-accent underline underline-offset-4" href={DRAFTKINGS_RULES_URL} target="_blank" rel="noreferrer">
                Review official scoring
              </a>
              .
            </p>
          </SectionCard>

          <SectionCard number="02" title="The prize pool">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
                <div className="text-3xl font-black text-primary">~60%</div>
                <div className="mt-1 font-bold text-primary">Season-long</div>
                <p className="mt-2 leading-6">
                  The top three cumulative scores win. The final structure depends on league size, with a goal
                  of paying up to the top 10 if participation allows.
                </p>
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5">
                <div className="text-3xl font-black text-accent">40%</div>
                <div className="mt-1 font-bold text-primary">Weekly</div>
                <p className="mt-2 leading-6">
                  Weekly winners earn an estimated $100+ depending on league size, with a goal of paying up to
                  the top three each week.
                </p>
              </div>
            </div>
            <p className="mt-5">
              The final payout table depends on league size. Ballsville freebies may appear as bonus prizes
              throughout the season.
            </p>
          </SectionCard>

          <SectionCard number="03" title="The schedule">
            <ul className="space-y-3">
              <li><strong className="text-primary">Weeks 1–17:</strong> every Sunday Main Slate counts toward cumulative standings.</li>
              <li><strong className="text-primary">Week 18:</strong> a bonus week reserved for Ballsville freebies.</li>
              <li><strong className="text-primary">Every Wednesday:</strong> the next contest is posted in the Ballsville Discord DFS channel.</li>
              <li><strong className="text-primary">By January 13, 2027:</strong> LeagueSafe winnings are paid, no later than three days after Week 18.</li>
            </ul>
          </SectionCard>

          <SectionCard number="04" title="The commitment">
            <p>
              Season standings are cumulative. Missing a week does not eliminate you, but it creates a real
              disadvantage. Missing multiple weeks will likely leave you competing only for weekly prizes.
              This league is built for active owners from Week 1 through Week 17.
            </p>
            <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/[0.06] p-5">
              <div className="font-bold text-primary">Know before you enter</div>
              <p className="mt-2">
                There are no concessions for missed weeks: no refunds, no chargebacks, and no exceptions for
                missed lineups. Life happens, but if you cannot submit a lineup most weeks, please do not enter.
              </p>
            </div>
          </SectionCard>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-subtle bg-card-surface shadow-xl">
          <div className="grid lg:grid-cols-[1fr_1fr]">
            <div className="p-7 md:p-10">
              <Eyebrow>Get on the field</Eyebrow>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-primary">Ready to play?</h2>
              <p className="mt-4 max-w-xl leading-7 text-muted">
                Apply first. Once your spot is confirmed, fund it through LeagueSafe and join the official
                DraftKings league.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="btn btn-primary" href={SIGNUP_URL} target="_blank" rel="noreferrer">Sign-up form</a>
                <a className="btn btn-outline" href={PAYMENT_URL} target="_blank" rel="noreferrer">Pay league dues</a>
                <a className="btn btn-outline" href={DRAFTKINGS_LEAGUE_URL} target="_blank" rel="noreferrer">Join DFS league</a>
              </div>
            </div>
            <div className="border-t border-subtle bg-black/10 p-7 md:p-10 lg:border-l lg:border-t-0">
              <div className="text-sm font-bold text-primary">New to DraftKings?</div>
              <p className="mt-3 text-sm leading-7 text-muted">
                Use Joe&apos;s referral link and complete these steps. The referral is only for first-time
                DraftKings users.
              </p>
              <ol className="mt-4 space-y-3 text-sm text-muted">
                {[
                  "Create your DraftKings account.",
                  "Deposit at least $20.",
                  "Enter any DraftKings contest.",
                  "Join the Ballsville DFS Degens league.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] text-[11px] font-bold text-accent">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              <a className="mt-5 inline-flex text-sm font-bold text-accent hover:underline" href={DRAFTKINGS_REFERRAL_URL} target="_blank" rel="noreferrer">
                Create a DraftKings account →
              </a>
              <span className="mx-3 text-muted">•</span>
              <a className="mt-5 inline-flex text-sm font-bold text-accent hover:underline" href={DRAFTKINGS_LEAGUE_URL} target="_blank" rel="noreferrer">
                Open Ballsville DFS Degens →
              </a>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-amber-300/20 bg-gradient-to-r from-amber-300/[0.08] to-cyan-300/[0.06] p-7 md:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Eyebrow>Already in the league?</Eyebrow>
              <h2 className="mt-2 text-2xl font-black text-primary">Joe&apos;s weekly desk is down the hall.</h2>
              <p className="mt-2 text-sm text-muted">Open the live edition for weekly updates, analysis, props, and receipts.</p>
            </div>
            <Link className="btn btn-primary shrink-0" href="/joe-street-journal/weekly">Enter the newsroom →</Link>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted">
          <a className="hover:text-accent" href={SOURCE_DOC_URL} target="_blank" rel="noreferrer">View original league information</a>
          <span aria-hidden="true">•</span>
          <span>Participation is subject to DraftKings eligibility and local laws.</span>
        </div>
      </div>
    </main>
  );
}
