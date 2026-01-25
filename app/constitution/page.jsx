import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/app/config/siteConfig";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import ConstitutionClient from "@/components/constitution/ConstitutionClient";

const pageTitle = `League Constitution | ${siteConfig.shortName}`;

export const metadata = {
  title: pageTitle,
  description:
    "Core constitution, code of conduct, and governance framework for all BALLSVILLE / Westlex fantasy leagues.",
  alternates: { canonical: "/constitution" },
  openGraph: {
    url: "/constitution",
    title: pageTitle,
    description:
      "Core constitution, code of conduct, and governance framework for all BALLSVILLE / Westlex fantasy leagues.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630 }],
  },
};

export default function Page() {
  return (
    <main className="min-h-screen text-fg relative">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          {/* HERO */}
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/20 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
              <div className="absolute top-10 right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">BALLSVILLE GOVERNANCE</p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-primary">
                  League Constitution <span className="text-accent">&amp; Code of Conduct</span>
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">
                  The baseline rules, protections, and expectations across all BALLSVILLE / Westlex formats —
                  dynasty, redraft, best ball, tournaments, and custom leagues.
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <a href="#section-1" className="btn btn-primary">
                    Start Reading →
                  </a>
                  <Link prefetch={false} href="/leaderboards" className="btn btn-outline">
                    Leaderboards
                  </Link>
                  <Link prefetch={false} href="/hall-of-fame" className="btn btn-outline">
                    Hall of Fame
                  </Link>
                </div>

                <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    Applies “where applicable”
                  </span>
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    League-specific bylaws may add details
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden shadow-lg">
                <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    QUICK NAV
                  </span>

                  <Image
                    src="/photos/bylaws.webp"
                    alt="BALLSVILLE game & code of conduct rulebook"
                    width={120}
                    height={80}
                    className="rounded-md"
                    priority
                  />
                </div>

                <div className="p-4">
                  <p className="text-xs text-muted leading-snug">
                    Tip: Use the Table of Contents below to jump between sections fast.
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Remote-first (R2) only. If nothing exists, component shows the empty state. */}
          <SectionManifestGate section="constitution">
            <ConstitutionClient remoteKey="content/constitution/main.json" />
          </SectionManifestGate>
        </div>
      </section>
    </main>
  );
}
