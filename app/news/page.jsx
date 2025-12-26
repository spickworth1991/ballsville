// app/news/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";

const cardCls =
  "card bg-card-surface border border-subtle relative p-6 transition shadow-sm hover:shadow-md hover:-translate-y-[2px]";
const chipBase = "text-sm px-3 py-1 rounded-full border transition";
const chipActive = "bg-primary text-white border-primary";
const chipIdle =
  "bg-transparent text-primary border-primary hover:bg-primary hover:text-white";
const tagPill =
  "text-xs px-2 py-0.5 rounded-full border border-subtle text-muted hover:text-accent hover:border-[color:var(--color-accent)] transition";

function isMiniGame(row) {
  return !!row.is_coupon;
}

function isClosed(row) {
  return isMiniGame(row) && row.expires_at && new Date(row.expires_at) < new Date();
}

function splitAndSort(rows) {
  const now = new Date();
  const activeMini = [];
  const regularPosts = [];
  const closedMini = [];

  for (const r of rows) {
    if (isMiniGame(r)) {
      const closed = r.expires_at ? new Date(r.expires_at) < now : false;
      if (closed) closedMini.push(r);
      else activeMini.push(r);
    } else {
      regularPosts.push(r);
    }
  }

  activeMini.sort((a, b) => {
    const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || new Date(b.created_at) - new Date(a.created_at);
  });

  regularPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  closedMini.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return { activeMini, regularPosts, closedMini };
}

function getDisplayTags(row) {
  const base = (row.tags || []).slice();
  const lower = base.map((t) => String(t).toLowerCase());

  const hasMini = lower.includes("mini game") || lower.includes("mini games");
  const hasMiniClosed = lower.includes("mini game (closed)") || lower.includes("mini games (closed)");

  // Site wording uses plural.
  if (isMiniGame(row) && !isClosed(row) && !hasMini) base.push("Mini Games");
  if (isClosed(row) && !hasMiniClosed) base.push("Mini Games (Closed)");

  return base;
}

function isVideoUrl(url) {
  if (!url) return false;
  const clean = String(url).split("?")[0].toLowerCase();
  return /\.(mp4|mov|webm|ogg|mpe?g)$/.test(clean);
}

