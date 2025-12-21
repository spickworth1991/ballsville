"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CURRENT_SEASON } from "@/src/lib/season";

function safeMode(mode) {
  const m = String(mode || "").trim().toLowerCase();
  const allow = new Set(["redraft", "biggame", "big-game", "gauntlet", "dynasty", "mini-leagues"]);
  if (!allow.has(m)) return "";
  if (m === "big-game") return "biggame";
  return m;
}

const DEFAULT = {
  season: CURRENT_SEASON,
  hero: {
    promoImageKey: "",
    promoImageUrl: "",
    updatesHtml: "<p>Updates will show here.</p>",
  },
};

export default function OwnerHeroBlock({
  mode,
  season = CURRENT_SEASON, // used only to determine which JSON we fetch
  title = "Owner Updates",
  subtitle,
}) {
  const m = safeMode(mode);
  const [cfg, setCfg] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // one-time cache-bust per mount (good enough)
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
      </div>

      <div className="p-4 grid gap-4">
        {imgSrc ? (
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

            <Image
              src={imgSrc}
              alt={`${title} image`}
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

        <div
          className="prose prose-invert max-w-none text-sm text-muted"
          dangerouslySetInnerHTML={{ __html: cfg?.hero?.updatesHtml || DEFAULT.hero.updatesHtml }}
        />
      </div>
    </div>
  );
}
