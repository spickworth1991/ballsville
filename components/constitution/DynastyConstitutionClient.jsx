"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function formatUpdatedAt(iso) {
  const d = new Date(String(iso || ""));
  if (!Number.isFinite(d.getTime())) return "";
  try {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function normalizeRemoteSections(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const cleaned = rows
    .map((s, i) => {
      const title = safeStr(s?.title || "").trim();
      const id = slugify(s?.id || s?.anchor || title || `section-${i + 1}`);
      const order = Number.isFinite(Number(s?.order)) ? Number(s.order) : i + 1;
      const bodyHtml = safeStr(s?.bodyHtml || s?.html || "").trim();
      return { id, title, order, bodyHtml };
    })
    .filter((s) => s.id && s.title);

  // Sort by order, then renumber sequentially so TOC numbers == section order.
  cleaned.sort((a, b) => a.order - b.order);
  return cleaned.map((s, idx) => ({ ...s, order: idx + 1 }));
}

function TocLink({ href, children }) {
  return (
    <a
      href={href}
      className="block rounded-lg px-3 py-2 text-sm text-muted hover:text-primary hover:bg-subtle-surface transition"
      onClick={(e) => {
        try {
          const id = String(href || "").replace(/^#/, "");
          const el = document.getElementById(id);
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } catch {
          // fall back
        }
      }}
    >
      {children}
    </a>
  );
}

function RemoteSectionCard({ id, title, bodyHtml }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-subtle bg-card-surface p-6 shadow-sm">
      <h2 className="text-xl md:text-2xl font-semibold text-primary">{title}</h2>
      <div
        className="mt-3 prose prose-invert max-w-none prose-p:my-2 prose-li:my-1 text-sm md:text-base"
        dangerouslySetInnerHTML={{ __html: bodyHtml || "" }}
      />
    </section>
  );
}

export default function DynastyConstitutionClient({ version = "0", manifest = null }) {
  const [sections, setSections] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Manifest-first: avoid an initial v=0 fetch before SectionManifestGate loads.
    if (!manifest && String(version || "0") === "0") return () => {
      cancelled = true;
    };

    const bust = `v=${encodeURIComponent(String(version || "0"))}`;
    const url = adminR2Url(`content/constitution/dynasty.json?${bust}`);

    setError("");
    setLoading(true);

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const normalized = normalizeRemoteSections(json?.sections || json?.items || []);
        setSections(normalized);
        setUpdatedAt(safeStr(json?.updatedAt || ""));
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
  }, [version, manifest]);

  const toc = useMemo(
    () => sections.map((s) => ({ id: s.id, label: `${s.order}. ${s.title}` })),
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
              <div className="absolute top-10 right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.35em] text-accent">DYNASTY GOVERNANCE</p>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-primary">
                  Dynasty Bye-Laws <span className="text-accent">&amp; Code of Conduct</span>
                </h1>

                <p className="text-sm sm:text-base text-muted max-w-prose">
                  Official rules and expectations for all BALLSVILLE dynasty leagues.
                </p>

                <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    LIVE{updatedLabel ? ` · Last updated ${updatedLabel}` : ""}
                  </span>
                  <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
                    Use TOC for quick jumps
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {toc.length ? (
                    <a href={`#${toc[0].id}`} className="btn btn-primary">
                      Start Reading →
                    </a>
                  ) : null}
                  <Link prefetch={false} href="/constitution" className="btn btn-outline">
                    League Constitution
                  </Link>
                  <Link prefetch={false} href="/leaderboards" className="btn btn-outline">
                    Leaderboards
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm overflow-hidden shadow-lg">
                <div className="px-4 py-3 border-b border-subtle">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">NOTES</p>
                </div>
                <div className="p-4 space-y-2 text-sm text-muted">
                  <p>This page is fully editable by admins.</p>
                  <p>Order numbers are the Table of Contents numbers.</p>
                </div>
              </div>
            </div>
          </header>

          {/* TOC + CONTENT */}
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] items-start">
            <aside className="space-y-4">
              <div className="bg-card-surface border border-subtle rounded-2xl p-5 shadow-sm sticky top-4">
                <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">Table of Contents</h2>

                {loading ? (
                  <div className="text-sm text-muted">Loading…</div>
                ) : error ? (
                  <div className="text-sm text-red-200">{error}</div>
                ) : toc.length === 0 ? (
                  <div className="text-sm text-muted">No sections yet.</div>
                ) : (
                  <nav className="space-y-1">
                    {toc.map((s) => (
                      <TocLink key={s.id} href={`#${s.id}`}>
                        {s.label}
                      </TocLink>
                    ))}
                  </nav>
                )}
              </div>
            </aside>

            <div className="space-y-6">
              {loading ? (
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-4 text-sm text-muted text-center">
                  Loading…
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200">
                  {error}
                </div>
              ) : sections.length === 0 ? (
                <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-sm text-muted">
                  No Dynasty Constitution content has been published yet.
                </div>
              ) : (
                sections.map((s) => (
                  <RemoteSectionCard key={s.id} id={s.id} title={`${s.order}. ${s.title}`} bodyHtml={s.bodyHtml} />
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