function linkifyBody(text, opts = {}) {
  const disableLinks = !!opts.disableLinks;
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = String(text).split(urlRegex);

  return parts.map((part, idx) => {
    const isUrl = /^https?:\/\/\S+$/i.test(part);
    if (isUrl) {
      if (disableLinks) {
        return (
          <span key={idx} className="text-muted break-all">
            {part}
          </span>
        );
      }
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function normalizePost(p) {
  const imageKey = typeof p?.imageKey === "string" ? p.imageKey : "";
  return {
    ...p,
    id: p?.id ?? p?.slug ?? crypto?.randomUUID?.() ?? String(Math.random()),
    created_at: p?.created_at || new Date().toISOString(),
    tags: Array.isArray(p?.tags) ? p.tags : [],
    image_url: imageKey ? `/r2/${imageKey}` : p?.image_url || p?.imageUrl || "",
  };
}

export default function NewsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const bust = `v=${Date.now()}`;
        const res = await fetch(`/r2/data/posts/posts.json?${bust}`, { cache: "no-store" });
        if (!res.ok) {
          if (mounted) setRows([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data?.posts) ? data.posts : Array.isArray(data) ? data : [];
        if (mounted) setRows(list.map(normalizePost));
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const allTags = useMemo(() => {
    const set = new Set();
    let sawActiveMini = false;
    let sawClosedMini = false;

    for (const r of rows) {
      (r.tags || []).forEach((t) => set.add(t));
      if (isMiniGame(r)) {
        if (isClosed(r)) sawClosedMini = true;
        else sawActiveMini = true;
      }
    }

    // Keep the label plural to match site wording.
    if (sawActiveMini) set.add("Mini Games");
    if (sawClosedMini) set.add("Mini Games (Closed)");

    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!activeTag) return rows;
    const tagLower = activeTag.toLowerCase();

    // Accept both singular + plural tags for backward compatibility.
    if (tagLower === "mini game" || tagLower === "mini games") return rows.filter((r) => isMiniGame(r) && !isClosed(r));
    if (tagLower === "mini game (closed)" || tagLower === "mini games (closed)")
      return rows.filter((r) => isMiniGame(r) && isClosed(r));

    return rows.filter((r) => (r.tags || []).some((t) => String(t).toLowerCase() === tagLower));
  }, [rows, activeTag]);

  const { activeMini, regularPosts, closedMini } = useMemo(() => splitAndSort(filtered), [filtered]);
  const display = [...activeMini, ...regularPosts, ...closedMini];

  return (
    <section className="section">
      <div className="container-site max-w-4xl mx-auto space-y-6">
        <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
            <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            <div className="absolute top-10 right-16 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
          </div>

          <div className="relative">
            <span className="badge">League news</span>
            <h1 className="h1 mt-3 text-primary">News, Mini Games &amp; Updates</h1>
            <p className="lead mt-3 text-muted max-w-2xl mx-auto">
              Announcements for Ballsville leagues, plus rotating mini games and side contests.
            </p>
          </div>
        </header>

        <div className="bg-card-surface border border-subtle rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => setActiveTag("")} className={`${chipBase} ${!activeTag ? chipActive : chipIdle}`}>
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                className={`${chipBase} ${activeTag === t ? chipActive : chipIdle}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="bg-card-surface border border-subtle rounded-2xl p-6 text-center shadow-sm">
            <p className="text-muted">Loading…</p>
          </div>
        ) : (
          <ul className="space-y-6">
            {display.map((p) => {
              const closed = isClosed(p);
              const tags = getDisplayTags(p);
              const mediaSrc = p.image_url || "";

              return (
                <li
                  key={p.id}
                  className={`${cardCls} ${closed ? "grayscale" : ""}`}
                  style={closed ? { opacity: 0.9 } : undefined}
                >
                  {isMiniGame(p) && closed && (
                    <div className="absolute -top-2 -right-2">
                      <div className="rotate-6 rounded px-2 py-1 text-[10px] font-semibold shadow bg-card-surface border border-subtle">
                        MINI GAME CLOSED
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-primary">{p.title}</h2>

                      {!!tags.length && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tags.map((t) => (
                            <button
                              key={t}
                              onClick={() => setActiveTag(t)}
                              className={tagPill}
                              title={`Filter by ${t}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {isMiniGame(p) && (
                      <span
                        className="badge"
                        style={
                          closed
                            ? undefined
                            : {
                                background: "color-mix(in oklab, var(--color-success) 18%, transparent)",
                                color: "var(--color-success)",
                              }
                        }
                      >
                        {closed ? "Mini Game (Closed)" : "Mini Game"}
                      </span>
                    )}
                  </div>

                  {mediaSrc ? (
                    <div className="mt-4 rounded-xl overflow-hidden border border-subtle bg-subtle-surface">
                      {isVideoUrl(mediaSrc) ? (
                        <video className="w-full" controls preload="metadata">
                          <source src={mediaSrc} />
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <img src={mediaSrc} alt={p.title} className="w-full h-auto object-contain" loading="lazy" />
                      )}
                    </div>
                  ) : null}

                  {p.body ? (
                    <p className="mt-4 whitespace-pre-line break-words text-fg">{linkifyBody(p.body, { disableLinks: closed })}</p>
                  ) : null}

                  <div className="mt-4 text-xs text-muted">
                    Posted {new Date(p.created_at).toLocaleString()}
                    {isMiniGame(p) && p.expires_at ? (
                      <> • Sign-up closes {new Date(p.expires_at).toLocaleString()}</>
                    ) : null}
                  </div>
                </li>
              );
            })}

            {!display.length && (
              <li className="bg-card-surface border border-subtle rounded-2xl p-6 text-center shadow-sm">
                <p className="text-muted">No news or mini games yet.</p>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
