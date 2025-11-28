"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

// token-driven UI bits
const cardCls =
  "card p-6 transition shadow-sm hover:shadow-md hover:-translate-y-[2px]";
const chipBase =
  "text-sm px-3 py-1 rounded-full border transition";
const chipActive =
  "bg-primary text-card border-primary";
const chipIdle =
  "bg-transparent text-primary border-primary hover:bg-primary";
const tagPill =
  "text-xs px-2 py-0.5 rounded-full border border-subtle";

// helpers
function splitAndSort(rows) {
  const now = new Date();
  const activeCoupons = [];
  const nonCoupons = [];
  const expiredCoupons = [];

  for (const r of rows) {
    if (r.is_coupon) {
      const expired = r.expires_at ? new Date(r.expires_at) < now : false;
      if (expired) expiredCoupons.push(r);
      else activeCoupons.push(r);
    } else {
      nonCoupons.push(r);
    }
  }

  activeCoupons.sort((a, b) => {
    const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || new Date(b.created_at) - new Date(a.created_at);
  });

  nonCoupons.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  expiredCoupons.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return { activeCoupons, nonCoupons, expiredCoupons };
}

function isExpired(row) {
  return row.is_coupon && row.expires_at && new Date(row.expires_at) < new Date();
}

function getDisplayTags(row) {
  const base = (row.tags || []).slice();
  if (row.is_coupon && !isExpired(row) && !base.some(t => t.toLowerCase() === "coupon")) base.push("Coupon");
  if (isExpired(row) && !base.some(t => t.toLowerCase() === "coupon (expired)")) base.push("Coupon (Expired)");
  return base;
}

export default function NewsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setLoading(false); return; }

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
    return () => { mounted = false; };
  }, []);

  const allTags = useMemo(() => {
    const set = new Set();
    let sawActive = false, sawExpired = false;

    for (const r of rows) {
      (r.tags || []).forEach(t => set.add(t));
      if (r.is_coupon) {
        if (isExpired(r)) sawExpired = true; else sawActive = true;
      }
    }
    if (sawActive) set.add("Coupon");
    if (sawExpired) set.add("Coupon (Expired)");

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!activeTag) return rows;
    const tagLower = activeTag.toLowerCase();
    if (tagLower === "coupon") return rows.filter(r => r.is_coupon && !isExpired(r));
    if (tagLower === "coupon (expired)") return rows.filter(r => r.is_coupon && isExpired(r));
    return rows.filter(r => (r.tags || []).some(t => t.toLowerCase() === tagLower));
  }, [rows, activeTag]);

  const { activeCoupons, nonCoupons, expiredCoupons } = useMemo(
    () => splitAndSort(filtered),
    [filtered]
  );
  const display = [...activeCoupons, ...nonCoupons, ...expiredCoupons];

  return (
    <section className="section">
      <div className="container-site max-w-3xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <span className="badge">Clinic news</span>
          <h1 className="h1 mt-3">News &amp; Updates</h1>
          <p className="lead mt-3">Announcements, events, and occasional promotions.</p>
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
          <div className="card p-6 text-center">Loading…</div>
        ) : (
          <ul className="space-y-6">
            {display.map((p) => {
              const expired = isExpired(p);
              const tags = getDisplayTags(p);

              return (
                <li
                  key={p.id}
                  className={`${cardCls} ${expired ? "grayscale" : ""}`}
                  style={expired ? { opacity: 0.85 } : undefined}
                >
                  {/* Expired ribbon */}
                  {expired && (
                    <div className="absolute -top-2 -right-2">
                      <div
                        className="rotate-12 rounded px-2 py-1 text-[10px] font-semibold shadow"
                        style={{
                          background: "var(--color-card)",
                          color: "var(--color-fg)",
                        }}
                      >
                        EXPIRED
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">{p.title}</h2>
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

                    {p.is_coupon && (
                      <span
                        className="badge"
                        style={
                          expired
                            ? undefined
                            : {
                                background:
                                  "color-mix(in oklab, var(--color-success) 18%, transparent)",
                                color: "var(--color-success)",
                              }
                        }
                      >
                        {expired ? "Coupon (Expired)" : "Coupon"}
                      </span>
                    )}
                  </div>

                  {p.image_url && (
                    <div className="mt-4">
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className="rounded-lg w-full h-auto"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {p.body && (
                    <p className="mt-4 whitespace-pre-line">
                      {p.body}
                    </p>
                  )}

                  <div className="mt-4 text-xs text-muted">
                    Posted {new Date(p.created_at).toLocaleString()}
                    {p.is_coupon && p.expires_at && (
                      <> • Expires {new Date(p.expires_at).toLocaleString()}</>
                    )}
                  </div>
                </li>
              );
            })}
            {!display.length && (
              <li className="card p-6 text-center">
                <p className="text-muted">No posts found.</p>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
