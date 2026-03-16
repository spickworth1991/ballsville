"use client";

import { useEffect, useMemo, useState } from "react";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { r2Url } from "@/lib/r2Url";
import { CURRENT_SEASON } from "@/lib/season";
import { safeArray, safeStr } from "@/lib/safe";

const cardBase = "card rounded-2xl border border-subtle bg-card-surface shadow-md transition";
const cardHover = "hover:-translate-y-0.5 hover:border-accent";
const URL_RE = /https?:\/\/[^\s<]+/g;

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function isVideoUrl(url) {
  const raw = safeStr(url).toLowerCase();
  const clean = raw.split("#")[0].split("?")[0];
  return clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".ogg");
}

function normalizeTags(v) {
  const tags = Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(",").map((s) => s.trim()) : [];
  const out = [];
  const seen = new Set();
  for (const tag of tags) {
    const value = String(tag || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalizePost(post, idx) {
  const value = post && typeof post === "object" ? post : {};

  let html = safeStr(value.html || value.body_html || value.bodyHtml || "").trim();
  let body = safeStr(value.body || value.content || "").trim();

  if (!html && body && body.includes("<") && body.includes(">")) {
    html = body;
    body = "";
  }

  const imageKey = safeStr(value.imageKey || value.image_key || "").trim();
  const imageUrl = safeStr(value.image_url || value.imageUrl || "").trim();
  const mediaSrc = imageKey ? r2Url(imageKey) : imageUrl;
  const pinned = Boolean(value.pinned ?? value.pin);
  const is_coupon = Boolean(value.is_coupon);
  const expires_at = safeStr(value.expires_at || value.expiresAt || "").trim();
  const media_type = safeStr(value.media_type || value.mediaType || "").toLowerCase();
  const is_video = Boolean(value.is_video ?? value.isVideo);

  let tags = normalizeTags(value.tags);
  const hasMini = tags.some((tag) => tag.toLowerCase() === "mini game");
  if (is_coupon && !hasMini) tags = ["Mini Game", ...tags];

  return {
    id: value.id || value.slug || String(idx),
    title: safeStr(value.title || value.name || "").trim(),
    body,
    html,
    date: safeStr(value.created_at || value.date || value.createdAt || "").trim(),
    link: safeStr(value.link || value.url || "").trim(),
    tags,
    pinned,
    is_coupon,
    expires_at,
    mediaSrc: safeStr(mediaSrc).trim(),
    media_type,
    is_video,
  };
}

function MediaBlock({ src, updatedAt, forceVideo = false }) {
  const mediaSrc = safeStr(src).trim();
  if (!mediaSrc) return null;

  const finalSrc = updatedAt ? (mediaSrc.includes("?") ? mediaSrc : `${mediaSrc}?v=${encodeURIComponent(updatedAt)}`) : mediaSrc;
  const lower = finalSrc.toLowerCase();
  const clean = lower.split("#")[0].split("?")[0];
  const inferredType = clean.endsWith(".webm") ? "video/webm" : clean.endsWith(".ogg") ? "video/ogg" : "video/mp4";
  const shouldTryVideo = forceVideo || isVideoUrl(finalSrc);

  if (shouldTryVideo) {
    return (
      <div className="relative aspect-[16/9] w-full bg-black/30">
        <video className="absolute inset-0 h-full w-full object-contain" controls playsInline muted preload="metadata" crossOrigin="anonymous">
          <source src={finalSrc} type={inferredType} />
        </video>
      </div>
    );
  }

  return (
    <div className="relative aspect-[16/9] w-full bg-black/20">
      <img src={finalSrc} alt="" className="absolute inset-0 h-full w-full object-contain" loading="lazy" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/10" />
    </div>
  );
}

function TagPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] transition ${
        active ? "border-accent/60 bg-accent/10 text-accent" : "border-subtle bg-panel text-muted hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );
}

function CornerRibbon({ label, variant = "mini" }) {
  const base =
    "pointer-events-none absolute z-30 flex items-center justify-center px-12 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] shadow-md";
  const pos = variant === "expired" ? "top-5 -right-11 rotate-45" : variant === "mini" ? "top-10 -left-10 -rotate-45" : "top-5 -right-11 rotate-45";
  const cls =
    variant === "expired"
      ? `${base} ${pos} border border-rose-300/40 bg-rose-600 text-white`
      : variant === "pinned"
        ? `${base} ${pos} border text-white`
        : `${base} ${pos} border border-emerald-300/30 bg-emerald-500/80 text-white`;

  const style =
    variant === "pinned"
      ? {
          background: "linear-gradient(135deg, #46c6d1, #1d7d92)",
          borderColor: "rgba(255, 255, 255, 0.22)",
        }
      : undefined;

  return (
    <div className={cls} style={style}>
      {label}
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
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
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
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">{closed ? "Closed" : "Closes in"}</div>
        <div className={`text-xs font-semibold ${closed ? "text-rose-100" : "text-foreground"}`}>{closed ? "00:00:00" : msToCountdown(remaining)}</div>
      </div>
      <div className="mt-1 text-[11px] text-muted">Closes: {fmtDate(expiresAt)}</div>
    </div>
  );
}

function splitTrailingPunctuation(url) {
  let clean = url;
  let trailing = "";
  while (/[),.;!?]$/.test(clean)) {
    trailing = clean.slice(-1) + trailing;
    clean = clean.slice(0, -1);
  }
  return { clean, trailing };
}

function renderLinkifiedText(text, className) {
  const lines = safeStr(text).split(/\r?\n/);
  return (
    <div className={className}>
      {lines.map((line, lineIdx) => {
        const parts = [];
        let lastIndex = 0;
        let match;

        URL_RE.lastIndex = 0;
        while ((match = URL_RE.exec(line)) !== null) {
          const rawUrl = match[0];
          const start = match.index;
          const end = start + rawUrl.length;
          const { clean, trailing } = splitTrailingPunctuation(rawUrl);

          if (start > lastIndex) parts.push(line.slice(lastIndex, start));
          parts.push(
            <a key={`${lineIdx}-${start}`} href={clean} target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent/80">
              {clean}
            </a>
          );
          if (trailing) parts.push(trailing);
          lastIndex = end;
        }

        if (lastIndex < line.length) parts.push(line.slice(lastIndex));
        if (parts.length === 0) parts.push("\u00A0");

        return (
          <p key={`line-${lineIdx}`} className={lineIdx === 0 ? "" : "mt-3"}>
            {parts}
          </p>
        );
      })}
    </div>
  );
}

function PostModal({ post, updatedAt, onClose }) {
  useEffect(() => {
    if (!post) return undefined;

    const prevOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, post]);

  if (!post) return null;

  const now = Date.now();
  const expMs = post.expires_at ? new Date(post.expires_at).getTime() : NaN;
  const isExpiredMini = Boolean(post.is_coupon && post.expires_at && !Number.isNaN(expMs) && expMs < now);

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div className="mx-auto flex h-full max-w-3xl items-end sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[28px] border border-subtle bg-card-surface shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-subtle bg-card-surface/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.28em] text-accent">{post.is_coupon ? "Mini Game" : "Ballsville Post"}</div>
              <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">{post.title || "Post"}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                {post.date ? <span className="rounded-full border border-subtle bg-panel/60 px-3 py-1">{fmtDate(post.date)}</span> : null}
                {post.tags?.map((tag) => (
                  <span key={tag} className="rounded-full border border-subtle px-3 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button type="button" onClick={onClose} className="rounded-full border border-subtle px-3 py-2 text-xs uppercase tracking-[0.2em] text-muted transition hover:border-accent hover:text-accent">
              Close
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {post.mediaSrc ? (
              <div className="overflow-hidden rounded-2xl border border-subtle bg-black/20">
                <MediaBlock src={post.mediaSrc} updatedAt={updatedAt} forceVideo={post.is_video || post.media_type === "video"} />
              </div>
            ) : null}

            {post.is_coupon ? <MiniGameTimer expiresAt={post.expires_at} /> : null}

            {post.html ? (
              <div className="prose prose-invert mt-5 max-w-none text-sm text-muted" dangerouslySetInnerHTML={{ __html: post.html }} />
            ) : post.body ? (
              renderLinkifiedText(post.body, "mt-5 text-sm leading-7 text-muted")
            ) : (
              <div className="mt-5 text-sm text-muted">No body content.</div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {post.link ? (
                isExpiredMini ? (
                  <span className="inline-flex rounded-full border border-subtle px-4 py-2 text-sm text-muted">Closed</span>
                ) : (
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent/15"
                  >
                    Open link
                  </a>
                )
              ) : null}
              <button type="button" onClick={onClose} className="inline-flex items-center rounded-full border border-subtle px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-accent">
                Back to posts
              </button>
            </div>
          </div>
        </div>
      </div>
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
  const [activePostId, setActivePostId] = useState("");

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
        // ignore cache issues
      }

      try {
        const res = await fetch(r2Url(`data/posts/posts.json?v=${encodeURIComponent(v)}`, { cache: "default" }));
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
          // ignore storage issues
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
  }, [manifest, version]);

  const tagOptions = useMemo(() => {
    const set = new Map();
    for (const post of posts) {
      for (const tag of post.tags || []) {
        const key = String(tag).toLowerCase();
        if (!key) continue;
        if (!set.has(key)) set.set(key, String(tag));
      }
    }
    return ["ALL", ...Array.from(set.values()).sort((a, b) => a.localeCompare(b))];
  }, [posts]);

  const filtered = useMemo(() => {
    if (miniOnly && activeTag === "ALL") return posts.filter((post) => post.is_coupon);

    return posts.filter((post) => {
      if (miniOnly && !post.is_coupon) return false;
      if (activeTag === "ALL") return true;
      const want = activeTag.toLowerCase();
      return (post.tags || []).some((tag) => String(tag).toLowerCase() === want);
    });
  }, [activeTag, miniOnly, posts]);

  const pinned = filtered.filter((post) => post.pinned);
  const regular = filtered.filter((post) => !post.pinned);
  const activePost = filtered.find((post) => post.id === activePostId) || posts.find((post) => post.id === activePostId) || null;

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <header className="space-y-2 rounded-2xl border border-subtle bg-card-surface p-6 text-center shadow-sm backdrop-blur">
          <p className="mx-auto inline-flex rounded-full border border-subtle bg-panel/60 px-3 py-1 text-xs uppercase tracking-[0.35em] text-accent">
            BALLSVILLE
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">News & Posts</h1>
          <p className="text-sm text-muted">Announcements, updates, and important posts from the admin team.</p>
        </header>

        <div className="flex flex-col gap-3 rounded-2xl border border-subtle bg-card-surface px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {tagOptions.map((tag) => (
              <TagPill key={tag} active={activeTag === tag} onClick={() => setActiveTag(tag)}>
                {tag}
              </TagPill>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 text-xs text-muted">
            <label className="inline-flex cursor-pointer select-none items-center gap-2">
              <input type="checkbox" checked={miniOnly} onChange={(e) => setMiniOnly(e.target.checked)} />
              <span>Mini Games only</span>
            </label>

            <span className="text-muted/50">|</span>

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
          <div className="text-center text-sm text-muted">Loading...</div>
        ) : err ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-center text-sm text-rose-100">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-center text-sm text-muted">No posts match your filter.</div>
        ) : (
          <div className="space-y-8">
            {pinned.length ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-sm font-semibold text-foreground">
                    Pinned
                  </h2>
                  <span className="text-[11px] text-muted">{pinned.length}</span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
                  {pinned.map((post) => (
                    <PostCard key={post.id} post={post} updatedAt={updatedAt} onOpen={() => setActivePostId(post.id)} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 rounded-full border border-subtle bg-panel/60 px-3 py-1 text-sm font-semibold text-foreground">
                  {pinned.length ? "Latest" : "Posts"}
                </h2>
                <span className="text-[11px] text-muted">{regular.length}</span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
                {regular.map((post) => (
                  <PostCard key={post.id} post={post} updatedAt={updatedAt} onOpen={() => setActivePostId(post.id)} />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <PostModal post={activePost} updatedAt={updatedAt} onClose={() => setActivePostId("")} />
    </main>
  );
}

function PostCard({ post, updatedAt, onOpen }) {
  const now = Date.now();
  const expMs = post.expires_at ? new Date(post.expires_at).getTime() : NaN;
  const isExpiredMini = Boolean(post.is_coupon && post.expires_at && !Number.isNaN(expMs) && expMs < now);
  const cardCls = `${cardBase} ${cardHover}`;
  const dimCls = isExpiredMini ? "opacity-60 grayscale" : "";

  return (
    <article className={`${cardCls} relative overflow-hidden`}>
      {isExpiredMini ? <CornerRibbon label="Expired" variant="expired" /> : null}
      {post.pinned ? <CornerRibbon label="Pinned" variant="pinned" /> : null}

      <div className="relative overflow-hidden rounded-t-2xl">
        {post.mediaSrc ? (
          <div className={`overflow-hidden rounded-2xl ${dimCls}`}>
            {post.is_coupon ? <CornerRibbon label="Mini Game" variant="mini" /> : null}
            <MediaBlock src={post.mediaSrc} updatedAt={updatedAt} forceVideo={post.is_video || post.media_type === "video"} />
          </div>
        ) : null}
      </div>

      <div className={`p-5 ${dimCls}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-foreground">{post.title || "Post"}</h3>
        </div>

        {post.date ? (
          <div className="mt-2">
            <span className="inline-flex rounded-full border border-subtle bg-panel/60 px-3 py-1 text-[11px] text-muted">{fmtDate(post.date)}</span>
          </div>
        ) : null}

        {post.is_coupon ? <MiniGameTimer expiresAt={post.expires_at} /> : null}

        {post.html ? (
          <div className="relative mt-3 max-h-32 overflow-hidden">
            <div className="prose prose-invert max-w-none text-xs text-muted" dangerouslySetInnerHTML={{ __html: post.html }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card-surface to-transparent" />
          </div>
        ) : post.body ? (
          <p className="mt-3 line-clamp-6 whitespace-pre-line text-xs text-muted">{post.body}</p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onOpen} className="inline-flex text-xs text-accent hover:underline">
            View full post
          </button>

          {post.tags?.length ? (
            <div className="max-w-[60%] truncate text-[10px] text-muted">
              {post.tags.slice(0, 2).join(" | ")}
              {post.tags.length > 2 ? " | ..." : ""}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function NewsPage() {
  return (
    <SectionManifestGate section="posts" season={CURRENT_SEASON}>
      <NewsInner />
    </SectionManifestGate>
  );
}
