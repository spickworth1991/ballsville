"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

function safeMode(mode) {
  const m = String(mode || "").trim().toLowerCase();
  // keep paths predictable & safe
  const allow = new Set(["redraft", "biggame", "big-game", "gauntlet", "dynasty", "mini-leagues"]);
  if (!allow.has(m)) return "";
  // normalize big-game -> biggame for storage path
  if (m === "big-game") return "biggame";
  return m;
}

const DEFAULT = {
  season: 2025,
  hero: {
    promoImageKey: "",
    promoImageUrl: "",
    updatesHtml: "<p>Updates will show here.</p>",
  },
};

export default function OwnerHeroBlock({
  mode,
  season = 2025,
  title = "Owner Updates",
  subtitle,
}) {
  const m = safeMode(mode);
  const [cfg, setCfg] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const bust = useMemo(() => `v=${Date.now()}`, []);

  const imgSrc = cfg?.hero?.promoImageKey
    ? `/r2/${cfg.hero.promoImageKey}?v=${encodeURIComponent(cfg.hero.promoImageKey)}`
    : cfg?.hero?.promoImageUrl || "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr("");
      setLoading(true);
      if (!m) {
        setCfg({ ...DEFAULT, season });
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/r2/content/${m}/page_${season}.json?${bust}`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setCfg({ ...DEFAULT, season });
          return;
        }
        const data = await res.json();
        const hero = data?.hero || {};
        const next = {
          season: Number(data?.season || season) || season,
          hero: {
            promoImageKey: typeof hero?.promoImageKey === "string" ? hero.promoImageKey : "",
            promoImageUrl: typeof hero?.promoImageUrl === "string" ? hero.promoImageUrl : "",
            updatesHtml: typeof hero?.updatesHtml === "string" ? hero.updatesHtml : DEFAULT.hero.updatesHtml,
          },
        };
        if (!cancelled) setCfg(next);
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load updates block.");
          setCfg({ ...DEFAULT, season });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [m, season, bust]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm p-4 shadow-lg shadow-black/30">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
        {err}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card-trans backdrop-blur-sm overflow-hidden shadow-xl shadow-black/40">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {title}
          </span>
          <span className="block text-[11px] text-muted truncate">
            {subtitle || String(mode || "").toUpperCase()}
          </span>
        </div>
        <span className="text-[11px] text-muted">Season {season}</span>
      </div>

      <div className="p-4 grid gap-4">
        {imgSrc ? (
          <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-subtle bg-black/20">
            <Image
              src={imgSrc}
              alt={`${title} image`}
              fill
              sizes="(max-width: 1024px) 100vw, 520px"
              className="object-cover"
            />
          </div>
        ) : null}

        <div
          className="prose prose-invert max-w-none text-sm text-muted"
          dangerouslySetInnerHTML={{ __html: cfg?.hero?.updatesHtml || DEFAULT.hero.updatesHtml }}
        />
      </div>
    </div>
  );
}
