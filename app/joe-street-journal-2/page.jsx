import Link from "next/link";
import { siteConfig } from "@/app/config/siteConfig";

const INFO_DOC_URL =
  "https://docs.google.com/document/d/19I0M17HoNYu_zi2dcLTdrbr7lzSRzLqxQb6OAnzNRQk/preview";
const INFO_DOC_EDIT_URL =
  "https://docs.google.com/document/d/19I0M17HoNYu_zi2dcLTdrbr7lzSRzLqxQb6OAnzNRQk/edit?tab=t.0";

export const metadata = {
  title: `The Joe Street Journal | ${siteConfig.shortName}`,
  description:
    "Ballsville DFS League information, signup details, rules, payouts, and The Joe Street Journal weekly edition.",
  robots: { index: false, follow: false },
};

export default function JoeStreetJournalAlternatePage() {
  return (
    <main className="section">
      <div className="container-site space-y-5">
        <header className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#07152b]/95 px-5 py-6 shadow-2xl md:px-8 md:py-7">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_88%_0%,rgba(122,212,242,.18),transparent_34%),radial-gradient(circle_at_4%_100%,rgba(229,159,60,.14),transparent_35%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-accent">
                Ballsville DFS League
              </p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-[-0.04em] text-white md:text-4xl">
                The Joe Street <span className="text-[color:var(--color-primary)]">Journal</span>
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                League information, rules, payouts, and signup details.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a className="btn btn-outline" href={INFO_DOC_EDIT_URL} target="_blank" rel="noreferrer">
                Open fullscreen
              </a>
              <Link className="btn btn-primary" href="/joe-street-journal/weekly">
                Weekly update →
              </Link>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-subtle bg-card-surface p-2 shadow-2xl md:p-3">
          <div className="mb-2 flex items-center justify-between gap-3 px-3 py-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent">League information</p>
              <p className="mt-1 text-xs text-muted">This document stays current as Joe updates it.</p>
            </div>
            <span className="hidden items-center gap-2 text-xs text-muted sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,.8)]" />
              Live document
            </span>
          </div>

          <div
            className="overflow-hidden rounded-[1.4rem] border border-subtle bg-white"
            style={{ height: "calc(100vh - 260px)", minHeight: "720px", maxHeight: "1200px" }}
          >
            <iframe
              title="Ballsville DFS League information"
              src={INFO_DOC_URL}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="eager"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
            />
          </div>
        </section>

        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-subtle bg-card-trans px-5 py-4 text-center sm:flex-row sm:text-left">
          <div>
            <div className="text-sm font-semibold text-primary">Looking for this week&apos;s issue?</div>
            <div className="mt-1 text-xs text-muted">Joe&apos;s weekly analysis and updates live on a separate page.</div>
          </div>
          <Link className="btn btn-outline shrink-0" href="/joe-street-journal/weekly">
            Enter the newsroom →
          </Link>
        </div>
      </div>
    </main>
  );
}
