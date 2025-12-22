// app/redraft/RedraftLeaguesClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CURRENT_SEASON } from "@/lib/season";

const SEASON = CURRENT_SEASON;

const STATUS_LABEL = {
  full: "FULL",
  filling: "FILLING",
  drafting: "DRAFTING",
  tbd: "TBD",
};

const STATUS_BADGE = {
  full: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  filling: "bg-amber-500/15 text-amber-200 border-amber-400/20",
  drafting: "bg-sky-500/15 text-sky-200 border-sky-400/20",
  tbd: "bg-zinc-500/15 text-zinc-200 border-zinc-400/20",
};

function normLeague(l, idx) {
  return {
    name: String(l?.name || `League ${idx + 1}`),
    url: String(l?.url || ""),
    status: ["full", "filling", "drafting", "tbd"].includes(l?.status) ? l.status : "tbd",
    active: l?.active !== false,
    order: Number.isFinite(Number(l?.order)) ? Number(l.order) : idx + 1,
    imageKey: String(l?.imageKey || ""),
    imageUrl: String(l?.imageUrl || ""),
  };
}

export default function RedraftLeaguesClient() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const bust = useMemo(() => `v=${Date.now()}`, []);

  async function loadLeagues() {
    setErr("");
    setLoading(true);
    try {
      const leaguesRes = await fetch(`/r2/data/redraft/leagues_${SEASON}.json?${bust}`, { cache: "no-store" });
      if (leaguesRes.ok) {
        const data = await leaguesRes.json();
        const list = Array.isArray(data?.leagues) ? data.leagues : Array.isArray(data) ? data : [];
        const normalized = list.map(normLeague).filter((x) => x.active !== false);
        normalized.sort((a, b) => a.order - b.order);
        setLeagues(normalized);
      } else {
        setLeagues([]);
      }
    } catch (e) {
      setErr(e?.message || "Failed to load Redraft leagues.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeagues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8">
        <p className="text-muted">Loading redraft leagues…</p>
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
    <section className="rounded-3xl border border-subtle bg-card-surface p-6 md:p-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="h3">Redraft Leagues</h2>
          <p className="text-sm text-muted mt-1">Live list maintained by admins (no divisions).</p>
        </div>
        <div className="text-xs text-muted">{leagues.length} leagues</div>
      </div>

      {leagues.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-subtle bg-subtle-surface p-5">
          <p className="text-sm text-muted">No leagues published yet.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {leagues.map((l) => {
            const badgeCls = STATUS_BADGE[l.status] || STATUS_BADGE.tbd;
            const label = STATUS_LABEL[l.status] || "TBD";
            const imgSrc = l.imageKey ? `/r2/${l.imageKey}` : l.imageUrl || "";

            return (
              <a
                key={`${l.order}-${l.name}`}
                href={l.url || "#"}
                target={l.url ? "_blank" : undefined}
                rel={l.url ? "noreferrer" : undefined}
                className="group rounded-2xl border border-subtle bg-subtle-surface p-5 hover:border-accent/60 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{l.name}</p>
                    <p className="text-xs text-muted mt-1">League #{l.order}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeCls}`}>
                    {label}
                  </span>
                </div>

                {imgSrc ? (
                  <div className="mt-4 relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-subtle bg-black/20">
                    <Image src={imgSrc} alt="League image" fill sizes="(max-width: 640px) 100vw, 420px" className="object-cover" />
                  </div>
                ) : null}

                <div className="mt-4 text-xs text-muted flex items-center justify-between">
                  <span className="truncate">{l.url ? "Open in Sleeper" : "Link not set"}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition">→</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
