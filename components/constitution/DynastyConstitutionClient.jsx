"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CURRENT_SEASON } from "@/lib/season";
import { adminR2Url } from "@/lib/r2Client";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function slugify(s) {
  return safeStr(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function formatUpdatedAt(iso) {
  const s = safeStr(iso).trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return d.toDateString();
  }
}

function normalizeRemoteSections(input) {
  const raw = Array.isArray(input) ? input : [];

  const cleaned = raw
    .map((s, idx) => {
      const title = safeStr(s?.title).trim();
      const id = slugify(s?.id || s?.anchor || title || `section-${idx + 1}`);
      const order = toInt(s?.order, idx + 1);
      const bodyHtml = safeStr(s?.bodyHtml || s?.html || "").trim();
      return { id, title, order, bodyHtml };
    })
    .filter((s) => s.title && s.id);

  cleaned.sort((a, b) => a.order - b.order);
  // Keep TOC numbers in sync with the order numbers (1..N).
  cleaned.forEach((s, i) => {
    s.order = i + 1;
  });
  return cleaned;
}

function TocLink({ href, children }) {
  return (
    <a
      href={href}
      className="block px-3 py-2 rounded-lg text-muted hover:text-primary hover:bg-subtle-surface transition"
      onClick={(e) => {
        // Smooth-scroll if possible.
        try {
          const id = String(href || "").replace(/^#/, "");
          const el = document.getElementById(id);
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } catch {
          // fall back to default
        }
      }}
    >
      {children}
    </a>
  );
}

function InlineNotice({ children }) {
  return (
    <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted text-center">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}

function SectionCard({ id, order, title, bodyHtml }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full border border-subtle bg-card-trans px-2 text-xs font-semibold text-muted">
          {order}
        </span>
        <h2 className="text-xl md:text-2xl font-semibold text-primary">{title}</h2>
      </div>
      <div
        className="prose prose-invert mt-4 max-w-none text-sm md:text-base"
        // Admin controls the HTML; this is intentional.
        dangerouslySetInnerHTML={{ __html: bodyHtml || "" }}
      />
    </section>
  );
}

export default function DynastyConstitutionClient({
  season = CURRENT_SEASON,
  version = "0",
  manifest = null,
}) {
  const [remote, setRemote] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Manifest-first: avoid an initial v=0 fetch before SectionManifestGate loads.
    if (!manifest && String(version || "0") === "0") return;

    const bust = `v=${encodeURIComponent(String(version || "0"))}`;
    const url = adminR2Url(`content/constitution/dynasty_${season}.json?${bust}`);

    setError("");
    setLoading(true);
    setRemote(null);
    setUpdatedAt("");

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const sections = normalizeRemoteSections(json?.sections || json?.items || []);
        setRemote({ sections });
        setUpdatedAt(safeStr(json?.updatedAt || json?.updated_at || ""));
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load constitution.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [season, version, manifest]);

  const sections = useMemo(() => remote?.sections || [], [remote]);
  const toc = useMemo(
    () =>
      sections.map((s) => ({
        id: s.id,
        label: `${s.order}. ${s.title}`,
      })),
    [sections]
  );

  const updatedLabel = formatUpdatedAt(updatedAt);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          {/* HERO */}
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">DYNASTY GOVERNANCE</p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-primary">
                  Dynasty Bye-Laws <span className="text-accent">&amp; Code of Conduct</span>
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">
                  Official rules and expectations for BALLSVILLE dynasty leagues.
                </p>

                <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    Live
                    {updatedLabel ? ` • Last updated ${updatedLabel}` : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {toc?.[0]?.id ? (
                    <a href={`#${toc[0].id}`} className="btn btn-primary">
                      Start Reading →
                    </a>
                  ) : (
                    <a href="#toc" className="btn btn-primary">
                      Table of Contents →
                    </a>
                  )}
                  <Link prefetch={false} href="/constitution" className="btn btn-outline">
                    Constitution Home
                  </Link>
                  <Link prefetch={false} href="/dynasty" className="btn btn-outline">
                    Dynasty
                  </Link>
                </div>
              </div>

              <aside className="w-full">
                <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden shadow-lg">
                  <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Status</span>
                    <span className="text-[11px] text-muted">{season}</span>
                  </div>
                  <div className="p-4 space-y-2 text-sm text-muted">
                    <p>
                      This page is editable by admins. The table of contents numbers match each section’s order.
                    </p>
                    <p>Use the TOC to jump quickly between sections.</p>
                  </div>
                </div>
              </aside>
            </div>
          </header>

          {error ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <InlineNotice>Loading…</InlineNotice>
          ) : sections.length === 0 ? (
            <InlineNotice>
              No dynasty constitution sections have been published for {season} yet.
            </InlineNotice>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start">
              {/* TOC */}
              <aside className="space-y-4">
                <div id="toc" className="bg-card-surface border border-subtle rounded-2xl p-5 shadow-sm sticky top-4">
                  <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">Table of Contents</h2>
                  <nav className="text-sm space-y-1">
                    {toc.map((s) => (
                      <TocLink key={s.id} href={`#${s.id}`}>
                        {s.label}
                      </TocLink>
                    ))}
                  </nav>
                </div>
              </aside>

              {/* Content */}
              <div className="space-y-6">
                {sections.map((s) => (
                  <SectionCard
                    key={s.id}
                    id={s.id}
                    order={s.order}
                    title={s.title}
                    bodyHtml={s.bodyHtml}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
