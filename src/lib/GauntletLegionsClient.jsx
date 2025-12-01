// src/lib/GauntletLegionsClient.jsx
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

const GODS_BY_THEME = {
  EGYPTIANS: [
    "AMUN-RAH",
    "OSIRIS",
    "Horus",
    "Anubis",
  ],
  GREEKS: [
    "ZEUS",
    "ARES",
    "Apollo",
    "Poseidon",
  ],
  ROMANS: [
    "SATURN",
    "MARS",
    "Minerva",
    "Saturn",
  ],
};

const STATUS_BADGE = {
  filling: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  full: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  tbd: "bg-slate-500/20 text-slate-200 border border-slate-500/40",
  drafting: "bg-purple-500/10 text-purple-300 border border-purple-500/40",
};

export default function GauntletLegionsClient() {
  const [legions, setLegions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("gauntlet_legions")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!error && data) setLegions(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mt-6 text-sm text-muted">
        Loading Legions…
      </div>
    );
  }

  if (!legions.length) {
    return (
      <div className="mt-6 text-sm text-muted">
        No Legions configured yet. Check back soon or ask your Game Manager.
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-3">
      {legions.map((legion) => {
        const themeKey = legion.theme?.toUpperCase?.();
        const gods = GODS_BY_THEME[themeKey] || [];

        return (
          <article
            key={legion.id}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface/60 backdrop-blur-sm shadow-lg shadow-black/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-sky-500/5 to-amber-500/5 pointer-events-none" />

            <div className="relative p-5 flex flex-col gap-4">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-wide">
                    {legion.name}
                  </h3>
                  <p className="text-xs uppercase tracking-[0.25em] text-accent/80 mt-1">
                    {legion.theme} LEGION
                  </p>
                  {legion.tagline && (
                    <p className="mt-2 text-sm text-muted">
                      {legion.tagline}
                    </p>
                  )}
                </div>
                <span
                  className={
                    "px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] " +
                    (STATUS_BADGE[legion.status] ||
                      "bg-slate-500/20 text-slate-200 border border-slate-500/40")
                  }
                >
                  {legion.status || "tbd"}
                </span>
              </header>

              <div className="h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />

              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
                  THE GODS
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {gods.map((god) => (
                    <li
                      key={god}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="font-medium">{god}</span>
                      <span className="text-[11px] text-muted uppercase tracking-[0.2em]">
                        24 Teams · Light / Dark
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
                  LIGHT & DARK LEAGUES
                </p>
                <p className="mt-2 text-xs text-muted">
                  This is where we&apos;ll surface the Light / Dark league
                  links for each God once drafts are locked in. For now, follow
                  your Sleeper links from the lobby or ask your Legion
                  Commissioner.
                </p>
              </section>
            </div>
          </article>
        );
      })}
    </div>
  );
}
