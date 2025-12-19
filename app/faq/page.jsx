// app/faq/page.jsx
import FAQItem from "@/components/FAQItem";
import { siteConfig } from "@/app/config/siteConfig";

const pageTitle = `FAQ | ${siteConfig.shortName}`;

export const metadata = {
  title: pageTitle,
  description:
    "Frequently asked questions about The Ballsville Game: formats, payouts, Sleeper, mini games, and how to join.",
  alternates: { canonical: "/faq" },
  openGraph: {
    url: "/faq",
    title: pageTitle,
    description:
      "Frequently asked questions about The Ballsville Game, formats, payouts, Sleeper setup, and mini games.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

const faqs = [
  {
    question: "What is The Ballsville Game?",
    answer:
      "The Ballsville Game is a fantasy football ecosystem built around bestball tournaments, mini leagues, dynasty empires, and redraft tiers — all tied together by a formula that combines big payouts with great odds.",
  },
  {
    question: "What platform do you use for leagues?",
    answer:
      "All core Ballsville leagues are hosted on Sleeper. You’ll draft, set lineups (where applicable), and view scores directly in the Sleeper app. This site handles the bigger game structure, leaderboards, and mini games.",
  },
  {
    question: "Who can join Ballsville leagues?",
    answer:
      "Anyone who is old enough to play fantasy for money in their region and has access to Sleeper can join, as long as they follow our League Constitution & Code of Conduct. Some leagues or buy-in levels may have limited spots or returning-player priority.",
  },
  {
    question: "What formats do you offer?",
    answer:
      "We currently run large bestball games (the BIG game), mini bestball leagues, redraft tiers, dynasty/empire leagues, and specialty formats like Gauntlet. Each format has its own rules page and uses the Constitution as a baseline.",
  },
  {
    question: "How do buy-ins and payouts work?",
    answer:
      "Buy-in amounts and payout structures are posted for each league before drafts start. Payouts are tied to league results and, for certain formats, Ballsville-wide tournaments. Full details live on the league info pages and in the League Constitution.",
  },
  {
    question: "Where can I see standings and results?",
    answer:
      "Live standings and tournament results are powered by our automated leaderboard engine. You can view them anytime on the Leaderboards page, which pulls data from Sleeper and applies Ballsville’s scoring and tie-break rules. *live is a timed update, roughly every 10 minutes during gametimes.",
  },
  {
    question: "What are Mini Games on the News page?",
    answer:
      "Mini Games are limited-time side contests, promos, or giveaways announced on the News page. Some use promo codes or quick entry forms and may offer free entries, credit, or small prizes. Each post will include rules and a closing time.",
  },
  {
    question: "How does the Code of Conduct work?",
    answer:
      "All leagues use the same Code of Conduct and League Constitution. It covers fair play, trading standards, collusion, tanking, and behavior in league chat. If you join any Ballsville league, you’re agreeing to those rules.",
  },
  {
    question: "How do I ask a rules question or report an issue?",
    answer:
      "If you have a question about a league rule, trade, or mini game, you can reach us by email at theballsvillegame@gmail.com or in the Ballsville Discord. We try to resolve disputes quickly and in line with the Constitution.",
  },
  {
    question: "Are Ballsville rules the same for every league?",
    answer:
      "The Constitution is the baseline, but each league can have its own bylaws, buy-ins, and scoring tweaks. When there’s a conflict, the specific league’s posted settings and bylaws take priority, as long as they don’t violate the spirit of the Constitution.",
  },
];

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const discordUrl = siteConfig.discordUrl || "https://discord.gg/mtqCRRW3";
  const emailHref = "mailto:theballsvillegame@gmail.com";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="section">
        <div className="container-site space-y-6">
          {/* HERO CARD (readable + premium) */}
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            {/* subtle glows */}
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
              <div className="absolute top-10 right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
            </div>

            <div className="relative text-center max-w-3xl mx-auto">
              <span className="badge">Answers you can trust</span>
              <h1 className="h1 mt-3">Frequently Asked Questions</h1>
              <p className="lead mt-3 text-muted">
                Quick answers about formats, payouts, Sleeper setup, and how the BALLSVILLE game works.
              </p>
            </div>
          </header>

          {/* Layout: left info card, right accordion */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: contact/help card */}
            <aside className="bg-card-surface border border-subtle rounded-2xl p-6 lg:sticky lg:top-20 self-start shadow-sm">
              <h2 className="h3 mb-2">Still have a question?</h2>
              <p className="text-muted">
                Reach out if you need help with a league rule, mini game, or Sleeper setup.
              </p>

              <div className="mt-5 grid gap-3">
                <a href={emailHref} className="btn btn-primary">
                  Email the commissioner
                </a>
                <a
                  href={discordUrl}
                  className="btn btn-outline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join the Discord
                </a>
                <a href="/leaderboards" className="btn btn-outline">
                  View leaderboards
                </a>
              </div>

              <div className="divider-subtle mt-6 pt-6">
                <p className="text-sm text-muted">
                  For detailed rules and governance (trades, conduct, tiebreakers, and more), see the{" "}
                  <a
                    href="/constitution"
                    className="underline underline-offset-4 decoration-accent hover:text-accent"
                  >
                    League Constitution &amp; Code of Conduct
                  </a>
                  .
                </p>
              </div>
            </aside>

            {/* Right: FAQ list */}
            <div className="lg:col-span-2">
              <div className="bg-card-surface border border-subtle rounded-2xl p-2 shadow-sm">
                {faqs.map((f, idx) => (
                  <FAQItem key={f.question} {...f} defaultOpen={idx === 0} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
