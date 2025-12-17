"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

function getFramePreset(w, h) {
  if (!w || !h) return { aspect: "aspect-[16/9]", fit: "object-cover" };

  const r = w / h;

  // Portrait
  if (r <= 0.85) return { aspect: "aspect-[3/4]", fit: "object-cover" };

  // Square-ish
  if (r > 0.85 && r < 1.15) return { aspect: "aspect-square", fit: "object-cover" };

  // Wide
  return { aspect: "aspect-[16/9]", fit: "object-cover" };
}

export default function HallOfFameClient() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // store image dims per item id
  const [dimsById, setDimsById] = useState({});

  useEffect(() => {
    let alive = true;

    async function load() {
      setErr("");
      setLoading(true);

      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("hall_of_fame")
          .select(
            "id, year, game_label, title, blurb, image_url, image_alt, sort_order, is_active"
          )
          .eq("is_active", true)
          .order("year", { ascending: false })
          .order("sort_order", { ascending: true });

        if (!alive) return;
        if (error) throw error;

        setItems(data || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load Hall of Fame.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  function setDims(id, w, h) {
    setDimsById((prev) => {
      // avoid re-renders if already set
      const cur = prev[id];
      if (cur && cur.w === w && cur.h === h) return prev;
      return { ...prev, [id]: { w, h } };
    });
  }

  return (
    <section className="section">
      <div className="container-site space-y-10">
        {/* Hero */}
        <header className="text-center mb-2">
          <span className="badge">Hall of Fame</span>
          <h1 className="h1 mt-3">BALLSVILLE Hall of Fame</h1>
          <p className="lead mt-3 max-w-2xl mx-auto">
            Champions, division winners, and special awards — the best of the
            best, preserved forever.
          </p>
        </header>

        {loading && (
          <div className="bg-card-surface p-6 md:p-8">
            <p className="text-muted">Loading Hall of Fame…</p>
          </div>
        )}

        {!loading && err && (
          <div className="bg-card-surface p-6 md:p-8">
            <p className="text-danger">{err}</p>
          </div>
        )}

        {!loading && !err && (
          <div className="space-y-8">
            {items.map((item, idx) => {
              const flip = idx % 2 === 1;

              const dims = dimsById[item.id];
              const preset = getFramePreset(dims?.w, dims?.h);

              return (
                <article
                  key={item.id}
                  className={`bg-card-surface rounded-2xl p-6 md:p-8 grid gap-6 items-center ${
                    flip ? "md:grid-cols-[1fr_420px]" : "md:grid-cols-[420px_1fr]"
                  }`}
                >
                  {/* Image */}
                  <div className={flip ? "md:order-2" : ""}>
                    <div
                      className={[
                        "relative w-full",
                        preset.aspect,
                        "rounded-2xl overflow-hidden border border-subtle shadow-md",
                        // ✅ “bubble” feel + subtle glow edge
                        "ring-1 ring-white/10",
                      ].join(" ")}
                    >
                      <Image
                        src={item.image_url}
                        alt={item.image_alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 420px"
                        className={preset.fit}
                        priority={idx === 0}
                        onLoadingComplete={(img) =>
                          setDims(item.id, img.naturalWidth, img.naturalHeight)
                        }
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className={flip ? "md:order-1" : ""}>
                    <p className="text-sm text-muted">{item.game_label}</p>
                    <h2 className="h2 mt-1">{item.title}</h2>
                    <p className="mt-3 text-fg/90">{item.blurb}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
