// app/news/page.jsx
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

function isVideoUrl(u) {
  const url = safeStr(u).toLowerCase();
  return url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".ogg") || url.includes("video");
}

function isImageUrl(u) {
  const url = safeStr(u).toLowerCase();
  return (
    url.endsWith(".png") ||
    url.endsWith(".jpg") ||
    url.endsWith(".jpeg") ||
    url.endsWith(".gif") ||
    url.endsWith(".webp") ||
    url.endsWith(".avif")
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function normalizePost(p, idx) {
  const o = p && typeof p === "object" ? p : {};
  let html = String(o.html || o.body_html || o.bodyHtml || "").trim();
  let body = String(o.body || o.content || "").trim();

  // Some older posts stored HTML inside `body`. If it looks like HTML, render it as such.
  if (!html && body && body.includes("<") && body.includes(">")) {
    html = body;
    body = "";
  }

  // Media: support both snake/camel and old fields
  const imageKey = safeStr(o.imageKey || o.image_key || "").trim();
  const imageUrl = safeStr(o.image_url || o.imageUrl || "").trim();
  const mediaSrc = imageKey ? `/r2/${imageKey}` : imageUrl;

  return {
    id: o.id || o.slug || String(idx),
    title: String(o.title || o.name || "").trim(),
    body,
    html,
    date: String(o.created_at || o.date || o.createdAt || o.created_at || "").trim(),
    link: String(o.link || o.url || "").trim(),
    tag: String(o.tag || o.type || "").trim(),
    tags: Array.isArray(o.tags) ? o.tags.map(String) : typeof o.tags === "string" ? o.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
    pinned: Boolean(o.pinned ?? o.pin),
    is_coupon: Boolean(o.is_coupon),
    expires_at: safeStr(o.expires_at || o.expiresAt || "").trim(),
    imageKey,
    imageUrl,
    mediaSrc: safeStr(mediaSrc),
  };
}

function MediaBlock({ src, updatedAt }) {
  const s = safeStr(src);
  if (!s) return null;

  // cache bust only when src is from our R2 proxy
  const finalSrc =
    s.startsWith("/r2/") && updatedAt
      ? (s.includes("?") ? s : `${s}?v=${encodeURIComponent(updatedAt)}`)
      : s;

  if (isVideoUrl(finalSrc)) {
    return (
      <div className="relative w-full aspect-[16/9] bg-black/30">
        <video
          className="absolute inset-0 w-full h-full object-contain"
          controls
          playsInline
          preload="metadata"
        >
          <source src={finalSrc} />
        </video>
      </div>
    );
  }

  // default to image if it looks like one, otherwise still try to render <img>
  if (isImageUrl(finalSrc) || finalSrc.startsWith("http") || finalSrc.startsWith("/")) {
    return (
      <div className="relative w-full aspect-[16/9] bg-black/20">
        <img
          src={finalSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        {/* subtle premium overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/10" />
      </div>
    );
  }

  return null;
}

function NewsInner({ version = "0", manifest = null }) {
  const [posts, setPosts] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Manifest-first: avoid an initial v=0 fetch before the manifest loads.
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

      // If we already have this exact version in sessionStorage, use it and skip network.
      try {
        const cachedV = sessionStorage.getItem(cacheKeyV);
        if (cachedV && cachedV === v) {
          const cached = sessionStorage.getItem(cacheKeyData);
          const cachedUpdated = sessionStorage.getItem(cacheKeyUpdated);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (!cancelled && parsed) {
              const list = safeArray(parsed?.posts || parsed?.rows || parsed);
              setPosts(list.map(normalizePost));
              setUpdatedAt(String(cachedUpdated || parsed?.updatedAt || ""));
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

        // sort: pinned first, newest first
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
          <p className="text-sm text-muted">Announcements, updates, and any important posts from the admin team.</p>
          {updatedAt ? <p className="text-[11px] text-muted">Updated: {fmtDate(updatedAt)}</p> : null}
        </header>

        {loading ? (
          <div className="text-center text-sm text-muted">Loading…</div>
        ) : err ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100 text-center">
            {err}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-subtle bg-subtle-surface p-6 text-center text-sm text-muted">
            No posts yet.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <article key={p.id} className={cardCls}>
                {/* Media */}
                {p.mediaSrc ? <MediaBlock src={p.mediaSrc} updatedAt={updatedAt} /> : null}

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground leading-snug">
                      {p.title || "Post"}
                    </h2>

                    <div className="flex items-center gap-2">
                      {p.pinned ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                          PINNED
                        </span>
                      ) : null}

                      {p.tag ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-subtle bg-panel text-muted">
                          {p.tag}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {p.date ? <p className="mt-1 text-[11px] text-muted">{fmtDate(p.date)}</p> : null}

                  {p.html ? (
                    <div
                      className="mt-3 prose prose-invert max-w-none text-xs text-muted"
                      // Admin-controlled HTML
                      dangerouslySetInnerHTML={{ __html: p.html }}
                    />
                  ) : p.body ? (
                    <p className="mt-3 text-xs text-muted line-clamp-6 whitespace-pre-line">{p.body}</p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between">
                    {p.link ? (
                      <Link
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-xs text-accent hover:underline"
                      >
                        Read more →
                      </Link>
                    ) : <span />}

                    {p.tags?.length ? (
                      <div className="text-[10px] text-muted truncate max-w-[60%]">
                        {p.tags.slice(0, 2).join(" · ")}{p.tags.length > 2 ? " · …" : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
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
