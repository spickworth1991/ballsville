// src/lib/GauntletLegionsClient.jsx
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

const GODS_BY_THEME = {
  EGYPTIANS: ["AMUN-RAH", "OSIRIS", "Horus", "Anubis"],
  GREEKS: ["ZEUS", "ARES", "Apollo", "Poseidon"],
  ROMANS: ["SATURN", "MARS", "Minerva", "Saturn"],
};

// Map DB statuses -> your global badge classes
const STATUS_CLASS = {
  filling: "badge-status badge-status-private", // amber-ish
  full: "badge-status badge-status-full",       // green
  tbd: "badge-status badge-status-default",     // slate
  drafting: "badge-status badge-status-default",// keep neutral unless you add a "drafting" theme var
};

export default function GauntletLegionsClient() {
  const [legions, setLegions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      const supabase = getSupabase();
      if (!supabase) {
        if (alive) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("gauntlet_legions")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!alive) return;

      if (!error && data) setLegions(data);
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <div className="mt-6 text-sm text-muted">Loading Legions…</div>;
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

        const statusKey = (legion.status || "tbd").toLowerCase();
        const badgeClass =
          STATUS_CLASS[statusKey] || "badge-status badge-status-default";

        return (
          <article
            key={legion.id}
            className="relative overflow-hidden rounded-2xl border border-subtle bg-card-surface shadow-md"
          >
            {/* subtle glow (uses your theme colors so it matches light/dark) */}
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at top left, color-mix(in oklab, var(--color-accent) 18%, transparent), transparent 55%)," +
                  "radial-gradient(circle at bottom right, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 55%)",
              }}
            />

            <div className="relative p-5 flex flex-col gap-4">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-wide text-fg">
                    {legion.name}
                  </h3>
                  <p className="text-xs uppercase tracking-[0.25em] text-accent/80 mt-1">
                    {legion.theme} LEGION
                  </p>
                  {legion.tagline && (
                    <p className="mt-2 text-sm text-muted">{legion.tagline}</p>
                  )}
                </div>

                <span className={badgeClass}>{statusKey}</span>
              </header>

              <div className="divider-subtle" />

              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">
                  THE GODS
                </p>

                <ul className="mt-3 space-y-2 text-sm">
                  {gods.map((god) => (
                    <li
                      key={god}
                      className="bg-subtle-surface border border-subtle rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-fg">{god}</span>
                      <span className="text-[11px] text-muted uppercase tracking-[0.2em]">
                        24 Teams · Light / Dark
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

            
            </div>
          </article>
        );
      })}
    </div>
  );
}
