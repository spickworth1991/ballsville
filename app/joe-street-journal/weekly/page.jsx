import Link from "next/link";
import { siteConfig } from "@/app/config/siteConfig";

const WEEKLY_DOC_URL =
  "https://docs.google.com/document/d/e/2PACX-1vTNyddNULSiiFSM2bYknXzpoFh5qi_szayYZ7Y4Ze6Vo62ZLhV3BFCK53v-19TaB6n4-e94K2eHpHuY/pub?embedded=true";

export const metadata = {
  title: `Weekly Edition | The Joe Street Journal | ${siteConfig.shortName}`,
  description: "The live weekly edition of The Joe Street Journal: DFS analysis, prop bets, and Ballsville storylines.",
  alternates: { canonical: "/joe-street-journal/weekly" },
};

export default function JoeStreetJournalWeeklyPage() {
  return (
    <main className="section">
      <div className="container-site space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-subtle bg-[#07152b]/95 p-6 shadow-xl md:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(122,212,242,.16),transparent_34%)]" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">Live from Ballsville</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">The Weekly Edition</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Joe&apos;s latest DFS analysis, prop bets, and weekly dispatch—updated live as the issue develops.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="btn btn-outline" href="/joe-street-journal">League information</Link>
              <a className="btn btn-primary" href={WEEKLY_DOC_URL} target="_blank" rel="noreferrer">Open fullscreen</a>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-subtle bg-card-surface p-3 shadow-xl md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3 px-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Current issue</div>
              <p className="mt-1 text-xs text-muted">This edition updates automatically when Joe updates the source document.</p>
            </div>
            <span className="hidden items-center gap-2 text-xs text-muted sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,.8)]" />
              Live document
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-subtle bg-white" style={{ height: "min(82vh, 1100px)" }}>
            <iframe
              title="The Joe Street Journal weekly edition"
              src={WEEKLY_DOC_URL}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="eager"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
