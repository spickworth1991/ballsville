"use client";

import { useEffect, useMemo, useState } from "react";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { r2Url } from "@/lib/r2Url";

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

function linkMap(links) {
  return new Map((Array.isArray(links) ? links : []).map((link) => [str(link?.id), link]));
}

function Action({ link, primary = false }) {
  if (!link?.url) return null;
  const external = /^https?:\/\//i.test(link.url);
  return (
    <a className={primary ? "btn btn-primary" : "btn btn-outline"} href={link.url}
      target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {link.label || "Open"} →
    </a>
  );
}

function JournalContent({ version }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = `${r2Url("content/joe-street-journal/main.json")}?v=${encodeURIComponent(version || "0")}`;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404
          ? "Journal content has not been initialized yet. Open the Journal admin page once to create it."
          : `Unable to load Journal content (${res.status}).`);
        return res.json();
      })
      .then((value) => { if (!cancelled) setData(value); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Unable to load Journal content."); });
    return () => { cancelled = true; };
  }, [version]);

  const links = useMemo(() => linkMap(data?.links), [data]);

  if (error) {
    return <div className="container-site rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">{error}</div>;
  }
  if (!data) {
    return <div className="container-site rounded-2xl border border-subtle bg-card-surface p-6 text-muted">Loading Journal…</div>;
  }

  return (
    <div className="container-site space-y-8">
      <header className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-[#07152b]/95 px-6 py-10 shadow-2xl md:px-10 md:py-14 lg:px-14">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_15%,rgba(122,212,242,.18),transparent_30%),radial-gradient(circle_at_10%_100%,rgba(229,159,60,.16),transparent_34%)]" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">{data.branding?.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-5xl font-black uppercase leading-[0.9] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              {data.branding?.title} <span className="text-[color:var(--color-primary)]">{data.branding?.accent}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{data.branding?.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Action link={links.get("signup")} primary />
              <Action link={links.get("weekly")} />
            </div>
          </div>
          <aside className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 backdrop-blur">
            <div className="grid grid-cols-2 gap-x-5 gap-y-6">
              {(data.stats || []).map((stat, index) => (
                <div key={`${stat.label}-${index}`} className="border-l border-white/15 pl-4">
                  <div className="text-2xl font-black text-primary">{stat.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-6"><Action link={links.get("payment")} /></div>
            <p className="mt-3 text-center text-[11px] leading-5 text-muted">{data.signup?.paymentNote}</p>
          </aside>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {(data.journey || []).map((step, index) => (
          <div key={`${step.title}-${index}`} className="rounded-2xl border border-subtle bg-card-trans p-5 backdrop-blur">
            <div className="text-xs font-bold tracking-[0.2em] text-accent">{String(index + 1).padStart(2, "0")}</div>
            <h2 className="mt-3 text-lg font-bold text-primary">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {(data.sections || []).map((section, index) => {
          const sectionLink = links.get(section.linkId);
          return (
            <article key={section.id} className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface p-6 shadow-lg md:p-8">
              <div className="absolute right-5 top-1 text-7xl font-black text-white/[0.035]">{String(index + 1).padStart(2, "0")}</div>
              <div className="relative">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Section {String(index + 1).padStart(2, "0")}</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-primary">{section.title}</h2>
                <div className="mt-5 space-y-4 text-sm leading-7 text-muted">
                  {str(section.body).split(/\n{2,}/).filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
                  {section.items?.length ? (
                    <ul className="space-y-2">
                      {section.items.map((item, i) => <li key={i} className="flex gap-3"><span className="text-accent">•</span><span>{item}</span></li>)}
                    </ul>
                  ) : null}
                  {section.calloutTitle || section.calloutText ? (
                    <div className="rounded-2xl border border-rose-300/20 bg-rose-400/[0.06] p-5">
                      <div className="font-bold text-primary">{section.calloutTitle}</div>
                      <p className="mt-2">{section.calloutText}</p>
                    </div>
                  ) : null}
                  {sectionLink ? <Action link={sectionLink} /> : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-subtle bg-card-surface shadow-xl">
        <div className="grid lg:grid-cols-2">
          <div className="p-7 md:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">{data.signup?.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black text-primary">{data.signup?.title}</h2>
            <p className="mt-4 leading-7 text-muted">{data.signup?.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Action link={links.get("signup")} primary />
              <Action link={links.get("payment")} />
              <Action link={links.get("draftkings-league")} />
            </div>
          </div>
          <div className="border-t border-subtle bg-black/10 p-7 md:p-10 lg:border-l lg:border-t-0">
            <h2 className="text-lg font-bold text-primary">{data.draftKings?.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted">{data.draftKings?.description}</p>
            <ol className="mt-4 space-y-3 text-sm text-muted">
              {(data.draftKings?.steps || []).map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/25 text-xs font-bold text-accent">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <Action link={links.get("draftkings-referral")} />
              <Action link={links.get("draftkings-league")} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-300/20 bg-gradient-to-r from-amber-300/[0.08] to-cyan-300/[0.06] p-7 md:p-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">{data.weekly?.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-black text-primary">{data.weekly?.title}</h2>
            <p className="mt-2 text-sm text-muted">{data.weekly?.description}</p>
          </div>
          <Action link={links.get("weekly")} primary />
        </div>
      </section>

      <footer className="flex flex-wrap justify-center gap-4 text-xs text-muted">
        <Action link={links.get("source")} />
        <span>{data.disclaimer}</span>
      </footer>
    </div>
  );
}

export default function JoeStreetJournalClient() {
  return (
    <main className="section">
      <SectionManifestGate section="joe-street-journal">
        {({ version }) => <JournalContent version={version} />}
      </SectionManifestGate>
    </main>
  );
}
