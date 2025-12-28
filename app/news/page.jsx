"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

const cardCls =
  "card bg-card-surface border border-subtle rounded-2xl shadow-md overflow-hidden transition hover:border-accent hover:-translate-y-0.5";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
function isVideoUrl(u) {
  const url = safeStr(u).toLowerCase();
  return url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg");
}
function normalizeTags(v) {
  const tags = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(",").map((s) => s.trim()) : [];
  const out = [];
  const seen = new Set();
  for (const t of tags) {
    const k = String(t || "").trim();
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

function normalizePost(p, idx) {
  const o = p && typeof p === "object" ? p : {};

  let html = safeStr(o.html || o.body_html || o.bodyHtml || "").trim();
  let body = safeStr(o.body || o.content || "").trim();

  if (!html && body && body.includes("<") && body.includes(">")) {
    html = body;
    body = "";
  }

  const imageKey = safeStr(o.imageKey || o.image_key || "").trim();
  const imageUrl = safeStr(o.image_url || o.imageUrl || "").trim();
  const mediaSrc = imageKey ? `/r2/${imageKey}` : imageUrl;

  const pinned = Boolean(o.pinned ?? o.pin);
  const is_coupon = Boolean(o.is_coupon);
  const expires_at = safeStr(o.expires_at || o.expiresAt || "").trim();

  // tags[] are your real filterable categories
  let tags = normalizeTags(o.tags);

  // Mini Game tag should appear if is_coupon is set, even if tags[] missing it
  const hasMini = tags.some((t) => t.toLowerCase() === "mini game");
  if (is_coupon && !hasMini) tags = ["Mini Game", ...tags];

  return {
    id: o.id || o.slug || String(idx),
    title: safeStr(o.title || o.name || "").trim(),
    body,
    html,
    date: safeStr(o.created_at || o.date || o.createdAt || "").trim(),
    link: safeStr(o.link || o.url || "").trim(),
    tags,
    pinned,
    is_coupon,
    expires_at,
    mediaSrc: safeStr(mediaSrc).trim(),
  };
}

function MediaBlock({ src, updatedAt }) {
  const s = safeStr(src).trim();
  if (!s) return null;

  const finalSrc =
    s.startsWith("/r2/") && updatedAt
      ? (s.includes("?") ? s : `${s}?v=${encodeURIComponent(updatedAt)}`)
      : s;

  if (isVideoUrl(finalSrc)) {
    return (
      <div className="relative w-full aspect-[16/9] bg-black/30">
        <video className="absolute inset-0 w-full h-full object-contain" controls playsInline preload="metadata">
          <source src={finalSrc} />
        </video>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[16/9] bg-black/20">
      <img src={finalSrc} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/10" />
    </div>
  );
}

function TagPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] uppercase tracking-[0.2em] px-3 py-1 rounded-full border transition ${
        active
          ? "border-accent/60 bg-accent/10 text-accent"
          : "border-subtle bg-panel text-muted hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );
}

function NewsInner({ version = "0", manifest = null }) {
  const [posts, setPosts] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [activeTag, setActiveTag] = useState("ALL");
  const [miniOnly, setMiniOnly] = useState(false);

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
      const cacheKeyV = "posts:version";
      const cacheKeyData = "posts:data";
      const cacheKeyUpdated = "posts:updatedAt";

      try {
        const cachedV = sessionStorage.getItem(cacheKeyV);
        if (cachedV && cachedV === v) {
          const cached = sessionStorage.getItem(cacheKeyData);
          const cachedUpdated = sessionStorage.getItem(cacheKeyUpdated);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (!cancelled && parsed) {
              const list = safeArray(parsed?.posts || parsed?.rows || parsed);
              const stamp = String(cachedUpdated || parsed?.updatedAt || "");
              const normalized = list.map(normalizePost);

              normalized.sort((a, b) => {
                if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
                return safeStr(b.date).localeCompare(safeStr(a.date));
              });

              setPosts(normalized);
              setUpdatedAt(stamp);
              setLoading(false);
              return;
            }
          }
        }
      } catch {
        // ignore
      }

      try {
        const res = await fetch(`/r2/data/posts/posts.json?v=${encodeURIComponent(v)}`, { cache: "default" });
        if (!res.ok) {
          if (!cancelled) setPosts([]);
          return;
        }
        const data = await res.json();
        const list = safeArray(data?.posts || data?.rows || data);
        const stamp = String(data?.updatedAt || data?.updated_at || "");

        if (cancelled) return;

        const normalized = list.map(normalizePost);
        normalized.sort((a, b) => {
          if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
          return safeStr(b.date).localeCompare(safeStr(a.date));
        });

        setPosts(normalized);
        setUpdatedAt(stamp);

        try {
          sessionStorage.setItem(cacheKeyV, v);
          sessionStorage.setItem(cacheKeyUpdated, stamp);
          sessionStorage.setItem(cacheKeyData, JSON.stringify(data));
        } catch {
          // ignore
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load posts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [version, manifest]);

  const tagOptions = useMemo(() => {
    const set = new Map(); // lower -> display
    for (const p of posts) {
      for (const t of p.tags || []) {
        const key = String(t).toLowerCase();
        if (!key) continue;
        if (!set.has(key)) set.set(key, String(t));
      }
    }
    return ["ALL", ...Array.from(set.values()).sort((a, b) => a.localeCompare(b))];
  }, [posts]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return posts.filter((p) => {
      // hide expired mini games on public page
      if (p.is_coupon && p.expires_at) {
        const t = new Date(p.expires_at).getTime();
        if (!Number.isNaN(t) && t < now) return false;
      }
      if (miniOnly && !p.is_coupon) return false;
      if (activeTag === "ALL") return true;
      const want = activeTag.toLowerCase();
      return (p.tags || []).some((t) => String(t).toLowerCase() === want);
    });
  }, [posts, miniOnly, activeTag]);

  const pinned = filtered.filter((p) => p.pinned);
  const regular = filtered.filter((p) => !p.pinned);

  const title = "News & Posts";

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <header className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">BALLSVILLE</p>
          <h1 className="text-3xl sm:text-4xl font-semibold">{title}</h1>
          <p className="text-sm text-muted">Announcements, updates, and important posts from the admin team.</p>
          {updatedAt ? <p className="text-[11px] text-muted">Updated: {fmtDate(updatedAt)}</p> : null}
        </header>

        {/* Premium filter bar */}
        <div className="rounded-2xl border border-subtle bg-card-surface/60 backdrop-blur px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {tagOptions.map((t) => (
              <TagPill key={t} active={activeTag === t} onClick={() => setActiveTag(t)}>
                {t}
              </TagPill>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 text-xs text-muted">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={miniOnly} onChange={(e) => setMiniOnly(e.target.checked)} />
              <span>Mini Games only</span>
            </label>

            <span className="text-muted/50">•</span>

            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => {
                setActiveTag("ALL");
                setMiniOnly(false);
              }}
            >
              Clear filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted">Loading…</div>
        ) : err ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100 text-center">
            {err}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-center text-sm text-muted">
            No posts match your filter.
          </div>
        ) : (
          <div className="space-y-8">
            {pinned.length ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Pinned</h2>
                  <span className="text-[11px] text-muted">{pinned.length}</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {pinned.map((p) => (
                    <article key={p.id} className={cardCls}>
                      {p.mediaSrc ? <MediaBlock src={p.mediaSrc} updatedAt={updatedAt} /> : null}
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground leading-snug">{p.title || "Post"}</h3>
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                            PINNED
                          </span>
                        </div>
                        {p.date ? <p className="mt-1 text-[11px] text-muted">{fmtDate(p.date)}</p> : null}

                        {p.html ? (
                          <div className="mt-3 prose prose-invert max-w-none text-xs text-muted" dangerouslySetInnerHTML={{ __html: p.html }} />
                        ) : p.body ? (
                          <p className="mt-3 text-xs text-muted line-clamp-6 whitespace-pre-line">{p.body}</p>
                        ) : null}

                        <div className="mt-4 flex items-center justify-between">
                          {p.link ? (
                            <Link href={p.link} target="_blank" rel="noreferrer" className="inline-flex text-xs text-accent hover:underline">
                              Read more →
                            </Link>
                          ) : (
                            <span />
                          )}
                          {p.is_coupon ? (
                            <span className="text-[10px] px-2 py-1 rounded-full border border-subtle text-muted bg-panel">
                              MINI GAME
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{pinned.length ? "Latest" : "Posts"}</h2>
                <span className="text-[11px] text-muted">{regular.length}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {regular.map((p) => (
                  <article key={p.id} className={cardCls}>
                    {p.mediaSrc ? <MediaBlock src={p.mediaSrc} updatedAt={updatedAt} /> : null}

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground leading-snug">{p.title || "Post"}</h3>
                        {p.is_coupon ? (
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-subtle bg-panel text-muted">
                            MINI GAME
                          </span>
                        ) : null}
                      </div>

                      {p.date ? <p className="mt-1 text-[11px] text-muted">{fmtDate(p.date)}</p> : null}

                      {p.html ? (
                        <div className="mt-3 prose prose-invert max-w-none text-xs text-muted" dangerouslySetInnerHTML={{ __html: p.html }} />
                      ) : p.body ? (
                        <p className="mt-3 text-xs text-muted line-clamp-6 whitespace-pre-line">{p.body}</p>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between">
                        {p.link ? (
                          <Link href={p.link} target="_blank" rel="noreferrer" className="inline-flex text-xs text-accent hover:underline">
                            Read more →
                          </Link>
                        ) : (
                          <span />
                        )}

                        {p.tags?.length ? (
                          <div className="text-[10px] text-muted truncate max-w-[60%]">
                            {p.tags.slice(0, 2).join(" · ")}
                            {p.tags.length > 2 ? " · …" : ""}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default function NewsPage() {
  return (
    <SectionManifestGate section="posts" season={CURRENT_SEASON}>
      <NewsInner />
    </SectionManifestGate>
  );
}
