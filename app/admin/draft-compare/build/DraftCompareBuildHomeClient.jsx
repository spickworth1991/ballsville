"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function safeInt(v, fallback = null) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function cls(...a) {
  return a.filter(Boolean).join(" ");
}

export default function DraftCompareBuildHomeClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const season = safeInt(sp.get("season"), null);
  const modeSlug = safeStr(sp.get("modeSlug")).trim();
  const title = safeStr(sp.get("title")).trim();
  const year = safeInt(sp.get("year"), null);
  const order = safeInt(sp.get("order"), null);
  const action = safeStr(sp.get("action")).trim() || "create";

  const canProceed = useMemo(() => {
    return (
      !!modeSlug &&
      !!title &&
      Number.isFinite(year) &&
      year > 2000 &&
      Number.isFinite(order) &&
      Number.isFinite(season)
    );
  }, [modeSlug, title, year, order, season]);

  const [username, setUsername] = useState("");
  const [err, setErr] = useState("");

  function goNext(e) {
    e.preventDefault();
    setErr("");
    const u = safeStr(username).trim();
    if (!u) {
      setErr("Enter your Sleeper username.");
      return;
    }
    if (!canProceed) {
      setErr("Missing mode metadata. Go back and make sure Order, Year, and Title are filled in.");
      return;
    }
    const qs = new URLSearchParams({
      season: String(season),
      modeSlug,
      title,
      year: String(year),
      order: String(order),
      action,
      username: u,
    });
    router.push(`/admin/draft-compare/build/select-leagues?${qs.toString()}`);
  }

  return (
    <section className="section">
      <div className="container-site">
        <div className="rounded-3xl border border-border bg-card-surface/80 p-6 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-muted">Draft Compare • Admin</div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">
                {action === "rebuild" ? "Rebuild" : "Create"} Draft Database
              </h1>
              <p className="mt-2 text-sm text-muted">
                Mode: <span className="font-semibold text-primary">{title || "—"}</span> • Sleeper season:{" "}
                <span className="font-semibold text-primary">{year || "—"}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                This will generate the exact same Draft Compare JSON, then save it to R2 for this mode.
              </p>
            </div>

            <div className="flex gap-2">
              <Link prefetch={false} className="btn btn-secondary" href="/admin/draft-compare">
                Back to Admin
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <div className="text-sm font-semibold text-primary">What you’ll do</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Enter your Sleeper username</li>
                <li>Select which leagues (and which draft) to include</li>
                <li>Click Build & Save — no extra preview screens</li>
              </ul>
            </div>

            <form onSubmit={goNext} className="rounded-2xl border border-border bg-background/30 p-4">
              <label className="block text-xs font-semibold text-muted">Sleeper Username</label>
              <input
                className="input mt-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. stickyPicky"
                autoComplete="off"
              />
              {err ? <div className="mt-3 text-sm text-red-300">{err}</div> : null}

              <button
                type="submit"
                className={cls("btn mt-4 w-full", canProceed ? "btn-primary" : "btn-primary opacity-50")}
                disabled={!canProceed}
                title={canProceed ? "" : "Go back and fill in Order, Year, and Title for this mode first."}
              >
                Continue to League Selection
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
