// app/joe-street-journal/page.jsx
import { siteConfig } from "@/app/config/siteConfig";

const DOC_URL =
  "https://docs.google.com/document/d/e/2PACX-1vTNyddNULSiiFSM2bYknXzpoFh5qi_szayYZ7Y4Ze6Vo62ZLhV3BFCK53v-19TaB6n4-e94K2eHpHuY/pub?embedded=true";

const pageTitle = `The Joe Street Journal | ${siteConfig.shortName}`;

export const metadata = {
  title: pageTitle,
  description:
    "The Joe Street Journal — Ballsville's weekly write-up, updated live. Power rankings, storylines, and chaos.",
  alternates: { canonical: "/joe-street-journal" },
  openGraph: {
    url: "/joe-street-journal",
    title: pageTitle,
    description:
      "The Joe Street Journal — Ballsville's weekly write-up, updated live. Power rankings, storylines, and chaos.",
    images: [{ url: "/photos/joe-street-journal-1280.webp", width: 1280, height: 720 }],
  },
};

export default function JoeStreetJournalPage() {
  return (
    <section className="section">
      <div className="container-site space-y-8">
        {/* HERO */}
        <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
          {/* premium glow */}
          <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
            <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
          </div>

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)] lg:items-start">
            {/* left */}
            <div className="space-y-4">
              <span className="badge">Weekly Feature</span>

              <h1 className="h1 mt-2">The Joe Street Journal</h1>

              <p className="lead max-w-2xl">
                A living Ballsville doc — updated whenever Joe drops the hammer.
                Read it here, share it, and keep receipts.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <a className="btn btn-primary" href={DOC_URL} target="_blank" rel="noreferrer">
                  Open in a new tab
                </a>
                <a className="btn btn-outline" href="/hall-of-fame">
                  Hall of Fame
                </a>
                <a className="btn btn-outline" href="/leaderboards">
                  Leaderboards
                </a>
              </div>

              <p className="text-sm text-muted">
                Tip: If the embed ever looks zoomed, “Open in a new tab” is the cleanest view.
              </p>
            </div>

            {/* right: small “info bubble” panel to match your new hero style */}
            <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-5 shadow-lg">
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted">
                What&apos;s inside
              </p>
              <ul className="mt-3 space-y-2 text-sm text-fg">
                <li>• Positional DFS</li>
                <li>• Prop Bets</li>
                <li>• Updated Weekly!</li>
              </ul>
              <div className="mt-4">
                <a className="btn btn-outline w-full" href={DOC_URL} target="_blank" rel="noreferrer">
                  Fullscreen / New Tab
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* EMBED */}
        <div className="bg-card-surface border border-subtle shadow-md rounded-3xl p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="h3">Live Journal</h2>
              <p className="text-muted mt-1">Auto-updates as the Google Doc changes.</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <a className="btn btn-outline" href={DOC_URL} target="_blank" rel="noreferrer">
                Fullscreen / New Tab
              </a>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden border border-subtle bg-subtle-surface"
            style={{ height: "min(78vh, 980px)" }}
          >
            <iframe
              title="The Joe Street Journal"
              src={DOC_URL}
              width="100%"
              height="100%"
              style={{ border: "0" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
