
// app/redraft/RedraftLeaguesClient.jsx
"use client";
import { r2Url } from "@/lib/r2Url";
import { safeStr } from "@/lib/safe";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CURRENT_SEASON } from "@/lib/season";

const SEASON = CURRENT_SEASON;

const STATUS_LABEL = {
  predraft: "PRE-DRAFT",
  drafting: "DRAFTING",
  inseason: "IN-SEASON",
  complete: "COMPLETE",
  tbd: "TBD",
};


function normalizeStatus(raw) {
  const s = safeStr(raw).trim().toLowerCase();
  if (s === "pre_draft" || s === "pre-draft" || s === "predraft") return "predraft";
  if (s === "drafting") return "drafting";
  if (s === "in_season" || s === "in-season" || s === "inseason") return "inseason";
  if (s === "complete") return "complete";
  // legacy mapping (older redraft JSON)
  if (s === "filling") return "predraft";
  if (s === "full") return "complete";
  return s || "tbd";
}

function statusBadge(raw) {
  const s = normalizeStatus(raw);
  if (s === "drafting") return STATUS_LABEL.drafting;
  if (s === "predraft") return STATUS_LABEL.predraft;
  if (s === "inseason") return STATUS_LABEL.inseason;
  if (s === "complete") return STATUS_LABEL.complete;
  return STATUS_LABEL.tbd;
}

function leagueImageSrc(l, updatedAt) {
  const key = safeStr(l?.imageKey || l?.image_key || "").trim();
  const url = safeStr(l?.image_url || l?.imageUrl || "").trim();
  const base = key ? r2Url(key) : url;
  if (!base) return "";
  if (!updatedAt) return base;
  return base.includes("?") ? base : `${base}?v=${encodeURIComponent(updatedAt)}`;
}

export default function RedraftLeaguesClient({
  // Prefer `season` (lowercase) because that's what callers pass.
  // Keep backwards-compat by tolerating the older `SEASON` prop too.
  season,
  SEASON,
  embedded = false,
  version = "0",
  manifest = null,
  title,
  subtitle,
}) {
  const seasonValue = season ?? SEASON ?? CURRENT_SEASON;
  const [leagues, setLeagues] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Manifest-first: avoid fetching the heavy JSON with v=0 before the manifest resolves.
    if (manifest === null) return () => {};

    async function run() {
      try {
        setError("");
        setLoading(true);

        const v = String(version || "0");
        const cacheKeyV = `redraft:leagues:${seasonValue}:version`;
        const cacheKeyData = `redraft:leagues:${seasonValue}:data`;
        const cacheKeyUpdated = `redraft:leagues:${seasonValue}:updatedAt`;

        try {
          const cachedV = sessionStorage.getItem(cacheKeyV);
          if (cachedV && cachedV === v) {
            const cachedData = sessionStorage.getItem(cacheKeyData);
            const cachedUpdated = sessionStorage.getItem(cacheKeyUpdated);
            if (cachedData) {
              const parsed = JSON.parse(cachedData);
              if (!cancelled && Array.isArray(parsed)) {
                setLeagues(parsed);
                setUpdatedAt(String(cachedUpdated || ""));
                setLoading(false);
                return;
              }
            }
          }
        } catch {
          // ignore storage errors
        }

        const leaguesKey = `data/redraft/leagues_${seasonValue}.json`;
        const leaguesRes = await fetch(`${r2Url(leaguesKey)}?v=${encodeURIComponent(v)}`, { cache: "default" });
        if (!leaguesRes.ok) throw new Error(`Failed to load Redraft leagues (${leaguesRes.status})`);

        const json = await leaguesRes.json();
        // Admin API stores this as { season, leagues: [...] }.
        const rows =
          Array.isArray(json?.leagues) ? json.leagues :
          Array.isArray(json?.rows) ? json.rows :
          Array.isArray(json) ? json :
          [];
        const stamp = safeStr(json?.updatedAt || json?.updated_at || "");

        if (cancelled) return;
        setLeagues(rows);
        setUpdatedAt(stamp);

        try {
          sessionStorage.setItem(cacheKeyV, v);
          sessionStorage.setItem(cacheKeyUpdated, stamp);
          sessionStorage.setItem(cacheKeyData, JSON.stringify(rows));
        } catch {
          // ignore storage errors
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load leagues.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [version, manifest, seasonValue]);

  const sorted = useMemo(() => {
    return [...leagues].sort((a, b) => {
      const ao = Number(a?.display_order ?? a?.order ?? 9999);
      const bo = Number(b?.display_order ?? b?.order ?? 9999);
      if (ao !== bo) return ao - bo;
      return safeStr(a?.name).localeCompare(safeStr(b?.name));
    });
  }, [leagues]);

  if (loading) return <p className="text-sm text-muted">Loading leagues…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;

  return (
    <section className={embedded ? "" : "mt-8"}>
      {(title || subtitle) && (
        <header className="mb-5">
          {title && (
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">{title}</h2>
          )}
          {subtitle && (
            <p className="mt-1 text-sm sm:text-base text-white/70 max-w-3xl">{subtitle}</p>
          )}
        </header>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((l, idx) => {
          const href = safeStr(l?.url || l?.sleeper_url || l?.sleeperUrl || "").trim();
          const effectiveStatus = l?.notReady ? "tbd" : l?.status;
          const badge = statusBadge(effectiveStatus);
          const isPreDraft = normalizeStatus(effectiveStatus) === "predraft";
          const isClickable = isPreDraft && Boolean(href);
          const img = leagueImageSrc(l, updatedAt);

          const CardTag = isClickable ? "a" : "div";
          const cardProps = isClickable
            ? { href, target: "_blank", rel: "noreferrer" }
            : {};

          return (
            <CardTag
              key={l?.id || `${l?.name}-${idx}`}
              {...cardProps}
              className={
                "group rounded-2xl border border-subtle bg-card-surface p-4 transition " +
                (isClickable
                  ? "hover:border-accent hover:-translate-y-0.5"
                  : "opacity-70 cursor-not-allowed")
              }
              aria-disabled={!isClickable}
            >
              <div className="flex items-start gap-4">
                {img ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-subtle bg-panel">
                    <Image src={img} alt={safeStr(l?.name || "League")} fill className="object-cover" />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate">{safeStr(l?.name || "League")}</h3>
                    <span className="rounded-full border border-subtle bg-panel px-2 py-0.5 text-[11px] text-muted">
                      {badge}
                    </span>
                  </div>

                  {safeStr(l?.note).trim() ? (
                    <p className="mt-1 text-xs text-muted line-clamp-2">{safeStr(l.note)}</p>
                  ) : null}

                  <div className="mt-4 text-xs text-muted flex items-center justify-between">
                    <span className="truncate">
                      {isClickable
                        ? "Open in Sleeper"
                        : isPreDraft
                        ? "Link not set"
                        : "Not currently pre-draft"}
                    </span>
                    {isClickable ? <span className="opacity-0 group-hover:opacity-100 transition">→</span> : null}
                  </div>
                </div>
              </div>
            </CardTag>
          );
        })}
      </div>
    </section>
  );
}