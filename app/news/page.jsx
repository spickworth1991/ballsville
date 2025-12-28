// app/news/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SectionManifestGate from "@/components/manifest/SectionManifestGate";
import { CURRENT_SEASON } from "@/lib/season";

const cardCls =
  "card bg-card-surface border border-subtle rounded-2xl shadow-md p-5 transition hover:border-accent hover:-translate-y-0.5";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizePost(p, idx) {
  const o = p && typeof p === "object" ? p : {};
  let html = String(o.html || o.body_html || o.bodyHtml || "").trim()();
  let body = String(o.body || o.content || "").trim()();

  // Some older posts stored HTML inside `body`. If it looks like HTML, render it as such.
  if (!html && body && body.includes("<") && body.includes(">")) {
    html = body;
    body = "";
  }
  return {
    id: o.id || o.slug || String(idx),
    title: String(o.title || o.name || "").trim()(),
    body,
    html,
    date: String(o.date || o.created_at || o.createdAt || "").trim()(),
    link: String(o.link || o.url || "").trim()(),
    tag: String(o.tag || o.type || "").trim()(),
  };
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
              setUpdatedAt(String(cachedUpdated || ""));
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
        setPosts(list.map(normalizePost));
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
          <p className="text-sm text-muted">
            Announcements, updates, and any important posts from the admin team.
          </p>
          {updatedAt ? (
            <p className="text-[11px] text-muted">Updated: {new Date(updatedAt).toLocaleString()}</p>
          ) : null}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <article key={p.id} className={cardCls}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{p.title || "Post"}</h2>
                  {p.tag ? (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-subtle bg-panel text-muted">
                      {p.tag}
                    </span>
                  ) : null}
                </div>

                {p.date ? (
                  <p className="mt-1 text-[11px] text-muted">{p.date}</p>
                ) : null}

                {p.html ? (
                  <div
                    className="mt-3 prose prose-invert max-w-none text-xs text-muted"
                    // Admin-controlled HTML; this mirrors how OwnerHeroBlock renders updatesHtml.
                    dangerouslySetInnerHTML={{ __html: p.html }}
                  />
                ) : p.body ? (
                  <p className="mt-3 text-xs text-muted line-clamp-6 whitespace-pre-line">{p.body}</p>
                ) : null}

                {p.link ? (
                  <Link
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex text-xs text-accent hover:underline"
                  >
                    Read more →
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function NewsPage() {
  // Posts are not season-scoped right now, but we still keep the season argument
  // for consistency and future expansion.
  return (
    <SectionManifestGate section="posts" season={CURRENT_SEASON}>
      <NewsInner />
    </SectionManifestGate>
  );
}
