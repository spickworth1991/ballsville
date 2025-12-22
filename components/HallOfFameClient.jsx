"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

const FALLBACK = {
  title: "Hall of Fame",
  entries: [],
};

function normalizeEntry(e, idx) {
  const id = String(e?.id || e?.slug || idx);
  const title = String(e?.title || e?.name || "").trim();
  const subtitle = String(e?.subtitle || e?.note || "").trim();
  const year = e?.year != null ? String(e.year) : "";
  const imageKey = typeof e?.imageKey === "string" ? e.imageKey : "";
  const imageUrl = typeof e?.imageUrl === "string" ? e.imageUrl : "";

  const img = imageKey ? `/r2/${imageKey}` : imageUrl;

  return {
    id,
    title,
    subtitle,
    year,
    imageKey,
    imageUrl,
    img,
    order: Number.isFinite(Number(e?.order)) ? Number(e.order) : idx + 1,
  };
}

export default function HallOfFameClient() {
  const [data, setData] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const bust = useMemo(() => `v=${Date.now()}`, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr("");
      setLoading(true);
      try {
        const res = await fetch(`/r2/data/hall-of-fame/hall_of_fame.json?${bust}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setData(FALLBACK);
          return;
        }
        const json = await res.json();
        const title = String(json?.title || FALLBACK.title);
        const list = Array.isArray(json?.entries) ? json.entries : Array.isArray(json) ? json : [];
        const entries = list.map(normalizeEntry).sort((a, b) => a.order - b.order);
        if (!cancelled) setData({ title, entries });
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load Hall of Fame.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bust]);

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-semibold text-primary">{data.title}</h1>
            <p className="text-muted">Past champions, winners, and moments worth remembering.</p>
          </header>

          {err ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {err}
            </div>
          ) : null}

          {loading ? (
            <div className="card bg-card-surface border border-subtle p-4 text-sm text-muted">Loading…</div>
          ) : data.entries.length === 0 ? (
            <div className="card bg-card-surface border border-subtle p-4 text-sm text-muted">No entries yet.</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {data.entries.map((e) => (
                <article key={e.id} className="rounded-3xl border border-subtle bg-card-surface overflow-hidden shadow-sm">
                  {e.img ? (
                    <div className="relative w-full overflow-hidden rounded-xl border border-subtle bg-black/20">
                  <div
                    className="relative mx-auto flex items-center justify-center w-full"
                    style={{
                      height: "clamp(180px, 22vw, 240px)", // never taller than 240px
                      maxWidth: "560px",                  // keeps it from becoming a full-width billboard
                    }}
                  >
                    {/* background polish */}
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute -top-16 -left-16 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
                      <div className="absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/20" />
                    </div>
                      <Image src={e.img} alt={e.title || "Hall of Fame"} 
                        width={1600}
                        height={900}
                        sizes="(max-width: 1024px) 100vw, 560px"
                        className="relative z-10 object-contain p-2"
                        style={{
                          maxHeight: "100%",  // cannot exceed the frame height
                          maxWidth: "100%",   // cannot exceed the frame width
                          width: "auto",
                          height: "auto",
                        }}
                      />
                    </div>
                  </div>
                  ) : null}
                  <div className="p-5 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-lg font-semibold">{e.title || "Untitled"}</h2>
                      {e.year ? (
                        <span className="text-[11px] uppercase tracking-[0.25em] text-muted">{e.year}</span>
                      ) : null}
                    </div>
                    {e.subtitle ? <p className="text-sm text-muted">{e.subtitle}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
