// components/about/ManagersSection.jsx
"use client";
import { safeArray } from "@/lib/safe";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { r2Url } from "@/lib/r2Url";
import { adminR2UrlForKey } from "@/lib/r2Client";


function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase() || "GM";
}

function normalizeManager(m, idx) {
  const o = m && typeof m === "object" ? m : {};
  const bullets = safeArray(o.bullets)
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  return {
    id: String(o.id || idx),
    order: Number.isFinite(Number(o.order)) ? Number(o.order) : idx + 1,
    name: String(o.name || "").trim(),
    role: String(o.role || "").trim(),
    bullets,
    bio: String(o.bio || "").trim(),
    imageKey: String(o.imageKey || "").trim(),
    imageUrl: String(o.imageUrl || o.image_url || "").trim(),
    twitter: String(o.twitter || "").trim(),
    discord: String(o.discord || "").trim(),
    sleeper: String(o.sleeper || "").trim(),
  };
}

function Modal({ open, onClose, children, titleId }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl rounded-3xl border border-subtle bg-card-surface shadow-xl overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
          <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
          <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
        </div>

        <div className="relative p-5 sm:p-7">{children}</div>
      </div>
    </div>
  );
}

export default function ManagersSection({ season, version = "0", manifest = null }) {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeId, setActiveId] = useState("");

  const active = useMemo(
    () => managers.find((m) => m.id === activeId) || null,
    [managers, activeId]
  );

  useEffect(() => {
    let cancelled = false;

    if (!manifest) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    async function run() {
      setErr("");
      setLoading(true);

      const v = String(version || "0");
      const cacheKeyV = `about-managers:${season}:version`;
      const cacheKeyData = `about-managers:${season}:data`;

      try {
        const cachedV = sessionStorage.getItem(cacheKeyV);
        if (cachedV && cachedV === v) {
          const cached = sessionStorage.getItem(cacheKeyData);
          if (cached) {
            const parsed = JSON.parse(cached);
            const list = safeArray(parsed?.managers || parsed?.rows || parsed);
            const normalized = list.map(normalizeManager).sort((a, b) => a.order - b.order);
            if (!cancelled) {
              setManagers(normalized);
              setLoading(false);
              return;
            }
          }
        }
      } catch {
        // ignore
      }

      try {
        const url = r2Url(`/r2/content/about/managers_${season}.json?v=${encodeURIComponent(v)}`);
        const res = await fetch(url, { cache: "default" });
        if (res.status === 404) {
          if (!cancelled) setManagers([]);
          return;
        }
        if (!res.ok) throw new Error(`Failed to load managers (${res.status})`);
        const data = await res.json();
        const list = safeArray(data?.managers || data?.rows || data);
        const normalized = list.map(normalizeManager).sort((a, b) => a.order - b.order);

        if (cancelled) return;
        setManagers(normalized);

        try {
          sessionStorage.setItem(cacheKeyV, v);
          sessionStorage.setItem(cacheKeyData, JSON.stringify(data));
        } catch {
          // ignore
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load managers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [manifest, season, version]);

  const cards = managers;

  return (
    <section className="rounded-3xl border border-subtle bg-card-surface shadow-md p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 max-w-2xl">
          <span className="badge">Meet our managers</span>
          <h2 className="h3 text-primary">Game Managers</h2>
          <p className="text-sm text-muted">
            Each manager oversees a group of leagues, helps resolve issues, and keeps the game running smooth.
          </p>
        </div>

        <div className="text-xs text-muted">
          <span className="rounded-full border border-subtle bg-card-trans px-3 py-1 backdrop-blur-sm">
            Season {season}
          </span>
        </div>
      </div>

      {err ? (
        <p className="mt-4 text-sm text-[color:var(--color-warning)]">{err}</p>
      ) : null}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-5 animate-pulse"
            >
              <div className="h-40 w-full rounded-xl bg-black/20" />
              <div className="mt-4 h-4 w-2/3 rounded bg-black/20" />
              <div className="mt-2 h-3 w-1/2 rounded bg-black/20" />
              <div className="mt-4 h-3 w-full rounded bg-black/20" />
              <div className="mt-2 h-3 w-11/12 rounded bg-black/20" />
            </div>
          ))}
        </div>
      ) : cards.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((m) => {
            const src = m.imageKey
              ? `${adminR2UrlForKey(m.imageKey)}?v=${encodeURIComponent(version)}`
              : m.imageUrl || "";
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveId(m.id)}
                className="text-left group rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm shadow-sm p-5 transition hover:border-accent hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/60"
              >
                <div className="relative w-full overflow-hidden rounded-xl border border-subtle bg-black/20" style={{ aspectRatio: "16/10" }}>
                  {src ? (
                    <Image
                      src={src}
                      alt={m.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="h-16 w-16 rounded-full border border-subtle bg-card-surface grid place-items-center text-lg font-semibold text-primary">
                        {initials(m.name)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <div>
                    <h3 className="text-base font-semibold text-fg">{m.name || "Manager"}</h3>
                    {m.role ? <p className="text-xs text-muted mt-0.5">{m.role}</p> : null}
                  </div>

                  {m.bullets?.length ? (
                    <ul className="text-sm text-fg/90 space-y-1">
                      {m.bullets.slice(0, 3).map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-[0.25rem] h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent)]/80" />
                          <span className="line-clamp-2">{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">Click to view details</p>
                  )}

                  <div className="pt-2">
                    <span className="text-xs text-accent underline underline-offset-4 decoration-accent/60 group-hover:decoration-accent">
                      View profile
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-5 text-sm text-muted">
          Managers will be listed here once published.
        </div>
      )}

      <Modal
        open={!!active}
        onClose={() => setActiveId("")}
        titleId="manager-modal-title"
      >
        {active ? (
          <div className="grid gap-6 md:grid-cols-[220px,1fr]">
            <div>
              <div className="relative overflow-hidden rounded-2xl border border-subtle bg-black/20" style={{ aspectRatio: "1/1" }}>
                {active.imageKey || active.imageUrl ? (
                  <Image
                    src={active.imageKey ? `${adminR2UrlForKey(active.imageKey)}?v=${encodeURIComponent(version)}` : r2Url(active.imageUrl)}
                    alt={active.name}
                    fill
                    sizes="220px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="h-20 w-20 rounded-full border border-subtle bg-card-surface grid place-items-center text-xl font-semibold text-primary">
                      {initials(active.name)}
                    </div>
                  </div>
                )}
              </div>

              {(active.twitter || active.discord || active.sleeper) ? (
                <div className="mt-4 space-y-2">
                  {active.sleeper ? (
                    <p className="text-xs text-muted">
                      <span className="font-semibold text-fg">Sleeper:</span> {active.sleeper}
                    </p>
                  ) : null}
                  {active.discord ? (
                    <p className="text-xs text-muted">
                      <span className="font-semibold text-fg">Discord:</span> {active.discord}
                    </p>
                  ) : null}
                  {active.twitter ? (
                    <p className="text-xs text-muted">
                      <span className="font-semibold text-fg">X:</span> {active.twitter}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="manager-modal-title" className="text-xl font-semibold text-fg">
                    {active.name || "Manager"}
                  </h3>
                  {active.role ? <p className="text-sm text-muted mt-1">{active.role}</p> : null}
                </div>
                <button className="btn btn-outline text-xs" onClick={() => setActiveId("")}>
                  Close
                </button>
              </div>

              {active.bullets?.length ? (
                <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4">
                  <h4 className="text-sm font-semibold text-primary">What they handle</h4>
                  <ul className="mt-3 text-sm text-fg/90 space-y-2">
                    {active.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-[color:var(--color-accent)]/80" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {active.bio ? (
                <div className="rounded-2xl border border-subtle bg-card-trans backdrop-blur-sm p-4">
                  <h4 className="text-sm font-semibold text-primary">About</h4>
                  <p className="mt-3 text-sm text-fg whitespace-pre-wrap">{active.bio}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}