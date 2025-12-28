"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

const cardBase =
  "card bg-card-surface border border-subtle rounded-2xl shadow-md overflow-hidden transition";

const cardHover = "hover:border-accent hover:-translate-y-0.5";

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

  let tags = normalizeTags(o.tags);

  // Ensure "Mini Game" appears as a tag for filtering + display, but still keep is_coupon as the true flag.
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

// Corner ribbon that overlaps the card edges at an angle
function CornerRibbon({ label, variant = "mini" }) {
  // variant: "mini" | "expired" | "pinned"
  const base =
    "absolute -top-2 -right-10 rotate-45 px-12 py-1 text-[10px] uppercase tracking-[0.25em] font-semibold shadow-md border";

  const cls =
    variant === "expired"
      ? `${base} bg-rose-500/20 text-rose-100 border-rose-300/30`
      : variant === "pinned"
      ? `${base} bg-primary/15 text-primary border-primary/30`
      : `${base} bg-accent/15 text-accent border-accent/30`;

  return (
    <div className="pointer-events-none absolute top-0 right-0 z-20">
      <div className={cls}>{label}</div>
    </div>
  );
}

function msToCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const totalHr = Math.floor(totalMin / 60);
  const h = totalHr % 24;
  const d = Math.floor(totalHr / 24);

  const pad = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function useNowTick(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function MiniGameTimer({ expiresAt }) {
  const exp = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const now = useNowTick(Boolean(expiresAt));
  if (!expiresAt || Number.isNaN(exp)) return null;

  const remaining = exp - now;
  const closed = remaining <= 0;

  return (
    <div className="mt-3 rounded-xl border border-subtle bg-panel/60 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          {closed ? "Closed" : "Closes in"}
        </div>
        <div className={`text-xs font-semibold ${closed ? "text-rose-100" : "text-foreground"}`}>
          {closed ? "00:00:00" : msToCountdown(remaining)}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-muted">Closes: {fmtDate(expiresAt)}</div>
    </div>
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

  // NOTE: we no longer hide expired mini games globally — we show them greyed out + unclickable.
  const filtered = useMemo(() => {
    if (miniOnly && activeTag === "ALL") return posts.filter((p) => p.is_coupon);

    return posts.filter((p) => {
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
        {/* Header bubble (readable) */}
        <header className="rounded-2xl border border-subtle bg-card-surface/70 backdrop-blur p-6 text-center space-y-2 shadow-sm">
          <p className="inline-flex mx-auto text-xs uppercase tracking-[0.35em] text-accent rounded-full border border-subtle bg-panel/60 px-3 py-1">
            BALLSVILLE
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold">{title}</h1>
          <p className="text-sm text-muted">
            Announcements, updates, and important posts from the admin team.
          </p>
          {updatedAt ? (
            <p className="inline-flex mx-auto text-[11px] text-muted rounded-full border border-subtle bg-panel/60 px-3 py-1">
              Updated: {fmtDate(updatedAt)}
            </p>
          ) : null}
        </header>

        {/* Premium filter bar (bubble) */}
        <div className="rounded-2xl border border-subtle bg-card-surface/60 backdrop-blur px-4 py-3 flex flex-col gap-3 shadow-sm">
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
                  <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground rounded-full border border-subtle bg-panel/60 px-3 py-1">
                    Pinned
                  </h2>
                  <span className="text-[11px] text-muted">{pinned.length}</span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
                  {pinned.map((p) => (
                    <PostCard key={p.id} p={p} updatedAt={updatedAt} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground rounded-full border border-subtle bg-panel/60 px-3 py-1">
                  {pinned.length ? "Latest" : "Posts"}
                </h2>
                <span className="text-[11px] text-muted">{regular.length}</span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
                {regular.map((p) => (
                  <PostCard key={p.id} p={p} updatedAt={updatedAt} />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function PostCard({ p, updatedAt }) {
  const now = Date.now();
  const expMs = p.expires_at ? new Date(p.expires_at).getTime() : NaN;
  const isExpiredMini = Boolean(p.is_coupon && p.expires_at && !Number.isNaN(expMs) && expMs < now);

  const disabled = isExpiredMini;

  // If expired, kill hover lift + add grayscale/opacity + prevent clicking
  const cardCls = `${cardBase} ${disabled ? "opacity-60 grayscale cursor-not-allowed" : cardHover}`;

  const Wrapper = ({ children }) => {
    if (disabled) return <article className={cardCls}>{children}</article>;
    return <article className={cardCls}>{children}</article>;
  };

  return (
    <Wrapper>
      <div className="relative">
        {/* Ribbons */}
        {p.is_coupon ? <CornerRibbon label="Mini Game" variant="mini" /> : null}
        {isExpiredMini ? <CornerRibbon label="Expired" variant="expired" /> : null}
        {p.pinned ? <CornerRibbon label="Pinned" variant="pinned" /> : null}

        {/* Media */}
        {p.mediaSrc ? <MediaBlock src={p.mediaSrc} updatedAt={updatedAt} /> : null}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground leading-snug">{p.title || "Post"}</h3>
        </div>

        {p.date ? (
          <div className="mt-2">
            <span className="inline-flex text-[11px] text-muted rounded-full border border-subtle bg-panel/60 px-3 py-1">
              {fmtDate(p.date)}
            </span>
          </div>
        ) : null}

        {p.is_coupon ? <MiniGameTimer expiresAt={p.expires_at} /> : null}

        {p.html ? (
          <div className="mt-3 prose prose-invert max-w-none text-xs text-muted" dangerouslySetInnerHTML={{ __html: p.html }} />
        ) : p.body ? (
          <p className="mt-3 text-xs text-muted line-clamp-6 whitespace-pre-line">{p.body}</p>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          {p.link ? (
            disabled ? (
              <span className="inline-flex text-xs text-muted">Closed</span>
            ) : (
              <Link href={p.link} target="_blank" rel="noreferrer" className="inline-flex text-xs text-accent hover:underline">
                Read more →
              </Link>
            )
          ) : (
            <span />
          )}

          {p.tags?.length ? (
            <div className="text-[10px] text-muted truncate max-w-[60%]">
              {p.tags.slice(0, 2).join(" · ")}{p.tags.length > 2 ? " · …" : ""}
            </div>
          ) : null}
        </div>
      </div>

      {/* Click blocker overlay (so links/video controls still work only if NOT disabled) */}
      {disabled ? (
        <div
          className="absolute inset-0 z-10"
          aria-hidden="true"
          title="This Mini Game is expired"
        />
      ) : null}
    </Wrapper>
  );
}

export default function NewsPage() {
  return (
    <SectionManifestGate section="posts" season={CURRENT_SEASON}>
      <NewsInner />
    </SectionManifestGate>
  );
}
