// src/lib/BigGameThemeClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabaseClient";

export default function BigGameThemeClient({ themeSlug }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!themeSlug) return;
    let cancelled = false;

    async function run() {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("biggame_leagues")
          .select("*")
          .eq("theme_slug", themeSlug)
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (error) throw error;
        if (!cancelled) {
          setRows(data || []);
        }
      } catch (err) {
        console.error("Failed to load biggame_leagues for theme:", err);
        if (!cancelled) {
          setErrorMsg(
            "Unable to load leagues for this division right now. Please refresh or try again later."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [themeSlug]);

  const header = useMemo(
    () => (rows.length > 0 ? rows[0] : null),
    [rows]
  );

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Division Leagues</h2>
        <p className="text-sm text-muted">Loading leagues…</p>
      </section>
    );
  }

  if (errorMsg) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Division Leagues</h2>
        <p className="text-sm text-danger">{errorMsg}</p>
      </section>
    );
  }

  if (!header) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Division Leagues</h2>
        <p className="text-sm text-muted">
          No leagues found for this division yet.
        </p>
      </section>
    );
  }

  const themeName = header.theme_name || themeSlug;
  const themeBlurb = header.theme_blurb || "";
  const status = header.status || "TBD";

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-accent">
          Big Game Division
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold">
          {themeName}
        </h1>
        <p className="text-xs sm:text-sm text-muted">
          Status: <span className="font-semibold">{status}</span>
        </p>
        {themeBlurb && (
          <p className="text-sm text-muted max-w-prose">{themeBlurb}</p>
        )}
        <p className="text-xs text-muted">
          This division consists of up to 8 leagues. Each tile below links
          directly to the Sleeper league.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((lg) => (
          <Link
            key={lg.id}
            href={lg.sleeper_url || "#"}
            className="group rounded-xl border border-subtle bg-card-surface overflow-hidden flex flex-col hover:border-accent hover:-translate-y-0.5 transition"
          >
            <div className="relative aspect-square overflow-hidden">
              <Image
                src={
                  lg.league_image_url ||
                  lg.theme_image_url ||
                  "/photos/biggame/default-league.jpg"
                }
                alt={lg.league_name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-semibold text-white drop-shadow">
                  {lg.league_name}
                </p>
              </div>
            </div>
            <div className="p-3 text-xs text-muted flex-1 flex items-center justify-between gap-2">
              <span>Big Game Bestball</span>
              <span className="text-[11px] font-mono text-accent">
                #{lg.display_order ?? "—"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
