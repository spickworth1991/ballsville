"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getADPGroupData } from "@/lib/adpBuild";

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

async function apiGet(url) {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function deriveSelectionKey(entry) {
  const leagueId = safeStr(entry?.leagueId).trim();
  const draftId = safeStr(entry?.draftId).trim();
  if (!leagueId) return "";
  return draftId ? `${leagueId}::${draftId}` : leagueId;
}

function getExistingSelectionKeys(data) {
  const payload = data && typeof data === "object" ? data : {};
  const explicit = Array.isArray(payload?.selectedKeys) ? payload.selectedKeys.map(safeStr).map((v) => v.trim()).filter(Boolean) : [];
  if (explicit.length) return explicit;

  const fromLeagues = Array.isArray(payload?.leagues)
    ? payload.leagues.map((entry) => safeStr(entry?.selectionKey).trim() || deriveSelectionKey(entry)).filter(Boolean)
    : [];
  return fromLeagues;
}

function getExistingLeagueMetaMap(data) {
  const out = new Map();
  const leagues = Array.isArray(data?.leagues) ? data.leagues : [];
  for (const entry of leagues) {
    const key = safeStr(entry?.selectionKey).trim() || deriveSelectionKey(entry);
    if (!key) continue;
    out.set(key, {
      leagueName: safeStr(entry?.leagueName || entry?.name || entry?.leagueId).trim(),
      draftName: safeStr(entry?.draftName || entry?.name || entry?.leagueName || entry?.leagueId).trim(),
      rookie: !!entry?.isRookie,
    });
  }
  return out;
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
  const [msg, setMsg] = useState("");
  const [existingDraftData, setExistingDraftData] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(action === "rebuild");
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadExisting() {
      if (action !== "rebuild" || !modeSlug || !Number.isFinite(season)) {
        setExistingDraftData(null);
        setCheckingExisting(false);
        return;
      }

      setCheckingExisting(true);
      try {
        const data = await apiGet(
          `/api/admin/draft-compare?season=${encodeURIComponent(String(season))}&type=drafts&modeSlug=${encodeURIComponent(modeSlug)}`
        );
        if (cancelled) return;
        const existing = data?.data && typeof data.data === "object" ? data.data : null;
        setExistingDraftData(existing);
        if (!safeStr(username).trim() && safeStr(existing?.source?.username).trim()) {
          setUsername(safeStr(existing.source.username).trim());
        }
      } catch (e) {
        if (cancelled) return;
        setExistingDraftData(null);
        setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setCheckingExisting(false);
      }
    }

    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [action, modeSlug, season]);

  const existingSelectedKeys = useMemo(() => getExistingSelectionKeys(existingDraftData), [existingDraftData]);
  const canUseCurrentLeagues = existingSelectedKeys.length > 0;
  const existingSourceUsername = safeStr(existingDraftData?.source?.username).trim();

  function goNext(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
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

  async function regenerateWithCurrentLeagues() {
    setErr("");
    setMsg("");

    if (!canProceed) {
      setErr("Missing mode metadata. Go back and make sure Order, Year, and Title are filled in.");
      return;
    }
    if (!canUseCurrentLeagues) {
      setErr("No saved league selection was found for this mode.");
      return;
    }

    try {
      setRegenerating(true);
      setMsg("Rebuilding ADP and draftboard data from the current saved league selection...");

      const group = await getADPGroupData(existingSelectedKeys);
      const leagueMetaMap = getExistingLeagueMetaMap(existingDraftData);

      const leaguesOut = (group?.leagues || []).map((league) => {
        const selectionKey = league?.draftId ? `${league.leagueId}::${league.draftId}` : safeStr(league?.leagueId);
        const existingMeta = leagueMetaMap.get(selectionKey);
        return {
          ...league,
          leagueName: existingMeta?.leagueName || league?.name || league?.leagueId,
          draftName: existingMeta?.draftName || league?.name || league?.leagueId,
          isRookie: !!existingMeta?.rookie,
          selectionKey,
        };
      });

      const payload = {
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        modeSlug,
        title,
        order,
        sleeperSeason: safeInt(existingDraftData?.sleeperSeason, null) ?? year,
        source: existingDraftData?.source || (existingSourceUsername ? { username: existingSourceUsername } : {}),
        meta: group?.meta || existingDraftData?.meta || { teams: 12, rounds: 15 },
        leagues: leaguesOut,
        selectedKeys: existingSelectedKeys,
      };

      setMsg("Saving rebuilt JSON to Ballsville...");
      await apiPost("/api/admin/draft-compare", {
        season,
        type: "drafts",
        modeSlug,
        data: payload,
      });

      setMsg("Saved! Returning to Draft Compare Admin...");
      router.push("/admin/draft-compare");
    } catch (e) {
      setErr(String(e?.message || e));
      setMsg("");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className="section">
      <div className="container-site">
        <div className="rounded-3xl border border-border bg-card-surface p-6 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-muted">Draft Compare - Admin</div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">
                {action === "rebuild" ? "Rebuild" : "Create"} Draft Database
              </h1>
              <p className="mt-2 text-sm text-muted">
                Mode: <span className="font-semibold text-primary">{title || "-"}</span> - Sleeper season:{" "}
                <span className="font-semibold text-primary">{year || "-"}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                This generates the Draft Compare JSON for this mode and saves it straight to R2.
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
              <div className="text-sm font-semibold text-primary">What you will do</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {action === "rebuild" ? <li>Reuse the current saved leagues if nothing changed</li> : null}
                <li>Enter your Sleeper username if you want to change the league selection</li>
                <li>Select the exact leagues and drafts to include</li>
                <li>Build and save with no extra preview step</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-background/30 p-4">
              {action === "rebuild" ? (
                <div className="rounded-2xl border border-border bg-background/40 p-4">
                  <div className="text-sm font-semibold text-primary">Reuse current leagues</div>
                  {checkingExisting ? (
                    <div className="mt-2 text-sm text-muted">Checking the saved draft selection...</div>
                  ) : canUseCurrentLeagues ? (
                    <>
                      <div className="mt-2 text-sm text-muted">
                        Found <span className="font-semibold text-primary">{existingSelectedKeys.length}</span> saved draft
                        selection{existingSelectedKeys.length === 1 ? "" : "s"}
                        {existingSourceUsername ? (
                          <>
                            {" "}
                            from <span className="font-semibold text-primary">{existingSourceUsername}</span>
                          </>
                        ) : null}
                        .
                      </div>
                      <button
                        type="button"
                        className={cls("btn btn-primary mt-4 w-full", regenerating ? "opacity-50" : "")}
                        disabled={regenerating}
                        onClick={regenerateWithCurrentLeagues}
                      >
                        {regenerating ? "Regenerating..." : "Regenerate with current leagues"}
                      </button>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-muted">
                      No reusable saved league selection exists for this mode yet. Use the manual flow below.
                    </div>
                  )}
                </div>
              ) : null}

              <form onSubmit={goNext} className={action === "rebuild" ? "mt-4" : ""}>
                <label className="block text-xs font-semibold text-muted">Sleeper Username</label>
                <input
                  className="input mt-2"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. stickyPicky"
                  autoComplete="off"
                />
                <div className="mt-2 text-xs text-muted">
                  Use this route when you want to re-pick the leagues instead of reusing the current saved selection.
                </div>

                {err ? <div className="mt-3 text-sm text-red-300">{err}</div> : null}
                {msg ? <div className="mt-3 text-sm text-muted">{msg}</div> : null}

                <button
                  type="submit"
                  className={cls("btn mt-4 w-full", canProceed ? "btn-primary" : "btn-primary opacity-50")}
                  disabled={!canProceed || regenerating}
                  title={canProceed ? "" : "Go back and fill in Order, Year, and Title for this mode first."}
                >
                  Continue to League Selection
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
