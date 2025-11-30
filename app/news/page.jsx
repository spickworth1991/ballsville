// app/news/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

// token-driven UI bits
const cardCls =
  "card bg-card-surface border border-subtle relative p-6 transition shadow-sm hover:shadow-md hover:-translate-y-[2px]";
const chipBase =
  "text-sm px-3 py-1 rounded-full border transition";
const chipActive =
  "bg-primary text-white border-primary";
const chipIdle =
  "bg-transparent text-primary border-primary hover:bg-primary hover:text-white";
const tagPill =
  "text-xs px-2 py-0.5 rounded-full border border-subtle text-muted";

// --- helpers mapping coupon -> mini game ---

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

  // Active mini games: nearest closing first
  activeMini.sort((a, b) => {
    const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || new Date(b.created_at) - new Date(a.created_at);
  });

  // Regular posts: newest first
  regularPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Closed mini games: newest first
  closedMini.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return { activeMini, regularPosts, closedMini };
}

function getDisplayTags(row) {
  const base = (row.tags || []).slice();
  const lower = base.map((t) => t.toLowerCase());

  if (isMiniGame(row) && !isClosed(row) && !lower.includes("mini game")) {
    base.push("Mini Game");
  }
  if (isClosed(row) && !lower.includes("mini game (closed)")) {
    base.push("Mini Game (Closed)");
  }
  return base;
}

// ---- media helpers: image vs video ----
function isVideoUrl(url) {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return /\.(mp4|mov|webm|ogg|mpe?g)$/.test(clean);
}

// ---- body helper: turn URLs into clickable links ----
function linkifyBody(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const parts = text.split(urlRegex);

  return parts.map((part, idx) => {
    const isUrl = /^https?:\/\/\S+$/i.test(part);
    if (isUrl) {
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

export default function NewsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!mounted) return;
      if (!error) setRows(data || []);
      setLoading(false);
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

    if (sawActiveMini) set.add("Mini Game");
    if (sawClosedMini) set.add("Mini Game (Closed)");

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!activeTag) return rows;
    const tagLower = activeTag.toLowerCase();

    if (tagLower === "mini game") {
      return rows.filter((r) => isMiniGame(r) && !isClosed(r));
    }
    if (tagLower === "mini game (closed)") {
      return rows.filter((r) => isMiniGame(r) && isClosed(r));
    }

    return rows.filter((r) =>
      (r.tags || []).some((t) => t.toLowerCase() === tagLower)
    );
  }, [rows, activeTag]);

  const { activeMini, regularPosts, closedMini } = useMemo(
    () => splitAndSort(filtered),
    [filtered]
  );
  const display = [...activeMini, ...regularPosts, ...closedMini];

  return (
    <section className="section">
      <div className="container-site max-w-3xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 space-y-3">
          <span className="badge">League news</span>
          <h1 className="h1 mt-1 text-primary">News, Mini Games &amp; Updates</h1>
          <p className="lead mt-1 text-muted">
            Announcements for Ballsville leagues, plus rotating mini games and side contests.
          </p>
        </header>

        {/* Tag filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveTag("")}
            className={`${chipBase} ${!activeTag ? chipActive : chipIdle}`}
          >
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

        {loading ? (
          <div className="card bg-card-surface border border-subtle p-6 text-center">
            <p className="text-muted">Loading…</p>
          </div>
        ) : (
          <ul className="space-y-6">
            {display.map((p) => {
              const closed = isClosed(p);
              const tags = getDisplayTags(p);

              return (
                <li
                  key={p.id}
                  className={`${cardCls} ${closed ? "grayscale" : ""}`}
                  style={closed ? { opacity: 0.9 } : undefined}
                >
                  {/* Closed ribbon for mini games */}
                  {isMiniGame(p) && closed && (
                    <div className="absolute -top-2 -right-2">
                      <div
                        className="rotate-6 rounded px-2 py-1 text-[10px] font-semibold shadow"
                        style={{
                          background: "var(--color-card)",
                          color: "var(--color-fg)",
                        }}
                      >
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
                                background:
                                  "color-mix(in oklab, var(--color-success) 18%, transparent)",
                                color: "var(--color-success)",
                              }
                        }
                      >
                        {closed ? "Mini Game (Closed)" : "Mini Game"}
                      </span>
                    )}
                  </div>

                  {/* Media block: image OR video */}
                  {p.image_url && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-subtle bg-subtle-surface">
                      {isVideoUrl(p.image_url) ? (
                        <video
                          className="w-full rounded-none"
                          controls
                          preload="metadata"
                        >
                          <source src={p.image_url} />
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <img
                          src={p.image_url}
                          alt={p.title}
                          className="w-full h-auto object-contain"
                          loading="lazy"
                        />
                      )}
                    </div>
                  )}

                  {p.body && (
                    <p className="mt-4 whitespace-pre-line break-words text-fg">
                      {linkifyBody(p.body)}
                    </p>
                  )}

                  <div className="mt-4 text-xs text-muted">
                    Posted {new Date(p.created_at).toLocaleString()}
                    {isMiniGame(p) && p.expires_at && (
                      <>
                        {" "}
                        • Sign-up closes{" "}
                        {new Date(p.expires_at).toLocaleString()}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {!display.length && (
              <li className="card bg-card-surface border border-subtle p-6 text-center">
                <p className="text-muted">No news or mini games yet.</p>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
