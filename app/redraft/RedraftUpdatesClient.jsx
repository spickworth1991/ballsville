// app/redraft/RedraftUpdatesClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CURRENT_SEASON } from "@/src/lib/season";

const SEASON = CURRENT_SEASON;

const DEFAULT_PAGE = {
  season: SEASON,
  hero: {
    promoImageKey: "",
    // IMPORTANT: this is NOT the "How it Works" image (that one is hardcoded on the page)
    promoImageUrl: "/photos/redraft/champ.jpg",
    updatesHtml: "<p>Updates will show here.</p>",
  },
};

export default function RedraftUpdatesClient() {
  const [pageCfg, setPageCfg] = useState(DEFAULT_PAGE);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const bust = useMemo(() => `v=${Date.now()}`, []);

  const updatesImgSrc = pageCfg?.hero?.promoImageKey
    ? `/r2/${pageCfg.hero.promoImageKey}?v=${encodeURIComponent(pageCfg.hero.promoImageKey)}`
    : pageCfg?.hero?.promoImageUrl || DEFAULT_PAGE.hero.promoImageUrl;

  async function loadPage() {
    setErr("");
    setLoading(true);
    try {
      const pageRes = await fetch(`/r2/content/redraft/page_${SEASON}.json?${bust}`, { cache: "no-store" });
      if (pageRes.ok) {
        const data = await pageRes.json();
        const hero = data?.hero || {};
        setPageCfg({
          ...DEFAULT_PAGE,
          ...data,
          hero: {
            ...DEFAULT_PAGE.hero,
            promoImageKey: hero?.promoImageKey ?? "",
            promoImageUrl: hero?.promoImageUrl ?? DEFAULT_PAGE.hero.promoImageUrl,
            updatesHtml: hero?.updatesHtml ?? DEFAULT_PAGE.hero.updatesHtml,
          },
        });
      } else {
        setPageCfg(DEFAULT_PAGE);
      }
    } catch (e) {
      setErr(e?.message || "Failed to load Redraft updates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8">
        <p className="text-muted">Loading updates…</p>
      </section>
    );
  }

  if (err) {
    return (
      <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8">
        <p className="text-muted">{err}</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-subtle bg-card-surface overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-subtle flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Updates</h2>
        <span className="text-[11px] text-muted">Redraft</span>
      </div>

      <div className="p-6 md:p-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-subtle bg-black/20">
          <Image
            src={updatesImgSrc}
            alt="Redraft updates"
            fill
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-cover"
          />
        </div>

        <div
          className="prose prose-invert max-w-none text-sm text-muted"
          dangerouslySetInnerHTML={{ __html: pageCfg?.hero?.updatesHtml || DEFAULT_PAGE.hero.updatesHtml }}
        />
      </div>
    </section>
  );
}
