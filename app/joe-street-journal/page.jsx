// app/joe-street-journal/page.jsx
import { siteConfig } from "@/app/config/siteConfig";

const DOC_URL =
  "https://docs.google.com/document/d/e/2PACX-1vTNyddNULSiiFSM2bYknXzpoFh5qi_szayYZ7Y4Ze6Vo62ZLhV3BFCK53v-19TaB6n4-e94K2eHpHuY/pub?embedded=true";

const pageTitle = `The Joe Street Journal | ${siteConfig.shortName}`;
const pageUrl = `${siteConfig.domain}/joe-street-journal`;

export const metadata = {
  title: pageTitle,
  description:
    "The Joe Street Journal — Ballsville's weekly write-up, updated live. Power rankings, storylines, and chaos.",
  alternates: { canonical: pageUrl },
  openGraph: {
    url: pageUrl,
    title: pageTitle,
    description:
      "The Joe Street Journal — Ballsville's weekly write-up, updated live. Power rankings, storylines, and chaos.",
    images: [{ url: "/photos/joe-street-journal-1280.webp", width: 1280, height: 720 }],
  },
};

export default function JoeStreetJournalPage() {
  return (
    <section className="section">
      <div className="container-site space-y-10">
        {/* Hero */}
        <header className="bg-card-surface border border-subtle shadow-md rounded-2xl p-6 md:p-10 overflow-hidden relative">
          {/* subtle glow accents */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-30 blur-3xl bg-[color:var(--color-accent)]" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-25 blur-3xl bg-[color:var(--color-primary)]" />

          <div className="relative">
            <span className="badge">Weekly Feature</span>

            <h1 className="h1 mt-4">The Joe Street Journal</h1>

            <p className="lead mt-3 max-w-2xl">
              A living Ballsville doc — updated whenever Joe drops the hammer.
              Read it here, share it, and keep receipts.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
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

            <div className="mt-6 text-sm text-muted">
              Tip: If the embed ever looks zoomed, use “Open in a new tab” for the cleanest view.
            </div>
          </div>
        </header>

        {/* Embed */}
        <div className="bg-card-surface border border-subtle shadow-md rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="h3">Live Journal</h2>
              <p className="text-muted mt-1">
                Auto-updates as the Google Doc changes.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <a className="btn btn-outline" href={DOC_URL} target="_blank" rel="noreferrer">
                Fullscreen / New Tab
              </a>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden border border-subtle bg-subtle-surface"
            style={{
              // keeps it tall on desktop, but still usable on mobile
              height: "min(78vh, 980px)",
            }}
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
